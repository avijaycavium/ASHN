import { db } from "../server/db";
import { metricsTimeseries, devices, type InsertMetricsTimeseries } from "../shared/schema";

async function seedHistoricalMetrics(hoursBack: number = 24, intervalMinutes: number = 5) {
  console.log(`[seed-metrics] Seeding ${hoursBack} hours of historical metrics...`);
  
  const allDevices = await db.select().from(devices);
  console.log(`[seed-metrics] Found ${allDevices.length} devices`);
  
  const now = Date.now();
  const startTime = now - hoursBack * 60 * 60 * 1000;
  const intervalMs = intervalMinutes * 60 * 1000;
  
  let totalInserted = 0;
  
  for (let timestamp = startTime; timestamp < now; timestamp += intervalMs) {
    const collectedAt = new Date(timestamp);
    const metricsToInsert: InsertMetricsTimeseries[] = [];
    
    const hourOfDay = collectedAt.getHours();
    const timeVariation = Math.sin((hourOfDay / 24) * 2 * Math.PI) * 15;
    
    for (const device of allDevices) {
      const bgpPeers = device.type === 'endpoint' ? 0 : 
        (device.bgpConfig as any)?.neighbors?.length || 0;
      
      const baseCpu = device.cpu + timeVariation;
      const baseMemory = device.memory + timeVariation * 0.5;
      
      metricsToInsert.push({
        deviceId: device.id,
        collectedAt,
        cpu: Math.max(5, Math.min(95, baseCpu + (Math.random() - 0.5) * 10)),
        memory: Math.max(10, Math.min(90, baseMemory + (Math.random() - 0.5) * 8)),
        portUtilization: Math.max(10, Math.min(85, 40 + timeVariation + (Math.random() - 0.5) * 20)),
        latency: Math.max(1, 5 + Math.random() * 10 + Math.abs(timeVariation) * 0.2),
        packetDrops: Math.max(0, Math.floor(Math.random() * 40 + timeVariation * 0.5)),
        bgpPeers: bgpPeers,
      });
    }
    
    if (metricsToInsert.length > 0) {
      await db.insert(metricsTimeseries).values(metricsToInsert);
      totalInserted += metricsToInsert.length;
    }
    
    if (totalInserted % 1000 === 0) {
      console.log(`[seed-metrics] Inserted ${totalInserted} records...`);
    }
  }
  
  console.log(`[seed-metrics] Complete! Inserted ${totalInserted} total records`);
}

const hoursBack = parseInt(process.argv[2] || "24");
const intervalMinutes = parseInt(process.argv[3] || "5");

seedHistoricalMetrics(hoursBack, intervalMinutes)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("[seed-metrics] Error:", error);
    process.exit(1);
  });
