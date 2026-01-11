import type { Device, TopologyLink, DeviceTier, BGPConfig, TelemetryExporterConfig } from "@shared/schema";

interface TopologyConfig {
  coreCount: number;
  spineCount: number;
  torCount: number;
  endpointCount: number;
}

const DEFAULT_CONFIG: TopologyConfig = {
  coreCount: 4,
  spineCount: 12,
  torCount: 16,
  endpointCount: 20,
};

function generateTelemetryExporter(): TelemetryExporterConfig {
  return {
    enabled: true,
    port: 9100,
    scrapeInterval: 10,
    metricsPath: "/metrics",
  };
}

function generateBGPConfig(asn: number, routerId: string, neighbors: BGPConfig["neighbors"]): BGPConfig {
  return {
    asn,
    routerId,
    neighbors,
  };
}

export function generate52DeviceTopology(config: TopologyConfig = DEFAULT_CONFIG): { devices: Device[]; links: TopologyLink[] } {
  const devices: Device[] = [];
  const links: TopologyLink[] = [];
  let linkId = 1;

  // Cloud-Host (Management)
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
    tier: "management",
    mgmtIp: "192.168.100.1",
    telemetryExporter: generateTelemetryExporter(),
  });

  // Generate Core switches (AS 65100-65103)
  for (let i = 1; i <= config.coreCount; i++) {
    const id = `core-${i}`;
    const asn = 65100 + i - 1;
    const mgmtIp = `192.168.100.${10 + i - 1}`;
    const dataIp = `10.255.1.${i}`;
    
    const neighbors: BGPConfig["neighbors"] = [];
    for (let s = 1; s <= config.spineCount; s++) {
      neighbors.push({
        peerIp: `10.0.0.${(i - 1) * config.spineCount * 2 + s * 2}`,
        remoteAsn: 65110 + s - 1,
        weight: 100,
        timers: { keepalive: 5, hold: 15 },
      });
    }

    devices.push({
      id,
      name: `CORE-${i}`,
      type: "core",
      status: "healthy",
      location: "Core Layer",
      cpu: Math.floor(Math.random() * 30) + 20,
      memory: Math.floor(Math.random() * 25) + 30,
      uptime: `${Math.floor(Math.random() * 90) + 30}d ${Math.floor(Math.random() * 24)}h`,
      ipAddress: mgmtIp,
      ports: 48,
      activePorts: 24 + Math.floor(Math.random() * 12),
      role: "fabric",
      tier: "core",
      mgmtIp,
      dataIp,
      bgpConfig: generateBGPConfig(asn, dataIp, neighbors),
      telemetryExporter: generateTelemetryExporter(),
    });
  }

  // Generate Spine switches (AS 65110-65121)
  for (let i = 1; i <= config.spineCount; i++) {
    const id = `spine-${String(i).padStart(2, "0")}`;
    const asn = 65110 + i - 1;
    const mgmtIp = `192.168.100.${50 + i - 1}`;
    const dataIp = `10.255.2.${i}`;

    const neighbors: BGPConfig["neighbors"] = [];
    for (let c = 1; c <= config.coreCount; c++) {
      neighbors.push({
        peerIp: `10.0.0.${(c - 1) * config.spineCount * 2 + i * 2 - 1}`,
        remoteAsn: 65100 + c - 1,
        weight: 100,
        timers: { keepalive: 5, hold: 15 },
      });
    }

    devices.push({
      id,
      name: `SPINE-${String(i).padStart(2, "0")}`,
      type: "spine",
      status: "healthy",
      location: "Spine Layer",
      cpu: Math.floor(Math.random() * 25) + 15,
      memory: Math.floor(Math.random() * 20) + 25,
      uptime: `${Math.floor(Math.random() * 60) + 20}d ${Math.floor(Math.random() * 24)}h`,
      ipAddress: mgmtIp,
      ports: 32,
      activePorts: 16 + Math.floor(Math.random() * 8),
      role: "transit",
      tier: "spine",
      mgmtIp,
      dataIp,
      bgpConfig: generateBGPConfig(asn, dataIp, neighbors),
      telemetryExporter: generateTelemetryExporter(),
    });
  }

  // Generate TOR switches (AS 65130-65145)
  for (let i = 1; i <= config.torCount; i++) {
    const id = `tor-${String(i).padStart(3, "0")}`;
    const asn = 65130 + i - 1;
    const mgmtIp = `192.168.100.${100 + i - 1}`;
    const dataIp = `10.255.3.${i}`;

    const neighbors: BGPConfig["neighbors"] = [];
    const spineConnections = Math.min(4, config.spineCount);
    for (let s = 0; s < spineConnections; s++) {
      const spineIndex = ((i - 1 + s) % config.spineCount) + 1;
      neighbors.push({
        peerIp: `10.0.16.${(i - 1) * spineConnections * 2 + s * 2}`,
        remoteAsn: 65110 + spineIndex - 1,
        weight: s === 0 ? 200 : 100,
        timers: { keepalive: 5, hold: 15 },
      });
    }

    devices.push({
      id,
      name: `TOR-${String(i).padStart(3, "0")}`,
      type: "tor",
      status: i === 5 ? "degraded" : "healthy",
      location: "TOR Layer",
      cpu: Math.floor(Math.random() * 35) + 20,
      memory: Math.floor(Math.random() * 25) + 30,
      uptime: `${Math.floor(Math.random() * 45) + 15}d ${Math.floor(Math.random() * 24)}h`,
      ipAddress: mgmtIp,
      ports: 48,
      activePorts: 24 + Math.floor(Math.random() * 16),
      role: "fabric",
      tier: "tor",
      mgmtIp,
      dataIp,
      bgpConfig: generateBGPConfig(asn, dataIp, neighbors),
      telemetryExporter: generateTelemetryExporter(),
    });
  }

  // Generate Endpoints (ENDPOINT-001 to ENDPOINT-020)
  for (let i = 1; i <= config.endpointCount; i++) {
    const id = `endpoint-${String(i).padStart(3, "0")}`;
    const mgmtIp = `192.168.100.${200 + i - 1}`;
    const dataIp = `10.2.${Math.ceil(i / 2)}.${10 + (i % 2 === 0 ? 1 : 0)}`;
    const parentTor = ((i - 1) % config.torCount) + 1;

    devices.push({
      id,
      name: `ENDPOINT-${String(i).padStart(3, "0")}`,
      type: "endpoint",
      status: "healthy",
      location: "Endpoint Layer",
      cpu: Math.floor(Math.random() * 20) + 10,
      memory: Math.floor(Math.random() * 30) + 20,
      uptime: `${Math.floor(Math.random() * 30) + 5}d ${Math.floor(Math.random() * 24)}h`,
      ipAddress: dataIp,
      ports: 2,
      activePorts: 2,
      role: "endpoint",
      tier: "endpoint",
      mgmtIp,
      dataIp,
      telemetryExporter: generateTelemetryExporter(),
    });
  }

  // Generate Core-Spine links (data plane only)
  for (let c = 1; c <= config.coreCount; c++) {
    for (let s = 1; s <= config.spineCount; s++) {
      links.push({
        id: `link-${linkId++}`,
        sourceId: `core-${c}`,
        targetId: `spine-${String(s).padStart(2, "0")}`,
        sourcePort: s,
        targetPort: c,
        status: "active",
        bandwidth: 100000,
        utilization: Math.floor(Math.random() * 40) + 20,
      });
    }
  }

  // Generate Spine-TOR links (data plane only)
  for (let s = 1; s <= config.spineCount; s++) {
    const torsPerSpine = Math.ceil(config.torCount / 4);
    for (let offset = 0; offset < torsPerSpine && ((s - 1) * torsPerSpine + offset + 1) <= config.torCount; offset++) {
      const torIndex = ((s - 1) % 4) * torsPerSpine + offset + 1;
      if (torIndex <= config.torCount) {
        const isFlapLink = s === 3 && torIndex === 5;
        links.push({
          id: `link-${linkId++}`,
          sourceId: `spine-${String(s).padStart(2, "0")}`,
          targetId: `tor-${String(torIndex).padStart(3, "0")}`,
          sourcePort: offset + config.coreCount + 1,
          targetPort: Math.ceil(s / 3),
          status: isFlapLink ? "error" : "active",
          bandwidth: 40000,
          utilization: isFlapLink ? 95 : Math.floor(Math.random() * 50) + 15,
        });
      }
    }
  }

  // Generate TOR-Endpoint links (data plane only)
  for (let e = 1; e <= config.endpointCount; e++) {
    const torIndex = ((e - 1) % config.torCount) + 1;
    links.push({
      id: `link-${linkId++}`,
      sourceId: `tor-${String(torIndex).padStart(3, "0")}`,
      targetId: `endpoint-${String(e).padStart(3, "0")}`,
      sourcePort: 24 + Math.ceil(e / config.torCount),
      targetPort: 1,
      status: "active",
      bandwidth: 10000,
      utilization: Math.floor(Math.random() * 30) + 10,
    });
  }

  return { devices, links };
}

export function getDevicesByTier(devices: Device[], tier: DeviceTier): Device[] {
  return devices.filter((d) => d.tier === tier);
}

export function getDataPlaneLinks(links: TopologyLink[]): TopologyLink[] {
  return links;
}
