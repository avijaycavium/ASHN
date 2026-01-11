import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { 
  Bot, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Zap,
  Activity,
  BarChart3,
  RefreshCw,
  Play,
  Pause,
  PlayCircle,
  Radio,
  Gauge,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  Server,
  Network,
  Wrench,
  Sparkles,
  Brain,
  Search,
  Shield,
  CheckSquare,
  Filter,
  Layers
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Agent, AgentStatus, OrchestratorStatus, Device, SSEMessage } from "@shared/schema";
import { LineChart, Line, ResponsiveContainer } from "recharts";

const statusConfig: Record<AgentStatus, { color: string; bgColor: string; icon: React.ReactNode; label: string }> = {
  active: {
    color: "text-status-online",
    bgColor: "bg-status-online",
    icon: <Zap className="h-4 w-4" />,
    label: "Active",
  },
  processing: {
    color: "text-primary",
    bgColor: "bg-primary",
    icon: <Clock className="h-4 w-4 animate-spin" />,
    label: "Processing",
  },
  idle: {
    color: "text-muted-foreground",
    bgColor: "bg-muted",
    icon: <CheckCircle2 className="h-4 w-4" />,
    label: "Idle",
  },
  error: {
    color: "text-status-busy",
    bgColor: "bg-status-busy",
    icon: <AlertCircle className="h-4 w-4" />,
    label: "Error",
  },
  offline: {
    color: "text-status-offline",
    bgColor: "bg-status-offline",
    icon: <AlertCircle className="h-4 w-4" />,
    label: "Offline",
  },
};

interface TelemetryDataPoint {
  time: string;
  value: number;
}

interface DeviceTelemetry {
  deviceId: string;
  deviceName: string;
  tier: string;
  status: string;
  cpu: number;
  memory: number;
  cpuHistory: TelemetryDataPoint[];
  memoryHistory: TelemetryDataPoint[];
  lastUpdate: string;
}

interface AnomalyEvent {
  id: string;
  deviceId: string;
  deviceName: string;
  metric: string;
  value: number;
  threshold: number;
  severity: "low" | "medium" | "high" | "critical";
  timestamp: string;
  incidentId?: string;
}

// LangGraph Agent types (from Python agent framework - source of truth)
interface LangGraphAgentCapability {
  name: string;
  description: string;
}

interface LangGraphAgent {
  id: string;
  name: string;
  type: string;
  status: "active" | "idle" | "offline";
  description: string;
  capabilities: LangGraphAgentCapability[];
  tools: string[];
  usesAI: boolean;
  framework: string;
  lastActive?: string;
}

interface LangGraphAgentRegistry {
  connected: boolean;
  agents: LangGraphAgent[];
  totalAgents: number;
  activeWorkflows: number;
  framework: string;
  note?: string;
}

// MCP Tool types
interface MCPTool {
  id: string;
  name: string;
  description: string;
  status: "connected" | "simulated" | "disconnected";
  message: string;
  url?: string;
  enabled: boolean;
  capabilities: string[];
}

interface ToolsHealth {
  connected: boolean;
  tools: MCPTool[];
  summary: {
    total: number;
    connected: number;
    simulated: number;
    disconnected: number;
  };
}

// Unified agent type for display
interface UnifiedAgent {
  id: string;
  name: string;
  type: string;
  status: AgentStatus;
  description: string;
  capabilities: { name: string; description: string }[];
  tools?: string[];
  usesAI: boolean;
  framework: "langgraph" | "orchestrator";
  processedTasks?: number;
  successRate?: number;
  lastActive?: string;
}

type AgentFilter = "all" | "langgraph" | "orchestrator" | "ai" | "active";

