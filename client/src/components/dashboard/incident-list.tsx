import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, CheckCircle2, Clock, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Incident, IncidentSeverity, IncidentStatus } from "@shared/schema";

interface IncidentListProps {
  incidents: Incident[];
  maxHeight?: string;
  showViewAll?: boolean;
}

const severityConfig: Record<IncidentSeverity, { color: string; icon: React.ReactNode }> = {
  critical: {
    color: "bg-status-busy text-white",
    icon: <AlertTriangle className="h-3 w-3" />,
  },
  high: {
    color: "bg-status-away text-black",
    icon: <AlertTriangle className="h-3 w-3" />,
  },
  medium: {
    color: "bg-orange-500 text-white",
    icon: <Clock className="h-3 w-3" />,
  },
  low: {
    color: "bg-status-online text-white",
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
};

const statusLabels: Record<IncidentStatus, string> = {
  active: "Active",
  investigating: "Investigating",
  remediating: "Remediating",
  resolved: "Resolved",
  closed: "Closed",
};

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

export function IncidentList({ incidents, maxHeight = "320px", showViewAll = true }: IncidentListProps) {
  const activeIncidents = incidents.filter(i => i.status !== "closed" && i.status !== "resolved");

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <div>
          <CardTitle className="text-base">Active Incidents</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            {activeIncidents.length} incidents requiring attention
          </p>
        </div>
        {showViewAll && (
          <Link href="/incidents">
            <Button variant="ghost" size="sm" className="gap-1" data-testid="link-view-all-incidents">
              View All
              <ExternalLink className="h-3 w-3" />
            </Button>
          </Link>
        )}
      </CardHeader>
      <CardContent className="flex-1">
        <ScrollArea style={{ height: maxHeight }}>
          <div className="space-y-3 pr-4">
            {activeIncidents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CheckCircle2 className="h-8 w-8 text-status-online mb-2" />
                <p className="text-sm font-medium">All Clear</p>
                <p className="text-xs text-muted-foreground">No active incidents</p>
              </div>
            ) : (
              activeIncidents.map((incident) => {
                const config = severityConfig[incident.severity];
                return (
                  <Link key={incident.id} href={`/incidents/${incident.id}`}>
                    <div
                      className="p-3 rounded-md bg-muted/50 hover-elevate cursor-pointer transition-colors"
                      data-testid={`incident-item-${incident.id}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge className={cn("gap-1 text-xs", config.color)}>
                            {config.icon}
                            {incident.severity.toUpperCase()}
                          </Badge>
                          <span className="text-xs text-muted-foreground font-mono">
                            {incident.id}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatTimeAgo(incident.createdAt)}
                        </span>
                      </div>
                      <h4 className="mt-2 text-sm font-medium">{incident.title}</h4>
                      <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                        <span>TTD: {incident.ttd}s</span>
                        {incident.ttr && <span>TTR: {incident.ttr}s</span>}
                        <Badge variant="outline" className="text-xs">
                          {statusLabels[incident.status]}
                        </Badge>
                      </div>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
