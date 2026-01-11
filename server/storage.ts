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
import { generate52DeviceTopology } from "./topology-generator";

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
  
  // Cloud-Host (Prometheus, Grafana, LangGraph Agents)
  devices.push({
    id: "cloud-host",
    name: "Cloud-Host",
    type: "core",
    status: "healthy",
    location: "Management",
    cpu: 25,
    memory: 40,
    uptime: "90d 8h",
    ipAddress: "192.168.100.1",
    ports: 4,
    activePorts: 2,
    role: "management",
    mgmtIp: "192.168.100.1",
  });
  
  // MGMT-SW (L2 Ethernet Switch)
  devices.push({
    id: "mgmt-sw",
    name: "MGMT-SW",
    type: "spine",
    status: "healthy",
    location: "Management",
    cpu: 15,
    memory: 25,
    uptime: "90d 8h",
    ipAddress: "192.168.100.254",
    ports: 8,
    activePorts: 6,
    role: "management",
    mgmtIp: "192.168.100.254",
  });
  
  // Switch-A1 (AS 65101, DPU-1 facing) - PRIMARY FLAP TEST SWITCH
  devices.push({
    id: "switch-a1",
    name: "Switch-A1",
    type: "tor",
    status: "degraded", // Currently experiencing flap
    location: "BGP Fabric",
    cpu: 45,
    memory: 52,
    uptime: "45d 12h",
    ipAddress: "192.168.100.21",
    ports: 4,
    activePorts: 3,
    role: "fabric",
    mgmtIp: "192.168.100.21",
    dataIp: "10.0.1.1",
    bgpConfig: {
      asn: 65101,
      routerId: "10.0.1.1",
      neighbors: [
        { peerIp: "10.0.13.2", remoteAsn: 65103, weight: 200, timers: { keepalive: 5, hold: 15 } },
        { peerIp: "10.0.12.2", remoteAsn: 65102, weight: 100, timers: { keepalive: 5, hold: 15 } },
      ],
    },
  });
  
  // Switch-B (AS 65102, Transit/Spine)
  devices.push({
    id: "switch-b",
    name: "Switch-B",
    type: "spine",
    status: "healthy",
    location: "BGP Fabric",
    cpu: 28,
    memory: 35,
    uptime: "45d 12h",
    ipAddress: "192.168.100.22",
    ports: 4,
    activePorts: 3,
    role: "transit",
    mgmtIp: "192.168.100.22",
    dataIp: "10.0.12.2",
    bgpConfig: {
      asn: 65102,
      routerId: "10.0.12.2",
      neighbors: [
        { peerIp: "10.0.12.1", remoteAsn: 65101, weight: 100, timers: { keepalive: 5, hold: 15 } },
        { peerIp: "10.0.23.2", remoteAsn: 65103, weight: 100, timers: { keepalive: 5, hold: 15 } },
      ],
    },
  });
  
  // Switch-C (AS 65103, DPU-2 facing)
  devices.push({
    id: "switch-c",
    name: "Switch-C",
    type: "tor",
    status: "healthy",
    location: "BGP Fabric",
    cpu: 32,
    memory: 38,
    uptime: "45d 12h",
    ipAddress: "192.168.100.23",
    ports: 4,
    activePorts: 4,
    role: "fabric",
    mgmtIp: "192.168.100.23",
    dataIp: "10.0.4.1",
    bgpConfig: {
      asn: 65103,
      routerId: "10.0.4.1",
      neighbors: [
        { peerIp: "10.0.13.1", remoteAsn: 65101, weight: 200, timers: { keepalive: 5, hold: 15 } },
        { peerIp: "10.0.23.1", remoteAsn: 65102, weight: 100, timers: { keepalive: 5, hold: 15 } },
      ],
    },
  });
  
  // ENDPOINT-001 (Data plane endpoint)
  devices.push({
    id: "endpoint-001",
    name: "ENDPOINT-001",
    type: "endpoint",
    status: "healthy",
    location: "Data Plane",
    cpu: 22,
    memory: 30,
    uptime: "30d 6h",
    ipAddress: "10.0.1.10",
    ports: 2,
    activePorts: 2,
    role: "endpoint",
    tier: "endpoint",
    mgmtIp: "192.168.100.200",
    dataIp: "10.2.1.10",
    telemetryExporter: { enabled: true, port: 9100, scrapeInterval: 10, metricsPath: "/metrics" },
  });
  
  // ENDPOINT-002 (Data plane endpoint)
  devices.push({
    id: "endpoint-002",
    name: "ENDPOINT-002",
    type: "endpoint",
    status: "healthy",
    location: "Data Plane",
    cpu: 18,
    memory: 28,
    uptime: "30d 6h",
    ipAddress: "10.0.4.10",
    ports: 2,
    activePorts: 2,
    role: "endpoint",
    tier: "endpoint",
    mgmtIp: "192.168.100.201",
    dataIp: "10.2.2.10",
    telemetryExporter: { enabled: true, port: 9100, scrapeInterval: 10, metricsPath: "/metrics" },
  });
  
  return devices;
}

