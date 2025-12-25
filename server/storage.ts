import { 
  type User, 
  type InsertUser,
  type Device,
  type Incident,
  type Agent,
  type AuditEntry,
  type TimelineEvent,
  type RemediationStep,
  type MetricTrend,
  type SystemHealth,
  type KPIMetrics,
  type LearningUpdate,
  type TopologyLink,
  type GNS3Settings,
} from "@shared/schema";
import { randomUUID } from "crypto";
import { getGNS3Client, getGNS3Config, type GNS3Link } from "./gns3";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  getDevices(): Promise<Device[]>;
  getDevice(id: string): Promise<Device | undefined>;
  
  getIncidents(): Promise<Incident[]>;
  getIncident(id: string): Promise<Incident | undefined>;
  getIncidentTimeline(incidentId: string): Promise<TimelineEvent[]>;
  getIncidentRemediation(incidentId: string): Promise<RemediationStep[]>;
  
  getAgents(): Promise<Agent[]>;
  getAgent(id: string): Promise<Agent | undefined>;
  
  getAuditEntries(): Promise<AuditEntry[]>;
  
  getMetricTrends(): Promise<MetricTrend[]>;
  getSystemHealth(): Promise<SystemHealth>;
  getKPIMetrics(): Promise<KPIMetrics>;
  getLearningUpdates(): Promise<LearningUpdate[]>;
  
  getTopologyLinks(): Promise<TopologyLink[]>;
  getGNS3Settings(): Promise<GNS3Settings>;
  updateGNS3Settings(settings: Partial<GNS3Settings>): Promise<GNS3Settings>;
  testGNS3Connection(): Promise<{ success: boolean; message: string; version?: string }>;
}

function generateMockDevices(): Device[] {
  const devices: Device[] = [];
  
  devices.push({
    id: "core-1",
    name: "Core-1",
    type: "core",
    status: "healthy",
    location: "DC-1",
    cpu: 35,
    memory: 45,
    uptime: "45d 12h",
    ipAddress: "10.0.0.1",
    ports: 48,
    activePorts: 42,
  });
  
  for (let i = 1; i <= 7; i++) {
    const status = i === 3 ? "degraded" : "healthy";
    devices.push({
      id: `spine-${i}`,
      name: `Spine-${i}`,
      type: "spine",
      status,
      location: `DC-1-Rack-${i}`,
      cpu: 25 + Math.floor(Math.random() * 30),
      memory: 30 + Math.floor(Math.random() * 30),
      uptime: `${30 + i}d ${Math.floor(Math.random() * 24)}h`,
      ipAddress: `10.0.1.${i}`,
      ports: 32,
      activePorts: 28 + Math.floor(Math.random() * 4),
    });
  }
  
  for (let i = 1; i <= 7; i++) {
    const status = i === 1 ? "critical" : "healthy";
    devices.push({
      id: `tor-${i}`,
      name: `TOR-${i}`,
      type: "tor",
      status,
      location: `DC-1-Rack-${i}`,
      cpu: 20 + Math.floor(Math.random() * 40),
      memory: 25 + Math.floor(Math.random() * 40),
      uptime: `${20 + i}d ${Math.floor(Math.random() * 24)}h`,
      ipAddress: `10.0.2.${i}`,
      ports: 24,
      activePorts: 18 + Math.floor(Math.random() * 6),
    });
  }
  
  for (let i = 1; i <= 35; i++) {
    const rand = Math.random();
    let status: Device["status"] = "healthy";
    if (rand > 0.95) status = "critical";
    else if (rand > 0.9) status = "degraded";
    else if (rand > 0.85) status = "offline";
    
    devices.push({
      id: `dpu-${i}`,
      name: `DPU-${i}`,
      type: "dpu",
      status,
      location: `DC-1-Rack-${Math.ceil(i / 5)}`,
      cpu: 15 + Math.floor(Math.random() * 50),
      memory: 20 + Math.floor(Math.random() * 50),
      uptime: `${10 + i}d ${Math.floor(Math.random() * 24)}h`,
      ipAddress: `10.0.3.${i}`,
      ports: 4,
      activePorts: 2 + Math.floor(Math.random() * 2),
    });
  }
  
  return devices;
}

