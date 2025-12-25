import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Device types and status
export type DeviceType = "core" | "spine" | "tor" | "dpu";
export type DeviceStatus = "healthy" | "degraded" | "critical" | "offline";

// Device interface
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

// Incident types
export type IncidentSeverity = "critical" | "high" | "medium" | "low";
export type IncidentStatus = "active" | "investigating" | "remediating" | "resolved" | "closed";

export interface Incident {
  id: string;
  title: string;
  description: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  ttd: number; // Time to Detect (seconds)
  ttr: number | null; // Time to Remediate (seconds)
  tttr: number | null; // Time to Total Recovery (seconds)
  affectedDevices: string[];
  rootCause: string | null;
  confidence: number;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

// Incident timeline event
export interface TimelineEvent {
  id: string;
  incidentId: string;
  timestamp: string;
  event: string;
  agent: string;
  details: string;
}

// Remediation step
export interface RemediationStep {
  id: string;
  incidentId: string;
  step: number;
  description: string;
  status: "pending" | "running" | "completed" | "failed";
}

// Agent types
export type AgentStatus = "active" | "idle" | "processing" | "error";

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

// Metrics
export interface Metric {
  id: string;
  deviceId: string;
  name: string;
  value: number;
  unit: string;
  timestamp: string;
}

export interface MetricTrend {
  timestamp: string;
  snr: number;
  ber: number;
  fec: number;
  cpu: number;
  latency: number;
}

// System health
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

// Audit log entry
export interface AuditEntry {
  id: string;
  timestamp: string;
  action: string;
  user: string;
  target: string;
  details: string;
  status: "success" | "failure" | "pending";
}

// KPI metrics
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

// Learning update
export interface LearningUpdate {
  id: string;
  pattern: string;
  description: string;
  timestamp: string;
}

// Insert schemas for API validation
export const insertDeviceSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["core", "spine", "tor", "dpu"]),
  status: z.enum(["healthy", "degraded", "critical", "offline"]),
  location: z.string().min(1),
  ipAddress: z.string().min(1),
  ports: z.number().int().positive(),
});

export const insertIncidentSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  severity: z.enum(["critical", "high", "medium", "low"]),
  affectedDevices: z.array(z.string()),
});

export type InsertDevice = z.infer<typeof insertDeviceSchema>;
export type InsertIncident = z.infer<typeof insertIncidentSchema>;
