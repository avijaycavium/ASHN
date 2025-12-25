import { useQuery } from "@tanstack/react-query";
import { 
  ClipboardList, 
  Search, 
  Download,
  CheckCircle2,
  XCircle,
  Clock,
  Filter
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useState } from "react";
import type { AuditEntry } from "@shared/schema";

const statusConfig = {
  success: { 
    color: "bg-status-online/10 text-status-online border-status-online", 
    icon: <CheckCircle2 className="h-3 w-3" />,
    label: "Success"
  },
  failure: { 
    color: "bg-status-busy/10 text-status-busy border-status-busy", 
    icon: <XCircle className="h-3 w-3" />,
    label: "Failure"
  },
  pending: { 
    color: "bg-status-away/10 text-status-away border-status-away", 
    icon: <Clock className="h-3 w-3" />,
    label: "Pending"
  },
};

function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function AuditPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: auditEntries, isLoading } = useQuery<AuditEntry[]>({
    queryKey: ["/api/audit"],
  });

  const filteredEntries = auditEntries?.filter((entry) => {
    const matchesSearch = 
      entry.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.user.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.target.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || entry.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: auditEntries?.length || 0,
    success: auditEntries?.filter(e => e.status === "success").length || 0,
    failure: auditEntries?.filter(e => e.status === "failure").length || 0,
    pending: auditEntries?.filter(e => e.status === "pending").length || 0,
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-4 p-4 border-b border-border bg-card/50">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Audit Trail</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Compliance and action logging
          </p>
        </div>
        <Button variant="outline" className="gap-1.5" data-testid="button-export-audit">
          <Download className="h-4 w-4" />
          Export Logs
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Entries</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-semibold" data-testid="stat-total">{stats.total}</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-status-online" />
                Successful
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-semibold text-status-online" data-testid="stat-success">{stats.success}</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-status-busy" />
                Failed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-semibold text-status-busy" data-testid="stat-failure">{stats.failure}</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-status-away" />
                Pending
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-semibold text-status-away" data-testid="stat-pending">{stats.pending}</span>
            </CardContent>
          </Card>
        </div>

        <Card className="flex-1">
          <CardHeader className="pb-3">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search audit logs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-audit"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36" data-testid="select-status">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="failure">Failure</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-20" />
                ))}
              </div>
            ) : (
              <ScrollArea className="h-[calc(100vh-380px)]">
                <div className="space-y-2 pr-4">
                  {filteredEntries?.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <ClipboardList className="h-12 w-12 text-muted-foreground mb-3" />
                      <p className="text-sm font-medium">No audit entries found</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Try adjusting your search or filter
                      </p>
                    </div>
                  ) : (
                    filteredEntries?.map((entry) => {
                      const config = statusConfig[entry.status];
                      return (
                        <div
                          key={entry.id}
                          className="p-3 rounded-md bg-muted/30 hover-elevate border border-border/50"
                          data-testid={`audit-entry-${entry.id}`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-sm">{entry.action}</span>
                                <Badge variant="outline" className={cn("gap-1 text-xs", config.color)}>
                                  {config.icon}
                                  {config.label}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                                <span>User: <span className="font-medium text-foreground">{entry.user}</span></span>
                                <span>Target: <span className="font-mono">{entry.target}</span></span>
                              </div>
                              {entry.details && (
                                <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                                  {entry.details}
                                </p>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground whitespace-nowrap font-mono">
                              {formatDateTime(entry.timestamp)}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
