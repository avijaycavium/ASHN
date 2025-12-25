import { useQuery } from "@tanstack/react-query";
import { 
  Bot, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Zap,
  Activity,
  BarChart3,
  RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Agent, AgentStatus } from "@shared/schema";

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

export default function AgentsPage() {
  const { data: agents, isLoading } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
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

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-4 p-4 border-b border-border bg-card/50">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Agents</h1>
          <p className="text-sm text-muted-foreground mt-1">
            AI agent status and execution monitoring
          </p>
        </div>
        <Button variant="outline" className="gap-1.5" data-testid="button-refresh-agents">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
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
          {isLoading ? (
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
                        agent.status === "error" && "bg-status-busy text-white"
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
      </div>
    </div>
  );
}
