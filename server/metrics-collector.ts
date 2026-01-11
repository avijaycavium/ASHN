import { db } from "./db";
import { metricsTimeseries, devices, type InsertMetricsTimeseries } from "@shared/schema";
import { getDeviceMetrics } from "./telemetry-exporter";

class MetricsCollector {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private collectionInterval = 30000;

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log("[MetricsCollector] Already running");
      return;
    }

    this.isRunning = true;
    console.log("[MetricsCollector] Starting metrics collection...");
    
    await this.collectMetrics();
    
    this.intervalId = setInterval(async () => {
      await this.collectMetrics();
    }, this.collectionInterval);
    
    console.log(`[MetricsCollector] Collection scheduled every ${this.collectionInterval / 1000}s`);
  }

  async stop(): Promise<void> {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log("[MetricsCollector] Stopped");
  }

  async collectMetrics(): Promise<void> {
    try {
      const allDevices = await db.select().from(devices);
      const now = new Date();
      const metricsToInsert: InsertMetricsTimeseries[] = [];

      for (const device of allDevices) {
        const deviceMetrics = getDeviceMetrics(device.id);
        
        if (deviceMetrics) {
          const bgpPeers = device.type === 'endpoint' ? 0 : 
            (device.bgpConfig as any)?.neighbors?.length || 0;
          
          metricsToInsert.push({
            deviceId: device.id,
            collectedAt: now,
            cpu: deviceMetrics.system?.cpuUsage || device.cpu,
            memory: deviceMetrics.system?.memoryUsage || device.memory,
            portUtilization: deviceMetrics.port?.utilization || Math.random() * 60 + 20,
            latency: deviceMetrics.port?.latencyUs ? deviceMetrics.port.latencyUs / 1000 : Math.random() * 10 + 2,
            packetDrops: deviceMetrics.port?.rxDrops || Math.floor(Math.random() * 30),
            bgpPeers: deviceMetrics.bgp?.peerCount || bgpPeers,
          });
        } else {
          const bgpPeers = device.type === 'endpoint' ? 0 : 
            (device.bgpConfig as any)?.neighbors?.length || 0;
          
          metricsToInsert.push({
            deviceId: device.id,
            collectedAt: now,
            cpu: device.cpu + (Math.random() - 0.5) * 10,
            memory: device.memory + (Math.random() - 0.5) * 8,
            portUtilization: Math.random() * 60 + 20,
            latency: Math.random() * 10 + 2,
            packetDrops: Math.floor(Math.random() * 30),
            bgpPeers: bgpPeers,
          });
        }
      }

      if (metricsToInsert.length > 0) {
        await db.insert(metricsTimeseries).values(metricsToInsert);
        console.log(`[MetricsCollector] Collected ${metricsToInsert.length} device metrics at ${now.toISOString()}`);
      }
    } catch (error) {
      console.error("[MetricsCollector] Error collecting metrics:", error);
    }
  }

  async cleanupOldMetrics(hoursToKeep: number = 24): Promise<void> {
    try {
      const cutoff = new Date(Date.now() - hoursToKeep * 60 * 60 * 1000);
      await db.delete(metricsTimeseries).where(
        (await import("drizzle-orm")).lt(metricsTimeseries.collectedAt, cutoff)
      );
      console.log(`[MetricsCollector] Cleaned up metrics older than ${hoursToKeep} hours`);
    } catch (error) {
      console.error("[MetricsCollector] Error cleaning up old metrics:", error);
    }
  }

  getStatus(): { isRunning: boolean; interval: number } {
    return {
      isRunning: this.isRunning,
      interval: this.collectionInterval,
    };
  }
}

export const metricsCollector = new MetricsCollector();