function generateIncidents(): Incident[] {
  const now = new Date();
  
  return [
    {
      id: "INC-2025-001",
      title: "Link Failure - Switch-A to Switch-B",
      description: "Physical link failure detected between Switch-A:port1 and Switch-B:port2. Cable fault or transceiver failure suspected. Automatic traffic rerouting initiated.",
      severity: "critical",
      status: "remediating",
      ttd: 25,
      ttr: 55,
      tttr: null,
      affectedDevices: ["spine-1", "spine-2", "tor-1", "tor-2", "tor-3", "dpu-1", "dpu-2", "dpu-3", "dpu-4", "dpu-5", "dpu-6", "dpu-7", "dpu-8", "dpu-9", "dpu-10"],
      rootCause: "Link failure between Switch-A:port1 and Switch-B:port2. Physical layer issue detected via link state monitoring. 15 downstream devices affected. OSPF/BGP auto-convergence in progress.",
      confidence: 95,
      createdAt: new Date(now.getTime() - 5 * 60000).toISOString(),
      updatedAt: new Date(now.getTime() - 2 * 60000).toISOString(),
      resolvedAt: null,
    },
    {
      id: "INC-2025-002",
      title: "Port Congestion - TOR-3 Uplink",
      description: "Queue depth 85% (baseline <15%), latency 250ms, packet drops detected on TOR-3 uplink ports. QoS remediation in progress.",
      severity: "high",
      status: "remediating",
      ttd: 90,
      ttr: 55,
      tttr: null,
      affectedDevices: ["tor-3", "dpu-11", "dpu-12", "dpu-13", "dpu-14"],
      rootCause: "Port congestion due to traffic surge. Queue depth 85% + latency 250ms + packet drops confirmed. Applying QoS buffer threshold adjustment and priority traffic policy.",
      confidence: 89,
      createdAt: new Date(now.getTime() - 10 * 60000).toISOString(),
      updatedAt: new Date(now.getTime() - 3 * 60000).toISOString(),
      resolvedAt: null,
    },
    {
      id: "INC-2025-003",
      title: "DPU Resource Exhaustion - DPU-5",
      description: "CPU saturation at 95% (baseline <70%), latency spike 250ms (baseline <100ms). Workload migration to DPU-8 initiated.",
      severity: "high",
      status: "remediating",
      ttd: 100,
      ttr: 110,
      tttr: null,
      affectedDevices: ["dpu-5", "dpu-8"],
      rootCause: "DPU-5 workload imbalance causing CPU saturation and memory pressure. Target DPU-8 identified with available capacity. Live migration strategy selected.",
      confidence: 85,
      createdAt: new Date(now.getTime() - 8 * 60000).toISOString(),
      updatedAt: new Date(now.getTime() - 4 * 60000).toISOString(),
      resolvedAt: null,
    },
    {
      id: "INC-2025-004",
      title: "Link Failure Recovery - Spine-2 to TOR-4",
      description: "Link failure between Spine-2:port3 and TOR-4:port1 successfully remediated. Traffic rerouted via alternate path.",
      severity: "critical",
      status: "resolved",
      ttd: 28,
      ttr: 58,
      tttr: 115,
      affectedDevices: ["spine-2", "tor-4", "dpu-15", "dpu-16", "dpu-17", "dpu-18"],
      rootCause: "Link failure detected via interface down event. Alternate path identified through Spine-1. OSPF reconvergence completed in 45 seconds. Zero packet loss after convergence.",
      confidence: 98,
      createdAt: new Date(now.getTime() - 2 * 60 * 60000).toISOString(),
      updatedAt: new Date(now.getTime() - 60 * 60000).toISOString(),
      resolvedAt: new Date(now.getTime() - 60 * 60000).toISOString(),
    },
    {
      id: "INC-2025-005",
      title: "QoS Remediation Complete - TOR-2",
      description: "Port congestion on TOR-2 resolved. Queue depth normalized from 82% to 12%, latency reduced from 230ms to 45ms.",
      severity: "high",
      status: "closed",
      ttd: 105,
      ttr: 50,
      tttr: 175,
      affectedDevices: ["tor-2", "dpu-6", "dpu-7", "dpu-8"],
      rootCause: "Traffic surge caused queue overflow. QoS buffer thresholds increased by 20%. Priority traffic policy applied. Packet loss reduced from 5% to <0.1%.",
      confidence: 92,
      createdAt: new Date(now.getTime() - 4 * 60 * 60000).toISOString(),
      updatedAt: new Date(now.getTime() - 3 * 60 * 60000).toISOString(),
      resolvedAt: new Date(now.getTime() - 3 * 60 * 60000).toISOString(),
    },
    {
      id: "INC-2025-006",
      title: "DPU Workload Migration Complete - DPU-12",
      description: "Workload migrated from DPU-12 to DPU-15. CPU normalized from 94% to 62%, latency recovered from 245ms to 78ms.",
      severity: "high",
      status: "closed",
      ttd: 95,
      ttr: 118,
      tttr: 285,
      affectedDevices: ["dpu-12", "dpu-15"],
      rootCause: "DPU-12 resource exhaustion detected. Container workload successfully migrated to DPU-15. Offload rules adjusted for optimal distribution. No service disruption during migration.",
      confidence: 88,
      createdAt: new Date(now.getTime() - 6 * 60 * 60000).toISOString(),
      updatedAt: new Date(now.getTime() - 5 * 60 * 60000).toISOString(),
      resolvedAt: new Date(now.getTime() - 5 * 60 * 60000).toISOString(),
    },
  ];
}

