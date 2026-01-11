import { db } from "./db";
import { metricsTimeseries, devices, type InsertMetricsTimeseries } from "@shared/schema";
import { generateDeviceMetrics } from "./telemetry-exporter";
import { lt } from "drizzle-orm";

class MetricsCollector {
  private intervalId: NodeJS.Timeout | null = null;
  private cleanupIntervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private collectionInterval = 30000;
  private cleanupInterval = 60 * 60 * 1000;
  private lastCollectionTime: Date | null = null;
  private totalCollections = 0;
  private errors = 0;

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log("[MetricsCollector] Already running");
      return;
    }

    this.isRunning = true;
    console.log("[MetricsCollector] Starting metrics collection...");
    
    await this.collectMetrics();
    
    this.intervalId = setInterval(async () => {
      try {
        await this.collectMetrics();
      } catch (error) {
        this.errors++;
        console.error("[MetricsCollector] Collection error, will retry next interval:", error);
      }
    }, this.collectionInterval);
    
    this.cleanupIntervalId = setInterval(async () => {
      await this.cleanupOldMetrics(24);
    }, this.cleanupInterval);
    
    console.log(`[MetricsCollector] Collection scheduled every ${this.collectionInterval / 1000}s`);
    console.log(`[MetricsCollector] Cleanup scheduled every ${this.cleanupInterval / 1000 / 60} min`);
  }

  async stop(): Promise<void> {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
    }
    this.isRunning = false;
    console.log("[MetricsCollector] Stopped");
  }

  async restart(): Promise<void> {
    console.log("[MetricsCollector] Restarting...");
    await this.stop();
    await this.start();
  }

  async collectMetrics(): Promise<void> {
    try {
      const allDevices = await db.select().from(devices);
      const now = new Date();
      const metricsToInsert: InsertMetricsTimeseries[] = [];

      for (const device of allDevices) {
        const deviceMetrics = generateDeviceMetrics(device as any);
        const bgpPeers = device.type === 'endpoint' ? 0 : 
          (device.bgpConfig as any)?.neighbors?.length || 0;
        
        let cpu = device.cpu;
        let memory = device.memory;
        let portUtil = Math.random() * 60 + 20;
        let latency = Math.random() * 10 + 2;
        let packetDrops = Math.floor(Math.random() * 30);
        let bgpPeerCount = bgpPeers;
        
        for (const m of deviceMetrics.metrics) {
          if (m.name === 'cpu_usage_percent') cpu = m.value;
          else if (m.name === 'memory_usage_percent') memory = m.value;
          else if (m.name === 'port_utilization_percent') portUtil = m.value;
          else if (m.name === 'latency_us') latency = m.value / 1000;
          else if (m.name === 'rx_drops') packetDrops = m.value;
          else if (m.name === 'bgp_peer_count') bgpPeerCount = m.value;
        }
        
        metricsToInsert.push({
          deviceId: device.id,
          collectedAt: now,
          cpu: cpu + (Math.random() - 0.5) * 5,
          memory: memory + (Math.random() - 0.5) * 3,
          portUtilization: portUtil,
          latency: latency,
          packetDrops: packetDrops,
          bgpPeers: bgpPeerCount,
        });
      }

      if (metricsToInsert.length > 0) {
        await db.insert(metricsTimeseries).values(metricsToInsert);
        this.lastCollectionTime = now;
        this.totalCollections++;
        console.log(`[MetricsCollector] Collected ${metricsToInsert.length} device metrics at ${now.toISOString()}`);
      }
    } catch (error) {
      this.errors++;
      console.error("[MetricsCollector] Error collecting metrics:", error);
    }
  }

  async cleanupOldMetrics(hoursToKeep: number = 24): Promise<void> {
    try {
      const cutoff = new Date(Date.now() - hoursToKeep * 60 * 60 * 1000);
      await db.delete(metricsTimeseries).where(lt(metricsTimeseries.collectedAt, cutoff));
      console.log(`[MetricsCollector] Cleaned up metrics older than ${hoursToKeep} hours`);
    } catch (error) {
      console.error("[MetricsCollector] Error cleaning up old metrics:", error);
    }
  }

  getStatus(): { 
    isRunning: boolean; 
    interval: number; 
    lastCollection: string | null;
    totalCollections: number;
    errors: number;
  } {
    return {
      isRunning: this.isRunning,
      interval: this.collectionInterval,
      lastCollection: this.lastCollectionTime?.toISOString() || null,
      totalCollections: this.totalCollections,
      errors: this.errors,
    };
  }

  async triggerCollection(): Promise<void> {
    await this.collectMetrics();
  }
}

export const metricsCollector = new MetricsCollector();
