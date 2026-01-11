import type { Device } from "@shared/schema";

export interface MetricValue {
  name: string;
  value: number;
  labels: Record<string, string>;
  timestamp: number;
}

export interface DeviceMetrics {
  deviceId: string;
  metrics: MetricValue[];
  collectedAt: number;
}

const activeFaults: Map<string, { faultType: string; severity: string }> = new Map();

export function injectFault(deviceId: string, faultType: string, severity: string): void {
  activeFaults.set(deviceId, { faultType, severity });
}

export function clearFault(deviceId: string): void {
  activeFaults.delete(deviceId);
}

export function hasFault(deviceId: string): boolean {
  return activeFaults.has(deviceId);
}

export function getFault(deviceId: string): { faultType: string; severity: string } | undefined {
  return activeFaults.get(deviceId);
}

function generateSystemMetrics(device: Device): MetricValue[] {
  const fault = getFault(device.id);
  const isLinkFlap = fault?.faultType === "link_flap";
  const isCongestion = fault?.faultType === "congestion";
  const now = Date.now();
  const labels = { device: device.name };

  const cpuBase = device.cpu || 30;
  const memBase = device.memory || 40;

  return [
    { name: "switch_cpu_usage", value: isLinkFlap ? cpuBase + 30 : cpuBase + Math.random() * 10, labels: { ...labels, cpu_core: "0" }, timestamp: now },
    { name: "switch_cpu_usage", value: isLinkFlap ? cpuBase + 25 : cpuBase + Math.random() * 8, labels: { ...labels, cpu_core: "1" }, timestamp: now },
    { name: "switch_memory_used", value: (memBase / 100) * 16 * 1024 * 1024 * 1024, labels, timestamp: now },
    { name: "switch_memory_available", value: ((100 - memBase) / 100) * 16 * 1024 * 1024 * 1024, labels, timestamp: now },
    { name: "switch_memory_utilization", value: isCongestion ? memBase + 25 : memBase + Math.random() * 5, labels, timestamp: now },
    { name: "switch_temperature", value: 45 + Math.random() * 15, labels: { ...labels, sensor: "CPU" }, timestamp: now },
    { name: "switch_power_consumption", value: 150 + Math.random() * 50, labels: { ...labels, psu: "PSU1" }, timestamp: now },
    { name: "switch_fan_speed", value: 4500 + Math.random() * 1000, labels: { ...labels, fan: "FAN1" }, timestamp: now },
  ];
}

function generatePortMetrics(device: Device): MetricValue[] {
  const fault = getFault(device.id);
  const isLinkFlap = fault?.faultType === "link_flap";
  const isCongestion = fault?.faultType === "congestion";
  const now = Date.now();
  const metrics: MetricValue[] = [];
  const portCount = device.ports || 4;

  for (let port = 1; port <= portCount; port++) {
    const labels = { device: device.name, port: `port${port}`, type: "ethernet" };
    const isAffectedPort = port === 2 && isLinkFlap;
    
    metrics.push(
      { name: "switch_port_bytes_in", value: Math.floor(Math.random() * 1000000000), labels, timestamp: now },
      { name: "switch_port_bytes_out", value: Math.floor(Math.random() * 1000000000), labels, timestamp: now },
      { name: "switch_port_packets_in", value: Math.floor(Math.random() * 10000000), labels, timestamp: now },
      { name: "switch_port_packets_out", value: Math.floor(Math.random() * 10000000), labels, timestamp: now },
      { name: "switch_port_unicast_packets_in", value: Math.floor(Math.random() * 8000000), labels, timestamp: now },
      { name: "switch_port_multicast_packets_in", value: Math.floor(Math.random() * 100000), labels, timestamp: now },
      { name: "switch_port_broadcast_packets_in", value: Math.floor(Math.random() * 50000), labels, timestamp: now },
      { name: "switch_port_errors_in", value: isAffectedPort ? 150 + Math.floor(Math.random() * 100) : Math.floor(Math.random() * 5), labels, timestamp: now },
      { name: "switch_port_errors_out", value: isAffectedPort ? 80 + Math.floor(Math.random() * 50) : Math.floor(Math.random() * 3), labels, timestamp: now },
      { name: "switch_port_discards_in", value: isCongestion ? 500 + Math.floor(Math.random() * 200) : Math.floor(Math.random() * 10), labels, timestamp: now },
      { name: "switch_port_discards_out", value: isCongestion ? 300 + Math.floor(Math.random() * 150) : Math.floor(Math.random() * 8), labels, timestamp: now },
      { name: "switch_port_oper_status", value: isAffectedPort ? (Math.random() > 0.5 ? 1 : 0) : 1, labels, timestamp: now },
      { name: "switch_port_admin_status", value: 1, labels, timestamp: now },
      { name: "switch_port_speed", value: port <= 24 ? 10000 : 40000, labels, timestamp: now },
      { name: "switch_port_mtu", value: 9000, labels, timestamp: now },
      { name: "switch_port_duplex", value: 1, labels, timestamp: now },
    );
  }

  return metrics;
}