function SparkChart({ data, color }: { data: TelemetryDataPoint[], color: string }) {
  if (!data || data.length < 2) return null;
  
  return (
    <div className="h-8 w-24">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line 
            type="monotone" 
            dataKey="value" 
            stroke={color} 
            strokeWidth={1.5} 
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function TrendIndicator({ current, previous }: { current: number, previous: number }) {
  const diff = current - previous;
  const pct = previous !== 0 ? ((diff / previous) * 100).toFixed(1) : "0";
  
  if (Math.abs(diff) < 2) {
    return <span className="flex items-center gap-1 text-xs text-muted-foreground"><Minus className="h-3 w-3" /> Stable</span>;
  }
  if (diff > 0) {
    return <span className="flex items-center gap-1 text-xs text-status-busy"><TrendingUp className="h-3 w-3" /> +{pct}%</span>;
  }
  return <span className="flex items-center gap-1 text-xs text-status-online"><TrendingDown className="h-3 w-3" /> {pct}%</span>;
}

// Get agent icon based on type
function getAgentIcon(type: string) {
  switch (type) {
    case "detection":
    case "anomaly":
      return <Search className="h-5 w-5" />;
    case "rca":
      return <Brain className="h-5 w-5" />;
    case "remediation":
      return <Shield className="h-5 w-5" />;
    case "verification":
      return <CheckSquare className="h-5 w-5" />;
    case "monitor":
      return <Activity className="h-5 w-5" />;
    case "telemetry":
      return <Gauge className="h-5 w-5" />;
    case "learning":
      return <Sparkles className="h-5 w-5" />;
    case "compliance":
      return <CheckCircle2 className="h-5 w-5" />;
    default:
      return <Bot className="h-5 w-5" />;
  }
}

export default function AgentsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("agents");
  const [agentFilter, setAgentFilter] = useState<AgentFilter>("all");
  const [telemetryData, setTelemetryData] = useState<Map<string, DeviceTelemetry>>(new Map());
  const [anomalyEvents, setAnomalyEvents] = useState<AnomalyEvent[]>([]);
  const [isSSEConnected, setIsSSEConnected] = useState(false);

  const { data: orchestratorStatus } = useQuery<OrchestratorStatus>({
    queryKey: ["/api/orchestrator/status"],
    refetchInterval: 5000,
  });

  const { data: devices } = useQuery<Device[]>({
    queryKey: ["/api/devices"],
    refetchInterval: 10000,
  });

  // Orchestrator agents from Node.js (includes operational metrics)
  const { data: orchestratorAgents, isLoading: orchestratorLoading, refetch: refetchOrchestrator } = useQuery<Agent[]>({
    queryKey: ["/api/orchestrator/agents"],
    refetchInterval: 5000,
  });

  // LangGraph agent registry from Python service (SOURCE OF TRUTH for healing pipeline)
  const { data: langGraphAgents, isLoading: langGraphLoading, refetch: refetchLangGraph } = useQuery<LangGraphAgentRegistry>({
    queryKey: ["/api/langgraph/agents"],
    refetchInterval: 10000,
  });

  // MCP tools health status
  const { data: toolsHealth, isLoading: toolsLoading } = useQuery<ToolsHealth>({
    queryKey: ["/api/tools/health"],
    refetchInterval: 15000,
  });

  // Merge agents: LangGraph takes precedence for healing pipeline roles
  // Orchestrator-only agents are included for operational visibility
  const unifiedAgents: UnifiedAgent[] = [];
  const langGraphTypes = new Set<string>();
  
  // First, add LangGraph agents (primary source for healing pipeline)
  if (langGraphAgents?.agents) {
    langGraphAgents.agents.forEach(agent => {
      langGraphTypes.add(agent.type);
      
      // Find matching orchestrator agent for enrichment
      const orchestratorMatch = orchestratorAgents?.find(oa => oa.type === agent.type);
      
      unifiedAgents.push({
        id: agent.id,
        name: agent.name,
        type: agent.type,
        status: agent.status,
        description: agent.description,
        capabilities: agent.capabilities,
        tools: agent.tools,
        usesAI: agent.usesAI,
        framework: "langgraph",
        lastActive: agent.lastActive,
        processedTasks: orchestratorMatch?.processedTasks,
        successRate: orchestratorMatch?.successRate,
      });
    });
  }
  
  // Add orchestrator-only agents (not in LangGraph - operational support agents)
  if (orchestratorAgents) {
    orchestratorAgents.forEach(agent => {
      // Skip if this type already exists from LangGraph
      if (langGraphTypes.has(agent.type)) return;
      
      // Build description from capabilities if available
      const description = agent.capabilities && agent.capabilities.length > 0
        ? agent.capabilities.map(c => c.description || c.name).slice(0, 2).join('. ')
        : `${agent.name} - ${agent.type} operations`;
      
      unifiedAgents.push({
        id: agent.id,
        name: agent.name,
        type: agent.type,
        status: agent.status as AgentStatus,
        description: description,
        capabilities: agent.capabilities || [],
        usesAI: agent.type === "anomaly" || agent.type === "learning", // These may use AI patterns
        framework: "orchestrator",
        lastActive: agent.lastActive,
        processedTasks: agent.processedTasks,
        successRate: agent.successRate,
      });
    });
  }

  // Filter agents based on selected filter
  const filteredAgents = unifiedAgents.filter(agent => {
    switch (agentFilter) {
      case "langgraph":
        return agent.framework === "langgraph";
      case "orchestrator":
        return agent.framework === "orchestrator";
      case "ai":
        return agent.usesAI;
      case "active":
        return agent.status === "active" || agent.status === "processing";
      default:
        return true;
    }
  });

  const refetchAgents = () => {
    refetchLangGraph();
    refetchOrchestrator();
  };

  // Initialize telemetry data from devices
  useEffect(() => {
    if (devices && devices.length > 0) {
      setTelemetryData(prev => {
        const updated = new Map(prev);
        devices.forEach(device => {
          const existing = updated.get(device.id);
          const now = new Date().toISOString();
          const newPoint = { time: now, value: device.cpu };
          const memPoint = { time: now, value: device.memory };
          
          updated.set(device.id, {
            deviceId: device.id,
            deviceName: device.name,
            tier: device.tier || "unknown",
            status: device.status,
            cpu: device.cpu,
            memory: device.memory,
            cpuHistory: existing?.cpuHistory ? [...existing.cpuHistory.slice(-19), newPoint] : [newPoint],
            memoryHistory: existing?.memoryHistory ? [...existing.memoryHistory.slice(-19), memPoint] : [memPoint],
            lastUpdate: now,
          });
        });
        return updated;
      });
    }
  }, [devices]);

  // Subscribe to SSE for real-time updates
  useEffect(() => {
    const eventSource = new EventSource("/api/stream/events");
    
    eventSource.onopen = () => {
      setIsSSEConnected(true);
    };
    
    eventSource.onmessage = (event) => {
      try {
        const message: SSEMessage = JSON.parse(event.data);
        
        if (message.type === "telemetry_update") {
          const { deviceId, metrics } = message.data as { deviceId: string; metrics: { cpu?: number; memory?: number } };
          setTelemetryData(prev => {
            const updated = new Map(prev);
            const existing = updated.get(deviceId);
            if (existing) {
              const now = new Date().toISOString();
              updated.set(deviceId, {
                ...existing,
                cpu: metrics.cpu ?? existing.cpu,
                memory: metrics.memory ?? existing.memory,
                cpuHistory: [...existing.cpuHistory.slice(-19), { time: now, value: metrics.cpu ?? existing.cpu }],
                memoryHistory: [...existing.memoryHistory.slice(-19), { time: now, value: metrics.memory ?? existing.memory }],
                lastUpdate: now,
              });
            }
            return updated;
          });
        }
        
        if (message.type === "anomaly_detected") {
          const anomaly = message.data as {
            deviceId: string;
            metric: string;
            value: number;
            threshold: number;
            anomalyType: string;
            timestamp: string;
          };
          
          const device = devices?.find(d => d.id === anomaly.deviceId);
          const newAnomaly: AnomalyEvent = {
            id: `anomaly-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            deviceId: anomaly.deviceId,
            deviceName: device?.name || anomaly.deviceId,
            metric: anomaly.metric,
            value: anomaly.value,
            threshold: anomaly.threshold,
            severity: anomaly.value > anomaly.threshold * 2 ? "critical" : 
                     anomaly.value > anomaly.threshold * 1.5 ? "high" : 
                     anomaly.value > anomaly.threshold * 1.2 ? "medium" : "low",
            timestamp: anomaly.timestamp,
          };
          
          setAnomalyEvents(prev => [newAnomaly, ...prev.slice(0, 99)]);
          
          toast({
            title: "Anomaly Detected",
            description: `${anomaly.metric} on ${device?.name || anomaly.deviceId}: ${anomaly.value} (threshold: ${anomaly.threshold})`,
            variant: "destructive",
          });
        }
        
        if (message.type === "device_status_changed") {
          const { deviceId, status } = message.data as { deviceId: string; status: string };
          setTelemetryData(prev => {
            const updated = new Map(prev);
            const existing = updated.get(deviceId);
            if (existing) {
              updated.set(deviceId, { ...existing, status });
            }
            return updated;
          });
        }
      } catch (e) {
        console.error("Failed to parse SSE message:", e);
      }
    };
    
    eventSource.onerror = () => {
      setIsSSEConnected(false);
    };
    
    return () => {
      eventSource.close();
    };
  }, [devices, toast]);

  const startOrchestrator = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/orchestrator/start");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orchestrator/status"] });
      toast({ title: "Orchestrator Started", description: "Agent orchestrator is now running" });
    },
  });

  const stopOrchestrator = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/orchestrator/stop");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orchestrator/status"] });
      toast({ title: "Orchestrator Stopped", description: "Agent orchestrator has been stopped" });
    },
  });

  const agentStats = {
    total: unifiedAgents.length,
    active: unifiedAgents.filter(a => a.status === "active" || a.status === "processing").length,
    idle: unifiedAgents.filter(a => a.status === "idle").length,
    offline: unifiedAgents.filter(a => a.status === "offline").length,
    aiPowered: unifiedAgents.filter(a => a.usesAI).length,
    langGraph: unifiedAgents.filter(a => a.framework === "langgraph").length,
    orchestrator: unifiedAgents.filter(a => a.framework === "orchestrator").length,
    avgSuccessRate: unifiedAgents.filter(a => a.successRate !== undefined).length > 0 
      ? Math.round(unifiedAgents.filter(a => a.successRate !== undefined).reduce((sum, a) => sum + (a.successRate || 0), 0) / unifiedAgents.filter(a => a.successRate !== undefined).length)
      : 0,
    totalTasks: unifiedAgents.reduce((sum, a) => sum + (a.processedTasks || 0), 0),
  };

  const isLoading = langGraphLoading || orchestratorLoading;

  const isRunning = orchestratorStatus?.status === "running";
  const telemetryArray = Array.from(telemetryData.values());
  const sortedTelemetry = [...telemetryArray].sort((a, b) => a.deviceName.localeCompare(b.deviceName));

  const telemetryStats = {
    totalDevices: telemetryArray.length,
    healthyDevices: telemetryArray.filter(d => d.status === "healthy").length,
    degradedDevices: telemetryArray.filter(d => d.status === "degraded").length,
    criticalDevices: telemetryArray.filter(d => d.status === "critical").length,
    avgCpu: telemetryArray.length ? Math.round(telemetryArray.reduce((sum, d) => sum + d.cpu, 0) / telemetryArray.length) : 0,
    avgMemory: telemetryArray.length ? Math.round(telemetryArray.reduce((sum, d) => sum + d.memory, 0) / telemetryArray.length) : 0,
  };

  const anomalyStats = {
    total: anomalyEvents.length,
    critical: anomalyEvents.filter(a => a.severity === "critical").length,
    high: anomalyEvents.filter(a => a.severity === "high").length,
    medium: anomalyEvents.filter(a => a.severity === "medium").length,
    low: anomalyEvents.filter(a => a.severity === "low").length,
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-4 p-4 border-b border-border bg-card/50">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Agent Orchestrator</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Autonomous agent management, telemetry collection, and anomaly surveillance
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={cn(
            "gap-1.5",
            langGraphAgents?.connected ? "bg-status-online text-white" : "bg-muted text-muted-foreground"
          )}>
            <Brain className="h-3 w-3" />
            {langGraphAgents?.connected ? "LangGraph Connected" : "LangGraph Offline"}
          </Badge>
          <Badge className={cn(
            "gap-1.5",
            isSSEConnected ? "bg-status-online text-white" : "bg-muted text-muted-foreground"
          )}>
            <Radio className="h-3 w-3" />
            {isSSEConnected ? "Live" : "Disconnected"}
          </Badge>
          <Badge className={cn(
            "gap-1.5",
            isRunning ? "bg-status-online text-white" : "bg-muted text-muted-foreground"
          )}>
            {isRunning ? <PlayCircle className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
            {isRunning ? "Running" : "Stopped"}
          </Badge>
          {isRunning ? (
            <Button 
              variant="outline" 
              size="sm"
              className="gap-1.5" 
              onClick={() => stopOrchestrator.mutate()}
              disabled={stopOrchestrator.isPending}
              data-testid="button-stop-orchestrator"
            >
              <Pause className="h-4 w-4" />
              Stop
            </Button>
          ) : (
            <Button 
              variant="default" 
              size="sm"
              className="gap-1.5" 
              onClick={() => startOrchestrator.mutate()}
              disabled={startOrchestrator.isPending}
              data-testid="button-start-orchestrator"
            >
              <Play className="h-4 w-4" />
              Start
            </Button>
          )}
          <Button 
            variant="outline" 
            size="sm"
            className="gap-1.5" 
            onClick={() => refetchAgents()}
            data-testid="button-refresh-agents"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <div className="border-b border-border bg-card/30 px-4">
          <TabsList className="h-auto p-0 bg-transparent">
            <TabsTrigger 
              value="agents" 
              className="gap-2 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-3"
              data-testid="tab-agents"
            >
              <Bot className="h-4 w-4" />
              Agents
              <Badge variant="outline" className="ml-1">{agentStats.total}</Badge>
            </TabsTrigger>
            <TabsTrigger 
              value="tools" 
              className="gap-2 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-3"
              data-testid="tab-tools"
            >
              <Wrench className="h-4 w-4" />
              MCP Tools
              <Badge 
                variant={toolsHealth?.summary?.connected ? "default" : "secondary"} 
                className="ml-1"
              >
                {toolsHealth?.summary?.connected || 0}/{toolsHealth?.summary?.total || 3}
              </Badge>
            </TabsTrigger>
            <TabsTrigger 
              value="telemetry" 
              className="gap-2 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-3"
              data-testid="tab-telemetry"
            >
              <Gauge className="h-4 w-4" />
              Telemetry
              <Badge variant="secondary" className="ml-1">{telemetryStats.totalDevices}</Badge>
            </TabsTrigger>
            <TabsTrigger 
              value="anomaly" 
              className="gap-2 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-3"
              data-testid="tab-anomaly"
            >
              <AlertTriangle className="h-4 w-4" />
              Anomalies
              {anomalyStats.total > 0 && (
                <Badge variant="destructive" className="ml-1">{anomalyStats.total}</Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Unified Agents Tab */}
        <TabsContent value="agents" className="flex-1 overflow-auto p-4 space-y-4 mt-0">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Agents</CardTitle>
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-semibold" data-testid="stat-total">{agentStats.total}</span>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-status-online animate-pulse" />
                  Active
                </CardTitle>
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-semibold text-status-online" data-testid="stat-active">{agentStats.active}</span>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-muted-foreground" />
                  Idle
                </CardTitle>
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-semibold text-muted-foreground" data-testid="stat-idle">{agentStats.idle}</span>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-status-offline" />
                  Offline
                </CardTitle>
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-semibold text-status-offline" data-testid="stat-offline">{agentStats.offline}</span>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Sparkles className="h-3 w-3" />
                  AI-Powered
                </CardTitle>
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-semibold" data-testid="stat-ai">{agentStats.aiPowered}</span>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Activity className="h-3 w-3" />
                  Active Workflows
                </CardTitle>
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-semibold" data-testid="stat-workflows">{langGraphAgents?.activeWorkflows || 0}</span>
              </CardContent>
            </Card>
          </div>

          {/* Filter Chips */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Filter className="h-4 w-4" />
              Filter:
            </span>
            <Button
              variant={agentFilter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setAgentFilter("all")}
              data-testid="filter-all"
            >
              All ({unifiedAgents.length})
            </Button>
            <Button
              variant={agentFilter === "langgraph" ? "default" : "outline"}
              size="sm"
              onClick={() => setAgentFilter("langgraph")}
              className="gap-1"
              data-testid="filter-langgraph"
            >
              <Brain className="h-3 w-3" />
              LangGraph ({agentStats.langGraph})
            </Button>
            <Button
              variant={agentFilter === "orchestrator" ? "default" : "outline"}
              size="sm"
              onClick={() => setAgentFilter("orchestrator")}
              className="gap-1"
              data-testid="filter-orchestrator"
            >
              <Layers className="h-3 w-3" />
              Orchestrator ({agentStats.orchestrator})
            </Button>
            <Button
              variant={agentFilter === "ai" ? "default" : "outline"}
              size="sm"
              onClick={() => setAgentFilter("ai")}
              className="gap-1"
              data-testid="filter-ai"
            >
              <Sparkles className="h-3 w-3" />
              AI-Powered ({agentStats.aiPowered})
            </Button>
            <Button
              variant={agentFilter === "active" ? "default" : "outline"}
              size="sm"
              onClick={() => setAgentFilter("active")}
              data-testid="filter-active"
            >
              Active ({agentStats.active})
            </Button>
          </div>

          {/* Connection Status */}
          {!langGraphAgents?.connected && (
            <Card className="border-dashed border-2 bg-muted/20">
              <CardContent className="flex items-center gap-4 py-4">
                <AlertCircle className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Python Agent Server Offline</p>
                  <p className="text-xs text-muted-foreground">
                    {langGraphAgents?.note || "Start the agent server on port 5001 for live status. Showing cached data."}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Agent Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-64" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredAgents.map((agent) => {
                const config = statusConfig[agent.status];
                const statusColor = agent.status === "active" ? "bg-status-online" :
                                   agent.status === "idle" ? "bg-muted" : "bg-status-offline";
                
                return (
                  <Card key={agent.id} className="hover-elevate" data-testid={`agent-card-${agent.id}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "h-12 w-12 rounded-md flex items-center justify-center text-white",
                            agent.status === "active" ? "bg-primary" : "bg-muted-foreground"
                          )}>
                            {getAgentIcon(agent.type)}
                          </div>
                          <div>
                            <CardTitle className="text-base flex items-center gap-2">
                              {agent.name}
                              {agent.usesAI && (
                                <Badge variant="outline" className="text-xs gap-1">
                                  <Sparkles className="h-3 w-3" />
                                  AI
                                </Badge>
                              )}
                            </CardTitle>
                            <div className="flex items-center gap-2 mt-0.5">
                              <Badge variant="secondary" className="text-xs gap-1">
                                <Layers className="h-3 w-3" />
                                {agent.framework === "langgraph" ? "LangGraph" : "Orchestrator"}
                              </Badge>
                              <span className="text-xs text-muted-foreground">{agent.type}</span>
                            </div>
                          </div>
                        </div>
                        <Badge 
                          variant={agent.status === "active" ? "default" : "secondary"}
                          className={cn("capitalize", agent.status === "offline" && "bg-status-offline")}
                        >
                          <span className={cn("h-2 w-2 rounded-full mr-1.5", statusColor)} />
                          {agent.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        {agent.description}
                      </p>
                      
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2">Capabilities</p>
                        <div className="flex flex-wrap gap-1.5">
                          {agent.capabilities.slice(0, 4).map((cap) => (
                            <Badge key={cap.name} variant="outline" className="text-xs">
                              {cap.name.replace(/_/g, ' ')}
                            </Badge>
                          ))}
                          {agent.capabilities.length > 4 && (
                            <Badge variant="outline" className="text-xs">
                              +{agent.capabilities.length - 4} more
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      {agent.tools && agent.tools.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-2">Tools</p>
                          <div className="flex flex-wrap gap-1.5">
                            {agent.tools.map((tool) => (
                              <Badge key={tool} variant="secondary" className="text-xs gap-1">
                                <Wrench className="h-3 w-3" />
                                {tool}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Operational Metrics */}
                      {(agent.processedTasks !== undefined || agent.successRate !== undefined) && (
                        <div className="flex items-center gap-4 pt-2 border-t border-border">
                          {agent.processedTasks !== undefined && (
                            <div className="flex items-center gap-1.5">
                              <Activity className="h-3 w-3 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">
                                {agent.processedTasks} tasks
                              </span>
                            </div>
                          )}
                          {agent.successRate !== undefined && (
                            <div className="flex items-center gap-1.5">
                              <BarChart3 className="h-3 w-3 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">
                                {agent.successRate}% success
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {filteredAgents.length === 0 && !isLoading && (
            <Card className="border-dashed border-2">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Bot className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground">No agents match the current filter</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* MCP Tools Tab */}
        <TabsContent value="tools" className="flex-1 overflow-auto p-4 space-y-4 mt-0">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Badge 
                variant={toolsHealth?.connected ? "default" : "secondary"}
                className="gap-1"
              >
                <Radio className={cn("h-3 w-3", toolsHealth?.connected && "animate-pulse")} />
                {toolsHealth?.connected ? "Agent Server Connected" : "Agent Server Disconnected"}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {toolsHealth?.summary?.connected || 0} of {toolsHealth?.summary?.total || 3} tools connected
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-status-online" />
                  Connected
                </CardTitle>
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-semibold text-status-online">
                  {toolsHealth?.summary?.connected || 0}
                </span>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-status-away" />
                  Simulated
                </CardTitle>
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-semibold text-status-away">
                  {toolsHealth?.summary?.simulated || 0}
                </span>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-status-offline" />
                  Disconnected
                </CardTitle>
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-semibold text-status-offline">
                  {toolsHealth?.summary?.disconnected || 0}
                </span>
              </CardContent>
            </Card>
          </div>

          {toolsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {toolsHealth?.tools?.map((tool) => {
                const toolIcon = tool.id === "gns3" ? <Network className="h-6 w-6" /> :
                                tool.id === "prometheus" ? <Activity className="h-6 w-6" /> :
                                <Server className="h-6 w-6" />;
                const statusColor = tool.status === "connected" ? "text-status-online" :
                                   tool.status === "simulated" ? "text-status-away" : "text-status-offline";
                const statusBg = tool.status === "connected" ? "bg-status-online/10" :
                                tool.status === "simulated" ? "bg-status-away/10" : "bg-status-offline/10";
                
                return (
                  <Card key={tool.id} data-testid={`tool-${tool.id}`}>
                    <CardContent className="py-4">
                      <div className="flex items-start gap-4">
                        <div className={cn("h-12 w-12 rounded-md flex items-center justify-center", statusBg, statusColor)}>
                          {toolIcon}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium">{tool.name}</h3>
                              <Badge 
                                variant={tool.status === "connected" ? "default" : "secondary"}
                                className={cn("capitalize text-xs", statusColor)}
                              >
                                {tool.status}
                              </Badge>
                              {!tool.enabled && (
                                <Badge variant="outline" className="text-xs">Disabled</Badge>
                              )}
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{tool.description}</p>
                          <p className="text-xs text-muted-foreground mt-2">
                            <span className={statusColor}>{tool.message}</span>
                            {tool.url && <span className="ml-2 font-mono">{tool.url}</span>}
                          </p>
                          <div className="flex flex-wrap gap-1.5 mt-3">
                            {tool.capabilities.map((cap, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">{cap}</Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Telemetry Tab */}
        <TabsContent value="telemetry" className="flex-1 overflow-auto p-4 space-y-4 mt-0">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Devices</CardTitle>
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-semibold">{telemetryStats.totalDevices}</span>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-status-online" />
                  Healthy
                </CardTitle>
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-semibold text-status-online">{telemetryStats.healthyDevices}</span>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-status-away" />
                  Degraded
                </CardTitle>
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-semibold text-status-away">{telemetryStats.degradedDevices}</span>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-status-busy" />
                  Critical
                </CardTitle>
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-semibold text-status-busy">{telemetryStats.criticalDevices}</span>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Avg CPU</CardTitle>
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-semibold">{telemetryStats.avgCpu}%</span>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Avg Memory</CardTitle>
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-semibold">{telemetryStats.avgMemory}%</span>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Gauge className="h-4 w-4" />
                Device Telemetry
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {sortedTelemetry.map((device) => {
                    const statusColor = device.status === "healthy" ? "text-status-online" :
                                       device.status === "degraded" ? "text-status-away" : "text-status-busy";
                    const cpuPrev = device.cpuHistory.length > 1 ? device.cpuHistory[device.cpuHistory.length - 2].value : device.cpu;
                    const memPrev = device.memoryHistory.length > 1 ? device.memoryHistory[device.memoryHistory.length - 2].value : device.memory;
                    
                    return (
                      <div key={device.deviceId} className="flex items-center justify-between p-3 rounded-md bg-muted/30 hover-elevate">
                        <div className="flex items-center gap-3">
                          <Server className={cn("h-5 w-5", statusColor)} />
                          <div>
                            <p className="font-medium text-sm">{device.deviceName}</p>
                            <p className="text-xs text-muted-foreground">{device.tier}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <p className="text-sm font-medium">CPU: {device.cpu}%</p>
                            <TrendIndicator current={device.cpu} previous={cpuPrev} />
                          </div>
                          <SparkChart data={device.cpuHistory} color="hsl(var(--primary))" />
                          <div className="text-right">
                            <p className="text-sm font-medium">Mem: {device.memory}%</p>
                            <TrendIndicator current={device.memory} previous={memPrev} />
                          </div>
                          <SparkChart data={device.memoryHistory} color="hsl(var(--status-away))" />
                          <Badge variant={device.status === "healthy" ? "default" : "destructive"} className="capitalize">
                            {device.status}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                  {sortedTelemetry.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No telemetry data available
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Anomaly Tab */}
        <TabsContent value="anomaly" className="flex-1 overflow-auto p-4 space-y-4 mt-0">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Anomalies</CardTitle>
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-semibold">{anomalyStats.total}</span>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-status-busy" />
                  Critical
                </CardTitle>
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-semibold text-status-busy">{anomalyStats.critical}</span>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-orange-500" />
                  High
                </CardTitle>
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-semibold text-orange-500">{anomalyStats.high}</span>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-status-away" />
                  Medium
                </CardTitle>
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-semibold text-status-away">{anomalyStats.medium}</span>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-muted-foreground" />
                  Low
                </CardTitle>
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-semibold">{anomalyStats.low}</span>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Recent Anomalies
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {anomalyEvents.length > 0 ? (
                  <div className="space-y-2">
                    {anomalyEvents.map((anomaly) => {
                      const severityColor = anomaly.severity === "critical" ? "text-status-busy bg-status-busy/10" :
                                           anomaly.severity === "high" ? "text-orange-500 bg-orange-500/10" :
                                           anomaly.severity === "medium" ? "text-status-away bg-status-away/10" : 
                                           "text-muted-foreground bg-muted";
                      
                      return (
                        <div key={anomaly.id} className={cn("flex items-center justify-between p-3 rounded-md", severityColor)}>
                          <div className="flex items-center gap-3">
                            <AlertTriangle className="h-5 w-5" />
                            <div>
                              <p className="font-medium text-sm">{anomaly.deviceName}</p>
                              <p className="text-xs">{anomaly.metric}: {anomaly.value} (threshold: {anomaly.threshold})</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge variant="outline" className="capitalize">{anomaly.severity}</Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(anomaly.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No anomalies detected</p>
                    <p className="text-xs mt-1">Anomalies will appear here when detected via SSE</p>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