function generateAgents(): Agent[] {
  const now = new Date();
  const nowStr = now.toISOString();
  
  return [
    {
      id: "agent-telemetry",
      name: "Telemetry Agent",
      type: "telemetry",
      status: "active",
      currentTask: "Collecting SNMP metrics from 50 devices",
      processedTasks: 15420,
      successRate: 99.8,
      lastActive: nowStr,
      capabilities: [{ name: "snmp_collection", description: "Collect SNMP metrics" }],
      config: { collectionInterval: 10000 },
      heartbeatInterval: 5000,
      lastHeartbeat: nowStr,
    },
    {
      id: "agent-anomaly",
      name: "Anomaly Detection Agent",
      type: "anomaly",
      status: "processing",
      currentTask: "Analyzing SNR patterns for DPU cluster",
      processedTasks: 8934,
      successRate: 97.2,
      lastActive: nowStr,
      capabilities: [{ name: "pattern_analysis", description: "Analyze metric patterns" }],
      config: { sensitivityThreshold: 0.85 },
      heartbeatInterval: 15000,
      lastHeartbeat: nowStr,
    },
    {
      id: "agent-monitor",
      name: "Network Monitor Agent",
      type: "monitor",
      status: "active",
      currentTask: null,
      processedTasks: 2341,
      successRate: 99.9,
      lastActive: new Date(now.getTime() - 30000).toISOString(),
      capabilities: [{ name: "device_polling", description: "Poll device health" }],
      config: { pollingInterval: 30000 },
      heartbeatInterval: 10000,
      lastHeartbeat: nowStr,
    },
    {
      id: "agent-rca",
      name: "RCA Agent",
      type: "rca",
      status: "processing",
      currentTask: "Analyzing INC-2025-001 hypothesis",
      processedTasks: 892,
      successRate: 94.5,
      lastActive: nowStr,
      capabilities: [{ name: "correlation_analysis", description: "Correlate events" }],
      config: { maxDepth: 5, confidenceThreshold: 0.7 },
      heartbeatInterval: 15000,
      lastHeartbeat: nowStr,
    },
    {
      id: "agent-remediation",
      name: "Remediation Agent",
      type: "remediation",
      status: "idle",
      currentTask: null,
      processedTasks: 456,
      successRate: 98.2,
      lastActive: new Date(now.getTime() - 120000).toISOString(),
      capabilities: [{ name: "device_restart", description: "Restart network devices" }],
      config: { autoApproveThreshold: 0.95 },
      heartbeatInterval: 10000,
      lastHeartbeat: nowStr,
    },
    {
      id: "agent-verification",
      name: "Verification Agent",
      type: "verification",
      status: "idle",
      currentTask: null,
      processedTasks: 445,
      successRate: 99.5,
      lastActive: new Date(now.getTime() - 180000).toISOString(),
      capabilities: [{ name: "health_check", description: "Verify device health" }],
      config: { checkInterval: 5000 },
      heartbeatInterval: 10000,
      lastHeartbeat: nowStr,
    },
    {
      id: "agent-learning",
      name: "Learning Agent",
      type: "learning",
      status: "active",
      currentTask: "Updating baseline models",
      processedTasks: 1234,
      successRate: 96.8,
      lastActive: nowStr,
      capabilities: [{ name: "pattern_learning", description: "Learn failure patterns" }],
      config: { learningRate: 0.1 },
      heartbeatInterval: 30000,
      lastHeartbeat: nowStr,
    },
    {
      id: "agent-compliance",
      name: "Compliance Agent",
      type: "compliance",
      status: "idle",
      currentTask: null,
      processedTasks: 567,
      successRate: 100,
      lastActive: new Date(now.getTime() - 300000).toISOString(),
      capabilities: [{ name: "policy_check", description: "Check configuration compliance" }],
      config: { auditRetention: 90 },
      heartbeatInterval: 30000,
      lastHeartbeat: nowStr,
    },
  ];
}

