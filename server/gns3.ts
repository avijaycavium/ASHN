import type { Device, DeviceStatus, DeviceType } from "@shared/schema";

export interface GNS3Config {
  serverUrl: string;
  projectId: string;
  username?: string;
  password?: string;
  enabled: boolean;
}

export interface GNS3Node {
  node_id: string;
  name: string;
  node_type: string;
  status: "started" | "stopped" | "suspended";
  console: number | null;
  console_type: string;
  properties: Record<string, unknown>;
  label: {
    text: string;
  };
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  port_name_format: string;
  first_port_name: string | null;
  compute_id: string;
}

export interface GNS3Link {
  link_id: string;
  project_id: string;
  nodes: Array<{
    node_id: string;
    adapter_number: number;
    port_number: number;
    label: {
      text: string;
    };
  }>;
  capturing: boolean;
  link_type: string;
  filters: Record<string, unknown>;
}

export interface GNS3Project {
  project_id: string;
  name: string;
  status: "opened" | "closed";
  path: string;
  filename: string;
  auto_start: boolean;
  auto_close: boolean;
  auto_open: boolean;
  scene_height: number;
  scene_width: number;
}

export interface GNS3Version {
  version: string;
  local: boolean;
}

export class GNS3Client {
  private config: GNS3Config;
  private baseUrl: string;

  constructor(config: GNS3Config) {
    this.config = config;
    this.baseUrl = config.serverUrl.replace(/\/$/, "");
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...((options.headers as Record<string, string>) || {}),
    };

