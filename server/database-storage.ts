import { eq, and, gte, desc, inArray, sql } from "drizzle-orm";
import { db } from "./db";
import {
  devices,
  incidents,
  topologyLinks,
  timelineEvents,
  remediationSteps,
  agents,
  metricsTimeseries,
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
  type InsertMetricsTimeseries,
  type SystemHealth,
  type KPIMetrics,
  type AuditEntry,
  type MetricTrend,
  type LearningUpdate,
  type DeviceTier,
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

  async getSystemHealth(): Promise<SystemHealth> {
    const allDevices = await this.getDevices();
    return {
      cpu: Math.round(allDevices.reduce((sum, d) => sum + d.cpu, 0) / allDevices.length),
      memory: Math.round(allDevices.reduce((sum, d) => sum + d.memory, 0) / allDevices.length),
      latencyP95: 125,
      apiLatency: 98,
      activeSessions: 3,
      totalDevices: allDevices.length,
      healthyDevices: allDevices.filter((d) => d.status === "healthy").length,
      degradedDevices: allDevices.filter((d) => d.status === "degraded").length,
      criticalDevices: allDevices.filter((d) => d.status === "critical").length,
    };
  }

  async getKPIMetrics(): Promise<KPIMetrics> {
    const allIncidents = await this.getIncidents();
    const activeIncidents = allIncidents.filter(
      (i) => i.status !== "resolved" && i.status !== "closed"
    ).length;
    const resolvedToday = allIncidents.filter((i) => {
      if (!i.resolvedAt) return false;
      const resolved = new Date(i.resolvedAt);
      const today = new Date();
      return resolved.toDateString() === today.toDateString();
    }).length;

    const ttdValues = allIncidents.filter((i) => i.ttd).map((i) => i.ttd || 0);
    const ttrValues = allIncidents.filter((i) => i.ttr).map((i) => i.ttr || 0);

    return {
      avgTTD: ttdValues.length > 0 ? Math.round(ttdValues.reduce((a, b) => a + b, 0) / ttdValues.length) : 45,
      avgTTR: ttrValues.length > 0 ? Math.round(ttrValues.reduce((a, b) => a + b, 0) / ttrValues.length) : 180,
      avgMTTR: 120,
      ttdChange: -12,
      ttrChange: -8,
      mttrChange: -15,
      activeIncidents,
      resolvedToday,
    };
  }

  async getAuditEntries(): Promise<AuditEntry[]> {
    const allIncidents = await this.getIncidents();
    const entries: AuditEntry[] = [];
    
    for (const incident of allIncidents.slice(0, 10)) {
      entries.push({
        id: `audit-${incident.id}`,
        timestamp: incident.createdAt || new Date().toISOString(),
        action: "Incident Created",
        user: "Detection Agent",
        target: incident.title,
        details: incident.description,
        status: "success",
      });
    }
    
    return entries;
  }

  async getMetricTrends(options?: { 
    deviceId?: string; 
    tier?: DeviceTier; 
    hoursBack?: number;
    limit?: number;
  }): Promise<MetricTrend[]> {
    const hoursBack = options?.hoursBack || 24;
    const limit = options?.limit || 100;
    const cutoff = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
    
    try {
      let deviceIds: string[] = [];
      
      if (options?.deviceId) {
        deviceIds = [options.deviceId];
      } else if (options?.tier) {
        const tieredDevices = await db.select({ id: devices.id })
          .from(devices)
          .where(eq(devices.tier, options.tier));
        deviceIds = tieredDevices.map(d => d.id);
      }
      
      const conditions = [gte(metricsTimeseries.collectedAt, cutoff)];
      if (deviceIds.length > 0) {
        conditions.push(inArray(metricsTimeseries.deviceId, deviceIds));
      }
      
      const metrics = await db.select({
        collectedAt: metricsTimeseries.collectedAt,
        cpu: metricsTimeseries.cpu,
        memory: metricsTimeseries.memory,
        portUtilization: metricsTimeseries.portUtilization,
        latency: metricsTimeseries.latency,
        packetDrops: metricsTimeseries.packetDrops,
        bgpPeers: metricsTimeseries.bgpPeers,
        deviceId: metricsTimeseries.deviceId,
      })
        .from(metricsTimeseries)
        .where(and(...conditions))
        .orderBy(desc(metricsTimeseries.collectedAt))
        .limit(limit);
      
      if (metrics.length > 0) {
        type MetricRow = { collectedAt: Date; cpu: number; memory: number; portUtilization: number; latency: number; packetDrops: number; bgpPeers: number; deviceId: string };
        const grouped = new Map<string, MetricRow[]>();
        for (const m of metrics) {
          const key = m.collectedAt.toISOString().slice(0, 16);
          if (!grouped.has(key)) {
            grouped.set(key, []);
          }
          grouped.get(key)!.push(m);
        }
        
        const trends: MetricTrend[] = [];
        const entries = Array.from(grouped.entries());
        for (const entry of entries) {
          const timestamp = entry[0];
          const group = entry[1];
          const avgCpu = group.reduce((sum: number, m: MetricRow) => sum + m.cpu, 0) / group.length;
          const avgMemory = group.reduce((sum: number, m: MetricRow) => sum + m.memory, 0) / group.length;
          const avgPortUtil = group.reduce((sum: number, m: MetricRow) => sum + m.portUtilization, 0) / group.length;
          const avgLatency = group.reduce((sum: number, m: MetricRow) => sum + m.latency, 0) / group.length;
          const totalPacketDrops = group.reduce((sum: number, m: MetricRow) => sum + m.packetDrops, 0);
          const totalBgpPeers = group.reduce((sum: number, m: MetricRow) => sum + m.bgpPeers, 0);
          
          trends.push({
            timestamp: timestamp + ':00.000Z',
            cpu: avgCpu,
            memory: avgMemory,
            portUtilization: avgPortUtil,
            latency: avgLatency,
            packetDrops: totalPacketDrops,
            bgpPeers: totalBgpPeers,
            deviceId: options?.deviceId,
            tier: options?.tier,
          });
        }
        
        return trends.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      }
      
      return this.generateFallbackTrends(hoursBack);
    } catch (error) {
      console.error("[DatabaseStorage] Error fetching metric trends:", error);
      return this.generateFallbackTrends(hoursBack);
    }
  }

  private generateFallbackTrends(hoursBack: number): MetricTrend[] {
    const now = Date.now();
    const trends: MetricTrend[] = [];
    
    for (let i = hoursBack - 1; i >= 0; i--) {
      const timestamp = new Date(now - i * 60 * 60 * 1000).toISOString();
      const variation = Math.sin(i * 0.5) * 10;
      trends.push({
        timestamp,
        cpu: Math.max(10, Math.min(90, 35 + variation + (Math.random() - 0.5) * 10)),
        memory: Math.max(20, Math.min(85, 40 + variation * 0.5 + (Math.random() - 0.5) * 8)),
        portUtilization: 40 + variation + Math.random() * 15,
        latency: 5 + Math.random() * 10 + Math.abs(variation) * 0.3,
        packetDrops: Math.max(0, Math.floor(Math.random() * 50 + variation * 2)),
        bgpPeers: 90 + Math.floor(Math.random() * 5 - 2),
      });
    }
    
    return trends;
  }

  async insertMetrics(metrics: InsertMetricsTimeseries[]): Promise<void> {
    if (metrics.length === 0) return;
    await db.insert(metricsTimeseries).values(metrics);
  }

  async getLearningUpdates(): Promise<LearningUpdate[]> {
    const allIncidents = await this.getIncidents();
    const updates: LearningUpdate[] = [];
    
    for (const incident of allIncidents.slice(0, 5)) {
      updates.push({
        id: `learn-${incident.id}`,
        pattern: `Pattern for ${incident.title}`,
        description: `Learned detection pattern from incident: ${incident.description.substring(0, 100)}`,
        timestamp: incident.createdAt || new Date().toISOString(),
      });
    }
    
    if (updates.length === 0) {
      updates.push({
        id: "learn-default",
        pattern: "Baseline Pattern",
        description: "System is learning baseline patterns from network telemetry data",
        timestamp: new Date().toISOString(),
      });
    }
    
    return updates;
  }
}

export const databaseStorage = new DatabaseStorage();