function generateAuditEntries(): AuditEntry[] {
  const now = new Date();
  
  return [
    {
      id: "audit-001",
      timestamp: new Date(now.getTime() - 5 * 60000).toISOString(),
      action: "Incident Created",
      user: "System",
      target: "INC-2025-001",
      details: "Auto-generated incident for link failure detection on Spine-1:port1",
      status: "success",
    },
    {
      id: "audit-002",
      timestamp: new Date(now.getTime() - 4.5 * 60000).toISOString(),
      action: "RCA Initiated",
      user: "RCA Agent",
      target: "INC-2025-001",
      details: "Starting root cause analysis with confidence threshold 90%",
      status: "success",
    },
    {
      id: "audit-003",
      timestamp: new Date(now.getTime() - 4 * 60000).toISOString(),
      action: "Remediation Proposed",
      user: "Remediation Agent",
      target: "INC-2025-001",
      details: "Proposed BGP convergence and traffic rerouting through alternate paths",
      status: "success",
    },
    {
      id: "audit-004",
      timestamp: new Date(now.getTime() - 3 * 60000).toISOString(),
      action: "Policy Check",
      user: "Compliance Agent",
      target: "INC-2025-001",
      details: "Remediation plan validated against network policies",
      status: "success",
    },
    {
      id: "audit-005",
      timestamp: new Date(now.getTime() - 2 * 60000).toISOString(),
      action: "Remediation Started",
      user: "Execution Agent",
      target: "INC-2025-001",
      details: "Executing approved remediation steps",
      status: "pending",
    },
    {
      id: "audit-006",
      timestamp: new Date(now.getTime() - 30 * 60000).toISOString(),
      action: "Anomaly Detected",
      user: "Anomaly Agent",
      target: "TOR-3",
      details: "Traffic congestion anomaly detected on uplink ports",
      status: "success",
    },
    {
      id: "audit-007",
      timestamp: new Date(now.getTime() - 60 * 60000).toISOString(),
      action: "Incident Resolved",
      user: "Verification Agent",
      target: "INC-2025-003",
      details: "BGP session stability confirmed. All metrics within normal range.",
      status: "success",
    },
    {
      id: "audit-008",
      timestamp: new Date(now.getTime() - 2 * 60 * 60000).toISOString(),
      action: "Baseline Updated",
      user: "Learning Agent",
      target: "SNR Threshold",
      details: "Updated SNR baseline for DPU cluster based on recent patterns",
      status: "success",
    },
    {
      id: "audit-009",
      timestamp: new Date(now.getTime() - 3 * 60 * 60000).toISOString(),
      action: "Config Backup",
      user: "System",
      target: "All Devices",
      details: "Automated configuration backup completed for 50 devices",
      status: "success",
    },
    {
      id: "audit-010",
      timestamp: new Date(now.getTime() - 4 * 60 * 60000).toISOString(),
      action: "Health Check Failed",
      user: "Telemetry Agent",
      target: "DPU-25",
      details: "Failed to collect metrics due to timeout",
      status: "failure",
    },
  ];
}

function generateMetricTrends(): MetricTrend[] {
  const now = new Date();
  const trends: MetricTrend[] = [];
  
  for (let i = 60; i >= 0; i--) {
    const timestamp = new Date(now.getTime() - i * 60000).toISOString();
    
    let anomalyFactor = 1;
    if (i >= 55 && i <= 58) {
      anomalyFactor = 1.5;
    }
    
    trends.push({
      timestamp,
      snr: 10 + Math.random() * 4 - (anomalyFactor > 1 ? 3 : 0),
      ber: 0.5 + Math.random() * 0.5 * anomalyFactor,
      fec: 2 + Math.random() * 3 * anomalyFactor,
      cpu: 30 + Math.random() * 20,
      latency: 50 + Math.random() * 50 * anomalyFactor,
    });
  }
  
  return trends;
}