    if (this.config.username && this.config.password) {
      const auth = Buffer.from(
        `${this.config.username}:${this.config.password}`
      ).toString("base64");
      headers["Authorization"] = `Basic ${auth}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      throw new Error(
        `GNS3 API error: ${response.status} ${response.statusText}`
      );
    }

    if (response.status === 204 || response.headers.get("content-length") === "0") {
      return {} as T;
    }

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      return response.json();
    }

    return {} as T;
  }

  async getVersion(): Promise<GNS3Version> {
    return this.request<GNS3Version>("/v2/version");
  }

  async getProjects(): Promise<GNS3Project[]> {
    return this.request<GNS3Project[]>("/v2/projects");
  }

  async getProject(projectId: string): Promise<GNS3Project> {
    return this.request<GNS3Project>(`/v2/projects/${projectId}`);
  }

  async openProject(projectId: string): Promise<GNS3Project> {
    return this.request<GNS3Project>(`/v2/projects/${projectId}/open`, {
      method: "POST",
    });
  }

  async getNodes(projectId?: string): Promise<GNS3Node[]> {
    const pid = projectId || this.config.projectId;
    return this.request<GNS3Node[]>(`/v2/projects/${pid}/nodes`);
  }

  async getNode(nodeId: string, projectId?: string): Promise<GNS3Node> {
    const pid = projectId || this.config.projectId;
    return this.request<GNS3Node>(`/v2/projects/${pid}/nodes/${nodeId}`);
  }

  async startNode(nodeId: string, projectId?: string): Promise<void> {
    const pid = projectId || this.config.projectId;
    await this.request(`/v2/projects/${pid}/nodes/${nodeId}/start`, {
      method: "POST",
    });
  }

  async stopNode(nodeId: string, projectId?: string): Promise<void> {
    const pid = projectId || this.config.projectId;
    await this.request(`/v2/projects/${pid}/nodes/${nodeId}/stop`, {
      method: "POST",
    });
  }

  async reloadNode(nodeId: string, projectId?: string): Promise<void> {
    const pid = projectId || this.config.projectId;
    await this.request(`/v2/projects/${pid}/nodes/${nodeId}/reload`, {
      method: "POST",
    });
  }

  async getLinks(projectId?: string): Promise<GNS3Link[]> {
    const pid = projectId || this.config.projectId;
    return this.request<GNS3Link[]>(`/v2/projects/${pid}/links`);
  }

  async getLink(linkId: string, projectId?: string): Promise<GNS3Link> {
    const pid = projectId || this.config.projectId;
    return this.request<GNS3Link>(`/v2/projects/${pid}/links/${linkId}`);
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.getVersion();
      return true;
    } catch {
      return false;
    }
  }

  mapNodeToDevice(node: GNS3Node, links: GNS3Link[]): Device {
    const deviceType = this.inferDeviceType(node);
    const deviceStatus = this.mapNodeStatus(node.status);

    const nodeLinks = links.filter((link) =>
      link.nodes.some((n) => n.node_id === node.node_id)
    );

    const totalPorts = this.estimatePorts(node);
    const activePorts = nodeLinks.length;

    return {
      id: node.node_id,
      name: node.name,
      type: deviceType,
      status: deviceStatus,
      location: `GNS3 (${node.compute_id})`,
      cpu: this.estimateCpu(node),
      memory: this.estimateMemory(node),
      uptime: node.status === "started" ? "Running" : "Stopped",
      ipAddress: this.extractIpAddress(node),
      ports: totalPorts,
      activePorts: activePorts,
    };
  }

  private inferDeviceType(node: GNS3Node): DeviceType {
    const name = node.name.toLowerCase();
    const nodeType = node.node_type.toLowerCase();

    if (name.includes("core") || name.includes("cr-")) {
      return "core";
    }
    if (name.includes("spine") || name.includes("sp-")) {
      return "spine";
    }
    if (name.includes("tor") || name.includes("leaf") || name.includes("sw-")) {
      return "tor";
    }
    if (name.includes("dpu") || name.includes("host") || name.includes("pc")) {
      return "dpu";
    }

    if (nodeType === "dynamips" || nodeType.includes("router")) {
      return "core";
    }
    if (nodeType === "ethernet_switch" || nodeType.includes("switch")) {
      return "spine";
    }
    if (nodeType === "vpcs" || nodeType === "docker") {
      return "dpu";
    }

    return "tor";
  }

  private mapNodeStatus(gns3Status: string): DeviceStatus {
    switch (gns3Status) {
      case "started":
        return "healthy";
      case "stopped":
        return "offline";
      case "suspended":
        return "degraded";
      default:
        return "offline";
    }
  }

  private estimatePorts(node: GNS3Node): number {
    const nodeType = node.node_type.toLowerCase();

    if (nodeType.includes("router") || nodeType === "dynamips") {
      return 48;
    }
    if (nodeType.includes("switch")) {
      return 24;
    }
    if (nodeType === "vpcs" || nodeType === "docker") {
      return 4;
    }

    return 8;
  }

  private estimateCpu(_node: GNS3Node): number {
    return Math.floor(20 + Math.random() * 40);
  }

  private estimateMemory(_node: GNS3Node): number {
    return Math.floor(25 + Math.random() * 40);
  }

  private extractIpAddress(node: GNS3Node): string {
    const props = node.properties as Record<string, string>;
    if (props.management_ip) {
      return props.management_ip;
    }
    if (props.ip_address) {
      return props.ip_address;
    }

    const name = node.name.toLowerCase();
    const match = name.match(/(\d+)/);
    const num = match ? parseInt(match[1], 10) : 1;

    if (name.includes("core")) return `10.0.0.${num}`;
    if (name.includes("spine")) return `10.0.1.${num}`;
    if (name.includes("tor") || name.includes("leaf")) return `10.0.2.${num}`;
    return `10.0.3.${num}`;
  }
}

let gns3Client: GNS3Client | null = null;

export function getGNS3Config(): GNS3Config {
  return {
    serverUrl: process.env.GNS3_SERVER_URL || "http://localhost:3080",
    projectId: process.env.GNS3_PROJECT_ID || "",
    username: process.env.GNS3_USERNAME,
    password: process.env.GNS3_PASSWORD,
    enabled: process.env.GNS3_ENABLED === "true",
  };
}

export function getGNS3Client(): GNS3Client | null {
  const config = getGNS3Config();

  if (!config.enabled) {
    return null;
  }

  if (!gns3Client) {
    gns3Client = new GNS3Client(config);
  }

  return gns3Client;
}

export function resetGNS3Client(): void {
  gns3Client = null;
}
