import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bot, CheckCircle2, Clock, AlertCircle, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Agent, AgentStatus as AgentStatusType } from "@shared/schema";

interface AgentStatusProps {
  agents: Agent[];
}

const statusConfig: Record<AgentStatusType, { color: string; icon: React.ReactNode; label: string }> = {
  active: {
    color: "bg-status-online text-white",
    icon: <Zap className="h-3 w-3" />,
    label: "Active",
  },
  processing: {
    color: "bg-primary text-primary-foreground",
    icon: <Clock className="h-3 w-3 animate-spin" />,
    label: "Processing",
  },
  idle: {
    color: "bg-muted text-muted-foreground",
    icon: <CheckCircle2 className="h-3 w-3" />,
    label: "Idle",
  },
  error: {
    color: "bg-status-busy text-white",
    icon: <AlertCircle className="h-3 w-3" />,
    label: "Error",
  },
};

export function AgentStatusCard({ agents }: AgentStatusProps) {
  const activeAgents = agents.filter((a) => a.status === "processing" || a.status === "active");
  const currentAgent = agents.find((a) => a.status === "processing");

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <div>
          <CardTitle className="text-base">Agent Execution Status</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            {activeAgents.length} agents active
          </p>
        </div>
        <Bot className="h-5 w-5 text-muted-foreground" />
      </CardHeader>
      <CardContent className="space-y-4">
        {currentAgent && (
          <div className="p-3 rounded-md bg-primary/10 border border-primary/20">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Currently Running</span>
              <Badge className="bg-primary text-primary-foreground gap-1">
                <Clock className="h-3 w-3 animate-spin" />
                Processing
              </Badge>
            </div>
            <div className="mt-2">
              <span className="text-sm font-medium">{currentAgent.name}</span>
              {currentAgent.currentTask && (
                <p className="text-xs text-muted-foreground mt-1">
                  {currentAgent.currentTask}
                </p>
              )}
            </div>
          </div>
        )}

        <div className="space-y-2">
          {agents.slice(0, 6).map((agent) => {
            const config = statusConfig[agent.status];
            return (
              <div
                key={agent.id}
                className="flex items-center justify-between p-2 rounded-md hover-elevate"
                data-testid={`agent-${agent.id}`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "h-2 w-2 rounded-full",
                      agent.status === "active" || agent.status === "processing"
                        ? "bg-status-online animate-pulse"
                        : agent.status === "error"
                        ? "bg-status-busy"
                        : "bg-muted-foreground"
                    )}
                  />
                  <span className="text-sm">{agent.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground font-mono">
                    {agent.successRate}%
                  </span>
                  <Badge
                    variant="outline"
                    className={cn("text-xs gap-1", config.color)}
                  >
                    {config.icon}
                    {config.label}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