function generateTimeline(incidentId: string): TimelineEvent[] {
  const now = new Date();
  const baseTime = now.getTime() - 5 * 60000;
  
  if (incidentId === "INC-2025-001") {
    return [
      { id: "tl-001", incidentId, timestamp: new Date(baseTime).toISOString(), event: "Link Down Detected", agent: "Telemetry Agent", details: "Interface state changed to down on Switch-A:port1" },
      { id: "tl-002", incidentId, timestamp: new Date(baseTime + 5000).toISOString(), event: "Anomaly Flagged", agent: "Anomaly Agent", details: "link_down event detected with 100% confidence" },
      { id: "tl-003", incidentId, timestamp: new Date(baseTime + 10000).toISOString(), event: "Alert Created", agent: "System", details: "link_failure alert generated" },
      { id: "tl-004", incidentId, timestamp: new Date(baseTime + 15000).toISOString(), event: "RCA Started", agent: "RCA Agent", details: "Analyzing link failure between Switch-A:port1 and Switch-B:port2" },
      { id: "tl-005", incidentId, timestamp: new Date(baseTime + 25000).toISOString(), event: "Impact Computed", agent: "Topology Agent", details: "15 downstream devices affected by link failure" },
      { id: "tl-006", incidentId, timestamp: new Date(baseTime + 30000).toISOString(), event: "RCA Completed", agent: "RCA Agent", details: "Root cause confirmed with 95% confidence" },
      { id: "tl-007", incidentId, timestamp: new Date(baseTime + 35000).toISOString(), event: "Alternate Path Found", agent: "Remediation Agent", details: "Alternate route via Spine-2 identified using topology.resolve" },
      { id: "tl-008", incidentId, timestamp: new Date(baseTime + 40000).toISOString(), event: "Remediation Started", agent: "Remediation Agent", details: "Enabling alternate route - OSPF/BGP auto-converging" },
      { id: "tl-009", incidentId, timestamp: new Date(baseTime + 55000).toISOString(), event: "Routing Converged", agent: "Verification Agent", details: "OSPF/BGP convergence completed in 30-60 seconds" },
    ];
  }
  
  if (incidentId === "INC-2025-002") {
    return [
      { id: "tl-101", incidentId, timestamp: new Date(baseTime).toISOString(), event: "Congestion Detected", agent: "Telemetry Agent", details: "Queue depth at 85% (baseline <15%), latency 250ms" },
      { id: "tl-102", incidentId, timestamp: new Date(baseTime + 30000).toISOString(), event: "Anomaly Flagged", agent: "Anomaly Agent", details: "Port congestion detected with 92% confidence" },
      { id: "tl-103", incidentId, timestamp: new Date(baseTime + 45000).toISOString(), event: "Alert Created", agent: "System", details: "port_congestion alert generated for TOR-3" },
      { id: "tl-104", incidentId, timestamp: new Date(baseTime + 60000).toISOString(), event: "RCA Started", agent: "RCA Agent", details: "Analyzing traffic patterns on TOR-3 uplink" },
      { id: "tl-105", incidentId, timestamp: new Date(baseTime + 90000).toISOString(), event: "RCA Completed", agent: "RCA Agent", details: "Hypothesis confirmed: Queue depth 85% + latency 250ms + packet drops = Port congestion (89% confidence)" },
      { id: "tl-106", incidentId, timestamp: new Date(baseTime + 100000).toISOString(), event: "Policy Check", agent: "Compliance Agent", details: "QoS changes validated against network policies" },
      { id: "tl-107", incidentId, timestamp: new Date(baseTime + 110000).toISOString(), event: "QoS Adjustment Started", agent: "Remediation Agent", details: "Adjusting buffer thresholds by 20%" },
      { id: "tl-108", incidentId, timestamp: new Date(baseTime + 130000).toISOString(), event: "QoS Policy Applied", agent: "Remediation Agent", details: "Priority traffic policy reconfigured" },
    ];
  }
  
  if (incidentId === "INC-2025-003") {
    return [
      { id: "tl-201", incidentId, timestamp: new Date(baseTime).toISOString(), event: "Resource Alert", agent: "Telemetry Agent", details: "DPU-5 CPU at 95% (baseline <70%), latency 250ms" },
      { id: "tl-202", incidentId, timestamp: new Date(baseTime + 30000).toISOString(), event: "Anomaly Flagged", agent: "Anomaly Agent", details: "DPU resource exhaustion detected with 88% confidence" },
      { id: "tl-203", incidentId, timestamp: new Date(baseTime + 50000).toISOString(), event: "Alert Created", agent: "System", details: "dpu_resource_exhaustion alert generated" },
      { id: "tl-204", incidentId, timestamp: new Date(baseTime + 70000).toISOString(), event: "RCA Started", agent: "RCA Agent", details: "Analyzing workload patterns on DPU-5" },
      { id: "tl-205", incidentId, timestamp: new Date(baseTime + 100000).toISOString(), event: "RCA Completed", agent: "RCA Agent", details: "CPU saturation caused by workload imbalance (85% confidence)" },
      { id: "tl-206", incidentId, timestamp: new Date(baseTime + 110000).toISOString(), event: "Target DPU Identified", agent: "Remediation Agent", details: "DPU-8 identified with available capacity (CPU 45%, Memory 52%)" },
      { id: "tl-207", incidentId, timestamp: new Date(baseTime + 120000).toISOString(), event: "Policy Check", agent: "Compliance Agent", details: "Workload migration validated against policies" },
      { id: "tl-208", incidentId, timestamp: new Date(baseTime + 130000).toISOString(), event: "Migration Started", agent: "Remediation Agent", details: "Live migration of container workload initiated" },
      { id: "tl-209", incidentId, timestamp: new Date(baseTime + 180000).toISOString(), event: "Offload Rules Updated", agent: "Remediation Agent", details: "Offload rules adjusted for optimal distribution" },
    ];
  }
  
  return [];
}

