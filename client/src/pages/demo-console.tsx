import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  Link2Off, 
  Gauge, 
  Cpu, 
  Play, 
  RotateCcw,
  CheckCircle2,
  Search,
  Bot,
  Wrench,
  Shield,
  AlertCircle,
  Loader2,
  Zap,
  TrendingUp,
  TrendingDown,
  Activity,
  AlertTriangle,
  Clock,
  Target,
  List,
  ArrowRight,
  CheckCircle,
  XCircle,
  Server,
  Flame,
  X
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Device } from "@shared/schema";

const faultTypes = [
  { id: "cpu_spike", label: "CPU Spike", description: "Simulate high CPU utilization" },
  { id: "memory_exhaustion", label: "Memory Exhaustion", description: "Simulate high memory usage" },
  { id: "link_flap", label: "Link Flap", description: "Simulate port state oscillation" },
  { id: "bgp_instability", label: "BGP Instability", description: "Simulate BGP session issues" },
  { id: "packet_drops", label: "Packet Drops", description: "Simulate high packet drop rate" },
  { id: "latency_spike", label: "Latency Spike", description: "Simulate increased latency" },
];

const severityLevels = [
  { id: "low", label: "Low", color: "bg-status-away" },
  { id: "medium", label: "Medium", color: "bg-orange-500" },
  { id: "high", label: "High", color: "bg-status-busy" },
  { id: "critical", label: "Critical", color: "bg-red-700" },
];

interface MetricDetail {
  baseline?: string;
  current?: string;
  threshold?: string;
  status?: string;
  deviation?: string;
}

interface EventDetails {
  metrics?: Record<string, MetricDetail>;
  confidence?: number;
  method?: string;
  hypothesis?: string;
  evidence?: string[];
  affectedDevices?: string[];
  action?: string;
  result?: string;
  comparison?: Record<string, { before: string; after: string; improvement: string }>;
}

interface DemoEvent {
  stage: string;
  event: string;
  timestamp: string;
  agent: string;
  details?: EventDetails;
}

interface StageDetails {
  detection?: {
    ttd: number;
    method: string;
    anomalyType: string;
    confidence: number;
    metrics: Record<string, { baseline: string; current: string; deviation: string }>;
  };
  diagnosis?: {
    rootCause: string;
    confidence: number;
    hypothesis: string;
    evidence: string[];
    affectedDevices: string[];
    alternateRoutes?: number;
  };
  remediation?: {
    plan: string[];
    estimatedTime: string;
    riskLevel: string;
    rollbackPlan: string;
    policyCheck: string;
  };
  verification?: {
    ttr: number;
    tttr: number;
    successCriteria: Array<{ criterion: string; met: boolean }>;
    metricsComparison: Record<string, { before: string; after: string; improvement: string }>;
  };
}

interface DemoScenarioStatus {
  active: boolean;
  type: string | null;
  stage: "idle" | "detection" | "diagnosis" | "remediation" | "verification" | "resolved";
  incidentId: string | null;
  startedAt: string | null;
  events: DemoEvent[];
  deviceId: string | null;
  targetDeviceId: string | null;
  stageDetails: StageDetails;
}

const scenarios = [
  {
    id: "bgp_link_flap",
    title: "BGP Link Flap Detection & Auto Reroute",
    description: "Simulate port state oscillation on Switch-A1:port2 (primary A1-C link). Agents detect flaps via PromQL, perform RCA, and execute remediation (port shutdown or BGP reweight) with traffic rerouting via Switch-B backup path.",
    icon: <Link2Off className="h-5 w-5" />,
    color: "text-status-busy",
    expectedDuration: "TTD <30s, TTR <60s, TTTR <120s",
    metrics: ["switch_port_oper_status", "switch_bgp_peer_state", "switch_bgp_updates_received", "switch_port_bytes_in"],
  },
  {
    id: "bgp_session_instability",
    title: "BGP Session Instability & Weight Adjustment",
    description: "Simulate BGP peer state oscillation caused by underlying link flap. Agents detect update storms, reweight neighbor preferences to shift traffic to backup peer.",
    icon: <Gauge className="h-5 w-5" />,
    color: "text-status-away",
    expectedDuration: "TTD <30s, TTR <45s, TTTR <90s",
    metrics: ["switch_bgp_peer_state", "switch_bgp_updates_received", "switch_port_bytes_out"],
  },
  {
    id: "traffic_drop",
    title: "Traffic Drop Detection & Backup Path Activation",
    description: "Simulate traffic drop on primary path. Agents correlate with link flap, activate backup path via Switch-B, and verify E2E connectivity with latency monitoring.",
    icon: <Cpu className="h-5 w-5" />,
    color: "text-primary",
    expectedDuration: "TTD <30s, TTR <60s, TTTR <120s",
    metrics: ["switch_port_bytes_in", "switch_port_bytes_out", "switch_bgp_peer_state"],
  },
];

