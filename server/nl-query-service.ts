import OpenAI from "openai";
import { getDeviceMetrics, getAllMetrics, detectAnomalies } from "./prometheus-integration";
import { storage } from "./storage";
import type { Device, Incident } from "@shared/schema";

interface MetricValue {
  name: string;
  value: number;
  labels: Record<string, string>;
}

let openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openai) {
    openai = new OpenAI();
  }
  return openai;
}

interface QueryResult {
  type: "devices" | "metrics" | "incidents" | "topology" | "anomalies" | "general";
  data: any;
  explanation: string;
  query?: string;
}

interface NLQueryResponse {
  success: boolean;
  result?: QueryResult;
  error?: string;
}

const QUERY_CLASSIFICATION_PROMPT = `You are a network operations assistant for AASHN (Agentic Autonomous Self-Healing Networks).
Classify the user's query into one of these categories and extract relevant parameters:

Categories:
1. "devices" - Questions about network devices (core, spine, TOR, endpoint switches)
2. "metrics" - Questions about device metrics (CPU, memory, port errors, BGP state)
3. "incidents" - Questions about network incidents, alerts, or issues
4. "topology" - Questions about network topology, connections, or links
5. "anomalies" - Questions about detected anomalies or problems
6. "general" - General questions about the network or system

Extract any filters like:
- device_type: core, spine, tor, endpoint
- status: healthy, degraded, critical, offline
- device_id: specific device name or ID
- metric_type: cpu, memory, port_errors, bgp_state, temperature
- severity: critical, high, medium, low

Respond in JSON format:
{
  "category": "devices|metrics|incidents|topology|anomalies|general",
  "filters": { ... },
  "explanation": "Brief description of what will be queried"
}`;

async function classifyQuery(query: string): Promise<{ category: string; filters: Record<string, any>; explanation: string }> {
  try {
    const client = getOpenAI();
    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: QUERY_CLASSIFICATION_PROMPT },
        { role: "user", content: query }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content || "{}";
    return JSON.parse(content);
  } catch (error) {
    console.error("Query classification error:", error);
    return { category: "general", filters: {}, explanation: "Unable to classify query" };
  }
}

async function queryDevices(filters: Record<string, any>): Promise<Device[]> {
  const devices = await storage.getDevices();
  let result = devices;

  if (filters.device_type) {
    result = result.filter(d => d.type === filters.device_type);
  }
  if (filters.status) {
    result = result.filter(d => d.status === filters.status);
  }
  if (filters.device_id) {
    result = result.filter(d => 
      d.id.toLowerCase().includes(filters.device_id.toLowerCase()) ||
      d.name.toLowerCase().includes(filters.device_id.toLowerCase())
    );
  }

  return result;
}

async function queryMetrics(filters: Record<string, any>): Promise<any> {
  if (filters.device_id) {
    const deviceMetrics = getDeviceMetrics(filters.device_id);
    const metrics = deviceMetrics?.metrics || [];
    if (filters.metric_type) {
      const filtered = metrics.filter((m: MetricValue) => 
        m.name.toLowerCase().includes(filters.metric_type.toLowerCase())
      );
      return { deviceId: filters.device_id, metrics: filtered };
    }
    return { deviceId: filters.device_id, metrics };
  }

  const devices = await storage.getDevices();
  let targetDevices = devices;
  
  if (filters.device_type) {
    targetDevices = targetDevices.filter(d => d.type === filters.device_type);
  }

  const metricsResults = targetDevices.slice(0, 10).map((device) => {
    const deviceMetrics = getDeviceMetrics(device.id);
    return { deviceId: device.id, deviceName: device.name, metrics: deviceMetrics?.metrics || [] };
  });

  return metricsResults;
}

async function queryIncidents(filters: Record<string, any>): Promise<Incident[]> {
  const incidents = await storage.getIncidents();
  let result = incidents;

  if (filters.severity) {
    result = result.filter(i => i.severity === filters.severity);
  }
  if (filters.status) {
    result = result.filter(i => i.status === filters.status);
  }
  if (filters.device_id) {
    result = result.filter(i => 
      i.affectedDevices.some(d => d.toLowerCase().includes(filters.device_id.toLowerCase()))
    );
  }

  return result;
}