function generateRemediation(incidentId: string): RemediationStep[] {
  if (incidentId === "INC-2025-002") {
    return [
      { id: "rem-201", incidentId, step: 1, description: "Analyze queue depth, latency, and packet drop metrics", status: "completed" },
      { id: "rem-202", incidentId, step: 2, description: "Adjust QoS buffer thresholds (+20%)", status: "completed" },
      { id: "rem-203", incidentId, step: 3, description: "Reconfigure QoS policy to priority_traffic", status: "running" },
      { id: "rem-204", incidentId, step: 4, description: "Verify queue depth and latency normalized", status: "pending" },
    ];
  }
  
  if (incidentId === "INC-2025-003") {
    return [
      { id: "rem-301", incidentId, step: 1, description: "Analyze DPU CPU, memory, and latency metrics", status: "completed" },
      { id: "rem-302", incidentId, step: 2, description: "Identify target DPU with available capacity", status: "completed" },
      { id: "rem-303", incidentId, step: 3, description: "Migrate workload to DPU-8 (live migration)", status: "running" },
      { id: "rem-304", incidentId, step: 4, description: "Adjust offload rules for optimal distribution", status: "pending" },
      { id: "rem-305", incidentId, step: 5, description: "Verify CPU normalized and latency recovered", status: "pending" },
    ];
  }
  
  if (incidentId !== "INC-2025-001") {
    return [];
  }
  
  return [
    {
      id: "rem-001",
      incidentId,
      step: 1,
      description: "Monitor BGP convergence on affected routers",
      status: "completed",
    },
    {
      id: "rem-002",
      incidentId,
      step: 2,
      description: "Wait for OSPF route update propagation (30-60s)",
      status: "running",
    },
    {
      id: "rem-003",
      incidentId,
      step: 3,
      description: "Verify new paths are active and receiving traffic",
      status: "pending",
    },
    {
      id: "rem-004",
      incidentId,
      step: 4,
      description: "Confirm traffic flowing through alternate paths",
      status: "pending",
    },
    {
      id: "rem-005",
      incidentId,
      step: 5,
      description: "Update network topology graph",
      status: "pending",
    },
  ];
}