const stageConfig = {
  idle: { label: "Ready", color: "bg-muted", icon: null },
  detection: { label: "Detection", color: "bg-status-away", icon: <Search className="h-4 w-4" /> },
  diagnosis: { label: "Diagnosis", color: "bg-primary", icon: <Bot className="h-4 w-4" /> },
  remediation: { label: "Remediation", color: "bg-orange-500", icon: <Wrench className="h-4 w-4" /> },
  verification: { label: "Verification", color: "bg-status-online", icon: <Shield className="h-4 w-4" /> },
  resolved: { label: "Resolved", color: "bg-status-online", icon: <CheckCircle2 className="h-4 w-4" /> },
};

interface ActiveFault {
  deviceId: string;
  faultType: string;
  severity: string;
}

function NodeFaultInjectionPanel({ devices }: { devices: Device[] }) {
  const [selectedDevice, setSelectedDevice] = useState<string>("");
  const [faultType, setFaultType] = useState<string>("cpu_spike");
  const [severity, setSeverity] = useState<string>("medium");
  const [duration, setDuration] = useState<string>("");
  const { toast } = useToast();

  const groupedDevices = {
    core: devices.filter(d => d.type === 'core'),
    spine: devices.filter(d => d.type === 'spine'),
    tor: devices.filter(d => d.type === 'tor'),
    endpoint: devices.filter(d => d.type === 'endpoint'),
  };

  const { data: activeFaults = [], refetch: refetchFaults } = useQuery<ActiveFault[]>({
    queryKey: ["/api/faults/active"],
    refetchInterval: 5000,
  });

  const injectMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/faults/inject", {
        deviceId: selectedDevice,
        faultType,
        severity,
        duration: duration ? parseInt(duration) : undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Fault Injected",
        description: `Successfully injected ${faultType.replace(/_/g, " ")} on ${devices.find(d => d.id === selectedDevice)?.name || selectedDevice}`,
      });
      refetchFaults();
      queryClient.invalidateQueries({ queryKey: ["/api/devices"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Injection Failed",
        description: error.message || "Failed to inject fault. Please try again.",
        variant: "destructive",
      });
    },
  });

  const resetMutation = useMutation({
    mutationFn: async (deviceId: string) => {
      const res = await apiRequest("POST", "/api/faults/reset", { deviceId });
      return res.json();
    },
    onSuccess: (_, deviceId) => {
      toast({
        title: "Fault Cleared",
        description: `Successfully cleared fault on ${devices.find(d => d.id === deviceId)?.name || deviceId}`,
      });
      refetchFaults();
      queryClient.invalidateQueries({ queryKey: ["/api/devices"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Reset Failed",
        description: error.message || "Failed to clear fault. Please try again.",
        variant: "destructive",
      });
    },
  });

  const selectedDeviceInfo = devices.find(d => d.id === selectedDevice);
  const selectedDeviceHasFault = activeFaults.some(f => f.deviceId === selectedDevice);

  return (
    <Card className="border-orange-500/30">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-md bg-orange-500/10 flex items-center justify-center">
            <Flame className="h-5 w-5 text-orange-500" />
          </div>
          <div>
            <CardTitle className="text-base">Node Fault Injection</CardTitle>
            <CardDescription>Manually inject faults into specific network nodes</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label htmlFor="device-select">Target Device</Label>
            <Select value={selectedDevice} onValueChange={setSelectedDevice}>
              <SelectTrigger id="device-select" data-testid="select-fault-device">
                <SelectValue placeholder="Select a device" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(groupedDevices).map(([type, devs]) => (
                  devs.length > 0 && (
                    <div key={type}>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase">
                        {type} ({devs.length})
                      </div>
                      {devs.map(device => (
                        <SelectItem key={device.id} value={device.id}>
                          <div className="flex items-center gap-2">
                            <Server className="h-3 w-3" />
                            {device.name}
                          </div>
                        </SelectItem>
                      ))}
                    </div>
                  )
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fault-type-select">Fault Type</Label>
            <Select value={faultType} onValueChange={setFaultType}>
              <SelectTrigger id="fault-type-select" data-testid="select-fault-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {faultTypes.map(ft => (
                  <SelectItem key={ft.id} value={ft.id}>
                    {ft.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="severity-select">Severity</Label>
            <Select value={severity} onValueChange={setSeverity}>
              <SelectTrigger id="severity-select" data-testid="select-fault-severity">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {severityLevels.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    <div className="flex items-center gap-2">
                      <div className={cn("h-2 w-2 rounded-full", s.color)} />
                      {s.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="duration-input">Duration (seconds)</Label>
            <Input
              id="duration-input"
              type="number"
              placeholder="Auto-clear after..."
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              min="1"
              max="3600"
              data-testid="input-fault-duration"
            />
          </div>
        </div>

        {selectedDeviceInfo && (
          <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-md">
            <Server className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">
              <strong>{selectedDeviceInfo.name}</strong> ({selectedDeviceInfo.type}) - 
              Status: <Badge variant={selectedDeviceInfo.status === 'healthy' ? 'default' : 'destructive'} className="ml-1">
                {selectedDeviceInfo.status}
              </Badge>
            </span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button
            onClick={() => injectMutation.mutate()}
            disabled={!selectedDevice || injectMutation.isPending}
            className="gap-1.5"
            data-testid="button-inject-fault"
          >
            {injectMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
            Inject Fault
          </Button>
          <Button
            variant="outline"
            onClick={() => selectedDevice && resetMutation.mutate(selectedDevice)}
            disabled={!selectedDevice || resetMutation.isPending || !selectedDeviceHasFault}
            className="gap-1.5"
            data-testid="button-reset-fault"
          >
            {resetMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="h-4 w-4" />
            )}
            Clear Fault
          </Button>
        </div>

        {activeFaults.length > 0 && (
          <div className="space-y-2">
            <Label>Active Faults ({activeFaults.length})</Label>
            <div className="flex flex-wrap gap-2">
              {activeFaults.map(fault => {
                const device = devices.find(d => d.id === fault.deviceId);
                const severityInfo = severityLevels.find(s => s.id === fault.severity);
                return (
                  <Badge 
                    key={fault.deviceId} 
                    variant="outline" 
                    className="gap-1.5 pr-1"
                    data-testid={`badge-fault-${fault.deviceId}`}
                  >
                    <div className={cn("h-2 w-2 rounded-full", severityInfo?.color || "bg-orange-500")} />
                    {device?.name || fault.deviceId}: {fault.faultType.replace(/_/g, " ")}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-4 w-4 ml-1 hover:bg-destructive hover:text-destructive-foreground"
                      onClick={() => resetMutation.mutate(fault.deviceId)}
                      data-testid={`button-clear-fault-${fault.deviceId}`}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StageIndicator({ currentStage }: { currentStage: DemoScenarioStatus["stage"] }) {
  const stages: DemoScenarioStatus["stage"][] = ["detection", "diagnosis", "remediation", "verification", "resolved"];
  
  return (
    <div className="flex items-center justify-between gap-2 p-4 bg-card rounded-md border border-border">
      {stages.map((stage, index) => {
        const config = stageConfig[stage];
        const isActive = stage === currentStage;
        const isPast = stages.indexOf(currentStage) > index || currentStage === "resolved";
        
        return (
          <div key={stage} className="flex items-center gap-2">
            <div className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-md transition-all",
              isActive && "ring-2 ring-primary ring-offset-2 ring-offset-background",
              isPast ? config.color : "bg-muted",
              (isActive || isPast) ? "text-white" : "text-muted-foreground"
            )}>
              {config.icon}
              <span className="text-sm font-medium">{config.label}</span>
            </div>
            {index < stages.length - 1 && (
              <div className={cn(
                "w-8 h-0.5",
                isPast ? "bg-primary" : "bg-border"
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function MetricsDisplay({ metrics }: { metrics?: Record<string, MetricDetail> }) {
  if (!metrics || Object.keys(metrics).length === 0) return null;
  
  return (
    <div className="mt-2 space-y-1.5">
      {Object.entries(metrics).map(([key, value]) => (
        <div 
          key={key} 
          className="flex items-center justify-between text-xs bg-muted/50 rounded px-2 py-1.5"
        >
          <span className="font-mono text-muted-foreground">{key}</span>
          <div className="flex items-center gap-2">
            {value.baseline && (
              <span className="text-muted-foreground">
                baseline: <span className="text-foreground">{value.baseline}</span>
              </span>
            )}
            {value.current && (
              <>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <span className={cn(
                  value.status === "CRITICAL" && "text-status-busy font-medium",
                  value.status === "WARNING" && "text-status-away font-medium",
                  value.status === "ANOMALY" && "text-orange-500 font-medium"
                )}>
                  {value.current}
                </span>
              </>
            )}
            {value.threshold && (
              <Badge variant="outline" className="text-xs h-5">
                threshold: {value.threshold}
              </Badge>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function ComparisonDisplay({ comparison }: { comparison?: Record<string, { before: string; after: string; improvement: string }> }) {
  if (!comparison || Object.keys(comparison).length === 0) return null;
  
  return (
    <div className="mt-2 space-y-1.5">
      {Object.entries(comparison).map(([key, value]) => (
        <div 
          key={key} 
          className="flex items-center justify-between text-xs bg-status-online/10 rounded px-2 py-1.5"
        >
          <span className="font-mono text-muted-foreground">{key}</span>
          <div className="flex items-center gap-2">
            <span className="text-status-busy">{value.before}</span>
            <ArrowRight className="h-3 w-3 text-status-online" />
            <span className="text-status-online font-medium">{value.after}</span>
            <Badge className="bg-status-online/20 text-status-online text-xs h-5">
              {value.improvement}
            </Badge>
          </div>
        </div>
      ))}
    </div>
  );
}

function EventTimeline({ events }: { events: DemoEvent[] }) {
  return (
    <ScrollArea className="h-[500px]">
      <div className="space-y-3 pr-4">
        {events.map((event, index) => {
          const stageConf = stageConfig[event.stage as keyof typeof stageConfig] || stageConfig.idle;
          const hasDetails = event.details && (
            event.details.metrics || 
            event.details.evidence || 
            event.details.comparison ||
            event.details.confidence ||
            event.details.method
          );
          
          return (
            <div 
              key={index} 
              className={cn(
                "p-3 rounded-md border border-border bg-card/50 animate-in fade-in slide-in-from-left-2",
                index === events.length - 1 && "ring-1 ring-primary"
              )}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex gap-3">
                <div className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0",
                  stageConf.color,
                  "text-white"
                )}>
                  {stageConf.icon || <Zap className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{event.event}</span>
                    <Badge variant="outline" className="text-xs">
                      {event.agent}
                    </Badge>
                    {event.details?.confidence !== undefined && (
                      <Badge className="bg-primary/20 text-primary text-xs">
                        {event.details.confidence}% confidence
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className={cn("text-xs", stageConf.color, "text-white")}>
                      {event.stage}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  
                  {hasDetails && (
                    <div className="mt-3 pt-2 border-t border-border/50">
                      {event.details?.method && (
                        <div className="flex items-start gap-2 text-xs mb-2">
                          <Activity className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                          <span><span className="text-muted-foreground">Method:</span> {event.details.method}</span>
                        </div>
                      )}
                      
                      {event.details?.hypothesis && (
                        <div className="flex items-start gap-2 text-xs mb-2">
                          <Target className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                          <span><span className="text-muted-foreground">Hypothesis:</span> {event.details.hypothesis}</span>
                        </div>
                      )}
                      
                      {event.details?.action && (
                        <div className="flex items-start gap-2 text-xs mb-2">
                          <Wrench className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                          <span><span className="text-muted-foreground">Action:</span> {event.details.action}</span>
                        </div>
                      )}
                      
                      {event.details?.result && (
                        <div className="flex items-start gap-2 text-xs mb-2">
                          <CheckCircle className="h-3.5 w-3.5 text-status-online mt-0.5 flex-shrink-0" />
                          <span><span className="text-muted-foreground">Result:</span> {event.details.result}</span>
                        </div>
                      )}
                      
                      {event.details?.evidence && event.details.evidence.length > 0 && (
                        <div className="mt-2">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                            <List className="h-3.5 w-3.5" />
                            <span>Evidence:</span>
                          </div>
                          <ul className="space-y-0.5 ml-5">
                            {event.details.evidence.map((ev, i) => (
                              <li key={i} className="text-xs text-muted-foreground list-disc">
                                {ev}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {event.details?.affectedDevices && event.details.affectedDevices.length > 0 && (
                        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                          <span className="text-xs text-muted-foreground">Affected:</span>
                          {event.details.affectedDevices.map((device, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {device}
                            </Badge>
                          ))}
                        </div>
                      )}
                      
                      <MetricsDisplay metrics={event.details?.metrics} />
                      <ComparisonDisplay comparison={event.details?.comparison} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {events.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <AlertCircle className="h-8 w-8 mb-2" />
            <p>No events yet. Select a scenario to begin.</p>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

function StageDetailsPanel({ stageDetails, currentStage }: { stageDetails: StageDetails; currentStage: string }) {
  const stages = ["detection", "diagnosis", "remediation", "verification"] as const;
  const rawIndex = stages.indexOf(currentStage as typeof stages[number]);
  const currentIndex = currentStage === "resolved" ? stages.length : rawIndex;
  
  return (
    <div className="space-y-4">
      {stageDetails.detection && currentIndex >= 0 && (
        <Card className="border-status-away/30">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-status-away flex items-center justify-center">
                <Search className="h-4 w-4 text-white" />
              </div>
              <div>
                <CardTitle className="text-sm">Detection Phase</CardTitle>
                <CardDescription className="text-xs">
                  TTD: {stageDetails.detection.ttd}s | Confidence: {stageDetails.detection.confidence}%
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Detection Method</p>
              <p className="text-sm">{stageDetails.detection.method}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Anomaly Type</p>
              <Badge variant="destructive">{stageDetails.detection.anomalyType.replace(/_/g, " ")}</Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-2">Metrics Deviation</p>
              <div className="space-y-1.5">
                {Object.entries(stageDetails.detection.metrics).map(([key, value]) => (
                  <div key={key} className="grid grid-cols-4 gap-2 text-xs bg-muted/50 rounded px-2 py-1.5">
                    <span className="font-mono">{key}</span>
                    <span className="text-muted-foreground">{value.baseline}</span>
                    <span className="text-status-busy font-medium">{value.current}</span>
                    <span className="text-orange-500">{value.deviation}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {stageDetails.diagnosis && currentIndex >= 1 && (
        <Card className="border-primary/30">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
                <Bot className="h-4 w-4 text-white" />
              </div>
              <div>
                <CardTitle className="text-sm">Diagnosis Phase</CardTitle>
                <CardDescription className="text-xs">
                  Confidence: {stageDetails.diagnosis.confidence}%
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Root Cause</p>
              <p className="text-sm font-medium">{stageDetails.diagnosis.rootCause}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Hypothesis</p>
              <p className="text-sm">{stageDetails.diagnosis.hypothesis}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Evidence</p>
              <ul className="space-y-0.5">
                {stageDetails.diagnosis.evidence.map((ev, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <CheckCircle className="h-3 w-3 text-status-online mt-0.5 flex-shrink-0" />
                    {ev}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">Affected:</span>
              {stageDetails.diagnosis.affectedDevices.map((device, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  {device}
                </Badge>
              ))}
            </div>
            {stageDetails.diagnosis.alternateRoutes !== undefined && (
              <Badge className="bg-status-online/20 text-status-online">
                {stageDetails.diagnosis.alternateRoutes} alternate routes available
              </Badge>
            )}
          </CardContent>
        </Card>
      )}
      
      {stageDetails.remediation && currentIndex >= 2 && (
        <Card className="border-orange-500/30">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-orange-500 flex items-center justify-center">
                <Wrench className="h-4 w-4 text-white" />
              </div>
              <div>
                <CardTitle className="text-sm">Remediation Phase</CardTitle>
                <CardDescription className="text-xs">
                  Est. Time: {stageDetails.remediation.estimatedTime} | Risk: {stageDetails.remediation.riskLevel}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Remediation Plan</p>
              <ol className="space-y-1">
                {stageDetails.remediation.plan.map((step, i) => (
                  <li key={i} className="text-xs flex items-start gap-2">
                    <span className="font-mono text-muted-foreground">{i + 1}.</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Policy Check</p>
                <Badge className="bg-status-online/20 text-status-online text-xs">
                  {stageDetails.remediation.policyCheck}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Rollback Plan</p>
                <p className="text-xs">{stageDetails.remediation.rollbackPlan}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {stageDetails.verification && currentIndex >= 3 && (
        <Card className="border-status-online/30">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-status-online flex items-center justify-center">
                <Shield className="h-4 w-4 text-white" />
              </div>
              <div>
                <CardTitle className="text-sm">Verification Phase</CardTitle>
                <CardDescription className="text-xs">
                  TTR: {stageDetails.verification.ttr}s | TTTR: {stageDetails.verification.tttr}s
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground mb-2">Success Criteria</p>
              <div className="space-y-1">
                {stageDetails.verification.successCriteria.map((criteria, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    {criteria.met ? (
                      <CheckCircle className="h-3.5 w-3.5 text-status-online" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-status-busy" />
                    )}
                    <span className={criteria.met ? "text-foreground" : "text-status-busy"}>
                      {criteria.criterion}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-2">Metrics Recovery</p>
              <div className="space-y-1.5">
                {Object.entries(stageDetails.verification.metricsComparison).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between text-xs bg-status-online/10 rounded px-2 py-1.5">
                    <span className="font-mono">{key}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-status-busy">{value.before}</span>
                      <ArrowRight className="h-3 w-3 text-status-online" />
                      <span className="text-status-online font-medium">{value.after}</span>
                      <Badge className="bg-status-online text-white text-xs h-5">
                        {value.improvement}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function DemoConsolePage() {
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);

  const { data: demoStatus, refetch: refetchStatus } = useQuery<DemoScenarioStatus>({
    queryKey: ["/api/demo/scenario-status"],
    refetchInterval: 1000,
  });

  const { data: devices } = useQuery<Device[]>({
    queryKey: ["/api/devices"],
  });

  const injectFaultMutation = useMutation({
    mutationFn: async (scenario: string) => {
      const res = await apiRequest("POST", "/api/demo/inject-fault", { scenario });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/demo/scenario-status"] });
    },
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/demo/reset");
      return res.json();
    },
    onSuccess: () => {
      setSelectedScenario(null);
      queryClient.invalidateQueries({ queryKey: ["/api/demo/scenario-status"] });
    },
  });

  useEffect(() => {
    if (demoStatus?.active) {
      const interval = setInterval(() => {
        refetchStatus();
      }, 500);
      return () => clearInterval(interval);
    }
  }, [demoStatus?.active, refetchStatus]);

  const handleStartScenario = (scenarioId: string) => {
    setSelectedScenario(scenarioId);
    injectFaultMutation.mutate(scenarioId);
  };

  const isRunning = demoStatus?.active && demoStatus.stage !== "resolved";
  const isResolved = demoStatus?.stage === "resolved";

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-4 p-4 border-b border-border bg-card/50">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Demo Console</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Inject faults and watch the agentic self-healing framework respond in real-time
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isRunning && (
            <Badge className="bg-primary gap-1.5 animate-pulse">
              <Loader2 className="h-3 w-3 animate-spin" />
              Scenario Running
            </Badge>
          )}
          {isResolved && (
            <Badge className="bg-status-online text-white gap-1.5">
              <CheckCircle2 className="h-3 w-3" />
              Scenario Complete
            </Badge>
          )}
          <Button 
            variant="outline" 
            onClick={() => resetMutation.mutate()}
            disabled={resetMutation.isPending}
            data-testid="button-reset-demo"
          >
            <RotateCcw className="h-4 w-4 mr-1.5" />
            Reset
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
          {scenarios.map((scenario) => (
            <Card 
              key={scenario.id}
              className={cn(
                "transition-all cursor-pointer",
                selectedScenario === scenario.id && "ring-2 ring-primary",
                isRunning && selectedScenario !== scenario.id && "opacity-50 pointer-events-none"
              )}
              onClick={() => !isRunning && setSelectedScenario(scenario.id)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "h-10 w-10 rounded-md flex items-center justify-center",
                    scenario.id === "link_failure" && "bg-status-busy/10 text-status-busy",
                    scenario.id === "port_congestion" && "bg-status-away/10 text-status-away",
                    scenario.id === "dpu_overload" && "bg-primary/10 text-primary"
                  )}>
                    {scenario.icon}
                  </div>
                  <div>
                    <CardTitle className="text-base">{scenario.title}</CardTitle>
                    <CardDescription className="text-xs mt-0.5">
                      Duration: {scenario.expectedDuration}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">{scenario.description}</p>
                <div className="flex flex-wrap gap-1 mb-4">
                  {scenario.metrics.map((metric) => (
                    <Badge key={metric} variant="outline" className="text-xs">
                      {metric}
                    </Badge>
                  ))}
                </div>
                <Button 
                  className="w-full gap-1.5"
                  disabled={isRunning || injectFaultMutation.isPending}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStartScenario(scenario.id);
                  }}
                  data-testid={`button-start-${scenario.id}`}
                >
                  {injectFaultMutation.isPending && selectedScenario === scenario.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  Start Scenario
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {devices && devices.length > 0 && (
          <div className="mb-4">
            <NodeFaultInjectionPanel devices={devices} />
          </div>
        )}

        {(demoStatus?.active || isResolved) && (
          <div className="space-y-4">
            <StageIndicator currentStage={demoStatus?.stage || "idle"} />
            
            {isResolved && demoStatus?.stageDetails?.verification && (
              <Card className="border-status-online bg-status-online/5">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-full bg-status-online flex items-center justify-center">
                        <CheckCircle2 className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-status-online">Incident Resolved Successfully</h3>
                        <p className="text-sm text-muted-foreground">
                          Zero human intervention - Fully autonomous remediation
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-status-online">
                          {demoStatus.stageDetails.detection?.ttd || 5}s
                        </p>
                        <p className="text-xs text-muted-foreground">TTD</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-status-online">
                          {demoStatus.stageDetails.verification.ttr}s
                        </p>
                        <p className="text-xs text-muted-foreground">TTR</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-status-online">
                          {demoStatus.stageDetails.verification.tttr}s
                        </p>
                        <p className="text-xs text-muted-foreground">TTTR</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Live Event Timeline</CardTitle>
                  <CardDescription>
                    Real-time events from the agentic framework with detailed metrics
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <EventTimeline events={demoStatus?.events || []} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Stage Analysis</CardTitle>
                  <CardDescription>
                    Detailed breakdown of each autonomous healing phase
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[500px]">
                    <div className="pr-4">
                      {demoStatus?.stageDetails && Object.keys(demoStatus.stageDetails).length > 0 ? (
                        <StageDetailsPanel 
                          stageDetails={demoStatus.stageDetails} 
                          currentStage={demoStatus.stage} 
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                          <Clock className="h-8 w-8 mb-2" />
                          <p>Stage details will appear as the scenario progresses</p>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {!demoStatus?.active && !isResolved && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Select a Scenario to Begin</h3>
              <p className="text-sm text-muted-foreground text-center max-w-md">
                Choose one of the scenarios above to inject a fault into the network. 
                The agentic framework will automatically detect and remediate the issue, 
                showing you detailed metrics and analysis at each stage.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