async function queryTopology(filters: Record<string, any>): Promise<any> {
  const [devices, links] = await Promise.all([
    storage.getDevices(),
    storage.getTopologyLinks()
  ]);

  let filteredDevices = devices;
  if (filters.device_type) {
    filteredDevices = filteredDevices.filter(d => d.type === filters.device_type);
  }

  return {
    devices: filteredDevices,
    links: links,
    summary: {
      totalDevices: devices.length,
      totalLinks: links.length,
      byType: {
        core: devices.filter(d => d.type === "core").length,
        spine: devices.filter(d => d.type === "spine").length,
        tor: devices.filter(d => d.type === "tor").length,
        endpoint: devices.filter(d => d.type === "endpoint").length
      }
    }
  };
}

async function queryAnomalies(filters: Record<string, any>): Promise<any> {
  const devices = await storage.getDevices();
  
  let targetDevices = devices;
  if (filters.device_type) {
    targetDevices = targetDevices.filter(d => d.type === filters.device_type);
  }

  const allAnomalies = detectAnomalies();
  const deviceIds = targetDevices.map(d => d.id);
  const filtered = allAnomalies.filter(a => deviceIds.includes(a.deviceId));
  return filtered;
}

async function generateSummary(query: string, result: any, category: string): Promise<string> {
  try {
    const client = getOpenAI();
    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { 
          role: "system", 
          content: `You are a network operations assistant. Summarize the query results in a clear, concise manner. 
Be specific about numbers and key findings. Keep the response under 150 words.` 
        },
        { 
          role: "user", 
          content: `User asked: "${query}"
Category: ${category}
Results: ${JSON.stringify(result, null, 2).slice(0, 2000)}

Provide a brief summary of the results.` 
        }
      ],
      temperature: 0.3,
      max_tokens: 200,
    });

    return response.choices[0]?.message?.content || "Query completed successfully.";
  } catch (error) {
    console.error("Summary generation error:", error);
    return "Query completed. Please review the results.";
  }
}

export async function processNLQuery(query: string): Promise<NLQueryResponse> {
  try {
    const classification = await classifyQuery(query);
    let data: any;

    switch (classification.category) {
      case "devices":
        data = await queryDevices(classification.filters);
        break;
      case "metrics":
        data = await queryMetrics(classification.filters);
        break;
      case "incidents":
        data = await queryIncidents(classification.filters);
        break;
      case "topology":
        data = await queryTopology(classification.filters);
        break;
      case "anomalies":
        data = await queryAnomalies(classification.filters);
        break;
      default:
        const [devices, incidents] = await Promise.all([
          storage.getDevices(),
          storage.getIncidents()
        ]);
        data = {
          deviceCount: devices.length,
          incidentCount: incidents.length,
          devicesByStatus: {
            healthy: devices.filter(d => d.status === "healthy").length,
            degraded: devices.filter(d => d.status === "degraded").length,
            critical: devices.filter(d => d.status === "critical").length,
            offline: devices.filter(d => d.status === "offline").length
          }
        };
    }

    const explanation = await generateSummary(query, data, classification.category);

    return {
      success: true,
      result: {
        type: classification.category as QueryResult["type"],
        data,
        explanation,
        query: query
      }
    };
  } catch (error) {
    console.error("NL Query processing error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Query processing failed"
    };
  }
}

export async function getQuerySuggestions(): Promise<string[]> {
  return [
    "Show all critical devices",
    "What is the CPU usage on core switches?",
    "List active incidents",
    "Show topology summary",
    "Are there any anomalies detected?",
    "Show me all TOR switches",
    "What is the BGP state for spine-001?",
    "How many devices are offline?",
    "Show port errors for tor-005",
    "List all high severity incidents"
  ];
}
