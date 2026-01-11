import type { Device } from "@shared/schema";
import { generateAllDeviceMetrics, type DeviceMetrics, type MetricValue } from "./telemetry-exporter";

interface PrometheusConfig {
  url: string;
  enabled: boolean;
}

const prometheusConfig: PrometheusConfig = {
  url: process.env.PROMETHEUS_URL || "http://192.168.100.1:9090",
  enabled: process.env.PROMETHEUS_ENABLED === "true",
};

let cachedMetrics: Map<string, DeviceMetrics> = new Map();
let lastUpdate = 0;
const CACHE_TTL = 10000;

export function getPrometheusConfig(): PrometheusConfig {
  return { ...prometheusConfig };
}

export function updatePrometheusConfig(config: Partial<PrometheusConfig>): void {
  if (config.url !== undefined) prometheusConfig.url = config.url;
  if (config.enabled !== undefined) prometheusConfig.enabled = config.enabled;
}

async function queryPrometheus(query: string): Promise<any> {
  if (!prometheusConfig.enabled) {
    return null;
  }

  try {
    const url = `${prometheusConfig.url}/api/v1/query?query=${encodeURIComponent(query)}`;
    const response = await fetch(url, { method: "GET", headers: { "Accept": "application/json" } });
    
    if (!response.ok) {
      console.error(`Prometheus query failed: ${response.status}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error("Prometheus connection error:", error);
    return null;
  }
}

async function queryPrometheusRange(query: string, start: number, end: number, step: string): Promise<any> {
  if (!prometheusConfig.enabled) {
    return null;
  }

  try {
    const url = `${prometheusConfig.url}/api/v1/query_range?query=${encodeURIComponent(query)}&start=${start}&end=${end}&step=${step}`;
    const response = await fetch(url, { method: "GET", headers: { "Accept": "application/json" } });
    
    if (!response.ok) {
      console.error(`Prometheus range query failed: ${response.status}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error("Prometheus connection error:", error);
    return null;
  }
}

export function updateMetricsCache(devices: Device[], forceRefresh: boolean = false): void {
  const now = Date.now();
  if (!forceRefresh && now - lastUpdate < CACHE_TTL) return;

  const allMetrics = generateAllDeviceMetrics(devices);
  cachedMetrics.clear();
  for (const dm of allMetrics) {
    cachedMetrics.set(dm.deviceId, dm);
  }
  lastUpdate = now;
}

export function getDeviceMetrics(deviceId: string): DeviceMetrics | undefined {
  return cachedMetrics.get(deviceId);
}

export function getAllMetrics(): DeviceMetrics[] {
  return Array.from(cachedMetrics.values());
}

export function queryMetricsByName(metricName: string, labelFilters?: Record<string, string>): MetricValue[] {
  const results: MetricValue[] = [];
  const allMetrics = Array.from(cachedMetrics.values());

  for (const dm of allMetrics) {
    for (const metric of dm.metrics) {
      if (metric.name !== metricName) continue;

      if (labelFilters) {
        const matches = Object.entries(labelFilters).every(
          ([key, value]) => metric.labels[key] === value
        );
        if (!matches) continue;
      }

      results.push(metric);
    }
  }

  return results;
}

export function getMetricValue(deviceId: string, metricName: string, port?: string): number | undefined {
  const dm = cachedMetrics.get(deviceId);
  if (!dm) return undefined;

  for (const metric of dm.metrics) {
    if (metric.name !== metricName) continue;
    if (port && metric.labels.port !== port) continue;
    return metric.value;
  }

  return undefined;
}

export interface AggregatedMetric {
  name: string;
  device: string;
  value: number;
  timestamp: number;
}

export function getSystemMetricsSummary(): AggregatedMetric[] {
  const results: AggregatedMetric[] = [];
  const allMetrics = Array.from(cachedMetrics.values());

  for (const dm of allMetrics) {
    const cpuMetrics = dm.metrics.filter((m: MetricValue) => m.name === "switch_cpu_usage");
    if (cpuMetrics.length > 0) {
      const avgCpu = cpuMetrics.reduce((sum: number, m: MetricValue) => sum + m.value, 0) / cpuMetrics.length;
      results.push({ name: "switch_cpu_usage", device: dm.deviceId, value: avgCpu, timestamp: dm.collectedAt });
    }

    const memMetric = dm.metrics.find((m: MetricValue) => m.name === "switch_memory_utilization");
    if (memMetric) {
      results.push({ name: "switch_memory_utilization", device: dm.deviceId, value: memMetric.value, timestamp: dm.collectedAt });
    }
  }

  return results;
}

export function getBGPPeerStatus(): Array<{ device: string; peerIp: string; state: number; prefixesReceived: number }> {
  const results: Array<{ device: string; peerIp: string; state: number; prefixesReceived: number }> = [];
  const allMetrics = Array.from(cachedMetrics.values());

  for (const dm of allMetrics) {
    const bgpStateMetrics = dm.metrics.filter((m: MetricValue) => m.name === "switch_bgp_peer_state");
    
    for (const stateMetric of bgpStateMetrics) {
      const prefixMetric = dm.metrics.find(
        (m: MetricValue) => m.name === "switch_bgp_prefixes_received" && m.labels.peer_ip === stateMetric.labels.peer_ip
      );

      results.push({
        device: stateMetric.labels.device,
        peerIp: stateMetric.labels.peer_ip,
        state: stateMetric.value,
        prefixesReceived: prefixMetric?.value || 0,
      });
    }
  }

  return results;
}

export function getPortStatus(): Array<{ device: string; port: string; operStatus: number; errors: number }> {
  const results: Array<{ device: string; port: string; operStatus: number; errors: number }> = [];
  const allMetrics = Array.from(cachedMetrics.values());

  for (const dm of allMetrics) {
    const operStatusMetrics = dm.metrics.filter((m: MetricValue) => m.name === "switch_port_oper_status");

    for (const statusMetric of operStatusMetrics) {
      const errorsInMetric = dm.metrics.find(
        (m: MetricValue) => m.name === "switch_port_errors_in" && m.labels.port === statusMetric.labels.port
      );
      const errorsOutMetric = dm.metrics.find(
        (m: MetricValue) => m.name === "switch_port_errors_out" && m.labels.port === statusMetric.labels.port
      );

      results.push({
        device: statusMetric.labels.device,
        port: statusMetric.labels.port,
        operStatus: statusMetric.value,
        errors: (errorsInMetric?.value || 0) + (errorsOutMetric?.value || 0),
      });
    }
  }

  return results;
}

export async function executePromQLQuery(query: string): Promise<any> {
  if (prometheusConfig.enabled) {
    return await queryPrometheus(query);
  }

  const allowedMetrics = [
    "switch_cpu_usage", "switch_memory_utilization", "switch_temperature",
    "switch_port_oper_status", "switch_port_errors_in", "switch_port_errors_out",
    "switch_bgp_peer_state", "switch_bgp_prefixes_received", "switch_bgp_updates_received",
    "sai_port_oper_status", "sai_queue_drops_total", "sai_pg_drops_total",
  ];

  for (const metric of allowedMetrics) {
    if (query.includes(metric)) {
      const results = queryMetricsByName(metric);
      return {
        status: "success",
        data: {
          resultType: "vector",
          result: results.map((r) => ({
            metric: { __name__: r.name, ...r.labels },
            value: [r.timestamp / 1000, String(r.value)],
          })),
        },
      };
    }
  }

  return { status: "error", error: "Metric not found in allowlist" };
}

export function detectAnomalies(): Array<{ deviceId: string; metric: string; value: number; threshold: number; severity: string }> {
  const anomalies: Array<{ deviceId: string; metric: string; value: number; threshold: number; severity: string }> = [];
  const allMetrics = Array.from(cachedMetrics.values());

  for (const dm of allMetrics) {
    const portStatusMetrics = dm.metrics.filter((m: MetricValue) => m.name === "switch_port_oper_status" && m.value === 0);
    for (const metric of portStatusMetrics) {
      anomalies.push({
        deviceId: dm.deviceId,
        metric: `${metric.name}{port="${metric.labels.port}"}`,
        value: metric.value,
        threshold: 1,
        severity: "critical",
      });
    }

    const bgpDownMetrics = dm.metrics.filter((m: MetricValue) => m.name === "switch_bgp_peer_state" && m.value === 0);
    for (const metric of bgpDownMetrics) {
      anomalies.push({
        deviceId: dm.deviceId,
        metric: `${metric.name}{peer_ip="${metric.labels.peer_ip}"}`,
        value: metric.value,
        threshold: 1,
        severity: "critical",
      });
    }

    const highErrorPorts = dm.metrics.filter((m: MetricValue) => m.name === "switch_port_errors_in" && m.value > 100);
    for (const metric of highErrorPorts) {
      anomalies.push({
        deviceId: dm.deviceId,
        metric: `${metric.name}{port="${metric.labels.port}"}`,
        value: metric.value,
        threshold: 100,
        severity: "high",
      });
    }

    const queueDrops = dm.metrics.filter((m: MetricValue) => m.name === "sai_queue_drops_total" && m.value > 1000);
    for (const metric of queueDrops) {
      anomalies.push({
        deviceId: dm.deviceId,
        metric: `${metric.name}{port="${metric.labels.port}",queue="${metric.labels.queue}"}`,
        value: metric.value,
        threshold: 1000,
        severity: "high",
      });
    }
  }

  return anomalies;
}
