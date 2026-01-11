import { useState } from "react";
import { 
  ChevronDown, 
  ChevronRight, 
  Database, 
  Brain, 
  Wrench, 
  MessageSquare,
  Lightbulb,
  Target,
  Clock,
  Server,
  Cpu,
  Download
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface InternalLogEntry {
  timestamp: string;
  stage: string;
  agent: string;
  log_type: string;
  title: string;
  content: Record<string, unknown>;
}

interface AgentInternalLogsProps {
  logs: InternalLogEntry[];
  className?: string;
}

const logTypeConfig: Record<string, { icon: typeof Database; color: string; label: string }> = {
  network_data: { icon: Server, color: "text-blue-500", label: "Network Data" },
  llm_context: { icon: Brain, color: "text-purple-500", label: "LLM Context" },
  tool_call: { icon: Wrench, color: "text-orange-500", label: "Tool Call" },
  reasoning: { icon: Lightbulb, color: "text-yellow-500", label: "Reasoning" },
  decision: { icon: Target, color: "text-green-500", label: "Decision" },
};

const stageColors: Record<string, string> = {
  detection: "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400",
  rca: "bg-blue-500/20 text-blue-600 dark:text-blue-400",
  remediation: "bg-orange-500/20 text-orange-600 dark:text-orange-400",
  verification: "bg-green-500/20 text-green-600 dark:text-green-400",
};

function formatTimestamp(ts: string): string {
  try {
    const date = new Date(ts);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      hour12: false 
    });
  } catch {
    return ts;
  }
}

function ContentRenderer({ content, depth = 0 }: { content: unknown; depth?: number }) {
  if (content === null || content === undefined) {
    return <span className="text-muted-foreground italic">null</span>;
  }

  if (typeof content === 'string') {
    if (content.length > 200) {
      return (
        <div className="font-mono text-xs bg-muted/50 p-2 rounded max-h-32 overflow-auto whitespace-pre-wrap">
          {content}
        </div>
      );
    }
    return <span className="font-mono text-xs">{content}</span>;
  }

  if (typeof content === 'number' || typeof content === 'boolean') {
    return <span className="font-mono text-xs text-primary">{String(content)}</span>;
  }

  if (Array.isArray(content)) {
    if (content.length === 0) {
      return <span className="text-muted-foreground italic text-xs">[]</span>;
    }
    return (
      <div className={cn("space-y-1", depth > 0 && "ml-3 border-l border-muted-foreground/20 pl-2")}>
        {content.map((item, index) => (
          <div key={index} className="flex items-start gap-1">
            <span className="text-muted-foreground text-xs">{index}:</span>
            <ContentRenderer content={item} depth={depth + 1} />
          </div>
        ))}
      </div>
    );
  }

  if (typeof content === 'object') {
    const entries = Object.entries(content as Record<string, unknown>);
    if (entries.length === 0) {
      return <span className="text-muted-foreground italic text-xs">{"{}"}</span>;
    }
    return (
      <div className={cn("space-y-1", depth > 0 && "ml-3 border-l border-muted-foreground/20 pl-2")}>
        {entries.map(([key, value]) => (
          <div key={key} className="flex items-start gap-1">
            <span className="text-muted-foreground text-xs font-medium shrink-0">{key}:</span>
            <div className="flex-1 min-w-0">
              <ContentRenderer content={value} depth={depth + 1} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return <span className="text-xs">{String(content)}</span>;
}

function LogEntryCard({ log, index }: { log: InternalLogEntry; index: number }) {
  const [isOpen, setIsOpen] = useState(false);
  const config = logTypeConfig[log.log_type] || { icon: Database, color: "text-muted-foreground", label: log.log_type };
  const Icon = config.icon;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <div 
          className="flex items-start gap-2 p-2 rounded-lg hover-elevate cursor-pointer bg-card border border-border/50"
          data-testid={`internal-log-entry-${index}`}
        >
          <div className="flex items-center gap-1 shrink-0 mt-0.5">
            {isOpen ? (
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
            )}
            <Icon className={cn("h-4 w-4", config.color)} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm">{log.title}</span>
              <Badge variant="outline" className={cn("text-xs h-5", stageColors[log.stage])}>
                {log.stage}
              </Badge>
              <Badge variant="outline" className="text-xs h-5">
                {log.agent}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
              <Clock className="h-3 w-3" />
              {formatTimestamp(log.timestamp)}
              <span className="text-muted-foreground/50">|</span>
              <span className={config.color}>{config.label}</span>
            </div>
          </div>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-1 ml-6 p-3 rounded-lg bg-muted/30 border border-border/30">
          <ContentRenderer content={log.content} />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function AgentInternalLogs({ logs, className }: AgentInternalLogsProps) {
  const [expandedStages, setExpandedStages] = useState<Record<string, boolean>>({
    detection: true,
    rca: true,
    remediation: true,
    verification: true,
  });
  const { toast } = useToast();

  const handleExportLogs = () => {
    if (!logs || logs.length === 0) {
      toast({
        title: "No logs to export",
        description: "Run a healing workflow first to generate logs.",
        variant: "destructive",
      });
      return;
    }

    const exportData = {
      exportedAt: new Date().toISOString(),
      totalEntries: logs.length,
      stageBreakdown: logs.reduce((acc, log) => {
        const stage = log.stage || 'unknown';
        acc[stage] = (acc[stage] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      logs: logs.map(log => ({
        timestamp: log.timestamp,
        stage: log.stage,
        agent: log.agent,
        logType: log.log_type,
        title: log.title,
        content: log.content,
      })),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `agent-logs-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Logs exported",
      description: `${logs.length} log entries exported successfully.`,
    });
  };

  if (!logs || logs.length === 0) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Cpu className="h-4 w-4" />
            Agent Internal Logs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No internal logs available. Run a healing workflow to see detailed agent activity.
          </p>
        </CardContent>
      </Card>
    );
  }

  const logsByStage = logs.reduce((acc, log) => {
    const stage = log.stage || 'unknown';
    if (!acc[stage]) acc[stage] = [];
    acc[stage].push(log);
    return acc;
  }, {} as Record<string, InternalLogEntry[]>);

  const stageOrder = ['detection', 'rca', 'remediation', 'verification'];
  const orderedStages = stageOrder.filter(s => logsByStage[s]);

  const toggleStage = (stage: string) => {
    setExpandedStages(prev => ({ ...prev, [stage]: !prev[stage] }));
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Cpu className="h-4 w-4" />
            Agent Internal Logs
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {logs.length} entries
            </Badge>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={handleExportLogs}
              data-testid="button-export-logs"
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Export
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[400px]">
          <div className="p-4 space-y-4">
            {orderedStages.map((stage) => (
              <div key={stage} data-testid={`log-stage-${stage}`}>
                <Collapsible 
                  open={expandedStages[stage]} 
                  onOpenChange={() => toggleStage(stage)}
                >
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-2 rounded-lg -mx-2">
                      {expandedStages[stage] ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                      <Badge className={cn("capitalize", stageColors[stage])}>
                        {stage === 'rca' ? 'RCA' : stage}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {logsByStage[stage].length} logs
                      </span>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="space-y-2 mt-2">
                      {logsByStage[stage].map((log, index) => (
                        <LogEntryCard 
                          key={`${stage}-${index}`} 
                          log={log} 
                          index={index}
                        />
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

export default AgentInternalLogs;
