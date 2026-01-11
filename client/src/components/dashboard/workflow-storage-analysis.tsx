import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Database, 
  ChevronDown, 
  ChevronRight,
  Server,
  Clock,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Activity,
  Brain,
  Wrench,
  Target
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface StageDetails {
  detection?: {
    ttd?: number;
    method?: string;
    anomalyType?: string;
    confidence?: number;
    metrics?: Record<string, { baseline?: string; current?: string; deviation?: string }>;
  };
  diagnosis?: {
    rootCause?: string;
    confidence?: number;
    hypothesis?: string;
    evidence?: string[];
    affectedDevices?: string[];
    alternateRoutes?: number;
  };
  remediation?: {
    actionsExecuted?: string[];
    plan?: string[];
    risk?: string;
    riskLevel?: string;
    policyCheck?: string;
    estimatedTime?: string;
    rollbackPlan?: string;
  };
  verification?: {
    ttr?: number;
    tttr?: number;
    successCriteria?: Array<{ criterion: string; met: boolean }>;
    metricsComparison?: Record<string, { before: string; after: string; improvement: string }>;
  };
}

interface InternalLogEntry {
  timestamp: string;
  stage: string;
  agent: string;
  log_type: string;
  title: string;
  content: Record<string, unknown>;
}

interface WorkflowStorageAnalysisProps {
  incidentId: string | null;
  stage: string;
  startedAt: string | null;
  stageDetails: StageDetails;
  internalLogs: InternalLogEntry[];
  deviceId?: string | null;
  faultType?: string | null;
  className?: string;
}

const stageIcons: Record<string, typeof Database> = {
  detection: Activity,
  diagnosis: Brain,
  rca: Brain,
  remediation: Wrench,
  verification: Target,
  resolved: CheckCircle2,
};

const stageColors: Record<string, string> = {
  detection: "text-yellow-500",
  diagnosis: "text-blue-500",
  rca: "text-blue-500",
  remediation: "text-orange-500",
  verification: "text-green-500",
  resolved: "text-emerald-500",
};

