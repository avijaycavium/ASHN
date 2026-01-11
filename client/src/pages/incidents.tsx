import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useState, useEffect } from "react";
import { 
  AlertTriangle, 
  Filter, 
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  Radio
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { queryClient } from "@/lib/queryClient";
import type { Incident, IncidentSeverity, IncidentStatus, SSEMessage } from "@shared/schema";

const severityConfig: Record<IncidentSeverity, { color: string; icon: React.ReactNode }> = {
  critical: { color: "bg-status-busy text-white", icon: <AlertTriangle className="h-3 w-3" /> },
  high: { color: "bg-status-away text-black", icon: <AlertTriangle className="h-3 w-3" /> },
  medium: { color: "bg-orange-500 text-white", icon: <Clock className="h-3 w-3" /> },
  low: { color: "bg-status-online text-white", icon: <CheckCircle2 className="h-3 w-3" /> },
};

const statusConfig: Record<IncidentStatus, { color: string; label: string }> = {
  active: { color: "bg-status-busy/10 text-status-busy border-status-busy", label: "Active" },
  investigating: { color: "bg-status-away/10 text-status-away border-status-away", label: "Investigating" },
  remediating: { color: "bg-primary/10 text-primary border-primary", label: "Remediating" },
  resolved: { color: "bg-status-online/10 text-status-online border-status-online", label: "Resolved" },
  closed: { color: "bg-muted text-muted-foreground border-muted", label: "Closed" },
};

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function IncidentsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isSSEConnected, setIsSSEConnected] = useState(false);

  const { data: incidents, isLoading } = useQuery<Incident[]>({
    queryKey: ["/api/incidents"],
  });

  // Subscribe to SSE for real-time updates
  useEffect(() => {
    const eventSource = new EventSource("/api/stream/events");
    
    eventSource.onopen = () => {
      setIsSSEConnected(true);
    };
    
    eventSource.onmessage = (event) => {
      try {
        const message: SSEMessage = JSON.parse(event.data);
        
        // Refresh incidents on relevant events
        if (message.type === "incident_created" || 
            message.type === "incident_updated" || 
            message.type === "incident_resolved" ||
            message.type === "stage_changed") {
          queryClient.invalidateQueries({ queryKey: ["/api/incidents"] });
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
  }, []);

  const filteredIncidents = incidents?.filter((incident) => {
    const matchesSearch = 
      incident.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      incident.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSeverity = severityFilter === "all" || incident.severity === severityFilter;
    const matchesStatus = statusFilter === "all" || incident.status === statusFilter;
    return matchesSearch && matchesSeverity && matchesStatus;
  });

  const stats = {
    total: incidents?.length || 0,
    active: incidents?.filter(i => i.status === "active").length || 0,
    investigating: incidents?.filter(i => i.status === "investigating" || i.status === "remediating").length || 0,
    resolved: incidents?.filter(i => i.status === "resolved" || i.status === "closed").length || 0,
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-4 p-4 border-b border-border bg-card/50">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Incidents</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitor and manage network incidents
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Incidents</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-semibold" data-testid="stat-total">{stats.total}</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-status-busy" />
                Active
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-semibold text-status-busy" data-testid="stat-active">{stats.active}</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-status-away" />
                In Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-semibold text-status-away" data-testid="stat-progress">{stats.investigating}</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-status-online" />
                Resolved
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-semibold text-status-online" data-testid="stat-resolved">{stats.resolved}</span>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search incidents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-incidents"
                />
              </div>
              <div className="flex items-center gap-2">
                <Select value={severityFilter} onValueChange={setSeverityFilter}>
                  <SelectTrigger className="w-36" data-testid="select-severity">
                    <SelectValue placeholder="Severity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Severities</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-36" data-testid="select-status">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="investigating">Investigating</SelectItem>
                    <SelectItem value="remediating">Remediating</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-16" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-32">ID</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead className="w-28">Severity</TableHead>
                    <TableHead className="w-32">Status</TableHead>
                    <TableHead className="w-24">TTD</TableHead>
                    <TableHead className="w-24">TTR</TableHead>
                    <TableHead className="w-36">Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredIncidents?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <div className="flex flex-col items-center gap-2">
                          <CheckCircle2 className="h-8 w-8 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">No incidents found</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredIncidents?.map((incident) => {
                      const sevConfig = severityConfig[incident.severity];
                      const statConfig = statusConfig[incident.status];
                      return (
                        <TableRow key={incident.id} className="cursor-pointer hover-elevate" data-testid={`row-${incident.id}`}>
                          <TableCell>
                            <Link href={`/incidents/${incident.id}`}>
                              <span className="font-mono text-xs text-primary hover:underline">
                                {incident.id}
                              </span>
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Link href={`/incidents/${incident.id}`}>
                              <span className="font-medium hover:underline">{incident.title}</span>
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Badge className={cn("gap-1 text-xs", sevConfig.color)}>
                              {sevConfig.icon}
                              {incident.severity.charAt(0).toUpperCase() + incident.severity.slice(1)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn("text-xs", statConfig.color)}>
                              {statConfig.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-sm">{incident.ttd}s</TableCell>
                          <TableCell className="font-mono text-sm">
                            {incident.ttr ? `${incident.ttr}s` : "—"}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(incident.createdAt)}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