function generateSAIMetrics(device: Device): MetricValue[] {
  const fault = getFault(device.id);
  const isCongestion = fault?.faultType === "congestion";
  const isLinkFlap = fault?.faultType === "link_flap";
  const now = Date.now();
  const metrics: MetricValue[] = [];
  const labels = { device: device.name };
  const portCount = device.ports || 4;

  for (let port = 1; port <= Math.min(portCount, 8); port++) {
    const portLabels = { ...labels, port: `Ethernet${port}` };
    const isAffectedPort = port === 2 && isLinkFlap;

    metrics.push(
      { name: "sai_port_oper_status", value: isAffectedPort ? (Math.random() > 0.5 ? 1 : 0) : 1, labels: portLabels, timestamp: now },
      { name: "sai_port_rx_packets_total", value: Math.floor(Math.random() * 100000000), labels: portLabels, timestamp: now },
      { name: "sai_port_tx_packets_total", value: Math.floor(Math.random() * 100000000), labels: portLabels, timestamp: now },
      { name: "sai_port_rx_bytes_total", value: Math.floor(Math.random() * 10000000000), labels: portLabels, timestamp: now },
      { name: "sai_port_tx_bytes_total", value: Math.floor(Math.random() * 10000000000), labels: portLabels, timestamp: now },
      { name: "sai_port_rx_errors_total", value: isAffectedPort ? 200 : Math.floor(Math.random() * 5), labels: portLabels, timestamp: now },
      { name: "sai_port_tx_errors_total", value: isAffectedPort ? 100 : Math.floor(Math.random() * 3), labels: portLabels, timestamp: now },
      { name: "sai_port_rx_discards_total", value: isCongestion ? 1000 : Math.floor(Math.random() * 10), labels: portLabels, timestamp: now },
      { name: "sai_port_tx_discards_total", value: isCongestion ? 800 : Math.floor(Math.random() * 8), labels: portLabels, timestamp: now },
    );

    for (let queue = 0; queue < 8; queue++) {
      const queueLabels = { ...portLabels, queue: `${queue}`, type: "unicast" };
      metrics.push(
        { name: "sai_queue_depth_current", value: isCongestion ? 50000 + Math.random() * 30000 : Math.floor(Math.random() * 10000), labels: queueLabels, timestamp: now },
        { name: "sai_queue_drops_total", value: isCongestion ? 5000 + Math.floor(Math.random() * 2000) : Math.floor(Math.random() * 50), labels: queueLabels, timestamp: now },
        { name: "sai_queue_watermark_max", value: 80000 + Math.floor(Math.random() * 20000), labels: queueLabels, timestamp: now },
      );
    }

    for (let pg = 0; pg < 8; pg++) {
      const pgLabels = { ...portLabels, pg: `${pg}` };
      metrics.push(
        { name: "sai_pg_packets_total", value: Math.floor(Math.random() * 10000000), labels: pgLabels, timestamp: now },
        { name: "sai_pg_bytes_total", value: Math.floor(Math.random() * 1000000000), labels: pgLabels, timestamp: now },
        { name: "sai_pg_drops_total", value: isCongestion ? 1000 : Math.floor(Math.random() * 20), labels: pgLabels, timestamp: now },
        { name: "sai_pg_watermark_bytes", value: 50000 + Math.floor(Math.random() * 30000), labels: pgLabels, timestamp: now },
      );
    }
  }

  metrics.push(
    { name: "sai_buffer_pool_used_bytes", value: isCongestion ? 80000000 : Math.floor(Math.random() * 50000000), labels: { ...labels, pool: "ingress" }, timestamp: now },
    { name: "sai_buffer_pool_available_bytes", value: 100000000 - (isCongestion ? 80000000 : 30000000), labels: { ...labels, pool: "ingress" }, timestamp: now },
    { name: "sai_buffer_pool_watermark_bytes", value: 90000000, labels: { ...labels, pool: "ingress" }, timestamp: now },
    { name: "sai_api_modules_available", value: 45, labels, timestamp: now },
    { name: "sai_collection_error", value: 0, labels, timestamp: now },
    { name: "sai_ports_collected", value: portCount, labels, timestamp: now },
  );

  return metrics;
}