function StateSection({ 
  title, 
  icon: Icon, 
  children, 
  defaultOpen = true,
  badgeText,
  badgeVariant = "secondary"
}: { 
  title: string; 
  icon: typeof Database; 
  children: React.ReactNode;
  defaultOpen?: boolean;
  badgeText?: string;
  badgeVariant?: "default" | "secondary" | "destructive" | "outline";
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <div className="flex items-center justify-between p-3 rounded-lg hover-elevate cursor-pointer bg-muted/30 border border-border/50 mb-2">
          <div className="flex items-center gap-2">
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <Icon className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">{title}</span>
          </div>
          {badgeText && (
            <Badge variant={badgeVariant} className="text-xs">
              {badgeText}
            </Badge>
          )}
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-6 pl-4 border-l border-border/50 mb-3">
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function KeyValueDisplay({ data, className }: { data: Record<string, unknown>; className?: string }) {
  return (
    <div className={cn("space-y-1 text-sm", className)}>
      {Object.entries(data).map(([key, value]) => (
        <div key={key} className="flex items-start gap-2">
          <span className="text-muted-foreground min-w-[120px] font-mono text-xs">{key}:</span>
          <span className="font-mono text-xs break-all">
            {typeof value === "object" ? JSON.stringify(value, null, 2) : String(value)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function WorkflowStorageAnalysis({
  incidentId,
  stage,
  startedAt,
  stageDetails,
  internalLogs,
  deviceId,
  faultType,
  className
}: WorkflowStorageAnalysisProps) {
  const StageIcon = stageIcons[stage] || Activity;
  const stageColor = stageColors[stage] || "text-muted-foreground";
  
  const agentDecisions = internalLogs.filter(log => log.log_type === "decision");
  const toolCalls = internalLogs.filter(log => log.log_type === "tool_call");
  const reasoning = internalLogs.filter(log => log.log_type === "reasoning");
  
  const stageTransitions = [
    { stage: "detection", completed: !!stageDetails.detection },
    { stage: "diagnosis", completed: !!stageDetails.diagnosis },
    { stage: "remediation", completed: !!stageDetails.remediation },
    { stage: "verification", completed: !!stageDetails.verification },
  ];

  if (!incidentId) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="h-4 w-4" />
            Workflow Storage Analysis
          </CardTitle>
          <CardDescription>
            State and data stored by agents during workflow execution
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Database className="h-8 w-8 mb-2" />
            <p className="text-sm">Start a scenario to see workflow state data</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Database className="h-4 w-4" />
          Workflow Storage Analysis
        </CardTitle>
        <CardDescription>
          Complete state snapshot showing all data stored during the healing workflow
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px]">
          <div className="pr-4 space-y-2">
            <StateSection 
              title="Incident Metadata" 
              icon={Server}
              badgeText={stage}
              badgeVariant={stage === "resolved" ? "default" : "secondary"}
            >
              <div className="space-y-2 py-2">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Incident ID:</span>
                    <span className="ml-2 font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{incidentId}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Started:</span>
                    <span className="ml-2 font-mono text-xs">{startedAt ? new Date(startedAt).toLocaleTimeString() : "N/A"}</span>
                  </div>
                  {deviceId && (
                    <div>
                      <span className="text-muted-foreground">Target Device:</span>
                      <span className="ml-2 font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{deviceId}</span>
                    </div>
                  )}
                  {faultType && (
                    <div>
                      <span className="text-muted-foreground">Fault Type:</span>
                      <span className="ml-2 font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{faultType}</span>
                    </div>
                  )}
                </div>
                <div className="mt-3">
                  <span className="text-muted-foreground text-sm">Current Stage:</span>
                  <div className="flex items-center gap-2 mt-1">
                    <StageIcon className={cn("h-5 w-5", stageColor)} />
                    <span className={cn("font-medium capitalize", stageColor)}>{stage}</span>
                  </div>
                </div>
              </div>
            </StateSection>

            <StateSection 
              title="Stage Transitions" 
              icon={Clock}
              badgeText={`${stageTransitions.filter(s => s.completed).length}/${stageTransitions.length}`}
            >
              <div className="py-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {stageTransitions.map((transition, idx) => (
                    <div key={transition.stage} className="flex items-center gap-1">
                      <div className={cn(
                        "h-6 w-6 rounded-full flex items-center justify-center text-xs font-medium",
                        transition.completed 
                          ? "bg-status-online text-white" 
                          : stage === transition.stage 
                            ? "bg-yellow-500 text-white animate-pulse"
                            : "bg-muted text-muted-foreground"
                      )}>
                        {transition.completed ? "✓" : idx + 1}
                      </div>
                      <span className={cn(
                        "text-xs capitalize",
                        transition.completed ? "text-status-online" : "text-muted-foreground"
                      )}>
                        {transition.stage}
                      </span>
                      {idx < stageTransitions.length - 1 && (
                        <div className={cn(
                          "w-4 h-0.5 mx-1",
                          transition.completed ? "bg-status-online" : "bg-muted"
                        )} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </StateSection>

            <StateSection 
              title="Agent Decisions" 
              icon={Zap}
              badgeText={`${agentDecisions.length} decisions`}
            >
              <div className="space-y-2 py-2">
                {agentDecisions.length > 0 ? agentDecisions.map((decision, idx) => (
                  <div key={idx} className="border border-border/50 rounded-lg p-2 bg-card">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs">{decision.agent}</Badge>
                      <span className="text-xs text-muted-foreground">{decision.title}</span>
                    </div>
                    <KeyValueDisplay data={decision.content} />
                  </div>
                )) : (
                  <p className="text-sm text-muted-foreground">No decisions recorded yet</p>
                )}
              </div>
            </StateSection>

            <StateSection 
              title="Tool Invocations" 
              icon={Wrench}
              badgeText={`${toolCalls.length} calls`}
              defaultOpen={false}
            >
              <div className="space-y-2 py-2">
                {toolCalls.length > 0 ? toolCalls.map((call, idx) => (
                  <div key={idx} className="border border-border/50 rounded-lg p-2 bg-card">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="secondary" className="text-xs">{call.agent}</Badge>
                      <span className="text-xs font-medium">{call.title}</span>
                    </div>
                    <KeyValueDisplay data={call.content} />
                  </div>
                )) : (
                  <p className="text-sm text-muted-foreground">No tool calls recorded yet</p>
                )}
              </div>
            </StateSection>

            <StateSection 
              title="Agent Reasoning" 
              icon={Brain}
              badgeText={`${reasoning.length} entries`}
              defaultOpen={false}
            >
              <div className="space-y-2 py-2">
                {reasoning.length > 0 ? reasoning.map((entry, idx) => (
                  <div key={idx} className="border border-border/50 rounded-lg p-2 bg-card">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className="text-xs bg-purple-500/10 text-purple-600 border-purple-500/20">{entry.agent}</Badge>
                      <span className="text-xs font-medium">{entry.title}</span>
                    </div>
                    <KeyValueDisplay data={entry.content} />
                  </div>
                )) : (
                  <p className="text-sm text-muted-foreground">No reasoning entries recorded yet</p>
                )}
              </div>
            </StateSection>

            {stageDetails.detection && (
              <StateSection 
                title="Detection State" 
                icon={Activity}
                badgeText={`${stageDetails.detection.confidence}% confidence`}
              >
                <div className="py-2 space-y-2">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-muted-foreground">TTD:</span> <span className="font-mono">{stageDetails.detection.ttd}s</span></div>
                    <div><span className="text-muted-foreground">Method:</span> <span className="text-xs">{stageDetails.detection.method}</span></div>
                    <div><span className="text-muted-foreground">Anomaly:</span> <span className="font-mono text-xs">{stageDetails.detection.anomalyType}</span></div>
                  </div>
                  {stageDetails.detection.metrics && (
                    <div className="mt-2">
                      <span className="text-xs text-muted-foreground">Metrics Deviation:</span>
                      <div className="mt-1 space-y-1">
                        {Object.entries(stageDetails.detection.metrics).map(([key, val]) => (
                          <div key={key} className="text-xs font-mono bg-muted/50 rounded px-2 py-1">
                            {key}: {val.baseline} → {val.current} ({val.deviation})
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </StateSection>
            )}

            {stageDetails.diagnosis && (
              <StateSection 
                title="Diagnosis State" 
                icon={Brain}
                badgeText={`${stageDetails.diagnosis.confidence}% confidence`}
              >
                <div className="py-2 space-y-2">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Root Cause:</span>
                    <p className="font-medium text-xs mt-1">{stageDetails.diagnosis.rootCause}</p>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Hypothesis:</span>
                    <p className="text-xs mt-1">{stageDetails.diagnosis.hypothesis}</p>
                  </div>
                  {stageDetails.diagnosis.evidence && (
                    <div>
                      <span className="text-xs text-muted-foreground">Evidence:</span>
                      <ul className="mt-1 text-xs space-y-0.5">
                        {stageDetails.diagnosis.evidence.map((e, i) => (
                          <li key={i} className="text-muted-foreground">• {e}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </StateSection>
            )}

            {stageDetails.remediation && (
              <StateSection 
                title="Remediation State" 
                icon={Wrench}
                badgeText={stageDetails.remediation.risk || stageDetails.remediation.riskLevel || "N/A"}
              >
                <div className="py-2 space-y-2">
                  {(stageDetails.remediation.actionsExecuted || stageDetails.remediation.plan) && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Actions/Plan:</span>
                      <div className="mt-1 space-y-0.5">
                        {(stageDetails.remediation.actionsExecuted || stageDetails.remediation.plan)?.map((action, i) => (
                          <div key={i} className="text-xs font-mono bg-muted/50 rounded px-2 py-1">
                            {action}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {stageDetails.remediation.estimatedTime && (
                    <div className="text-xs">
                      <span className="text-muted-foreground">Estimated Time:</span>
                      <span className="ml-2">{stageDetails.remediation.estimatedTime}</span>
                    </div>
                  )}
                  {stageDetails.remediation.policyCheck && (
                    <div className="text-xs">
                      <span className="text-muted-foreground">Policy Check:</span>
                      <span className="ml-2">{stageDetails.remediation.policyCheck}</span>
                    </div>
                  )}
                </div>
              </StateSection>
            )}

            {stageDetails.verification && (
              <StateSection 
                title="Verification State" 
                icon={CheckCircle2}
                badgeText={`TTR: ${stageDetails.verification.ttr}s`}
              >
                <div className="py-2 space-y-2">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-muted-foreground">TTR:</span> <span className="font-mono">{stageDetails.verification.ttr}s</span></div>
                    <div><span className="text-muted-foreground">TTTR:</span> <span className="font-mono">{stageDetails.verification.tttr}s</span></div>
                  </div>
                  {stageDetails.verification.successCriteria && (
                    <div>
                      <span className="text-xs text-muted-foreground">Success Criteria:</span>
                      <div className="mt-1 space-y-0.5">
                        {stageDetails.verification.successCriteria.map((c, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            {c.met ? (
                              <CheckCircle2 className="h-3 w-3 text-status-online" />
                            ) : (
                              <AlertTriangle className="h-3 w-3 text-status-busy" />
                            )}
                            <span>{c.criterion}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </StateSection>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
