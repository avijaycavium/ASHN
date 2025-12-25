import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { 
  AlertTriangle, 
  ArrowLeft, 
  CheckCircle2, 
  Clock, 
  Download,
  Server,
  Shield,
  Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { Incident, TimelineEvent, RemediationStep } from "@shared/schema";

const severityConfig = {
  critical: { color: "bg-status-busy text-white", icon: <AlertTriangle className="h-4 w-4" /> },
  high: { color: "bg-status-away text-black", icon: <AlertTriangle className="h-4 w-4" /> },
  medium: { color: "bg-orange-500 text-white", icon: <Clock className="h-4 w-4" /> },
  low: { color: "bg-status-online text-white", icon: <CheckCircle2 className="h-4 w-4" /> },
};

const statusLabels = {
  active: "Active",
  investigating: "Investigating",
  remediating: "Remediating",
  resolved: "Resolved",
  closed: "Closed",
};

function formatTime(dateString: string): string {
  return new Date(dateString).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function IncidentDetailPage() {
  const [, params] = useRoute("/incidents/:id");
  const incidentId = params?.id;

  const { data: incident, isLoading } = useQuery<Incident>({
    queryKey: ["/api/incidents", incidentId],
    enabled: !!incidentId,
  });

  const { data: timeline } = useQuery<TimelineEvent[]>({
    queryKey: ["/api/incidents", incidentId, "timeline"],
    enabled: !!incidentId,
  });

  const { data: remediationSteps } = useQuery<RemediationStep[]>({
    queryKey: ["/api/incidents", incidentId, "remediation"],
    enabled: !!incidentId,
  });

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-48" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!incident) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <AlertTriangle className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-lg font-medium">Incident Not Found</h2>
        <p className="text-sm text-muted-foreground">
          The incident you're looking for doesn't exist.
        </p>
        <Link href="/incidents">
          <Button variant="outline">Back to Incidents</Button>
        </Link>
      </div>
    );
  }

  const sevConfig = severityConfig[incident.severity];
  const completedSteps = remediationSteps?.filter(s => s.status === "completed").length || 0;
  const totalSteps = remediationSteps?.length || 0;
  const progress = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-4 p-4 border-b border-border bg-card/50">
        <div className="flex items-center gap-4">
          <Link href="/incidents">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold tracking-tight" data-testid="incident-id">
                {incident.id}
              </h1>
              <Badge className={cn("gap-1", sevConfig.color)}>
                {sevConfig.icon}
                {incident.severity.toUpperCase()}
              </Badge>
              <Badge variant="outline">{statusLabels[incident.status]}</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{incident.title}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="default" className="gap-1.5" data-testid="button-approve">
            <Shield className="h-4 w-4" />
            Approve Remediation
          </Button>
          <Button variant="outline" className="gap-1.5" data-testid="button-override">
            <Zap className="h-4 w-4" />
            Manual Override
          </Button>
          <Button variant="outline" size="icon" data-testid="button-export">
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground">Time to Detect</div>
                <div className="text-2xl font-semibold font-mono mt-1 flex items-center gap-2">
                  {incident.ttd}s
                  <CheckCircle2 className="h-4 w-4 text-status-online" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground">Time to Remediate</div>
                <div className="text-2xl font-semibold font-mono mt-1 flex items-center gap-2">
                  {incident.ttr ? `${incident.ttr}s` : "—"}
                  {incident.ttr && <CheckCircle2 className="h-4 w-4 text-status-online" />}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground">Total Recovery</div>
                <div className="text-2xl font-semibold font-mono mt-1 flex items-center gap-2">
                  {incident.tttr ? `${incident.tttr}s` : "—"}
                  {incident.tttr && <CheckCircle2 className="h-4 w-4 text-status-online" />}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground">Confidence Score</div>
                <div className="text-2xl font-semibold font-mono mt-1">
                  {incident.confidence}%
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Incident Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
                <div className="space-y-4">
                  {timeline?.map((event, idx) => (
                    <div key={event.id} className="relative pl-10">
                      <div className={cn(
                        "absolute left-2.5 w-3 h-3 rounded-full border-2 border-background",
                        idx === 0 ? "bg-primary" : "bg-muted-foreground"
                      )} />
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-medium">{event.event}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {event.agent} - {event.details}
                          </p>
                        </div>
                        <span className="text-xs text-muted-foreground font-mono">
                          {formatTime(event.timestamp)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Root Cause Analysis</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium mb-2">Hypothesis</h4>
                  <p className="text-sm text-muted-foreground">
                    {incident.rootCause || incident.description}
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-medium mb-2">Confidence</h4>
                  <div className="flex items-center gap-3">
                    <Progress value={incident.confidence} className="flex-1" />
                    <span className="text-sm font-mono">{incident.confidence}%</span>
                  </div>
                </div>
                <Separator />
                <div>
                  <h4 className="text-sm font-medium mb-2">Evidence</h4>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>SNMP ifOperStatus = down</li>
                    <li>No errors before incident</li>
                    <li>Sudden state change detected</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Affected Devices</CardTitle>
                  <Badge variant="secondary">{incident.affectedDevices.length} devices</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {incident.affectedDevices.map((deviceId) => (
                    <div
                      key={deviceId}
                      className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                    >
                      <div className="flex items-center gap-2">
                        <Server className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{deviceId}</span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        Impacted
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Remediation Plan</CardTitle>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {completedSteps}/{totalSteps} steps
                  </span>
                  <Progress value={progress} className="w-24" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {remediationSteps?.map((step) => (
                  <div
                    key={step.id}
                    className="flex items-center gap-3 p-3 rounded-md bg-muted/50"
                  >
                    <div className={cn(
                      "h-6 w-6 rounded-full flex items-center justify-center text-xs font-medium",
                      step.status === "completed" 
                        ? "bg-status-online text-white" 
                        : step.status === "running"
                        ? "bg-primary text-primary-foreground animate-pulse"
                        : step.status === "failed"
                        ? "bg-status-busy text-white"
                        : "bg-muted text-muted-foreground"
                    )}>
                      {step.status === "completed" ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : step.status === "running" ? (
                        <Clock className="h-4 w-4" />
                      ) : (
                        step.step
                      )}
                    </div>
                    <div className="flex-1">
                      <span className="text-sm">{step.description}</span>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs",
                        step.status === "completed" && "bg-status-online/10 text-status-online",
                        step.status === "running" && "bg-primary/10 text-primary",
                        step.status === "failed" && "bg-status-busy/10 text-status-busy"
                      )}
                    >
                      {step.status.charAt(0).toUpperCase() + step.status.slice(1)}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </div>
  );
}
