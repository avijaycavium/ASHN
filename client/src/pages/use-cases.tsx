import { useQuery } from "@tanstack/react-query";
import { 
  Link2Off, 
  Gauge, 
  Cpu, 
  ArrowRight, 
  Clock, 
  CheckCircle2,
  AlertCircle,
  Bot,
  Zap,
  Search,
  Wrench,
  Shield
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import type { Incident, TimelineEvent } from "@shared/schema";

interface UseCase {
  id: string;
  title: string;
  icon: React.ReactNode;
  scenario: string;
  fault: string;
  impact: string;
  incidentId: string;
  performance: {
    ttd: string;
    ttr: string;
    tttr: string;
  };
  agenticFlow: {
    detection: string[];
    diagnosis: string[];
    remediation: string[];
    verification: string[];
  };
}

const useCases: UseCase[] = [
  {
    id: "link-failure",
    title: "Switch Link Failure & Traffic Rerouting",
    icon: <Link2Off className="h-5 w-5" />,
    scenario: "Network link failure between switches (cable fault, transceiver failure)",
    fault: "Physical link failure between Switch-A:port1 and Switch-B:port2",
    impact: "Traffic disruption, service degradation for 15 downstream devices",
    incidentId: "INC-2025-001",
    performance: {
      ttd: "<30 seconds",
      ttr: "<1 minute",
      tttr: "<2 minutes",
    },
    agenticFlow: {
      detection: [
        "Telemetry Agent monitors link state (interface up/down)",
        "Anomaly Detection detects link_down event (100% confidence)",
        "Alert: link_failure alert created",
      ],
      diagnosis: [
        "RCA Agent identifies link failure location",
        "Topology Agent computes impact path (15 devices affected)",
        "Confidence: 95%",
      ],
      remediation: [
        "Remediation Planning finds alternate path via topology.resolve",
        "Action: Enable alternate route (OSPF/BGP auto-converges)",
        "Fallback: Manual static route if needed",
      ],
      verification: [
        "Routing protocol converges (30-60 seconds)",
        "Traffic flows via alternate path",
        "Zero packet loss after convergence",
      ],
    },
  },
  {
    id: "port-congestion",
    title: "Port Congestion & QoS Remediation",
    icon: <Gauge className="h-5 w-5" />,
    scenario: "Port congestion due to traffic surge",
    fault: "Queue depth 85% (baseline <15%), latency 250ms, packet drops",
    impact: "Degraded service quality, potential SLA violations",
    incidentId: "INC-2025-002",
    performance: {
      ttd: "<2 minutes",
      ttr: "<1 minute",
      tttr: "<3 minutes",
    },
    agenticFlow: {
      detection: [
        "Telemetry Agent monitors queue_depth, latency, port_errors",
        "Anomaly Detection flags congestion (92% confidence)",
        "Alert: port_congestion alert created",
      ],
      diagnosis: [
        "RCA Agent analyzes traffic patterns",
        "Hypothesis: Queue depth + latency + drops = Port congestion",
        "Confidence: 89%",
      ],
      remediation: [
        "adjust_qos_buffer_thresholds(port, 20%)",
        "reconfigure_qos_policy(port, priority_traffic)",
        "Policy Validation: QoS changes allowed",
      ],
      verification: [
        "Queue depth: 85% to 12% (recovered)",
        "Latency: 250ms to 45ms (normalized)",
        "Packet loss: 5% to <0.1%",
      ],
    },
  },
  {
    id: "dpu-workload",
    title: "DPU Workload Imbalance & Migration",
    icon: <Cpu className="h-5 w-5" />,
    scenario: "DPU resource exhaustion (CPU saturation, memory pressure)",
    fault: "CPU 95% (baseline <70%), latency spike 250ms (baseline <100ms)",
    impact: "Application performance degradation",
    incidentId: "INC-2025-003",
    performance: {
      ttd: "<2 minutes",
      ttr: "<2 minutes",
      tttr: "<5 minutes",
    },
    agenticFlow: {
      detection: [
        "Telemetry Agent monitors CPU, memory, latency",
        "Anomaly Detection flags resource exhaustion (88% confidence)",
        "Alert: dpu_resource_exhaustion alert created",
      ],
      diagnosis: [
        "RCA Agent analyzes workload patterns",
        "Hypothesis: CPU saturation = Workload imbalance",
        "Confidence: 85%",
      ],
      remediation: [
        "migrate_workload(container_id, target_dpu)",
        "adjust_offload_rules(rule_id, new_config)",
        "Policy Validation: Migration allowed",
      ],
      verification: [
        "CPU usage: 95% to 65% (normalized)",
        "Latency: 250ms to 80ms (recovered)",
        "No service disruption during migration",
      ],
    },
  },
];

function AgentFlowStep({ 
  phase, 
  items, 
  icon,
  color 
}: { 
  phase: string; 
  items: string[]; 
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="space-y-2">
      <div className={cn("flex items-center gap-2 font-medium", color)}>
        {icon}
        {phase}
      </div>
      <div className="ml-6 space-y-1.5">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-muted-foreground/50 flex-shrink-0" />
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function UseCaseCard({ useCase }: { useCase: UseCase }) {
  const { data: incident } = useQuery<Incident>({
    queryKey: ["/api/incidents", useCase.incidentId],
  });

  const { data: timeline } = useQuery<TimelineEvent[]>({
    queryKey: ["/api/incidents", useCase.incidentId, "timeline"],
  });

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center">
              {useCase.icon}
            </div>
            <div>
              <CardTitle className="text-lg">{useCase.title}</CardTitle>
              <CardDescription className="mt-1">{useCase.scenario}</CardDescription>
            </div>
          </div>
          {incident && (
            <Badge className={cn(
              incident.status === "remediating" && "bg-primary",
              incident.status === "resolved" && "bg-status-online text-white",
              incident.status === "closed" && "bg-muted text-muted-foreground"
            )}>
              {incident.status}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground mb-1">Fault</p>
            <p className="font-medium">{useCase.fault}</p>
          </div>
          <div>
            <p className="text-muted-foreground mb-1">Impact</p>
            <p className="font-medium">{useCase.impact}</p>
          </div>
        </div>

        <div className="flex items-center gap-4 py-3 border-y border-border">
          <div className="flex-1 text-center">
            <p className="text-xs text-muted-foreground mb-1">TTD</p>
            <p className="font-mono font-semibold text-status-online">{useCase.performance.ttd}</p>
          </div>
          <div className="flex-1 text-center border-x border-border">
            <p className="text-xs text-muted-foreground mb-1">TTR</p>
            <p className="font-mono font-semibold text-primary">{useCase.performance.ttr}</p>
          </div>
          <div className="flex-1 text-center">
            <p className="text-xs text-muted-foreground mb-1">TTTR</p>
            <p className="font-mono font-semibold">{useCase.performance.tttr}</p>
          </div>
        </div>

        <Tabs defaultValue="flow" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="flow" data-testid={`tab-flow-${useCase.id}`}>Agentic Flow</TabsTrigger>
            <TabsTrigger value="timeline" data-testid={`tab-timeline-${useCase.id}`}>Live Timeline</TabsTrigger>
          </TabsList>
          <TabsContent value="flow" className="mt-4 space-y-4">
            <AgentFlowStep 
              phase="Detection" 
              items={useCase.agenticFlow.detection}
              icon={<Search className="h-4 w-4" />}
              color="text-status-online"
            />
            <AgentFlowStep 
              phase="Diagnosis" 
              items={useCase.agenticFlow.diagnosis}
              icon={<Bot className="h-4 w-4" />}
              color="text-primary"
            />
            <AgentFlowStep 
              phase="Remediation" 
              items={useCase.agenticFlow.remediation}
              icon={<Wrench className="h-4 w-4" />}
              color="text-amber-500"
            />
            <AgentFlowStep 
              phase="Verification" 
              items={useCase.agenticFlow.verification}
              icon={<Shield className="h-4 w-4" />}
              color="text-status-online"
            />
          </TabsContent>
          <TabsContent value="timeline" className="mt-4">
            <ScrollArea className="h-[280px]">
              <div className="space-y-3">
                {timeline?.map((event, i) => (
                  <div key={event.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={cn(
                        "h-2 w-2 rounded-full mt-2",
                        i === 0 ? "bg-primary" : "bg-muted-foreground/30"
                      )} />
                      {i < (timeline.length - 1) && (
                        <div className="w-px flex-1 bg-border" />
                      )}
                    </div>
                    <div className="pb-3">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{event.event}</p>
                        <Badge variant="outline" className="text-xs">
                          {event.agent}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{event.details}</p>
                    </div>
                  </div>
                ))}
                {(!timeline || timeline.length === 0) && (
                  <div className="text-center text-muted-foreground py-8">
                    No timeline events available
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <div className="flex gap-2 pt-2">
          <Link href={`/incidents/${useCase.incidentId}`} className="flex-1">
            <Button variant="outline" className="w-full gap-1.5" data-testid={`button-view-incident-${useCase.id}`}>
              View Incident
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default function UseCasesPage() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-4 p-4 border-b border-border bg-card/50">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Use Cases</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Autonomous self-healing network scenarios with agentic workflows
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>TTD = Time to Detect</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Zap className="h-4 w-4" />
            <span>TTR = Time to Remediate</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4" />
            <span>TTTR = Time to Total Recovery</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {useCases.map((useCase) => (
            <UseCaseCard key={useCase.id} useCase={useCase} />
          ))}
        </div>
      </div>
    </div>
  );
}