function generateBGPMetrics(device: Device): MetricValue[] {
  if (!device.bgpConfig) return [];

  const fault = getFault(device.id);
  const isBGPReset = fault?.faultType === "bgp_reset";
  const isLinkFlap = fault?.faultType === "link_flap";
  const now = Date.now();
  const metrics: MetricValue[] = [];
  const labels = { device: device.name };

  for (const neighbor of device.bgpConfig.neighbors) {
    const peerLabels = { ...labels, peer_ip: neighbor.peerIp, vrf: "default" };
    const isPrimaryPeer = neighbor.weight >= 200;
    const isAffectedPeer = (isBGPReset || isLinkFlap) && isPrimaryPeer;

    metrics.push(
      { name: "switch_bgp_peer_state", value: isAffectedPeer ? (Math.random() > 0.5 ? 1 : 0) : 1, labels: peerLabels, timestamp: now },
      { name: "switch_bgp_prefixes_received", value: isAffectedPeer ? Math.floor(Math.random() * 50) : 100 + Math.floor(Math.random() * 50), labels: peerLabels, timestamp: now },
      { name: "switch_bgp_prefixes_advertised", value: 80 + Math.floor(Math.random() * 40), labels: peerLabels, timestamp: now },
      { name: "switch_bgp_updates_received", value: isAffectedPeer ? 50 + Math.floor(Math.random() * 30) : Math.floor(Math.random() * 10), labels: peerLabels, timestamp: now },
      { name: "switch_bgp_updates_sent", value: Math.floor(Math.random() * 15), labels: peerLabels, timestamp: now },
    );
  }

  return metrics;
}

function generateLLDPMetrics(device: Device): MetricValue[] {
  const now = Date.now();
  const labels = { device: device.name };
  const neighborCount = Math.floor(device.activePorts / 2) || 2;

  const metrics: MetricValue[] = [
    { name: "switch_lldp_neighbor_count", value: neighborCount, labels, timestamp: now },
  ];

  for (let i = 1; i <= neighborCount; i++) {
    metrics.push({
      name: "switch_lldp_neighbor_age",
      value: Math.floor(Math.random() * 3600) + 60,
      labels: { ...labels, local_port: `Ethernet${i}`, neighbor_chassis_id: `00:11:22:33:44:${String(i).padStart(2, "0")}` },
      timestamp: now,
    });
  }

  return metrics;
}

function generateGNMIMetrics(device: Device): MetricValue[] {
  const now = Date.now();
  const labels = { device: device.name };

  return [
    { name: "gnmi_service_up", value: 1, labels, timestamp: now },
    { name: "gnmi_collection_timestamp", value: now, labels, timestamp: now },
  ];
}

export function generateDeviceMetrics(device: Device): DeviceMetrics {
  const metrics: MetricValue[] = [
    ...generateSystemMetrics(device),
    ...generatePortMetrics(device),
    ...generateSAIMetrics(device),
    ...generateBGPMetrics(device),
    ...generateLLDPMetrics(device),
    ...generateGNMIMetrics(device),
  ];

  return {
    deviceId: device.id,
    metrics,
    collectedAt: Date.now(),
  };
}

export function generateAllDeviceMetrics(devices: Device[]): DeviceMetrics[] {
  return devices.map((device) => generateDeviceMetrics(device));
}

export function formatPrometheusMetrics(deviceMetrics: DeviceMetrics[]): string {
  const lines: string[] = [];

  for (const dm of deviceMetrics) {
    for (const metric of dm.metrics) {
      const labelPairs = Object.entries(metric.labels)
        .map(([k, v]) => `${k}="${v}"`)
        .join(",");
      lines.push(`${metric.name}{${labelPairs}} ${metric.value}`);
    }
  }

  return lines.join("\n");
}