function generateLearningUpdates(): LearningUpdate[] {
  const now = new Date();
  
  return [
    {
      id: "learn-001",
      pattern: "SPLL BW Mismatch Pattern",
      description: "Learned new pattern for detecting bandwidth mismatch between SPLL links",
      timestamp: new Date(now.getTime() - 60 * 60000).toISOString(),
    },
    {
      id: "learn-002",
      pattern: "SNR Threshold Update",
      description: "Updated baseline SNR threshold for DPU cluster from 9.5dB to 10.2dB",
      timestamp: new Date(now.getTime() - 2 * 60 * 60000).toISOString(),
    },
    {
      id: "learn-003",
      pattern: "BGP Flap Detection",
      description: "Improved BGP flap detection sensitivity based on recent incidents",
      timestamp: new Date(now.getTime() - 5 * 60 * 60000).toISOString(),
    },
    {
      id: "learn-004",
      pattern: "Congestion Prediction",
      description: "New ML model deployed for traffic congestion prediction",
      timestamp: new Date(now.getTime() - 12 * 60 * 60000).toISOString(),
    },
    {
      id: "learn-005",
      pattern: "FEC Error Correlation",
      description: "Identified correlation between FEC errors and temperature changes",
      timestamp: new Date(now.getTime() - 24 * 60 * 60000).toISOString(),
    },
  ];
}

