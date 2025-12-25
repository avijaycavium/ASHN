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
  Zap
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Device } from "@shared/schema";

interface DemoScenarioStatus {
  active: boolean;
  type: string | null;
  stage: "idle" | "detection" | "diagnosis" | "remediation" | "verification" | "resolved";
  incidentId: string | null;
  startedAt: string | null;
  events: Array<{ stage: string; event: string; timestamp: string; agent: string }>;
  deviceId: string | null;
  targetDeviceId: string | null;
}

const scenarios = [
  {
    id: "link_failure",
    title: "Link Failure & Traffic Rerouting",
    description: "Simulate a physical link failure between switches. The agentic framework will detect, analyze, and reroute traffic automatically.",
    icon: <Link2Off className="h-5 w-5" />,
    color: "text-status-busy",
    expectedDuration: "~30 seconds",
  },
  {
    id: "port_congestion",
    title: "Port Congestion & QoS Remediation",
    description: "Simulate port congestion with high queue depth and latency. Agents will apply QoS policies to restore service quality.",
    icon: <Gauge className="h-5 w-5" />,
    color: "text-status-away",
    expectedDuration: "~25 seconds",
  },
  {
    id: "dpu_overload",
    title: "DPU Resource Exhaustion & Migration",
    description: "Simulate CPU saturation on a DPU. The framework will migrate workloads to a less loaded DPU.",
    icon: <Cpu className="h-5 w-5" />,
    color: "text-primary",
    expectedDuration: "~35 seconds",
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

function EventTimeline({ events }: { events: DemoScenarioStatus["events"] }) {
  return (
    <ScrollArea className="h-[400px]">
      <div className="space-y-3 pr-4">
        {events.map((event, index) => {
          const stageConf = stageConfig[event.stage as keyof typeof stageConfig] || stageConfig.idle;
          return (
            <div 
              key={index} 
              className={cn(
                "flex gap-3 p-3 rounded-md border border-border bg-card/50 animate-in fade-in slide-in-from-left-2",
                index === events.length - 1 && "ring-1 ring-primary"
              )}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className={cn(
                "h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0",
                stageConf.color,
                "text-white"
              )}>
                {stageConf.icon || <Zap className="h-4 w-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{event.event}</span>
                  <Badge variant="outline" className="text-xs">
                    {event.agent}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Badge className={cn("text-xs", stageConf.color, "text-white")}>
                    {event.stage}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </span>
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
                <p className="text-sm text-muted-foreground mb-4">{scenario.description}</p>
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

        {(demoStatus?.active || isResolved) && (
          <div className="space-y-4">
            <StageIndicator currentStage={demoStatus?.stage || "idle"} />
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Live Event Timeline</CardTitle>
                  <CardDescription>
                    Real-time events from the agentic framework
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <EventTimeline events={demoStatus?.events || []} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Scenario Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Scenario Type</p>
                      <p className="font-medium">{demoStatus?.type?.replace(/_/g, " ") || "—"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Incident ID</p>
                      <p className="font-mono text-sm">{demoStatus?.incidentId || "—"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Current Stage</p>
                      <Badge className={cn(
                        stageConfig[demoStatus?.stage || "idle"].color,
                        "text-white"
                      )}>
                        {stageConfig[demoStatus?.stage || "idle"].label}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Started At</p>
                      <p className="text-sm">
                        {demoStatus?.startedAt 
                          ? new Date(demoStatus.startedAt).toLocaleTimeString() 
                          : "—"}
                      </p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-border">
                    <h4 className="text-sm font-medium mb-3">Agentic Flow</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "h-2 w-2 rounded-full",
                          demoStatus?.stage === "detection" || 
                          (demoStatus?.events?.some(e => e.stage === "detection")) 
                            ? "bg-status-online" : "bg-muted"
                        )} />
                        <span>Detection: Telemetry + Anomaly Agents</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "h-2 w-2 rounded-full",
                          demoStatus?.stage === "diagnosis" || 
                          (demoStatus?.events?.some(e => e.stage === "diagnosis")) 
                            ? "bg-status-online" : "bg-muted"
                        )} />
                        <span>Diagnosis: RCA + Topology Agents</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "h-2 w-2 rounded-full",
                          demoStatus?.stage === "remediation" || 
                          (demoStatus?.events?.some(e => e.stage === "remediation")) 
                            ? "bg-status-online" : "bg-muted"
                        )} />
                        <span>Remediation: Remediation + Compliance Agents</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "h-2 w-2 rounded-full",
                          demoStatus?.stage === "verification" || demoStatus?.stage === "resolved"
                            ? "bg-status-online" : "bg-muted"
                        )} />
                        <span>Verification: Verification Agent</span>
                      </div>
                    </div>
                  </div>

                  {isResolved && (
                    <div className="pt-4 border-t border-border">
                      <div className="flex items-center gap-2 text-status-online">
                        <CheckCircle2 className="h-5 w-5" />
                        <span className="font-medium">Incident Resolved Successfully</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        The agentic framework has successfully detected, diagnosed, and remediated the fault.
                      </p>
                    </div>
                  )}
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
                The agentic framework will automatically detect and remediate the issue.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