function generateIncidents(): Incident[] {
  const now = new Date();
  
  return [
    {
      id: "INC-2026-001",
      title: "BGP Link Flap - Switch-A1 to Switch-C (Primary Path)",
      description: "Rapid port state oscillations detected on Switch-A1:port2 (A1-C primary link). 6 state transitions in 2 minutes. BGP session to peer 10.0.13.2 (Switch-C, AS 65103) unstable. Traffic rerouting via Switch-B backup path initiated.",
      severity: "critical",
      status: "remediating",
      ttd: 25,
      ttr: 55,
      tttr: null,
      affectedDevices: ["switch-a1", "switch-c", "endpoint-001", "endpoint-002"],
      rootCause: "Link flap detected on Switch-A1:port2 (10.0.13.1/30). Evidence: 6 port state changes in 2min, BGP updates spike (5+ resets), CRC/FCS errors detected. Suspected transceiver degradation or cable connector issue. Primary path DPU-1 → A1 → C → DPU-2 affected. Backup path via Switch-B (10.0.12.0/30) available.",
      confidence: 95,
      createdAt: new Date(now.getTime() - 5 * 60000).toISOString(),
      updatedAt: new Date(now.getTime() - 2 * 60000).toISOString(),
      resolvedAt: null,
    },
    {
      id: "INC-2026-002",
      title: "BGP Session Instability - Switch-A1 Peer 10.0.13.2",
      description: "BGP peer state oscillating (1→0→1→0). switch_bgp_updates_received spike detected (5+ in 2min). BGP weight adjustment to backup peer in progress.",
      severity: "high",
      status: "remediating",
      ttd: 30,
      ttr: 45,
      tttr: null,
      affectedDevices: ["switch-a1", "switch-c"],
      rootCause: "BGP session instability caused by underlying link flap on port2 (10.0.13.0/30). Primary peer weight 200 reduced to 50 to prefer backup peer 10.0.12.2 (Switch-B) with weight 100. Traffic shifting to backup path A1 → B → C.",
      confidence: 92,
      createdAt: new Date(now.getTime() - 10 * 60000).toISOString(),
      updatedAt: new Date(now.getTime() - 3 * 60000).toISOString(),
      resolvedAt: null,
    },
    {
      id: "INC-2026-003",
      title: "Traffic Drop - Primary Path A1-C",
      description: "switch_port_bytes_in on Switch-A1:port2 dropped from 1.2 MB/s to <10 bytes/s. End-to-end latency increased from 300µs to 600µs via backup path.",
      severity: "high",
      status: "remediating",
      ttd: 28,
      ttr: 60,
      tttr: null,
      affectedDevices: ["switch-a1", "switch-b", "switch-c", "dpu-1", "dpu-2"],
      rootCause: "Primary link instability causing traffic drop. Backup path A1 → B → C → DPU-2 now active. Latency increase acceptable (+1 hop). Monitoring for stability.",
      confidence: 90,
      createdAt: new Date(now.getTime() - 8 * 60000).toISOString(),
      updatedAt: new Date(now.getTime() - 4 * 60000).toISOString(),
      resolvedAt: null,
    },
    {
      id: "INC-2026-004",
      title: "Link Flap Recovery Complete - Switch-A1 Port2 Shutdown",
      description: "Primary link A1-C administratively shutdown after 10+ flaps in 5min. Traffic successfully rerouted via Switch-B. BGP convergence completed in 45 seconds.",
      severity: "critical",
      status: "resolved",
      ttd: 28,
      ttr: 58,
      tttr: 115,
      affectedDevices: ["switch-a1", "switch-b", "switch-c", "dpu-1", "dpu-2"],
      rootCause: "Excessive link flaps (>10 in 5min) on A1:port2. Remediation: Port shutdown via 'vtysh -c interface port2 shutdown'. BGP reconverged to backup path via 10.0.12.2 (Switch-B). E2E verification: ping 10.0.4.10 - 0% loss, latency ~600µs (acceptable). Flap cessation confirmed.",
      confidence: 98,
      createdAt: new Date(now.getTime() - 2 * 60 * 60000).toISOString(),
      updatedAt: new Date(now.getTime() - 60 * 60000).toISOString(),
      resolvedAt: new Date(now.getTime() - 60 * 60000).toISOString(),
    },
    {
      id: "INC-2026-005",
      title: "BGP Weight Remediation Complete - Backup Path Active",
      description: "Switch-A1 neighbor 10.0.13.2 weight reduced from 200 to 50. Backup peer 10.0.12.2 (weight 100) now preferred. Traffic flowing via A1 → B → C.",
      severity: "high",
      status: "closed",
      ttd: 25,
      ttr: 50,
      tttr: 120,
      affectedDevices: ["switch-a1", "switch-b", "switch-c"],
      rootCause: "Moderate flap severity (5-10 flaps in 5min). BGP reweight applied: neighbor 10.0.13.2 weight 50 (was 200). Backup path now active. Primary link remains up for monitoring/recovery. switch_port_bytes_out on A1:port3 confirmed increasing.",
      confidence: 94,
      createdAt: new Date(now.getTime() - 4 * 60 * 60000).toISOString(),
      updatedAt: new Date(now.getTime() - 3 * 60 * 60000).toISOString(),
      resolvedAt: new Date(now.getTime() - 3 * 60 * 60000).toISOString(),
    },
    {
      id: "INC-2026-006",
      title: "BGP Timer Adjustment - Link Stabilization",
      description: "BGP hold timer increased from 15s to 180s for neighbor 10.0.13.2. Link stabilizing, flaps reduced. Traffic maintained on primary path.",
      severity: "medium",
      status: "closed",
      ttd: 20,
      ttr: 45,
      tttr: 90,
      affectedDevices: ["switch-a1", "switch-c"],
      rootCause: "Minor flap severity (<5 flaps in 5min). BGP timers tuned: neighbor 10.0.13.2 timers 60 180 (was 5 15). BGP now tolerates brief flaps without resetting. Link stabilized, no further state changes in 5min window. E2E SLA maintained.",
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
      target: "INC-2026-001",
      details: "Auto-generated incident for BGP link flap detection on Switch-A1:port2",
      status: "success",
    },
    {
      id: "audit-002",
      timestamp: new Date(now.getTime() - 4.5 * 60000).toISOString(),
      action: "PromQL Rule Triggered",
      user: "Telemetry Agent",
      target: "Switch-A1",
      details: "changes(switch_port_oper_status[2m]) >= 3 - Port flapping detected",
      status: "success",
    },
    {
      id: "audit-003",
      timestamp: new Date(now.getTime() - 4 * 60000).toISOString(),
      action: "RCA Initiated",
      user: "RCA Agent",
      target: "INC-2026-001",
      details: "Analyzing link flap between A1:port2 (10.0.13.1/30) and C:port2 (10.0.13.2/30)",
      status: "success",
    },
    {
      id: "audit-004",
      timestamp: new Date(now.getTime() - 3 * 60000).toISOString(),
      action: "Remediation Proposed",
      user: "Remediation Agent",
      target: "INC-2026-001",
      details: "Proposed port shutdown and traffic reroute via Switch-B backup path",
      status: "success",
    },
    {
      id: "audit-005",
      timestamp: new Date(now.getTime() - 2 * 60000).toISOString(),
      action: "Port Shutdown Executed",
      user: "Execution Agent",
      target: "Switch-A1:port2",
      details: "vtysh -c 'interface port2' -c 'shutdown' executed successfully",
      status: "success",
    },
    {
      id: "audit-006",
      timestamp: new Date(now.getTime() - 1.5 * 60000).toISOString(),
      action: "BGP Convergence Started",
      user: "System",
      target: "Switch-A1",
      details: "BGP reconverging to backup peer 10.0.12.2 (Switch-B)",
      status: "pending",
    },
    {
      id: "audit-007",
      timestamp: new Date(now.getTime() - 60 * 60000).toISOString(),
      action: "Incident Resolved",
      user: "Verification Agent",
      target: "INC-2026-004",
      details: "BGP convergence completed. E2E ping 10.0.4.10 - 0% loss. Flap cessation confirmed.",
      status: "success",
    },
    {
      id: "audit-008",
      timestamp: new Date(now.getTime() - 2 * 60 * 60000).toISOString(),
      action: "Baseline Updated",
      user: "Learning Agent",
      target: "BGP Flap Detection",
      details: "Updated flap detection threshold based on Prestera transceiver patterns",
      status: "success",
    },
    {
      id: "audit-009",
      timestamp: new Date(now.getTime() - 3 * 60 * 60000).toISOString(),
      action: "Config Backup",
      user: "System",
      target: "BGP Fabric",
      details: "Automated FRR configuration backup for Switch-A1, Switch-B, Switch-C",
      status: "success",
    },
    {
      id: "audit-010",
      timestamp: new Date(now.getTime() - 4 * 60 * 60000).toISOString(),
      action: "Prometheus Scrape",
      user: "Telemetry Agent",
      target: "All Switches",
      details: "SONiC metrics collection: 50+ metrics from 192.168.100.21-23:9090",
      status: "success",
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
  
  // BGP Link Flap - Primary Incident (Active)
  if (incidentId === "INC-2026-001") {
    return [
      { id: "tl-001", incidentId, timestamp: new Date(baseTime).toISOString(), event: "Port Flap Detected", agent: "Telemetry Agent", details: "switch_port_oper_status{device='Switch-A1',port='port2'} toggling 1→0→1→0. 3 state changes in 2min detected." },
      { id: "tl-002", incidentId, timestamp: new Date(baseTime + 10000).toISOString(), event: "PromQL Rule Triggered", agent: "Telemetry Agent", details: "changes(switch_port_oper_status[2m]) >= 3 - THRESHOLD CROSSED. Confidence: 98%" },
      { id: "tl-003", incidentId, timestamp: new Date(baseTime + 15000).toISOString(), event: "BGP Instability Correlated", agent: "Anomaly Agent", details: "switch_bgp_peer_state{peer_ip='10.0.13.2'} = 0, switch_bgp_updates_received spike (5+ in 2min)" },
      { id: "tl-004", incidentId, timestamp: new Date(baseTime + 20000).toISOString(), event: "Alert Created", agent: "System", details: "PortFlappingDetected alert generated for Switch-A1:port2" },
      { id: "tl-005", incidentId, timestamp: new Date(baseTime + 25000).toISOString(), event: "RCA Started", agent: "RCA Agent", details: "Analyzing link flap between Switch-A1:port2 (10.0.13.1/30) and Switch-C:port2 (10.0.13.2/30)" },
      { id: "tl-006", incidentId, timestamp: new Date(baseTime + 30000).toISOString(), event: "Impact Analysis", agent: "RCA Agent", details: "Primary path DPU-1 → A1 → C → DPU-2 affected. 2 downstream networks impacted (10.0.4.0/24)" },
      { id: "tl-007", incidentId, timestamp: new Date(baseTime + 35000).toISOString(), event: "Error Metrics Confirmed", agent: "RCA Agent", details: "switch_port_errors_in spike detected (CRC/FCS >5/min). Suspected transceiver degradation." },
      { id: "tl-008", incidentId, timestamp: new Date(baseTime + 40000).toISOString(), event: "RCA Completed", agent: "RCA Agent", details: "Root cause: Link flap on A1-C primary. Confidence: 95%. Recommended: Shutdown port or reweight BGP." },
      { id: "tl-009", incidentId, timestamp: new Date(baseTime + 45000).toISOString(), event: "Backup Path Identified", agent: "Remediation Agent", details: "Alternate route via Switch-B (10.0.12.0/30) available. Path: A1 → B → C → DPU-2" },
      { id: "tl-010", incidentId, timestamp: new Date(baseTime + 50000).toISOString(), event: "Remediation Started", agent: "Remediation Agent", details: "Executing: vtysh -c 'interface port2' -c 'shutdown' on Switch-A1" },
      { id: "tl-011", incidentId, timestamp: new Date(baseTime + 55000).toISOString(), event: "BGP Convergence", agent: "Verification Agent", details: "BGP reconverging to backup peer 10.0.12.2 (Switch-B). Estimated time: 30-60s" },
    ];
  }
  
  // BGP Session Instability
  if (incidentId === "INC-2026-002") {
    return [
      { id: "tl-101", incidentId, timestamp: new Date(baseTime).toISOString(), event: "BGP Session Down", agent: "Telemetry Agent", details: "switch_bgp_peer_state{device='Switch-A1',peer_ip='10.0.13.2'} = 0" },
      { id: "tl-102", incidentId, timestamp: new Date(baseTime + 10000).toISOString(), event: "Update Storm Detected", agent: "Anomaly Agent", details: "increase(switch_bgp_updates_received[2m]) = 5 - BGPUpdateStorm alert triggered" },
      { id: "tl-103", incidentId, timestamp: new Date(baseTime + 20000).toISOString(), event: "RCA Started", agent: "RCA Agent", details: "Correlating BGP state with port2 link status" },
      { id: "tl-104", incidentId, timestamp: new Date(baseTime + 30000).toISOString(), event: "RCA Completed", agent: "RCA Agent", details: "BGP instability caused by underlying link flap. Confidence: 92%" },
      { id: "tl-105", incidentId, timestamp: new Date(baseTime + 40000).toISOString(), event: "Weight Adjustment Started", agent: "Remediation Agent", details: "Executing: vtysh -c 'neighbor 10.0.13.2 weight 50' to prefer backup peer" },
      { id: "tl-106", incidentId, timestamp: new Date(baseTime + 50000).toISOString(), event: "Traffic Shifting", agent: "Verification Agent", details: "switch_port_bytes_out{port='port3'} increasing - traffic moving to backup path" },
    ];
  }
  
  // Traffic Drop
  if (incidentId === "INC-2026-003") {
    return [
      { id: "tl-201", incidentId, timestamp: new Date(baseTime).toISOString(), event: "Traffic Drop Alert", agent: "Telemetry Agent", details: "rate(switch_port_bytes_in{port='port2'}[1m]) < 10 bytes/s (was 1.2 MB/s)" },
      { id: "tl-202", incidentId, timestamp: new Date(baseTime + 15000).toISOString(), event: "PrimaryLinkTrafficDrop Alert", agent: "System", details: "Critical alert: Traffic dropped on Switch-A1:port2" },
      { id: "tl-203", incidentId, timestamp: new Date(baseTime + 28000).toISOString(), event: "RCA Completed", agent: "RCA Agent", details: "Traffic drop correlated with link flap on primary A1-C path. Confidence: 90%" },
      { id: "tl-204", incidentId, timestamp: new Date(baseTime + 40000).toISOString(), event: "Backup Path Activated", agent: "Remediation Agent", details: "Traffic rerouted via A1 → B → C → DPU-2. Latency increased from 300µs to 600µs." },
      { id: "tl-205", incidentId, timestamp: new Date(baseTime + 60000).toISOString(), event: "Traffic Confirmed", agent: "Verification Agent", details: "increase(switch_port_bytes_out{A1:port3}[2m]) > 500KB confirmed" },
    ];
  }
  
  // Link Flap Recovery Complete (Resolved)
  if (incidentId === "INC-2026-004") {
    const resolvedTime = now.getTime() - 2 * 60 * 60000;
    return [
      { id: "tl-401", incidentId, timestamp: new Date(resolvedTime).toISOString(), event: "Excessive Flaps Detected", agent: "Telemetry Agent", details: "changes(switch_port_oper_status[5m]) > 10 on Switch-A1:port2" },
      { id: "tl-402", incidentId, timestamp: new Date(resolvedTime + 10000).toISOString(), event: "Critical Threshold", agent: "Anomaly Agent", details: "Flap count > 10 in 5min - CRITICAL severity assigned" },
      { id: "tl-403", incidentId, timestamp: new Date(resolvedTime + 20000).toISOString(), event: "RCA Completed", agent: "RCA Agent", details: "Unrecoverable link instability. Confidence: 98%" },
      { id: "tl-404", incidentId, timestamp: new Date(resolvedTime + 28000).toISOString(), event: "Port Shutdown Executed", agent: "Remediation Agent", details: "vtysh -c 'interface port2' -c 'shutdown' - Force clean reroute" },
      { id: "tl-405", incidentId, timestamp: new Date(resolvedTime + 35000).toISOString(), event: "BGP Session Dropped", agent: "Verification Agent", details: "switch_bgp_peer_state{peer_ip='10.0.13.2'} = 0 (permanent)" },
      { id: "tl-406", incidentId, timestamp: new Date(resolvedTime + 58000).toISOString(), event: "BGP Converged", agent: "Verification Agent", details: "Routes via 10.0.12.2 (Switch-B) now active. Convergence: 45s" },
      { id: "tl-407", incidentId, timestamp: new Date(resolvedTime + 90000).toISOString(), event: "E2E Validation", agent: "Verification Agent", details: "ping 10.0.4.10 - 0% loss, latency ~600µs (acceptable +1 hop)" },
      { id: "tl-408", incidentId, timestamp: new Date(resolvedTime + 115000).toISOString(), event: "Incident Resolved", agent: "System", details: "All verification checks passed. Flap cessation confirmed. Status: RESOLVED" },
    ];
  }
  
  // BGP Weight Remediation Complete (Closed)
  if (incidentId === "INC-2026-005") {
    const resolvedTime = now.getTime() - 4 * 60 * 60000;
    return [
      { id: "tl-501", incidentId, timestamp: new Date(resolvedTime).toISOString(), event: "Moderate Flaps Detected", agent: "Telemetry Agent", details: "5-10 flaps in 5min on Switch-A1:port2" },
      { id: "tl-502", incidentId, timestamp: new Date(resolvedTime + 15000).toISOString(), event: "RCA Completed", agent: "RCA Agent", details: "Moderate instability - prefer backup strategy. Confidence: 94%" },
      { id: "tl-503", incidentId, timestamp: new Date(resolvedTime + 25000).toISOString(), event: "BGP Reweight Applied", agent: "Remediation Agent", details: "neighbor 10.0.13.2 weight 50 (was 200). Backup peer 10.0.12.2 weight 100 now preferred." },
      { id: "tl-504", incidentId, timestamp: new Date(resolvedTime + 50000).toISOString(), event: "Traffic Shift Confirmed", agent: "Verification Agent", details: "switch_port_bytes_out{A1:port3} increasing - traffic via backup path" },
      { id: "tl-505", incidentId, timestamp: new Date(resolvedTime + 90000).toISOString(), event: "Primary Link Monitoring", agent: "Verification Agent", details: "Primary link remains up for recovery monitoring" },
      { id: "tl-506", incidentId, timestamp: new Date(resolvedTime + 120000).toISOString(), event: "Incident Closed", agent: "System", details: "Backup path stable. Primary available for future restoration." },
    ];
  }
  
  // BGP Timer Adjustment (Closed)
  if (incidentId === "INC-2026-006") {
    const resolvedTime = now.getTime() - 6 * 60 * 60000;
    return [
      { id: "tl-601", incidentId, timestamp: new Date(resolvedTime).toISOString(), event: "Minor Flaps Detected", agent: "Telemetry Agent", details: "<5 flaps in 5min on Switch-A1:port2" },
      { id: "tl-602", incidentId, timestamp: new Date(resolvedTime + 10000).toISOString(), event: "RCA Completed", agent: "RCA Agent", details: "Minor instability - timer tuning recommended. Confidence: 88%" },
      { id: "tl-603", incidentId, timestamp: new Date(resolvedTime + 20000).toISOString(), event: "Timer Adjustment Applied", agent: "Remediation Agent", details: "neighbor 10.0.13.2 timers 60 180 (was 5 15). BGP now tolerates brief flaps." },
      { id: "tl-604", incidentId, timestamp: new Date(resolvedTime + 45000).toISOString(), event: "Link Stabilizing", agent: "Verification Agent", details: "No new state changes detected in 2min window" },
      { id: "tl-605", incidentId, timestamp: new Date(resolvedTime + 90000).toISOString(), event: "Incident Closed", agent: "System", details: "Link stabilized. E2E SLA maintained on primary path." },
    ];
  }
  
  return [];
}

function generateRemediation(incidentId: string): RemediationStep[] {
  // BGP Link Flap - Primary Incident (Active, Critical)
  if (incidentId === "INC-2026-001") {
    return [
      { id: "rem-001", incidentId, step: 1, description: "Evaluate flap severity: changes(switch_port_oper_status[5m]) > 10 → SHUTDOWN action", status: "completed" },
      { id: "rem-002", incidentId, step: 2, description: "Execute: vtysh -c 'interface port2' -c 'shutdown' on Switch-A1", status: "completed" },
      { id: "rem-003", incidentId, step: 3, description: "Wait for BGP convergence to backup peer 10.0.12.2 (30-60s)", status: "running" },
      { id: "rem-004", incidentId, step: 4, description: "Verify switch_bgp_peer_state{peer_ip='10.0.12.2'} = 1", status: "pending" },
      { id: "rem-005", incidentId, step: 5, description: "Confirm traffic shift: increase(switch_port_bytes_out{port='port3'}[2m]) > 500KB", status: "pending" },
      { id: "rem-006", incidentId, step: 6, description: "E2E validation: ping 10.0.4.10 - 0% loss expected", status: "pending" },
    ];
  }
  
  // BGP Session Instability
  if (incidentId === "INC-2026-002") {
    return [
      { id: "rem-201", incidentId, step: 1, description: "Evaluate flap severity: 5-10 flaps in 5min → REWEIGHT action", status: "completed" },
      { id: "rem-202", incidentId, step: 2, description: "Execute: vtysh -c 'neighbor 10.0.13.2 weight 50' (was 200)", status: "completed" },
      { id: "rem-203", incidentId, step: 3, description: "Wait for BGP best-path recalculation (backup peer weight 100 now preferred)", status: "running" },
      { id: "rem-204", incidentId, step: 4, description: "Verify traffic shifting to backup path A1 → B → C", status: "pending" },
    ];
  }
  
  // Traffic Drop
  if (incidentId === "INC-2026-003") {
    return [
      { id: "rem-301", incidentId, step: 1, description: "Correlate traffic drop with link flap on port2", status: "completed" },
      { id: "rem-302", incidentId, step: 2, description: "Activate backup path via Switch-B (10.0.12.0/30)", status: "completed" },
      { id: "rem-303", incidentId, step: 3, description: "Monitor latency increase (expected: 300µs → 600µs, +1 hop)", status: "running" },
      { id: "rem-304", incidentId, step: 4, description: "Verify E2E connectivity: DPU-1 → A1 → B → C → DPU-2", status: "pending" },
    ];
  }
  
  // Link Flap Recovery Complete (Resolved)
  if (incidentId === "INC-2026-004") {
    return [
      { id: "rem-401", incidentId, step: 1, description: "Flap count > 10 in 5min detected - CRITICAL severity", status: "completed" },
      { id: "rem-402", incidentId, step: 2, description: "Port shutdown executed: vtysh -c 'interface port2' -c 'shutdown'", status: "completed" },
      { id: "rem-403", incidentId, step: 3, description: "BGP reconvergence completed - backup routes installed", status: "completed" },
      { id: "rem-404", incidentId, step: 4, description: "E2E validation: ping 10.0.4.10 - 0% loss confirmed", status: "completed" },
      { id: "rem-405", incidentId, step: 5, description: "Flap cessation confirmed: changes(switch_port_oper_status[5m]) = 0", status: "completed" },
    ];
  }
  
  // BGP Weight Remediation Complete (Closed)
  if (incidentId === "INC-2026-005") {
    return [
      { id: "rem-501", incidentId, step: 1, description: "Moderate flaps detected (5-10 in 5min) - HIGH severity", status: "completed" },
      { id: "rem-502", incidentId, step: 2, description: "BGP reweight applied: neighbor 10.0.13.2 weight 50", status: "completed" },
      { id: "rem-503", incidentId, step: 3, description: "Traffic shift verified: backup path A1 → B → C now active", status: "completed" },
      { id: "rem-504", incidentId, step: 4, description: "Primary link left up for monitoring/recovery", status: "completed" },
    ];
  }
  
  // BGP Timer Adjustment (Closed)
  if (incidentId === "INC-2026-006") {
    return [
      { id: "rem-601", incidentId, step: 1, description: "Minor flaps detected (<5 in 5min) - MEDIUM severity", status: "completed" },
      { id: "rem-602", incidentId, step: 2, description: "Timer adjustment: neighbor 10.0.13.2 timers 60 180 (was 5 15)", status: "completed" },
      { id: "rem-603", incidentId, step: 3, description: "Link stabilized - no additional state changes", status: "completed" },
      { id: "rem-604", incidentId, step: 4, description: "E2E SLA maintained on primary path", status: "completed" },
    ];
  }
  
  return [];
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
  
  // BGP Fabric Topology Links based on Prestera document
  // Management Plane Links (192.168.100.0/24)
  
  // Cloud-Host → MGMT-SW
  links.push({
    id: "link-cloud-mgmt",
    sourceId: "cloud-host",
    targetId: "mgmt-sw",
    sourcePort: 1,
    targetPort: 1,
    status: "active",
    bandwidth: 1000,
    utilization: 15,
  });
  
  // MGMT-SW → All devices (management connections)
  ["switch-a1", "switch-b", "switch-c", "dpu-1", "dpu-2"].forEach((deviceId, idx) => {
    links.push({
      id: `link-mgmt-${deviceId}`,
      sourceId: "mgmt-sw",
      targetId: deviceId,
      sourcePort: idx + 2,
      targetPort: 0, // eth0 for management
      status: "active",
      bandwidth: 1000,
      utilization: 5 + Math.random() * 10,
    });
  });
  
  // Data Plane Links (10.0.x.x IP Space)
  
  // DPU-1 eth1 → Switch-A1 port1 (10.0.1.0/24)
  links.push({
    id: "link-dpu1-a1",
    sourceId: "dpu-1",
    targetId: "switch-a1",
    sourcePort: 1, // eth1
    targetPort: 1, // port1
    status: "active",
    bandwidth: 10000,
    utilization: 35,
  });
  
  // Switch-A1 port2 ↔ Switch-C port2 (10.0.13.0/30) - PRIMARY LINK (FLAPPING)
  links.push({
    id: "link-a1-c-primary",
    sourceId: "switch-a1",
    targetId: "switch-c",
    sourcePort: 2, // port2
    targetPort: 2, // port2
    status: "error", // Currently flapping
    bandwidth: 10000,
    utilization: 5, // Low due to flap
  });
  
  // Switch-A1 port3 ↔ Switch-B port1 (10.0.12.0/30) - BACKUP LINK
  links.push({
    id: "link-a1-b-backup",
    sourceId: "switch-a1",
    targetId: "switch-b",
    sourcePort: 3, // port3
    targetPort: 1, // port1
    status: "active",
    bandwidth: 10000,
    utilization: 75, // High due to traffic reroute
  });
  
  // Switch-B port2 ↔ Switch-C port3 (10.0.23.0/30) - TRANSIT LINK
  links.push({
    id: "link-b-c-transit",
    sourceId: "switch-b",
    targetId: "switch-c",
    sourcePort: 2, // port2
    targetPort: 3, // port3
    status: "active",
    bandwidth: 10000,
    utilization: 70, // High due to traffic reroute
  });
  
  // Switch-C port4 → DPU-2 eth1 (10.0.4.0/24)
  links.push({
    id: "link-c-dpu2",
    sourceId: "switch-c",
    targetId: "dpu-2",
    sourcePort: 4, // port4
    targetPort: 1, // eth1
    status: "active",
    bandwidth: 10000,
    utilization: 40,
  });
  
  return links;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private mockDevices: Device[];
  private topologyDevices: Device[];
  private topologyLinks: TopologyLink[];
  private incidents: Incident[];
  private agents: Agent[];
  private auditEntries: AuditEntry[];
  private gns3Settings: GNS3Settings;
  private cachedGNS3Devices: Device[] | null = null;
  private cachedGNS3Links: GNS3Link[] | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_TTL = 5000;
  private useTopologyGenerator: boolean = true;

  constructor() {
    this.users = new Map();
    this.mockDevices = generateMockDevices();
    
    const topology = generate52DeviceTopology();
    this.topologyDevices = topology.devices;
    this.topologyLinks = topology.links;
    
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
        console.error("GNS3 fetch failed, falling back to topology data:", error);
      }
    }
    
    if (this.useTopologyGenerator) {
      return this.topologyDevices;
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

  async addIncident(incident: Incident): Promise<Incident> {
    this.incidents.push(incident);
    return incident;
  }

  async updateIncident(id: string, updates: Partial<Incident>): Promise<Incident | undefined> {
    const index = this.incidents.findIndex((i) => i.id === id);
    if (index === -1) return undefined;
    
    this.incidents[index] = { ...this.incidents[index], ...updates, updatedAt: new Date().toISOString() };
    return this.incidents[index];
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
    if (this.useTopologyGenerator) {
      return this.topologyLinks;
    }
    
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
