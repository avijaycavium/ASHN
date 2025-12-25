import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type DeviceType = "core" | "spine" | "tor" | "dpu";
export type DeviceStatus = "healthy" | "degraded" | "critical" | "offline";

export interface Device {
  id: string;
  name: string;
  type: DeviceType;
  status: DeviceStatus;
  location: string;
  cpu: number;
  memory: number;
  uptime: string;
  ipAddress: string;
  ports: number;
  activePorts: number;
}

export type IncidentSeverity = "critical" | "high" | "medium" | "low";
export type IncidentStatus = "active" | "investigating" | "remediating" | "resolved" | "closed";

export interface Incident {
  id: string;
  title: string;
  description: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  ttd: number;
  ttr: number | null;
  tttr: number | null;
  affectedDevices: string[];
  rootCause: string | null;
  confidence: number;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

export interface TimelineEvent {
  id: string;
  incidentId: string;
  timestamp: string;
  event: string;
  agent: string;
  details: string;
}

export type RemediationStepStatus = "pending" | "running" | "completed" | "failed";

export interface RemediationStep {
  id: string;
  incidentId: string;
  step: number;
  description: string;
  status: RemediationStepStatus;
}

export type AgentStatus = "active" | "processing" | "idle" | "error" | "offline";
export type AgentType = "monitor" | "anomaly" | "rca" | "remediation" | "verification" | "learning" | "compliance" | "telemetry";

export interface AgentCapability {
  name: string;
  description: string;
  parameters?: Record<string, string>;
}

export interface Agent {
  id: string;
  name: string;
  type: AgentType;
  status: AgentStatus;
  currentTask: string | null;
  processedTasks: number;
  successRate: number;
  lastActive: string;
  capabilities: AgentCapability[];
  config: Record<string, unknown>;
  heartbeatInterval: number;
  lastHeartbeat: string | null;
}

export type TaskPriority = "critical" | "high" | "medium" | "low";
export type TaskStatus = "queued" | "assigned" | "running" | "completed" | "failed" | "cancelled";
export type TaskType = "monitor" | "analyze" | "diagnose" | "remediate" | "verify" | "learn";

export interface AgentTask {
  id: string;
  type: TaskType;
  priority: TaskPriority;
  status: TaskStatus;
  assignedAgentId: string | null;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error: string | null;
  retryCount: number;
  maxRetries: number;
  createdAt: string;
  assignedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  incidentId: string | null;
  deviceIds: string[];
  parentTaskId: string | null;
}

export interface AgentExecution {
  id: string;
  taskId: string;
  agentId: string;
  status: "running" | "completed" | "failed";
  startedAt: string;
  completedAt: string | null;
  output: Record<string, unknown> | null;
  logs: string[];
  metrics: {
    durationMs: number | null;
    cpuUsage: number | null;
    memoryUsage: number | null;
  };
  confidence: number | null;
}

export interface Playbook {
  id: string;
  name: string;
  description: string;
  triggerConditions: {
    incidentSeverity?: IncidentSeverity[];
    deviceTypes?: DeviceType[];
    patterns?: string[];
  };
  steps: PlaybookStep[];
  autoApprove: boolean;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PlaybookStep {
  id: string;
  order: number;
  action: string;
  description: string;
  parameters: Record<string, unknown>;
  rollbackAction: string | null;
  timeout: number;
  continueOnFailure: boolean;
}

export interface AgentEvent {
  id: string;
  agentId: string;
  taskId: string | null;
  eventType: "task_started" | "task_completed" | "task_failed" | "heartbeat" | "status_change" | "action_executed";
  message: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface OrchestratorStatus {
  status: "running" | "paused" | "stopped";
  activeAgents: number;
  totalAgents: number;
  queuedTasks: number;
  runningTasks: number;
  completedTasks24h: number;
  failedTasks24h: number;
  avgTaskDurationMs: number;
}

export type AuditStatus = "success" | "failure" | "pending";

export interface AuditEntry {
  id: string;
  timestamp: string;
  action: string;
  user: string;
  target: string;
  details: string;
  status: AuditStatus;
}

export interface MetricTrend {
  timestamp: string;
  snr: number;
  ber: number;
  fec: number;
  cpu: number;
  latency: number;
}

export interface SystemHealth {
  cpu: number;
  memory: number;
  latencyP95: number;
  apiLatency: number;
  activeSessions: number;
  totalDevices: number;
  healthyDevices: number;
  degradedDevices: number;
  criticalDevices: number;
}

export interface KPIMetrics {
  avgTTD: number;
  avgTTR: number;
  avgMTTR: number;
  ttdChange: number;
  ttrChange: number;
  mttrChange: number;
  activeIncidents: number;
  resolvedToday: number;
}

export interface LearningUpdate {
  id: string;
  pattern: string;
  description: string;
  timestamp: string;
}

export interface TopologyLink {
  id: string;
  sourceId: string;
  targetId: string;
  sourcePort: number;
  targetPort: number;
  status: "active" | "inactive" | "error";
  bandwidth: number;
  utilization: number;
}

export interface GNS3Settings {
  serverUrl: string;
  projectId: string;
  username: string;
  password: string;
  enabled: boolean;
  lastConnected: string | null;
  connectionStatus: "connected" | "disconnected" | "error";
}

export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  createdAt: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
});

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
