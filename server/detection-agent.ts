import { storage } from "./storage";
import { detectAnomalies, getAllMetrics, updateMetricsCache } from "./prometheus-integration";
import type { Incident, IncidentSeverity, IncidentStatus } from "@shared/schema";

interface DetectionConfig {
  pollingInterval: number;
  enabled: boolean;
}

interface DetectedAnomaly {
  deviceId: string;
  metric: string;
  value: number;
  threshold: number;
  severity: string;
}

interface IncidentCreation {
  title: string;
  description: string;
  severity: IncidentSeverity;
  affectedDevices: string[];
}

class DetectionAgent {
  private config: DetectionConfig;
  private pollingTimer: ReturnType<typeof setInterval> | null = null;
  private processedAnomalies: Set<string> = new Set();
  private incidentCounter: number = 0;

  constructor() {
    this.config = {
      pollingInterval: 15000,
      enabled: false,
    };
  }

  start(): void {
    if (this.pollingTimer) {
      return;
    }
    
    this.config.enabled = true;
    console.log("[DetectionAgent] Starting detection agent...");
    
    this.runDetectionCycle();
    
    this.pollingTimer = setInterval(() => {
      this.runDetectionCycle();
    }, this.config.pollingInterval);
  }

  stop(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
    this.config.enabled = false;
    console.log("[DetectionAgent] Detection agent stopped");
  }

  isRunning(): boolean {
    return this.config.enabled && this.pollingTimer !== null;
  }

  getStatus(): { running: boolean; processedCount: number; pollingInterval: number } {
    return {
      running: this.isRunning(),
      processedCount: this.processedAnomalies.size,
      pollingInterval: this.config.pollingInterval,
    };
  }

  private async runDetectionCycle(): Promise<void> {
    try {
      const devices = await storage.getDevices();
      updateMetricsCache(devices, true);
      
      const anomalies = detectAnomalies();
      
      if (anomalies.length > 0) {
        console.log(`[DetectionAgent] Found ${anomalies.length} anomalies`);
      }
      
      for (const anomaly of anomalies) {
        await this.processAnomaly(anomaly);
      }
    } catch (error) {
      console.error("[DetectionAgent] Detection cycle error:", error);
    }
  }

  private getAnomalyKey(anomaly: DetectedAnomaly): string {
    return `${anomaly.deviceId}-${anomaly.metric}-${Math.floor(anomaly.value / 10) * 10}`;
  }

  private async processAnomaly(anomaly: DetectedAnomaly): Promise<void> {
    const key = this.getAnomalyKey(anomaly);
    
    if (this.processedAnomalies.has(key)) {
      return;
    }
    
    this.processedAnomalies.add(key);
    
    setTimeout(() => {
      this.processedAnomalies.delete(key);
    }, 300000);
    
    const incident = this.createIncidentFromAnomaly(anomaly);
    await this.raiseIncident(incident);
    
    console.log(`[DetectionAgent] Created incident for ${anomaly.deviceId}: ${anomaly.metric} = ${anomaly.value}`);
  }

  private createIncidentFromAnomaly(anomaly: DetectedAnomaly): IncidentCreation {
    const severityMap: Record<string, "critical" | "high" | "medium" | "low"> = {
      critical: "critical",
      high: "high",
      medium: "medium",
      low: "low",
    };

    let title: string;
    let description: string;
    let type: string;

    if (anomaly.metric.includes("port_oper_status")) {
      title = `Port Down on ${anomaly.deviceId.toUpperCase()}`;
      description = `Port operational status changed to DOWN (0). This may indicate a link flap or hardware failure.`;
      type = "Link Down";
    } else if (anomaly.metric.includes("bgp_peer_state")) {
      title = `BGP Session Down on ${anomaly.deviceId.toUpperCase()}`;
      description = `BGP peer session is not in established state. This affects routing convergence.`;
      type = "BGP Failure";
    } else if (anomaly.metric.includes("port_errors")) {
      title = `High Port Errors on ${anomaly.deviceId.toUpperCase()}`;
      description = `Port error count (${anomaly.value}) exceeded threshold (${anomaly.threshold}). May indicate physical layer issues.`;
      type = "Interface Errors";
    } else if (anomaly.metric.includes("sai_queue_drops")) {
      title = `Queue Drops Detected on ${anomaly.deviceId.toUpperCase()}`;
      description = `SAI queue drop count (${anomaly.value}) exceeded threshold (${anomaly.threshold}). Possible congestion or QoS misconfiguration.`;
    } else {
      title = `Anomaly Detected on ${anomaly.deviceId.toUpperCase()}`;
      description = `Metric ${anomaly.metric} value (${anomaly.value}) exceeded threshold (${anomaly.threshold}).`;
    }

    return {
      title,
      description,
      severity: severityMap[anomaly.severity] || "medium",
      affectedDevices: [anomaly.deviceId],
    };
  }

  private async raiseIncident(creation: IncidentCreation): Promise<Incident> {
    this.incidentCounter++;
    const id = `INC-${String(this.incidentCounter).padStart(5, "0")}`;
    
    const incident: Incident = {
      id,
      title: creation.title,
      description: creation.description,
      severity: creation.severity,
      status: "active" as IncidentStatus,
      ttd: 0,
      ttr: null,
      tttr: null,
      affectedDevices: creation.affectedDevices,
      rootCause: null,
      confidence: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      resolvedAt: null,
    };

    await storage.addIncident(incident);
    
    this.notifyAgents(incident);
    
    return incident;
  }

  private notifyAgents(incident: Incident): void {
    console.log(`[DetectionAgent] Notifying agents about incident ${incident.id}: ${incident.title}`);
  }

  clearProcessedAnomalies(): void {
    this.processedAnomalies.clear();
  }
}

export const detectionAgent = new DetectionAgent();
