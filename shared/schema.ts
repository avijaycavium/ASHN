import { pgTable, text, serial, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

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

export type AgentStatus = "active" | "processing" | "idle" | "error";

export interface Agent {
  id: string;
  name: string;
  type: string;
  status: AgentStatus;
  currentTask: string | null;
  processedTasks: number;
  successRate: number;
  lastActive: string;
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
