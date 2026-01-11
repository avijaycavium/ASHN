import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { databaseStorage } from "./database-storage";
import { getGNS3Client, getGNS3Config, resetGNS3Client } from "./gns3";
import { getCopilot } from "./copilot";
import { orchestrator } from "./orchestrator";
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
import { injectFault, clearFault, hasFault, getFault, formatPrometheusMetrics, generateAllDeviceMetrics } from "./telemetry-exporter";
import { generate52DeviceTopology } from "./topology-generator";
import { processNLQuery, getQuerySuggestions } from "./nl-query-service";
import { detectionAgent } from "./detection-agent";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await databaseStorage.initialize();
  console.log("[Routes] Database initialized");
  
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
      const agents = await databaseStorage.getAgents();
      res.json(agents);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch agents" });
    }
  });

  app.get("/api/agents/:id", async (req, res) => {
    try {
      const agent = await databaseStorage.getAgent(req.params.id);
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
      const entries = await storage.getAuditEntries();
      res.json(entries);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch audit entries" });
    }
  });

  app.get("/api/metrics/trends", async (req, res) => {
    try {
      const trends = await storage.getMetricTrends();
      res.json(trends);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch metric trends" });
    }
  });

  app.get("/api/health", async (req, res) => {
    try {
      const health = await storage.getSystemHealth();
      res.json(health);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch system health" });
    }
  });

  app.get("/api/kpis", async (req, res) => {
    try {
      const kpis = await storage.getKPIMetrics();
      res.json(kpis);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch KPI metrics" });
    }
  });

  app.get("/api/learning", async (req, res) => {
    try {
      const updates = await storage.getLearningUpdates();
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

  // Metrics API endpoints
  app.get("/api/metrics/refresh", async (req, res) => {
    try {
      const devices = await storage.getDevices();
      updateMetricsCache(devices);
      res.json({ success: true, message: "Metrics cache refreshed", deviceCount: devices.length });
    } catch (error) {
      res.status(500).json({ error: "Failed to refresh metrics" });
    }
  });

  app.get("/api/metrics/all", async (req, res) => {
    try {
      const devices = await storage.getDevices();
      updateMetricsCache(devices);
      const metrics = getAllMetrics();
      res.json(metrics);
    } catch (error) {
      res.status(500).json({ error: "Failed to get metrics" });
    }
  });

  app.get("/api/metrics/device/:deviceId", async (req, res) => {
    try {
      const devices = await storage.getDevices();
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
      const devices = await storage.getDevices();
      updateMetricsCache(devices);
      const summary = getSystemMetricsSummary();
      res.json(summary);
    } catch (error) {
      res.status(500).json({ error: "Failed to get system metrics" });
    }
  });

  app.get("/api/metrics/bgp", async (req, res) => {
    try {
      const devices = await storage.getDevices();
      updateMetricsCache(devices);
      const bgpStatus = getBGPPeerStatus();
      res.json(bgpStatus);
    } catch (error) {
      res.status(500).json({ error: "Failed to get BGP metrics" });
    }
  });

  app.get("/api/metrics/ports", async (req, res) => {
    try {
      const devices = await storage.getDevices();
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
      const devices = await storage.getDevices();
      updateMetricsCache(devices);
      const result = await executePromQLQuery(query);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to execute query" });
    }
  });

  app.get("/api/metrics/anomalies", async (req, res) => {
    try {
      const devices = await storage.getDevices();
      updateMetricsCache(devices);
      const anomalies = detectAnomalies();
      res.json(anomalies);
    } catch (error) {
      res.status(500).json({ error: "Failed to detect anomalies" });
    }
  });

  app.get("/api/metrics/prometheus", async (req, res) => {
    try {
      const devices = await storage.getDevices();
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

  return httpServer;
}
