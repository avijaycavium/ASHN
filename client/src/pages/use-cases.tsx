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
    id: "bgp-link-flap",
    title: "BGP Link Flap Detection & Auto Reroute",
    icon: <Link2Off className="h-5 w-5" />,
    scenario: "Port state oscillation on Switch-A1:port2 (primary A1-C link) causing BGP session instability",
    fault: "switch_port_oper_status toggling (6 state changes in 2min), BGP updates spike (5+ in 2min)",
    impact: "Primary path DPU-1 to A1 to C to DPU-2 disrupted, traffic rerouting via backup Switch-B path",
    incidentId: "INC-2026-001",
    performance: {
      ttd: "<30 seconds",
      ttr: "<60 seconds",
      tttr: "<120 seconds",
    },
    agenticFlow: {
      detection: [
        "Telemetry Agent scrapes SONiC metrics (switch_port_oper_status, switch_bgp_peer_state)",
        "PromQL Rule: changes(switch_port_oper_status[2m]) >= 3 THRESHOLD CROSSED",
        "Alert: PortFlappingDetected for Switch-A1:port2",
      ],
      diagnosis: [
        "RCA Agent correlates port flap with BGP session down (peer 10.0.13.2)",
        "Error metrics: switch_port_errors_in spike (CRC/FCS >5/min)",
        "Confidence: 95% - Suspected transceiver degradation",
      ],
      remediation: [
        "Severity >10 flaps/5min: vtysh -c 'interface port2' -c 'shutdown'",
        "Severity 5-10 flaps: neighbor 10.0.13.2 weight 50 (prefer backup)",
        "Severity <5 flaps: neighbor 10.0.13.2 timers 60 180 (tolerate brief flaps)",
      ],
      verification: [
        "BGP converged to backup peer 10.0.12.2 (Switch-B) in 30-60s",
        "E2E validation: ping 10.0.4.10 - 0% loss, latency ~600us",
        "Flap cessation: changes(switch_port_oper_status[5m]) = 0",
      ],
    },
  },
  {
    id: "bgp-session-instability",
    title: "BGP Session Instability & Weight Adjustment",
    icon: <Gauge className="h-5 w-5" />,
    scenario: "BGP peer state oscillating due to underlying link flap on port2 (10.0.13.0/30)",
    fault: "switch_bgp_peer_state{peer_ip='10.0.13.2'} = 0, increase(switch_bgp_updates_received[2m]) >= 5",
    impact: "BGP update storm causing route instability, traffic shifting needed",
    incidentId: "INC-2026-002",
    performance: {
      ttd: "<30 seconds",
      ttr: "<45 seconds",
      tttr: "<90 seconds",
    },
    agenticFlow: {
      detection: [
        "Telemetry Agent monitors switch_bgp_peer_state and switch_bgp_updates_received",
        "PromQL Rule: increase(switch_bgp_updates_received[2m]) >= 5 BGPUpdateStorm",
        "Alert: BGPUpdateStorm for Switch-A1 peer 10.0.13.2",
      ],
      diagnosis: [
        "RCA Agent correlates BGP instability with port2 link status",
        "Primary peer 10.0.13.2 (weight 200) unstable",
        "Backup peer 10.0.12.2 (Switch-B, weight 100) available",
      ],
      remediation: [
        "vtysh -c 'neighbor 10.0.13.2 weight 50' - reduce primary weight",
        "Backup peer 10.0.12.2 (weight 100) now preferred",
        "Traffic shifts to backup path A1 to B to C",
      ],
      verification: [
        "switch_port_bytes_out{port='port3'} increasing - traffic via backup",
        "Primary link remains up for monitoring/recovery",
        "E2E latency acceptable (300us to 600us, +1 hop)",
      ],
    },
  },
  {
    id: "traffic-drop",
    title: "Traffic Drop & Backup Path Activation",
    icon: <Cpu className="h-5 w-5" />,
    scenario: "Traffic drop on primary A1-C path due to link flap, backup activation required",
    fault: "rate(switch_port_bytes_in{port='port2'}[1m]) < 10 bytes/s (was 1.2 MB/s)",
    impact: "Primary path traffic disrupted, latency increase on backup (300us to 600us)",
    incidentId: "INC-2026-003",
    performance: {
      ttd: "<30 seconds",
      ttr: "<60 seconds",
      tttr: "<120 seconds",
    },
    agenticFlow: {
      detection: [
        "Telemetry Agent monitors switch_port_bytes_in/out metrics",
        "PromQL Rule: rate(switch_port_bytes_in[1m]) < threshold",
        "Alert: PrimaryLinkTrafficDrop for Switch-A1:port2",
      ],
      diagnosis: [
        "RCA Agent correlates traffic drop with link flap on primary A1-C path",
        "Backup path via Switch-B (10.0.12.0/30) available",
        "Confidence: 90% - Primary link instability confirmed",
      ],
      remediation: [
        "Activate backup path via Switch-B",
        "Route: DPU-1 to A1 to B to C to DPU-2",
        "Accept latency increase (+1 hop, 300us to 600us)",
      ],
      verification: [
        "increase(switch_port_bytes_out{A1:port3}[2m]) > 500KB confirmed",
        "E2E ping 10.0.4.10 - 0% loss",
        "Backup path stable for 5min monitoring window",
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
