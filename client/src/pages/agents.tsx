import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useState, useCallback } from "react";
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
  Cpu,
  MemoryStick,
  Network,
  Link2,
  Eye
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
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";

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

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

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

export default function AgentsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("agents");
  const [telemetryData, setTelemetryData] = useState<Map<string, DeviceTelemetry>>(new Map());
  const [anomalyEvents, setAnomalyEvents] = useState<AnomalyEvent[]>([]);
  const [isSSEConnected, setIsSSEConnected] = useState(false);
  
  const { data: agents, isLoading: agentsLoading, refetch: refetchAgents } = useQuery<Agent[]>({
    queryKey: ["/api/orchestrator/agents"],
    refetchInterval: 5000,
  });

  const { data: orchestratorStatus } = useQuery<OrchestratorStatus>({
    queryKey: ["/api/orchestrator/status"],
    refetchInterval: 5000,
  });

  const { data: devices } = useQuery<Device[]>({
    queryKey: ["/api/devices"],
    refetchInterval: 10000,
  });

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

  const stats = {
    total: agents?.length || 0,
    active: agents?.filter(a => a.status === "active" || a.status === "processing").length || 0,
    idle: agents?.filter(a => a.status === "idle").length || 0,
    error: agents?.filter(a => a.status === "error").length || 0,
    avgSuccessRate: agents?.length 
      ? Math.round(agents.reduce((sum, a) => sum + a.successRate, 0) / agents.length) 
      : 0,
    totalTasks: agents?.reduce((sum, a) => sum + a.processedTasks, 0) || 0,
  };

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
            </TabsTrigger>
            <TabsTrigger 
              value="telemetry" 
              className="gap-2 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-3"
              data-testid="tab-telemetry"
            >
              <Gauge className="h-4 w-4" />
              Telemetry Operations
              <Badge variant="secondary" className="ml-1">{telemetryStats.totalDevices}</Badge>
            </TabsTrigger>
            <TabsTrigger 
              value="anomaly" 
              className="gap-2 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-3"
              data-testid="tab-anomaly"
            >
              <AlertTriangle className="h-4 w-4" />
              Anomaly Surveillance
              {anomalyStats.total > 0 && (
                <Badge variant="destructive" className="ml-1">{anomalyStats.total}</Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="agents" className="flex-1 overflow-auto p-4 space-y-4 mt-0">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Agents</CardTitle>
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-semibold" data-testid="stat-total">{stats.total}</span>
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
                <span className="text-2xl font-semibold text-status-online" data-testid="stat-active">{stats.active}</span>
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
                <span className="text-2xl font-semibold text-muted-foreground" data-testid="stat-idle">{stats.idle}</span>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-status-busy" />
                  Error
                </CardTitle>
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-semibold text-status-busy" data-testid="stat-error">{stats.error}</span>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <BarChart3 className="h-3 w-3" />
                  Avg Success
                </CardTitle>
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-semibold" data-testid="stat-success">{stats.avgSuccessRate}%</span>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Activity className="h-3 w-3" />
                  Tasks Processed
                </CardTitle>
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-semibold" data-testid="stat-tasks">{stats.totalTasks}</span>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {agentsLoading ? (
              [...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-48" />
              ))
            ) : (
              agents?.map((agent) => {
                const config = statusConfig[agent.status];
                return (
                  <Card key={agent.id} className="hover-elevate" data-testid={`agent-card-${agent.id}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "h-10 w-10 rounded-md flex items-center justify-center",
                            agent.status === "active" || agent.status === "processing" 
                              ? "bg-primary/10" 
                              : "bg-muted"
                          )}>
                            <Bot className={cn("h-5 w-5", config.color)} />
                          </div>
                          <div>
                            <CardTitle className="text-base">{agent.name}</CardTitle>
                            <p className="text-xs text-muted-foreground mt-0.5">{agent.type}</p>
                          </div>
                        </div>
                        <Badge className={cn(
                          "gap-1",
                          agent.status === "active" && "bg-status-online text-white",
                          agent.status === "processing" && "bg-primary text-primary-foreground",
                          agent.status === "idle" && "bg-muted text-muted-foreground",
                          agent.status === "error" && "bg-status-busy text-white",
                          agent.status === "offline" && "bg-status-offline text-white"
                        )}>
                          {config.icon}
                          {config.label}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {agent.currentTask && (
                        <div className="p-2 rounded-md bg-muted/50">
                          <p className="text-xs text-muted-foreground mb-1">Current Task</p>
                          <p className="text-sm">{agent.currentTask}</p>
                        </div>
                      )}
                      
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Success Rate</span>
                          <span className="font-mono">{agent.successRate}%</span>
                        </div>
                        <Progress value={agent.successRate} className="h-1.5" />
                      </div>

                      <div className="flex items-center justify-between text-sm pt-2 border-t border-border">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Activity className="h-3 w-3" />
                          <span>{agent.processedTasks} tasks</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          Last active: {formatTimeAgo(agent.lastActive)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </TabsContent>

        <TabsContent value="telemetry" className="flex-1 overflow-hidden mt-0">
          <div className="h-full flex flex-col p-4 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Server className="h-3 w-3" />
                    Monitored Devices
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <span className="text-2xl font-semibold" data-testid="telemetry-total">{telemetryStats.totalDevices}</span>
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
                  <span className="text-2xl font-semibold text-status-online" data-testid="telemetry-healthy">{telemetryStats.healthyDevices}</span>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-yellow-500" />
                    Degraded
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <span className="text-2xl font-semibold text-yellow-500" data-testid="telemetry-degraded">{telemetryStats.degradedDevices}</span>
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
                  <span className="text-2xl font-semibold text-status-busy" data-testid="telemetry-critical">{telemetryStats.criticalDevices}</span>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Cpu className="h-3 w-3" />
                    Avg CPU
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <span className="text-2xl font-semibold" data-testid="telemetry-avgcpu">{telemetryStats.avgCpu}%</span>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <MemoryStick className="h-3 w-3" />
                    Avg Memory
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <span className="text-2xl font-semibold" data-testid="telemetry-avgmem">{telemetryStats.avgMemory}%</span>
                </CardContent>
              </Card>
            </div>

            <Card className="flex-1 overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Live Device Telemetry
                  <Badge variant="outline" className="ml-2">Real-time</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 h-[calc(100%-4rem)]">
                <ScrollArea className="h-full">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-background border-b border-border">
                        <tr>
                          <th className="text-left p-3 font-medium text-muted-foreground">Device</th>
                          <th className="text-left p-3 font-medium text-muted-foreground">Tier</th>
                          <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                          <th className="text-left p-3 font-medium text-muted-foreground">CPU</th>
                          <th className="text-left p-3 font-medium text-muted-foreground">CPU Trend</th>
                          <th className="text-left p-3 font-medium text-muted-foreground">Memory</th>
                          <th className="text-left p-3 font-medium text-muted-foreground">Memory Trend</th>
                          <th className="text-left p-3 font-medium text-muted-foreground">Last Update</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedTelemetry.map((device) => {
                          const prevCpu = device.cpuHistory.length > 1 ? device.cpuHistory[device.cpuHistory.length - 2].value : device.cpu;
                          const prevMem = device.memoryHistory.length > 1 ? device.memoryHistory[device.memoryHistory.length - 2].value : device.memory;
                          
                          return (
                            <tr 
                              key={device.deviceId} 
                              className="border-b border-border last:border-0 hover-elevate"
                              data-testid={`telemetry-row-${device.deviceId}`}
                            >
                              <td className="p-3">
                                <div className="flex items-center gap-2">
                                  <Server className="h-4 w-4 text-muted-foreground" />
                                  <span className="font-mono text-xs">{device.deviceName}</span>
                                </div>
                              </td>
                              <td className="p-3">
                                <Badge variant="outline" className="font-mono text-xs uppercase">
                                  {device.tier}
                                </Badge>
                              </td>
                              <td className="p-3">
                                <Badge className={cn(
                                  device.status === "healthy" && "bg-status-online text-white",
                                  device.status === "degraded" && "bg-yellow-500 text-white",
                                  device.status === "critical" && "bg-status-busy text-white",
                                  device.status === "offline" && "bg-status-offline text-white"
                                )}>
                                  {device.status}
                                </Badge>
                              </td>
                              <td className="p-3">
                                <div className="flex items-center gap-2">
                                  <Progress 
                                    value={device.cpu} 
                                    className={cn(
                                      "h-2 w-16",
                                      device.cpu > 80 && "[&>div]:bg-status-busy",
                                      device.cpu > 60 && device.cpu <= 80 && "[&>div]:bg-yellow-500"
                                    )}
                                  />
                                  <span className="font-mono text-xs w-10">{device.cpu}%</span>
                                </div>
                              </td>
                              <td className="p-3">
                                <div className="flex items-center gap-2">
                                  <SparkChart data={device.cpuHistory} color="hsl(var(--primary))" />
                                  <TrendIndicator current={device.cpu} previous={prevCpu} />
                                </div>
                              </td>
                              <td className="p-3">
                                <div className="flex items-center gap-2">
                                  <Progress 
                                    value={device.memory} 
                                    className={cn(
                                      "h-2 w-16",
                                      device.memory > 80 && "[&>div]:bg-status-busy",
                                      device.memory > 60 && device.memory <= 80 && "[&>div]:bg-yellow-500"
                                    )}
                                  />
                                  <span className="font-mono text-xs w-10">{device.memory}%</span>
                                </div>
                              </td>
                              <td className="p-3">
                                <div className="flex items-center gap-2">
                                  <SparkChart data={device.memoryHistory} color="hsl(var(--chart-2))" />
                                  <TrendIndicator current={device.memory} previous={prevMem} />
                                </div>
                              </td>
                              <td className="p-3 text-xs text-muted-foreground">
                                {formatTimeAgo(device.lastUpdate)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="anomaly" className="flex-1 overflow-hidden mt-0">
          <div className="h-full flex flex-col p-4 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Eye className="h-3 w-3" />
                    Total Anomalies
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <span className="text-2xl font-semibold" data-testid="anomaly-total">{anomalyStats.total}</span>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-status-busy animate-pulse" />
                    Critical
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <span className="text-2xl font-semibold text-status-busy" data-testid="anomaly-critical">{anomalyStats.critical}</span>
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
                  <span className="text-2xl font-semibold text-orange-500" data-testid="anomaly-high">{anomalyStats.high}</span>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-yellow-500" />
                    Medium
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <span className="text-2xl font-semibold text-yellow-500" data-testid="anomaly-medium">{anomalyStats.medium}</span>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-blue-500" />
                    Low
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <span className="text-2xl font-semibold text-blue-500" data-testid="anomaly-low">{anomalyStats.low}</span>
                </CardContent>
              </Card>
            </div>

            <Card className="flex-1 overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Anomaly Events
                  <Badge variant="outline" className="ml-2">Live Feed</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 h-[calc(100%-4rem)]">
                <ScrollArea className="h-full">
                  {anomalyEvents.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                      <CheckCircle2 className="h-12 w-12 mb-4 opacity-50" />
                      <p className="text-sm">No anomalies detected</p>
                      <p className="text-xs mt-1">System is operating within normal parameters</p>
                    </div>
                  ) : (
                    <div className="space-y-2 p-4">
                      {anomalyEvents.map((anomaly) => (
                        <div 
                          key={anomaly.id}
                          className={cn(
                            "p-3 rounded-md border",
                            anomaly.severity === "critical" && "border-status-busy bg-status-busy/5",
                            anomaly.severity === "high" && "border-orange-500 bg-orange-500/5",
                            anomaly.severity === "medium" && "border-yellow-500 bg-yellow-500/5",
                            anomaly.severity === "low" && "border-blue-500 bg-blue-500/5"
                          )}
                          data-testid={`anomaly-event-${anomaly.id}`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3">
                              <AlertTriangle className={cn(
                                "h-5 w-5 mt-0.5",
                                anomaly.severity === "critical" && "text-status-busy",
                                anomaly.severity === "high" && "text-orange-500",
                                anomaly.severity === "medium" && "text-yellow-500",
                                anomaly.severity === "low" && "text-blue-500"
                              )} />
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{anomaly.deviceName}</span>
                                  <Badge variant="outline" className="text-xs uppercase">{anomaly.severity}</Badge>
                                </div>
                                <p className="text-sm text-muted-foreground mt-1">
                                  <span className="font-mono">{anomaly.metric}</span>: {anomaly.value} 
                                  <span className="text-xs ml-1">(threshold: {anomaly.threshold})</span>
                                </p>
                                {anomaly.incidentId && (
                                  <Badge variant="secondary" className="mt-2 text-xs">
                                    <Link2 className="h-3 w-3 mr-1" />
                                    {anomaly.incidentId}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {formatTimeAgo(anomaly.timestamp)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