function generateMockTopologyLinks(devices: Device[]): TopologyLink[] {
  const links: TopologyLink[] = [];
  
  const core = devices.find(d => d.type === "core");
  const spines = devices.filter(d => d.type === "spine");
  const tors = devices.filter(d => d.type === "tor");
  
  if (core) {
    spines.forEach((spine, idx) => {
      links.push({
        id: `link-core-spine-${idx}`,
        sourceId: core.id,
        targetId: spine.id,
        sourcePort: idx + 1,
        targetPort: 1,
        status: spine.status === "healthy" ? "active" : "error",
        bandwidth: 100000,
        utilization: 20 + Math.random() * 40,
      });
    });
  }
  
  spines.forEach((spine, spineIdx) => {
    tors.forEach((tor, torIdx) => {
      if (torIdx % 2 === spineIdx % 2) {
        links.push({
          id: `link-spine-tor-${spineIdx}-${torIdx}`,
          sourceId: spine.id,
          targetId: tor.id,
          sourcePort: torIdx + 2,
          targetPort: spineIdx + 1,
          status: tor.status === "healthy" && spine.status === "healthy" ? "active" : "error",
          bandwidth: 40000,
          utilization: 30 + Math.random() * 50,
        });
      }
    });
  });
  
  return links;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private mockDevices: Device[];
  private incidents: Incident[];
  private agents: Agent[];
  private auditEntries: AuditEntry[];
  private gns3Settings: GNS3Settings;
  private cachedGNS3Devices: Device[] | null = null;
  private cachedGNS3Links: GNS3Link[] | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_TTL = 5000;

  constructor() {
    this.users = new Map();
    this.mockDevices = generateMockDevices();
    this.incidents = generateIncidents();
    this.agents = generateAgents();
    this.auditEntries = generateAuditEntries();
    
    const config = getGNS3Config();
    this.gns3Settings = {
      serverUrl: config.serverUrl,
      projectId: config.projectId,
      username: config.username || "",
      password: config.password || "",
      enabled: config.enabled,
      lastConnected: null,
      connectionStatus: "disconnected",
    };
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  private async fetchGNS3Data(): Promise<{ devices: Device[]; links: GNS3Link[] }> {
    const now = Date.now();
    
    if (
      this.cachedGNS3Devices &&
      this.cachedGNS3Links &&
      now - this.cacheTimestamp < this.CACHE_TTL
    ) {
      return { devices: this.cachedGNS3Devices, links: this.cachedGNS3Links };
    }

    const client = getGNS3Client();
    if (!client) {
      return { devices: [], links: [] };
    }

    try {
      const [nodes, links] = await Promise.all([
        client.getNodes(),
        client.getLinks(),
      ]);

      const devices = nodes.map((node) => client.mapNodeToDevice(node, links));
      
      this.cachedGNS3Devices = devices;
      this.cachedGNS3Links = links;
      this.cacheTimestamp = now;
      this.gns3Settings.connectionStatus = "connected";
      this.gns3Settings.lastConnected = new Date().toISOString();

      return { devices, links };
    } catch (error) {
      console.error("Failed to fetch GNS3 data:", error);
      this.gns3Settings.connectionStatus = "error";
      return { devices: [], links: [] };
    }
  }

  async getDevices(): Promise<Device[]> {
    const config = getGNS3Config();
    
    if (config.enabled && config.projectId) {
      try {
        const { devices } = await this.fetchGNS3Data();
        if (devices.length > 0) {
          return devices;
        }
      } catch (error) {
        console.error("GNS3 fetch failed, falling back to mock data:", error);
      }
    }
    
    return this.mockDevices;
  }

  async getDevice(id: string): Promise<Device | undefined> {
    const devices = await this.getDevices();
    return devices.find((d) => d.id === id);
  }

  async getIncidents(): Promise<Incident[]> {
    return this.incidents;
  }

  async getIncident(id: string): Promise<Incident | undefined> {
    return this.incidents.find((i) => i.id === id);
  }

  async getIncidentTimeline(incidentId: string): Promise<TimelineEvent[]> {
    return generateTimeline(incidentId);
  }

  async getIncidentRemediation(incidentId: string): Promise<RemediationStep[]> {
    return generateRemediation(incidentId);
  }

  async getAgents(): Promise<Agent[]> {
    return this.agents;
  }

  async getAgent(id: string): Promise<Agent | undefined> {
    return this.agents.find((a) => a.id === id);
  }

  async getAuditEntries(): Promise<AuditEntry[]> {
    return this.auditEntries;
  }

  async getMetricTrends(): Promise<MetricTrend[]> {
    return generateMetricTrends();
  }

  async getSystemHealth(): Promise<SystemHealth> {
    const devices = await this.getDevices();
    return {
      cpu: 35,
      memory: 45,
      latencyP95: 125,
      apiLatency: 98,
      activeSessions: 3,
      totalDevices: devices.length,
      healthyDevices: devices.filter((d) => d.status === "healthy").length,
      degradedDevices: devices.filter((d) => d.status === "degraded").length,
      criticalDevices: devices.filter((d) => d.status === "critical").length,
    };
  }

  async getKPIMetrics(): Promise<KPIMetrics> {
    const activeIncidents = this.incidents.filter(
      (i) => i.status !== "resolved" && i.status !== "closed"
    ).length;
    const resolvedToday = this.incidents.filter((i) => {
      if (!i.resolvedAt) return false;
      const resolved = new Date(i.resolvedAt);
      const today = new Date();
      return resolved.toDateString() === today.toDateString();
    }).length;

    return {
      avgTTD: 5,
      avgTTR: 50,
      avgMTTR: 60,
      ttdChange: -15,
      ttrChange: -8,
      mttrChange: -12,
      activeIncidents,
      resolvedToday: resolvedToday || 2,
    };
  }

  async getLearningUpdates(): Promise<LearningUpdate[]> {
    return generateLearningUpdates();
  }

  async getTopologyLinks(): Promise<TopologyLink[]> {
    const config = getGNS3Config();
    
    if (config.enabled && config.projectId) {
      try {
        const { devices, links } = await this.fetchGNS3Data();
        if (links.length > 0) {
          return links.map((link): TopologyLink => ({
            id: link.link_id,
            sourceId: link.nodes[0]?.node_id || "",
            targetId: link.nodes[1]?.node_id || "",
            sourcePort: link.nodes[0]?.port_number || 0,
            targetPort: link.nodes[1]?.port_number || 0,
            status: link.capturing ? "active" : "active",
            bandwidth: 10000,
            utilization: Math.random() * 60,
          }));
        }
      } catch (error) {
        console.error("GNS3 links fetch failed:", error);
      }
    }
    
    const devices = await this.getDevices();
    return generateMockTopologyLinks(devices);
  }

  async getGNS3Settings(): Promise<GNS3Settings> {
    return this.gns3Settings;
  }

  async updateGNS3Settings(settings: Partial<GNS3Settings>): Promise<GNS3Settings> {
    this.gns3Settings = { ...this.gns3Settings, ...settings };
    
    this.cachedGNS3Devices = null;
    this.cachedGNS3Links = null;
    this.cacheTimestamp = 0;
    
    return this.gns3Settings;
  }

  async testGNS3Connection(): Promise<{ success: boolean; message: string; version?: string }> {
    const client = getGNS3Client();
    
    if (!client) {
      return {
        success: false,
        message: "GNS3 integration is not enabled. Set GNS3_ENABLED=true to enable.",
      };
    }

    try {
      const version = await client.getVersion();
      this.gns3Settings.connectionStatus = "connected";
      this.gns3Settings.lastConnected = new Date().toISOString();
      
      return {
        success: true,
        message: `Connected to GNS3 server`,
        version: version.version,
      };
    } catch (error) {
      this.gns3Settings.connectionStatus = "error";
      return {
        success: false,
        message: `Failed to connect: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }
}

export const storage = new MemStorage();
