import { eq, and } from "drizzle-orm";
import { db } from "./db";
import {
  devices,
  incidents,
  topologyLinks,
  timelineEvents,
  remediationSteps,
  agents,
  type Device,
  type Incident,
  type Agent,
  type TopologyLink,
  type TimelineEvent,
  type RemediationStep,
  type InsertDevice,
  type InsertIncident,
  type InsertTopologyLink,
  type InsertTimelineEvent,
  type InsertRemediationStep,
  type InsertAgent,
} from "@shared/schema";
import { generate52DeviceTopology } from "./topology-generator";

export class DatabaseStorage {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const existingDevices = await db.select().from(devices).limit(1);
      
      if (existingDevices.length === 0) {
        console.log("[DatabaseStorage] Seeding database with 52-device topology...");
        await this.seedTopology();
        await this.seedAgents();
        console.log("[DatabaseStorage] Database seeded successfully");
      } else {
        console.log("[DatabaseStorage] Database already seeded, using existing data");
      }
      
      this.initialized = true;
    } catch (error) {
      console.error("[DatabaseStorage] Initialization error:", error);
      throw error;
    }
  }

  private async seedTopology(): Promise<void> {
    const { devices: topologyDevices, links } = generate52DeviceTopology();

    for (const device of topologyDevices) {
      await db.insert(devices).values({
        id: device.id,
        name: device.name,
        type: device.type,
        status: device.status,
        location: device.location,
        cpu: device.cpu,
        memory: device.memory,
        uptime: device.uptime,
        ipAddress: device.ipAddress,
        ports: device.ports,
        activePorts: device.activePorts,
        role: device.role,
        tier: device.tier,
        mgmtIp: device.mgmtIp,
        dataIp: device.dataIp,
        bgpConfig: device.bgpConfig as any,
        telemetryExporter: device.telemetryExporter as any,
      }).onConflictDoNothing();
    }

    for (const link of links) {
      await db.insert(topologyLinks).values({
        id: link.id,
        sourceId: link.sourceId,
        targetId: link.targetId,
        sourcePort: link.sourcePort,
        targetPort: link.targetPort,
        status: link.status,
        bandwidth: link.bandwidth,
        utilization: link.utilization,
      }).onConflictDoNothing();
    }
  }

  private async seedAgents(): Promise<void> {
    const now = new Date();
    const agentData: InsertAgent[] = [
      {
        id: "agent-telemetry",
        name: "Telemetry Agent",
        type: "telemetry",
        status: "active",
        currentTask: "Collecting metrics from 52 devices",
        processedTasks: 15420,
        successRate: 99.8,
        capabilities: [{ name: "metric_collection", description: "Collect SONiC metrics" }],
        config: { collectionInterval: 10000 },
        heartbeatInterval: 5000,
      },
      {
        id: "agent-detection",
        name: "Detection Agent",
        type: "anomaly",
        status: "active",
        currentTask: "Monitoring for anomalies",
        processedTasks: 8934,
        successRate: 97.2,
        capabilities: [{ name: "anomaly_detection", description: "Detect metric anomalies" }],
        config: { pollingInterval: 15000 },
        heartbeatInterval: 15000,
      },
      {
        id: "agent-rca",
        name: "RCA Agent",
        type: "rca",
        status: "idle",
        currentTask: null,
        processedTasks: 892,
        successRate: 94.5,
        capabilities: [{ name: "root_cause_analysis", description: "Analyze incident root causes" }],
        config: { maxDepth: 5, confidenceThreshold: 0.7 },
        heartbeatInterval: 15000,
      },
      {
        id: "agent-remediation",
        name: "Remediation Agent",
        type: "remediation",
        status: "idle",
        currentTask: null,
        processedTasks: 456,
        successRate: 98.2,
        capabilities: [{ name: "auto_remediation", description: "Execute remediation actions" }],
        config: { autoApproveThreshold: 0.95 },
        heartbeatInterval: 10000,
      },
      {
        id: "agent-verification",
        name: "Verification Agent",
        type: "verification",
        status: "idle",
        currentTask: null,
        processedTasks: 445,
        successRate: 99.5,
        capabilities: [{ name: "health_check", description: "Verify remediation success" }],
        config: { checkInterval: 5000 },
        heartbeatInterval: 10000,
      },
    ];

    for (const agent of agentData) {
      await db.insert(agents).values(agent).onConflictDoNothing();
    }
  }

  async getDevices(): Promise<Device[]> {
    const rows = await db.select().from(devices);
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      type: row.type as Device["type"],
      status: row.status as Device["status"],
      location: row.location,
      cpu: row.cpu,
      memory: row.memory,
      uptime: row.uptime,
      ipAddress: row.ipAddress,
      ports: row.ports,
      activePorts: row.activePorts,
      role: row.role as Device["role"],
      tier: row.tier as Device["tier"],
      mgmtIp: row.mgmtIp || undefined,
      dataIp: row.dataIp || undefined,
      bgpConfig: row.bgpConfig as Device["bgpConfig"],
      telemetryExporter: row.telemetryExporter as Device["telemetryExporter"],
    }));
  }

  async getDevice(id: string): Promise<Device | undefined> {
    const rows = await db.select().from(devices).where(eq(devices.id, id)).limit(1);
    if (rows.length === 0) return undefined;

    const row = rows[0];
    return {
      id: row.id,
      name: row.name,
      type: row.type as Device["type"],
      status: row.status as Device["status"],
      location: row.location,
      cpu: row.cpu,
      memory: row.memory,
      uptime: row.uptime,
      ipAddress: row.ipAddress,
      ports: row.ports,
      activePorts: row.activePorts,
      role: row.role as Device["role"],
      tier: row.tier as Device["tier"],
      mgmtIp: row.mgmtIp || undefined,
      dataIp: row.dataIp || undefined,
      bgpConfig: row.bgpConfig as Device["bgpConfig"],
      telemetryExporter: row.telemetryExporter as Device["telemetryExporter"],
    };
  }

  async updateDevice(id: string, updates: Partial<Device>): Promise<Device | undefined> {
    await db.update(devices).set({
      ...updates,
      updatedAt: new Date(),
    }).where(eq(devices.id, id));
    return this.getDevice(id);
  }

  async getIncidents(): Promise<Incident[]> {
    const rows = await db.select().from(incidents).orderBy(incidents.createdAt);
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      severity: row.severity as Incident["severity"],
      status: row.status as Incident["status"],
      ttd: row.ttd || 0,
      ttr: row.ttr,
      tttr: row.tttr,
      affectedDevices: (row.affectedDevices as string[]) || [],
      rootCause: row.rootCause,
      confidence: row.confidence,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      resolvedAt: row.resolvedAt?.toISOString() || null,
    }));
  }

  async getIncident(id: string): Promise<Incident | undefined> {
    const rows = await db.select().from(incidents).where(eq(incidents.id, id)).limit(1);
    if (rows.length === 0) return undefined;

    const row = rows[0];
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      severity: row.severity as Incident["severity"],
      status: row.status as Incident["status"],
      ttd: row.ttd || 0,
      ttr: row.ttr,
      tttr: row.tttr,
      affectedDevices: (row.affectedDevices as string[]) || [],
      rootCause: row.rootCause,
      confidence: row.confidence,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      resolvedAt: row.resolvedAt?.toISOString() || null,
    };
  }

  async createIncident(data: Omit<Incident, "createdAt" | "updatedAt" | "resolvedAt">): Promise<Incident> {
    const now = new Date();
    await db.insert(incidents).values({
      id: data.id,
      title: data.title,
      description: data.description,
      severity: data.severity,
      status: data.status,
      ttd: data.ttd,
      ttr: data.ttr,
      tttr: data.tttr,
      affectedDevices: data.affectedDevices,
      rootCause: data.rootCause,
      confidence: data.confidence,
    }).onConflictDoNothing();

    const created = await this.getIncident(data.id);
    if (!created) throw new Error("Failed to create incident");
    return created;
  }

  async updateIncident(id: string, updates: Partial<Incident>): Promise<Incident | undefined> {
    const { createdAt, updatedAt, resolvedAt, ...safeUpdates } = updates;
    await db.update(incidents).set({
      ...safeUpdates,
      updatedAt: new Date(),
      ...(resolvedAt ? { resolvedAt: new Date(resolvedAt) } : {}),
    }).where(eq(incidents.id, id));
    return this.getIncident(id);
  }

  async getTopologyLinks(): Promise<TopologyLink[]> {
    const rows = await db.select().from(topologyLinks);
    return rows.map((row) => ({
      id: row.id,
      sourceId: row.sourceId,
      targetId: row.targetId,
      sourcePort: row.sourcePort,
      targetPort: row.targetPort,
      status: row.status as TopologyLink["status"],
      bandwidth: row.bandwidth,
      utilization: row.utilization,
    }));
  }

  async getAgents(): Promise<Agent[]> {
    const rows = await db.select().from(agents);
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      type: row.type as Agent["type"],
      status: row.status as Agent["status"],
      currentTask: row.currentTask,
      processedTasks: row.processedTasks,
      successRate: row.successRate,
      lastActive: row.lastActive.toISOString(),
      capabilities: (row.capabilities as Agent["capabilities"]) || [],
      config: row.config as Agent["config"],
      heartbeatInterval: row.heartbeatInterval,
      lastHeartbeat: row.lastHeartbeat?.toISOString() || null,
    }));
  }

  async getAgent(id: string): Promise<Agent | undefined> {
    const rows = await db.select().from(agents).where(eq(agents.id, id)).limit(1);
    if (rows.length === 0) return undefined;

    const row = rows[0];
    return {
      id: row.id,
      name: row.name,
      type: row.type as Agent["type"],
      status: row.status as Agent["status"],
      currentTask: row.currentTask,
      processedTasks: row.processedTasks,
      successRate: row.successRate,
      lastActive: row.lastActive.toISOString(),
      capabilities: (row.capabilities as Agent["capabilities"]) || [],
      config: row.config as Agent["config"],
      heartbeatInterval: row.heartbeatInterval,
      lastHeartbeat: row.lastHeartbeat?.toISOString() || null,
    };
  }

  async updateAgent(id: string, updates: Partial<Agent>): Promise<Agent | undefined> {
    const { lastActive, lastHeartbeat, ...safeUpdates } = updates;
    await db.update(agents).set({
      ...safeUpdates,
      lastActive: new Date(),
      ...(lastHeartbeat ? { lastHeartbeat: new Date(lastHeartbeat) } : {}),
    }).where(eq(agents.id, id));
    return this.getAgent(id);
  }

  async createTimelineEvent(data: InsertTimelineEvent): Promise<TimelineEvent> {
    await db.insert(timelineEvents).values(data);
    return {
      id: data.id,
      incidentId: data.incidentId,
      timestamp: new Date().toISOString(),
      event: data.event,
      agent: data.agent,
      details: data.details,
    };
  }

  async getIncidentTimeline(incidentId: string): Promise<TimelineEvent[]> {
    const rows = await db.select().from(timelineEvents).where(eq(timelineEvents.incidentId, incidentId));
    return rows.map((row) => ({
      id: row.id,
      incidentId: row.incidentId,
      timestamp: row.timestamp.toISOString(),
      event: row.event,
      agent: row.agent,
      details: row.details,
    }));
  }

  async createRemediationStep(data: InsertRemediationStep): Promise<RemediationStep> {
    await db.insert(remediationSteps).values(data);
    return {
      id: data.id,
      incidentId: data.incidentId,
      step: data.step,
      description: data.description,
      status: (data.status || "pending") as RemediationStep["status"],
    };
  }

  async getIncidentRemediation(incidentId: string): Promise<RemediationStep[]> {
    const rows = await db.select().from(remediationSteps).where(eq(remediationSteps.incidentId, incidentId));
    return rows.map((row) => ({
      id: row.id,
      incidentId: row.incidentId,
      step: row.step,
      description: row.description,
      status: row.status as RemediationStep["status"],
    }));
  }

  async getNextIncidentId(): Promise<string> {
    const allIncidents = await db.select().from(incidents);
    const numericIds = allIncidents
      .map((i) => {
        const match = i.id.match(/INC-(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter((n) => !isNaN(n));
    
    const maxId = numericIds.length > 0 ? Math.max(...numericIds) : 0;
    return `INC-${String(maxId + 1).padStart(5, "0")}`;
  }
}

export const databaseStorage = new DatabaseStorage();
