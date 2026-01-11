import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { databaseStorage } from "./database-storage";
import { metricsCollector } from "./metrics-collector";
import { getGNS3Client, getGNS3Config, resetGNS3Client } from "./gns3";
import { getCopilot } from "./copilot";
import { orchestrator, sseEmitter, broadcastSSE } from "./orchestrator";
import type { SSEMessage } from "@shared/schema";
import { 
  updateMetricsCache, 
  getAllMetrics, 
  getDeviceMetrics, 
  queryMetricsByName,
  getSystemMetricsSummary,
  getBGPPeerStatus,
  getPortStatus,
  executePromQLQuery,
  detectAnomalies,
  getPrometheusConfig,
  updatePrometheusConfig
} from "./prometheus-integration";
import { injectFault, clearFault, hasFault, getFault, getAllActiveFaults, formatPrometheusMetrics, generateAllDeviceMetrics } from "./telemetry-exporter";
import { generate52DeviceTopology } from "./topology-generator";
import { processNLQuery, getQuerySuggestions } from "./nl-query-service";
import { detectionAgent } from "./detection-agent";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await databaseStorage.initialize();
  console.log("[Routes] Database initialized");
  
  await metricsCollector.start();
  console.log("[Routes] Metrics collector started");
  
  app.get("/api/devices", async (req, res) => {
    try {
      const devices = await databaseStorage.getDevices();
      res.json(devices);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch devices" });
    }
  });

  app.get("/api/devices/:id", async (req, res) => {
    try {
      const device = await databaseStorage.getDevice(req.params.id);
      if (!device) {
        return res.status(404).json({ error: "Device not found" });
      }
      res.json(device);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch device" });
    }
  });

  app.post("/api/devices/:id/start", async (req, res) => {
    try {
      const client = getGNS3Client();
      if (!client) {
        return res.status(400).json({ error: "GNS3 not enabled" });
      }
      await client.startNode(req.params.id);
      res.json({ success: true, message: "Node started" });
    } catch (error) {
      res.status(500).json({ 
        error: "Failed to start device",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.post("/api/devices/:id/stop", async (req, res) => {
    try {
      const client = getGNS3Client();
      if (!client) {
        return res.status(400).json({ error: "GNS3 not enabled" });
      }
      await client.stopNode(req.params.id);
      res.json({ success: true, message: "Node stopped" });
    } catch (error) {
      res.status(500).json({ 
        error: "Failed to stop device",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.post("/api/devices/:id/reload", async (req, res) => {
    try {
      const client = getGNS3Client();
      if (!client) {
        return res.status(400).json({ error: "GNS3 not enabled" });
      }
      await client.reloadNode(req.params.id);
      res.json({ success: true, message: "Node reloaded" });
    } catch (error) {
      res.status(500).json({ 
        error: "Failed to reload device",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.get("/api/incidents", async (req, res) => {
    try {
      const incidents = await databaseStorage.getIncidents();
      res.json(incidents);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch incidents" });
    }
  });

  app.get("/api/incidents/:id", async (req, res) => {
    try {
      const incident = await databaseStorage.getIncident(req.params.id);
      if (!incident) {
        return res.status(404).json({ error: "Incident not found" });
      }
      res.json(incident);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch incident" });
    }
  });

  app.get("/api/incidents/:id/timeline", async (req, res) => {
    try {
      const timeline = await databaseStorage.getIncidentTimeline(req.params.id);
      res.json(timeline);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch incident timeline" });
    }
  });

  app.get("/api/incidents/:id/remediation", async (req, res) => {
    try {
      const steps = await databaseStorage.getIncidentRemediation(req.params.id);
      res.json(steps);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch remediation steps" });
    }
  });

  app.get("/api/agents", async (req, res) => {
    try {
      // Use orchestrator agents as the source of truth for operational agents
      // This ensures consistency with /api/orchestrator/agents
      const agents = orchestrator.getAgents();
      res.json(agents);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch agents" });
    }
  });

  app.get("/api/agents/:id", async (req, res) => {
    try {
      // Use orchestrator agent by ID for consistency
      const agent = orchestrator.getAgent(req.params.id);
      if (!agent) {
        return res.status(404).json({ error: "Agent not found" });
      }
      res.json(agent);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch agent" });
    }
  });

  app.get("/api/audit", async (req, res) => {
    try {
      const entries = await databaseStorage.getAuditEntries();
      res.json(entries);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch audit entries" });
    }
  });

  app.get("/api/metrics/trends", async (req, res) => {
    try {
      const deviceId = req.query.deviceId as string | undefined;
      const tier = req.query.tier as "core" | "spine" | "tor" | "endpoint" | undefined;
      const hoursBack = req.query.hoursBack ? parseInt(req.query.hoursBack as string) : 24;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      
      const trends = await databaseStorage.getMetricTrends({ 
        deviceId, 
        tier, 
        hoursBack, 
        limit 
      });
      res.json(trends);
    } catch (error) {
      console.error("Failed to fetch metric trends:", error);
      res.status(500).json({ error: "Failed to fetch metric trends" });
    }
  });

  app.get("/api/health", async (req, res) => {
    try {
      const health = await databaseStorage.getSystemHealth();
      res.json(health);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch system health" });
    }
  });

  app.get("/api/kpis", async (req, res) => {
    try {
      const kpis = await databaseStorage.getKPIMetrics();
      res.json(kpis);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch KPI metrics" });
    }
  });

  app.get("/api/learning", async (req, res) => {
    try {
      const updates = await databaseStorage.getLearningUpdates();
      res.json(updates);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch learning updates" });
    }
  });

  app.get("/api/topology/links", async (req, res) => {
    try {
      const links = await databaseStorage.getTopologyLinks();
      res.json(links);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch topology links" });
    }
  });

  app.get("/api/gns3/settings", async (req, res) => {
    try {
      const settings = await storage.getGNS3Settings();
      const safeSettings = {
        ...settings,
        password: settings.password ? "********" : "",
      };
      res.json(safeSettings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch GNS3 settings" });
    }
  });

  app.post("/api/gns3/test", async (req, res) => {
    try {
      const result = await storage.testGNS3Connection();
      res.json(result);
    } catch (error) {
      res.status(500).json({ 
        success: false,
        message: error instanceof Error ? error.message : "Connection test failed"
      });
    }
  });

  app.get("/api/gns3/projects", async (req, res) => {
    try {
      const client = getGNS3Client();
      if (!client) {
        return res.status(400).json({ error: "GNS3 not enabled" });
      }
      const projects = await client.getProjects();
      res.json(projects);
    } catch (error) {
      res.status(500).json({ 
        error: "Failed to fetch GNS3 projects",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.get("/api/gns3/nodes", async (req, res) => {
    try {
      const client = getGNS3Client();
      if (!client) {
        return res.status(400).json({ error: "GNS3 not enabled" });
      }
      const nodes = await client.getNodes();
      res.json(nodes);
    } catch (error) {
      res.status(500).json({ 
        error: "Failed to fetch GNS3 nodes",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.get("/api/gns3/links", async (req, res) => {
    try {
      const client = getGNS3Client();
      if (!client) {
        return res.status(400).json({ error: "GNS3 not enabled" });
      }
      const links = await client.getLinks();
      res.json(links);
    } catch (error) {
      res.status(500).json({ 
        error: "Failed to fetch GNS3 links",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.get("/api/gns3/status", async (req, res) => {
    try {
      const config = getGNS3Config();
      const client = getGNS3Client();
      
      if (!config.enabled) {
        return res.json({
          enabled: false,
          connected: false,
          message: "GNS3 integration is disabled",
        });
      }

      if (!client) {
        return res.json({
          enabled: true,
          connected: false,
          message: "GNS3 client not initialized",
        });
      }

      const isConnected = await client.testConnection();
      let version = null;
      let projectInfo = null;

      if (isConnected) {
        try {
          const versionData = await client.getVersion();
          version = versionData.version;
          
          if (config.projectId) {
            const project = await client.getProject(config.projectId);
            projectInfo = {
              name: project.name,
              status: project.status,
            };
          }
        } catch (e) {
        }
      }

      res.json({
        enabled: true,
        connected: isConnected,
        serverUrl: config.serverUrl,
        projectId: config.projectId,
        version,
        project: projectInfo,
        message: isConnected ? "Connected to GNS3 server" : "Unable to connect to GNS3 server",
      });
    } catch (error) {
      res.status(500).json({ 
        enabled: getGNS3Config().enabled,
        connected: false,
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.post("/api/copilot/chat", async (req, res) => {
    try {
      const { message } = req.body;
      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }

      const copilot = getCopilot();
      const actions = await copilot.processCommand(message);
      res.json({ actions });
    } catch (error) {
      res.status(500).json({
        error: "Failed to process command",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.post("/api/copilot/clear", async (req, res) => {
    try {
      const copilot = getCopilot();
      copilot.clearHistory();
      res.json({ success: true, message: "Conversation history cleared" });
    } catch (error) {
      res.status(500).json({
        error: "Failed to clear history",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.post("/api/nl-query", async (req, res) => {
    try {
      const { query } = req.body;
      if (!query) {
        return res.status(400).json({ error: "Query is required" });
      }

      const result = await processNLQuery(query);
      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Query processing failed",
      });
    }
  });

  app.get("/api/nl-query/suggestions", async (req, res) => {
    try {
      const suggestions = await getQuerySuggestions();
      res.json({ suggestions });
    } catch (error) {
      res.status(500).json({
        error: "Failed to get suggestions",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.get("/api/gns3/templates", async (req, res) => {
    try {
      const client = getGNS3Client();
      if (!client) {
        return res.status(400).json({ error: "GNS3 not enabled" });
      }
      const templates = await client.getTemplates();
      res.json(templates);
    } catch (error) {
      res.status(500).json({
        error: "Failed to fetch templates",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.get("/api/orchestrator/status", async (req, res) => {
    try {
      const status = orchestrator.getStatus();
      res.json(status);
    } catch (error) {
      res.status(500).json({
        error: "Failed to get orchestrator status",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.post("/api/orchestrator/start", async (req, res) => {
    try {
      orchestrator.start();
      res.json({ success: true, message: "Orchestrator started" });
    } catch (error) {
      res.status(500).json({
        error: "Failed to start orchestrator",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.post("/api/orchestrator/stop", async (req, res) => {
    try {
      orchestrator.stop();
      res.json({ success: true, message: "Orchestrator stopped" });
    } catch (error) {
      res.status(500).json({
        error: "Failed to stop orchestrator",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.get("/api/orchestrator/agents", async (req, res) => {
    try {
      const agents = orchestrator.getAgents();
      res.json(agents);
    } catch (error) {
      res.status(500).json({
        error: "Failed to get agents",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.get("/api/orchestrator/tasks", async (req, res) => {
    try {
      const tasks = orchestrator.getTasks();
      res.json(tasks);
    } catch (error) {
      res.status(500).json({
        error: "Failed to get tasks",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.post("/api/orchestrator/tasks", async (req, res) => {
    try {
      const { type, priority, payload, incidentId, deviceIds } = req.body;
      const task = await orchestrator.createTask(type, priority, payload, { incidentId, deviceIds });
      res.json(task);
    } catch (error) {
      res.status(500).json({
        error: "Failed to create task",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.get("/api/orchestrator/executions", async (req, res) => {
    try {
      const executions = orchestrator.getExecutions();
      res.json(executions);
    } catch (error) {
      res.status(500).json({
        error: "Failed to get executions",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.get("/api/orchestrator/events", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const events = orchestrator.getEvents(limit);
      res.json(events);
    } catch (error) {
      res.status(500).json({
        error: "Failed to get events",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.get("/api/orchestrator/playbooks", async (req, res) => {
    try {
      const playbooks = orchestrator.getPlaybooks();
      res.json(playbooks);
    } catch (error) {
      res.status(500).json({
        error: "Failed to get playbooks",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.post("/api/orchestrator/trigger-analysis", async (req, res) => {
    try {
      const { incidentId } = req.body;
      const incident = await databaseStorage.getIncident(incidentId);
      if (!incident) {
        return res.status(404).json({ error: "Incident not found" });
      }
      const task = await orchestrator.triggerIncidentAnalysis(incident);
      res.json(task);
    } catch (error) {
      res.status(500).json({
        error: "Failed to trigger analysis",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.get("/api/detection/status", async (req, res) => {
    try {
      const status = detectionAgent.getStatus();
      res.json(status);
    } catch (error) {
      res.status(500).json({
        error: "Failed to get detection agent status",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.post("/api/detection/start", async (req, res) => {
    try {
      detectionAgent.start();
      res.json({ success: true, message: "Detection agent started" });
    } catch (error) {
      res.status(500).json({
        error: "Failed to start detection agent",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.post("/api/detection/stop", async (req, res) => {
    try {
      detectionAgent.stop();
      res.json({ success: true, message: "Detection agent stopped" });
    } catch (error) {
      res.status(500).json({
        error: "Failed to stop detection agent",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.post("/api/demo/inject-fault", async (req, res) => {
    try {
      const { scenario, deviceId, targetDeviceId } = req.body;
      if (!scenario) {
        return res.status(400).json({ error: "Scenario is required" });
      }
      const result = await orchestrator.injectFault(scenario, deviceId, targetDeviceId);
      res.json(result);
    } catch (error) {
      res.status(500).json({
        error: "Failed to inject fault",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.get("/api/demo/scenario-status", async (req, res) => {
    try {
      const status = orchestrator.getDemoScenarioStatus();
      res.json(status);
    } catch (error) {
      res.status(500).json({
        error: "Failed to get demo status",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.post("/api/demo/reset", async (req, res) => {
    try {
      await orchestrator.resetDemoScenario();
      res.json({ success: true, message: "Demo scenario reset" });
    } catch (error) {
      res.status(500).json({
        error: "Failed to reset demo",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.get("/api/metrics/collector/status", async (req, res) => {
    try {
      const status = metricsCollector.getStatus();
      res.json(status);
    } catch (error) {
      res.status(500).json({ error: "Failed to get collector status" });
    }
  });

  app.post("/api/metrics/collector/trigger", async (req, res) => {
    try {
      await metricsCollector.triggerCollection();
      res.json({ success: true, message: "Metrics collection triggered" });
    } catch (error) {
      res.status(500).json({ error: "Failed to trigger collection" });
    }
  });

  app.post("/api/metrics/collector/restart", async (req, res) => {
    try {
      await metricsCollector.restart();
      res.json({ success: true, message: "Metrics collector restarted" });
    } catch (error) {
      res.status(500).json({ error: "Failed to restart collector" });
    }
  });

  app.post("/api/metrics/collector/interval", async (req, res) => {
    try {
      const { intervalSeconds } = req.body;
      if (!intervalSeconds || typeof intervalSeconds !== 'number') {
        return res.status(400).json({ error: "intervalSeconds is required and must be a number" });
      }
      await metricsCollector.setInterval(intervalSeconds);
      res.json({ success: true, message: `Interval set to ${intervalSeconds} seconds`, interval: intervalSeconds });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to set interval" });
    }
  });

  // Metrics API endpoints
  app.get("/api/metrics/refresh", async (req, res) => {
    try {
      const devices = await databaseStorage.getDevices();
      updateMetricsCache(devices);
      res.json({ success: true, message: "Metrics cache refreshed", deviceCount: devices.length });
    } catch (error) {
      res.status(500).json({ error: "Failed to refresh metrics" });
    }
  });

  app.get("/api/metrics/all", async (req, res) => {
    try {
      const devices = await databaseStorage.getDevices();
      updateMetricsCache(devices);
      const metrics = getAllMetrics();
      res.json(metrics);
    } catch (error) {
      res.status(500).json({ error: "Failed to get metrics" });
    }
  });

  app.get("/api/metrics/device/:deviceId", async (req, res) => {
    try {
      const devices = await databaseStorage.getDevices();
      updateMetricsCache(devices);
      const metrics = getDeviceMetrics(req.params.deviceId);
      if (!metrics) {
        return res.status(404).json({ error: "Device metrics not found" });
      }
      res.json(metrics);
    } catch (error) {
      res.status(500).json({ error: "Failed to get device metrics" });
    }
  });

  app.get("/api/metrics/system", async (req, res) => {
    try {
      const devices = await databaseStorage.getDevices();
      updateMetricsCache(devices);
      const summary = getSystemMetricsSummary();
      res.json(summary);
    } catch (error) {
      res.status(500).json({ error: "Failed to get system metrics" });
    }
  });

  app.get("/api/metrics/bgp", async (req, res) => {
    try {
      const devices = await databaseStorage.getDevices();
      updateMetricsCache(devices);
      const bgpStatus = getBGPPeerStatus();
      res.json(bgpStatus);
    } catch (error) {
      res.status(500).json({ error: "Failed to get BGP metrics" });
    }
  });

  app.get("/api/metrics/ports", async (req, res) => {
    try {
      const devices = await databaseStorage.getDevices();
      updateMetricsCache(devices);
      const portStatus = getPortStatus();
      res.json(portStatus);
    } catch (error) {
      res.status(500).json({ error: "Failed to get port metrics" });
    }
  });

  app.post("/api/metrics/query", async (req, res) => {
    try {
      const { query } = req.body;
      if (!query) {
        return res.status(400).json({ error: "Query is required" });
      }
      const devices = await databaseStorage.getDevices();
      updateMetricsCache(devices);
      const result = await executePromQLQuery(query);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to execute query" });
    }
  });

  app.get("/api/metrics/anomalies", async (req, res) => {
    try {
      const devices = await databaseStorage.getDevices();
      updateMetricsCache(devices);
      const anomalies = detectAnomalies();
      res.json(anomalies);
    } catch (error) {
      res.status(500).json({ error: "Failed to detect anomalies" });
    }
  });

  app.get("/api/metrics/prometheus", async (req, res) => {
    try {
      const devices = await databaseStorage.getDevices();
      const allMetrics = generateAllDeviceMetrics(devices);
      const prometheusFormat = formatPrometheusMetrics(allMetrics);
      res.set("Content-Type", "text/plain");
      res.send(prometheusFormat);
    } catch (error) {
      res.status(500).json({ error: "Failed to get prometheus metrics" });
    }
  });

  app.get("/api/prometheus/config", async (req, res) => {
    try {
      const config = getPrometheusConfig();
      res.json(config);
    } catch (error) {
      res.status(500).json({ error: "Failed to get Prometheus config" });
    }
  });

  app.post("/api/prometheus/config", async (req, res) => {
    try {
      const { url, enabled } = req.body;
      updatePrometheusConfig({ url, enabled });
      res.json({ success: true, config: getPrometheusConfig() });
    } catch (error) {
      res.status(500).json({ error: "Failed to update Prometheus config" });
    }
  });

  // Fault injection API endpoints
  app.post("/api/faults/inject", async (req, res) => {
    try {
      const { deviceId, faultType, severity, duration } = req.body;
      if (!deviceId || !faultType) {
        return res.status(400).json({ error: "deviceId and faultType are required" });
      }
      injectFault(deviceId, faultType, severity || "medium");
      
      if (duration) {
        setTimeout(() => clearFault(deviceId), duration * 1000);
      }
      
      res.json({ 
        success: true, 
        message: `Fault ${faultType} injected on ${deviceId}`,
        fault: { deviceId, faultType, severity: severity || "medium", duration }
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to inject fault" });
    }
  });

  app.post("/api/faults/reset", async (req, res) => {
    try {
      const { deviceId } = req.body;
      if (!deviceId) {
        return res.status(400).json({ error: "deviceId is required" });
      }
      clearFault(deviceId);
      res.json({ success: true, message: `Fault cleared on ${deviceId}` });
    } catch (error) {
      res.status(500).json({ error: "Failed to reset fault" });
    }
  });

  app.get("/api/faults/status/:deviceId", async (req, res) => {
    try {
      const deviceId = req.params.deviceId;
      const fault = getFault(deviceId);
      res.json({ 
        deviceId, 
        hasFault: hasFault(deviceId), 
        fault: fault || null 
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get fault status" });
    }
  });

  app.get("/api/faults/active", async (req, res) => {
    try {
      const activeFaults = getAllActiveFaults();
      res.json(activeFaults);
    } catch (error) {
      res.status(500).json({ error: "Failed to get active faults" });
    }
  });

  // Topology API endpoints
  app.get("/api/topology/generate", async (req, res) => {
    try {
      const topology = generate52DeviceTopology();
      res.json({
        devices: topology.devices.length,
        links: topology.links.length,
        tiers: {
          core: topology.devices.filter(d => d.tier === "core").length,
          spine: topology.devices.filter(d => d.tier === "spine").length,
          tor: topology.devices.filter(d => d.tier === "tor").length,
          endpoint: topology.devices.filter(d => d.tier === "endpoint").length,
          management: topology.devices.filter(d => d.tier === "management").length,
        }
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to generate topology" });
    }
  });

  app.get("/api/topology/pyramid", async (req, res) => {
    try {
      const topology = generate52DeviceTopology();
      res.json(topology);
    } catch (error) {
      res.status(500).json({ error: "Failed to get pyramid topology" });
    }
  });

  // LangGraph Agent API endpoints - Connects to Python agent server
  const AGENT_SERVER_URL = process.env.AGENT_SERVER_URL || "http://localhost:5001";
  const AGENT_FETCH_TIMEOUT = 30000; // 30 second timeout for agent calls

  // Helper function for fetch with timeout
  async function fetchWithTimeout(url: string, options: RequestInit, timeout: number = AGENT_FETCH_TIMEOUT): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  app.post("/api/langgraph/trigger", async (req, res) => {
    try {
      const { deviceId, deviceName, deviceType, faultType, severity } = req.body;
      
      if (!deviceId || !faultType) {
        return res.status(400).json({ error: "deviceId and faultType are required" });
      }

      // Get device info if not provided
      let device = null;
      if (!deviceName) {
        device = await databaseStorage.getDevice(deviceId);
        if (!device) {
          return res.status(404).json({ error: "Device not found" });
        }
      }

      const payload = {
        device_id: deviceId,
        device_name: deviceName || device?.name || deviceId,
        device_type: deviceType || device?.tier || "unknown",
        fault_type: faultType,
        severity: severity || "medium"
      };

      // Call Python agent server with timeout
      const response = await fetchWithTimeout(
        `${AGENT_SERVER_URL}/api/agents/trigger`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        }
      );

      if (!response.ok) {
        throw new Error(`Agent server error: ${response.status}`);
      }

      const result = await response.json();
      
      // Log the agent execution
      console.log(`[LangGraph] Healing workflow triggered: ${result.incident_id} for ${faultType} on ${payload.device_name}`);
      console.log(`[LangGraph] Stage: ${result.stage}, Verification: ${result.verification_passed}`);
      
      // Store internal logs in the demo scenario if available
      if (result.internal_logs && Array.isArray(result.internal_logs)) {
        console.log(`[LangGraph] Internal logs captured: ${result.internal_logs.length} entries`);
        orchestrator.setDemoInternalLogs(result.internal_logs);
      }

      res.json(result);
    } catch (error) {
      const isTimeout = error instanceof Error && error.name === 'AbortError';
      console.error("LangGraph trigger error:", error);
      res.status(isTimeout ? 504 : 500).json({
        error: isTimeout ? "Agent server timeout" : "Failed to trigger healing workflow",
        details: error instanceof Error ? error.message : "Unknown error",
        note: "Ensure Python agent server is running on port 5001"
      });
    }
  });

  app.get("/api/langgraph/status", async (req, res) => {
    try {
      const response = await fetchWithTimeout(
        `${AGENT_SERVER_URL}/api/agents/status`,
        { method: "GET" },
        5000 // 5 second timeout for status check
      );
      if (!response.ok) {
        throw new Error(`Agent server error: ${response.status}`);
      }
      const status = await response.json();
      res.json({ connected: true, ...status });
    } catch (error) {
      res.json({
        connected: false,
        error: error instanceof Error ? error.message : "Agent server not available",
        serverUrl: AGENT_SERVER_URL
      });
    }
  });

  app.get("/api/langgraph/capabilities", async (req, res) => {
    try {
      const response = await fetchWithTimeout(
        `${AGENT_SERVER_URL}/api/agents/capabilities`,
        { method: "GET" },
        5000
      );
      if (!response.ok) {
        throw new Error(`Agent server error: ${response.status}`);
      }
      const capabilities = await response.json();
      res.json({ connected: true, ...capabilities });
    } catch (error) {
      // Return static capabilities if server is unavailable
      res.json({
        connected: false,
        supported_fault_types: [
          { type: "bgp_link_flap", description: "BGP session flapping", auto_remediation: true },
          { type: "bgp_session_instability", description: "BGP session instability", auto_remediation: true },
          { type: "traffic_drop", description: "Unexpected traffic drop", auto_remediation: true },
          { type: "cpu_spike", description: "CPU utilization spike", auto_remediation: true },
          { type: "memory_exhaustion", description: "Memory exhaustion", auto_remediation: true }
        ],
        agents: [
          { name: "DetectionAgent", role: "Anomaly detection and fault classification" },
          { name: "RCAAgent", role: "Root cause analysis and hypothesis generation" },
          { name: "RemediationAgent", role: "Execute corrective actions via SONiC/GNS3" },
          { name: "VerificationAgent", role: "Validate fix success via metrics" }
        ]
      });
    }
  });

  app.post("/api/langgraph/test", async (req, res) => {
    try {
      const response = await fetchWithTimeout(
        `${AGENT_SERVER_URL}/api/agents/test`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" }
        }
      );
      if (!response.ok) {
        throw new Error(`Agent server error: ${response.status}`);
      }
      const result = await response.json();
      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Test failed",
        note: "Ensure Python agent server is running"
      });
    }
  });

  // Get LangGraph agent registry - source of truth for agent definitions
  app.get("/api/langgraph/agents", async (req, res) => {
    try {
      const response = await fetchWithTimeout(
        `${AGENT_SERVER_URL}/api/agents/registry`,
        { method: "GET" },
        5000
      );
      if (!response.ok) {
        throw new Error(`Agent server error: ${response.status}`);
      }
      const registry = await response.json();
      res.json({ connected: true, ...registry });
    } catch (error) {
      // Return static agent registry if server is unavailable
      res.json({
        connected: false,
        agents: [
          {
            id: "langgraph-detection",
            name: "DetectionAgent",
            type: "detection",
            status: "offline",
            description: "Analyzes metrics and confirms/classifies network faults using AI-powered pattern recognition",
            capabilities: [
              { name: "anomaly_detection", description: "Detect metric anomalies using statistical analysis" },
              { name: "fault_classification", description: "Classify faults into specific types" }
            ],
            tools: ["prometheus", "gns3"],
            usesAI: true,
            framework: "langgraph"
          },
          {
            id: "langgraph-rca",
            name: "RCAAgent",
            type: "rca",
            status: "offline",
            description: "Performs root cause analysis using correlation analysis and AI hypothesis generation",
            capabilities: [
              { name: "correlation_analysis", description: "Correlate events across devices" },
              { name: "hypothesis_generation", description: "Generate root cause hypotheses" }
            ],
            tools: ["prometheus", "gns3"],
            usesAI: true,
            framework: "langgraph"
          },
          {
            id: "langgraph-remediation",
            name: "RemediationAgent",
            type: "remediation",
            status: "offline",
            description: "Executes corrective actions via SONiC and GNS3 based on playbooks",
            capabilities: [
              { name: "playbook_execution", description: "Execute remediation playbooks" },
              { name: "bgp_remediation", description: "Reset BGP sessions and clear routes" }
            ],
            tools: ["sonic", "gns3"],
            usesAI: false,
            framework: "langgraph"
          },
          {
            id: "langgraph-verification",
            name: "VerificationAgent",
            type: "verification",
            status: "offline",
            description: "Validates fix success by checking metrics and running verification queries",
            capabilities: [
              { name: "metric_verification", description: "Verify metrics return to normal levels" }
            ],
            tools: ["prometheus"],
            usesAI: false,
            framework: "langgraph"
          }
        ],
        totalAgents: 4,
        activeWorkflows: 0,
        framework: "langgraph",
        note: "Agent server not connected"
      });
    }
  });

  // Get MCP tools health status
  app.get("/api/tools/health", async (req, res) => {
    try {
      const response = await fetchWithTimeout(
        `${AGENT_SERVER_URL}/api/tools/health`,
        { method: "GET" },
        5000
      );
      if (!response.ok) {
        throw new Error(`Agent server error: ${response.status}`);
      }
      const health = await response.json();
      res.json({ connected: true, ...health });
    } catch (error) {
      // Return offline status if server is unavailable
      res.json({
        connected: false,
        tools: [
          {
            id: "gns3",
            name: "GNS3 Network Simulator",
            description: "Network topology simulation and node control",
            status: "disconnected",
            message: "Agent server not available",
            enabled: false,
            capabilities: ["Node lifecycle management", "Link control", "Topology visualization"]
          },
          {
            id: "prometheus",
            name: "Prometheus Metrics",
            description: "Time-series metrics collection and queries",
            status: "disconnected",
            message: "Agent server not available",
            enabled: false,
            capabilities: ["Real-time metric queries", "Threshold monitoring"]
          },
          {
            id: "sonic",
            name: "SONiC Network OS",
            description: "Network operating system for remediation actions",
            status: "disconnected",
            message: "Agent server not available",
            enabled: false,
            capabilities: ["BGP session management", "Interface control"]
          }
        ],
        summary: {
          total: 3,
          connected: 0,
          simulated: 0,
          disconnected: 3
        }
      });
    }
  });

  app.get("/api/langgraph/workflow/:incidentId", async (req, res) => {
    try {
      const response = await fetchWithTimeout(
        `${AGENT_SERVER_URL}/api/agents/workflow/${req.params.incidentId}`,
        { method: "GET" },
        5000
      );
      if (!response.ok) {
        throw new Error(`Agent server error: ${response.status}`);
      }
      const result = await response.json();
      res.json(result);
    } catch (error) {
      res.status(500).json({
        error: "Failed to get workflow status",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Topology sync - fetch live device telemetry from Python agents
  app.get("/api/topology/telemetry", async (req, res) => {
    try {
      const deviceId = req.query.device_id;
      const url = deviceId 
        ? `${AGENT_SERVER_URL}/api/devices/telemetry?device_id=${deviceId}`
        : `${AGENT_SERVER_URL}/api/devices/telemetry`;
      
      const response = await fetchWithTimeout(url, { method: "GET" }, 5000);
      if (!response.ok) {
        throw new Error(`Agent server error: ${response.status}`);
      }
      const result = await response.json();
      res.json({ connected: true, ...result });
    } catch (error) {
      // Return fallback when Python service unavailable
      res.json({
        connected: false,
        success: false,
        devices: [],
        source: { gns3: "unavailable", prometheus: "unavailable" },
        note: "Agent server not connected",
        timestamp: new Date().toISOString()
      });
    }
  });

  // Topology sync trigger - fetch updates and broadcast via SSE
  app.post("/api/topology/sync", async (req, res) => {
    try {
      const response = await fetchWithTimeout(
        `${AGENT_SERVER_URL}/api/topology/sync`,
        { method: "POST", headers: { "Content-Type": "application/json" } },
        10000
      );
      if (!response.ok) {
        throw new Error(`Agent server error: ${response.status}`);
      }
      const result = await response.json();
      
      // Broadcast any device status updates via SSE
      if (result.updates && Array.isArray(result.updates)) {
        for (const update of result.updates) {
          sseEmitter.emit("event", {
            type: update.type || "device_status_changed",
            data: update
          });
        }
      }
      
      res.json({ connected: true, ...result });
    } catch (error) {
      res.json({
        connected: false,
        success: false,
        updates: [],
        nodeCount: 0,
        linkCount: 0,
        source: { gns3: "unavailable", prometheus: "unavailable" },
        note: "Agent server not connected",
        timestamp: new Date().toISOString()
      });
    }
  });

  // Auto-trigger LangGraph agents on fault injection
  app.post("/api/faults/inject-with-healing", async (req, res) => {
    try {
      const { deviceId, faultType, severity, autoHeal } = req.body;
      
      if (!deviceId || !faultType) {
        return res.status(400).json({ error: "deviceId and faultType are required" });
      }

      // Inject the fault
      injectFault(deviceId, faultType, severity || "medium");

      // Get device info
      const device = await databaseStorage.getDevice(deviceId);

      // If autoHeal is enabled, trigger LangGraph agents
      let healingResult = null;
      if (autoHeal !== false) {
        try {
          const response = await fetchWithTimeout(
            `${AGENT_SERVER_URL}/api/agents/trigger`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                device_id: deviceId,
                device_name: device?.name || deviceId,
                device_type: device?.tier || "unknown",
                fault_type: faultType,
                severity: severity || "medium"
              })
            }
          );
          
          if (response.ok) {
            healingResult = await response.json();
            
            // Store internal logs in the demo scenario if available
            if (healingResult.internal_logs && Array.isArray(healingResult.internal_logs)) {
              console.log(`[LangGraph] Internal logs captured: ${healingResult.internal_logs.length} entries`);
              orchestrator.setDemoInternalLogs(healingResult.internal_logs);
            }
            
            // If healing was successful, clear the fault
            if (healingResult.verification_passed) {
              clearFault(deviceId);
            }
          }
        } catch (e) {
          console.warn("Auto-healing not available:", e);
        }
      }

      res.json({
        success: true,
        message: `Fault ${faultType} injected on ${deviceId}`,
        fault: { deviceId, faultType, severity: severity || "medium" },
        healing: healingResult
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to inject fault with healing" });
    }
  });

  // ===== SSE Stream Endpoints =====
  
  // Unified SSE stream for all real-time updates
  app.get("/api/stream/events", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    // Send initial connection confirmation
    res.write(`data: ${JSON.stringify({ type: "connected", timestamp: new Date().toISOString() })}\n\n`);

    // Listen for SSE messages from the emitter
    const onMessage = (message: SSEMessage) => {
      res.write(`data: ${JSON.stringify(message)}\n\n`);
    };

    sseEmitter.on("message", onMessage);

    // Send heartbeat every 30 seconds to keep connection alive
    const heartbeat = setInterval(() => {
      res.write(`data: ${JSON.stringify({ type: "heartbeat", timestamp: new Date().toISOString() })}\n\n`);
    }, 30000);

    // Cleanup on client disconnect
    req.on("close", () => {
      sseEmitter.off("message", onMessage);
      clearInterval(heartbeat);
    });
  });

  // Get agent internal logs for a specific incident
  app.get("/api/incidents/:id/logs", async (req, res) => {
    try {
      const incidentId = req.params.id;
      const logs = await databaseStorage.getAgentInternalLogs(incidentId);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch incident logs" });
    }
  });

  // Get incident events for a specific incident
  app.get("/api/incidents/:id/events", async (req, res) => {
    try {
      const incidentId = req.params.id;
      const events = await databaseStorage.getIncidentEvents(incidentId);
      res.json(events);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch incident events" });
    }
  });

  // Broadcast manual telemetry update (for testing)
  app.post("/api/stream/telemetry", async (req, res) => {
    try {
      const { deviceId, metrics } = req.body;
      broadcastSSE("telemetry_update", { deviceId, metrics, timestamp: new Date().toISOString() });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to broadcast telemetry" });
    }
  });

  // Broadcast manual anomaly event (for testing)
  app.post("/api/stream/anomaly", async (req, res) => {
    try {
      const { deviceId, metric, value, threshold, anomalyType } = req.body;
      broadcastSSE("anomaly_detected", { 
        deviceId, 
        metric, 
        value, 
        threshold, 
        anomalyType,
        timestamp: new Date().toISOString() 
      });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to broadcast anomaly" });
    }
  });

  return httpServer;
}
