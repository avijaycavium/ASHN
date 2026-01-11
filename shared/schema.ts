import { pgTable, text, serial, integer, boolean, timestamp, real, jsonb } from "drizzle-orm/pg-core";
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

export type DeviceType = "core" | "spine" | "tor" | "endpoint";
export type DeviceStatus = "healthy" | "degraded" | "critical" | "offline";
export type DeviceRole = "management" | "fabric" | "endpoint" | "transit";
export type DeviceTier = "core" | "spine" | "tor" | "endpoint" | "management";

export interface BGPConfig {
  asn: number;
  routerId: string;
  neighbors: Array<{
    peerIp: string;
    remoteAsn: number;
    weight: number;
    timers: { keepalive: number; hold: number };
  }>;
}

export interface TelemetryExporterConfig {
  enabled: boolean;
  port: number;
  scrapeInterval: number;
  metricsPath: string;
}

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
  role?: DeviceRole;
  tier?: DeviceTier;
  bgpConfig?: BGPConfig;
  mgmtIp?: string;
  dataIp?: string;
  telemetryExporter?: TelemetryExporterConfig;
}

export const devices = pgTable("devices", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  status: text("status").notNull().default("healthy"),
  location: text("location").notNull(),
  cpu: real("cpu").notNull().default(0),
  memory: real("memory").notNull().default(0),
  uptime: text("uptime").notNull().default("0d 0h"),
  ipAddress: text("ip_address").notNull(),
  ports: integer("ports").notNull().default(4),
  activePorts: integer("active_ports").notNull().default(0),
  role: text("role"),
  tier: text("tier"),
  mgmtIp: text("mgmt_ip"),
  dataIp: text("data_ip"),
  bgpConfig: jsonb("bgp_config"),
  telemetryExporter: jsonb("telemetry_exporter"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const topologyLinks = pgTable("topology_links", {
  id: text("id").primaryKey(),
  sourceId: text("source_id").notNull().references(() => devices.id),
  targetId: text("target_id").notNull().references(() => devices.id),
  sourcePort: integer("source_port").notNull(),
  targetPort: integer("target_port").notNull(),
  status: text("status").notNull().default("active"),
  bandwidth: integer("bandwidth").notNull().default(10000),
  utilization: real("utilization").notNull().default(0),
  linkType: text("link_type").notNull().default("data"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const incidents = pgTable("incidents", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  severity: text("severity").notNull(),
  status: text("status").notNull().default("active"),
  ttd: integer("ttd"),
  ttr: integer("ttr"),
  tttr: integer("tttr"),
  affectedDevices: jsonb("affected_devices").notNull().default([]),
  rootCause: text("root_cause"),
  confidence: real("confidence").notNull().default(0),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  resolvedAt: timestamp("resolved_at"),
});

export const timelineEvents = pgTable("timeline_events", {
  id: text("id").primaryKey(),
  incidentId: text("incident_id").notNull().references(() => incidents.id),
  timestamp: timestamp("timestamp").default(sql`CURRENT_TIMESTAMP`).notNull(),
  event: text("event").notNull(),
  agent: text("agent").notNull(),
  details: text("details").notNull(),
});

export const remediationSteps = pgTable("remediation_steps", {
  id: text("id").primaryKey(),
  incidentId: text("incident_id").notNull().references(() => incidents.id),
  step: integer("step").notNull(),
  description: text("description").notNull(),
  status: text("status").notNull().default("pending"),
  command: text("command"),
  output: text("output"),
  executedAt: timestamp("executed_at"),
});

export const agents = pgTable("agents", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  status: text("status").notNull().default("idle"),
  currentTask: text("current_task"),
  processedTasks: integer("processed_tasks").notNull().default(0),
  successRate: real("success_rate").notNull().default(100),
  lastActive: timestamp("last_active").default(sql`CURRENT_TIMESTAMP`).notNull(),
  capabilities: jsonb("capabilities").notNull().default([]),
  config: jsonb("config").notNull().default({}),
  heartbeatInterval: integer("heartbeat_interval").notNull().default(30),
  lastHeartbeat: timestamp("last_heartbeat"),
});

export const agentTasks = pgTable("agent_tasks", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  priority: text("priority").notNull().default("medium"),
  status: text("status").notNull().default("queued"),
  assignedAgentId: text("assigned_agent_id").references(() => agents.id),
  payload: jsonb("payload").notNull().default({}),
  result: jsonb("result"),
  error: text("error"),
  retryCount: integer("retry_count").notNull().default(0),
  maxRetries: integer("max_retries").notNull().default(3),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  assignedAt: timestamp("assigned_at"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  incidentId: text("incident_id").references(() => incidents.id),
  deviceIds: jsonb("device_ids").notNull().default([]),
  parentTaskId: text("parent_task_id"),
});

export const faultInjections = pgTable("fault_injections", {
  id: text("id").primaryKey(),
  deviceId: text("device_id").notNull().references(() => devices.id),
  faultType: text("fault_type").notNull(),
  severity: text("severity").notNull().default("medium"),
  duration: integer("duration"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  expiresAt: timestamp("expires_at"),
});

export const insertDeviceSchema = createInsertSchema(devices).omit({ createdAt: true, updatedAt: true });
export const insertTopologyLinkSchema = createInsertSchema(topologyLinks).omit({ createdAt: true });
export const insertIncidentSchema = createInsertSchema(incidents).omit({ createdAt: true, updatedAt: true, resolvedAt: true });
export const insertTimelineEventSchema = createInsertSchema(timelineEvents);
export const insertRemediationStepSchema = createInsertSchema(remediationSteps);
export const insertAgentSchema = createInsertSchema(agents).omit({ lastActive: true, lastHeartbeat: true });
export const insertAgentTaskSchema = createInsertSchema(agentTasks).omit({ createdAt: true, assignedAt: true, startedAt: true, completedAt: true });
export const insertFaultInjectionSchema = createInsertSchema(faultInjections).omit({ createdAt: true });

export type InsertDevice = z.infer<typeof insertDeviceSchema>;
export type InsertTopologyLink = z.infer<typeof insertTopologyLinkSchema>;
export type InsertIncident = z.infer<typeof insertIncidentSchema>;
export type InsertTimelineEvent = z.infer<typeof insertTimelineEventSchema>;
export type InsertRemediationStep = z.infer<typeof insertRemediationStepSchema>;
export type InsertAgent = z.infer<typeof insertAgentSchema>;
export type InsertAgentTask = z.infer<typeof insertAgentTaskSchema>;
export type InsertFaultInjection = z.infer<typeof insertFaultInjectionSchema>;

export type DbDevice = typeof devices.$inferSelect;
export type DbTopologyLink = typeof topologyLinks.$inferSelect;
export type DbIncident = typeof incidents.$inferSelect;
export type DbTimelineEvent = typeof timelineEvents.$inferSelect;
export type DbRemediationStep = typeof remediationSteps.$inferSelect;
export type DbAgent = typeof agents.$inferSelect;
export type DbAgentTask = typeof agentTasks.$inferSelect;
export type DbFaultInjection = typeof faultInjections.$inferSelect;

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
  cpu: number;
  memory: number;
  portUtilization: number;
  latency: number;
  packetDrops: number;
  bgpPeers: number;
  deviceId?: string;
  tier?: DeviceTier;
}

export const metricsTimeseries = pgTable("metrics_timeseries", {
  id: serial("id").primaryKey(),
  deviceId: text("device_id").notNull().references(() => devices.id),
  collectedAt: timestamp("collected_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  cpu: real("cpu").notNull().default(0),
  memory: real("memory").notNull().default(0),
  portUtilization: real("port_utilization").notNull().default(0),
  latency: real("latency").notNull().default(0),
  packetDrops: integer("packet_drops").notNull().default(0),
  bgpPeers: integer("bgp_peers").notNull().default(0),
});

export const insertMetricsTimeseriesSchema = createInsertSchema(metricsTimeseries).omit({ id: true });
export type InsertMetricsTimeseries = z.infer<typeof insertMetricsTimeseriesSchema>;
export type MetricsTimeseries = typeof metricsTimeseries.$inferSelect;

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
