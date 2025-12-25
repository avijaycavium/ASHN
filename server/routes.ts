import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { getGNS3Client, getGNS3Config, resetGNS3Client } from "./gns3";
import { getCopilot } from "./copilot";
import { orchestrator } from "./orchestrator";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.get("/api/devices", async (req, res) => {
    try {
      const devices = await storage.getDevices();
      res.json(devices);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch devices" });
    }
  });

  app.get("/api/devices/:id", async (req, res) => {
    try {
      const device = await storage.getDevice(req.params.id);
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
      const incidents = await storage.getIncidents();
      res.json(incidents);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch incidents" });
    }
  });

  app.get("/api/incidents/:id", async (req, res) => {
    try {
      const incident = await storage.getIncident(req.params.id);
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
      const timeline = await storage.getIncidentTimeline(req.params.id);
      res.json(timeline);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch incident timeline" });
    }
  });

  app.get("/api/incidents/:id/remediation", async (req, res) => {
    try {
      const steps = await storage.getIncidentRemediation(req.params.id);
      res.json(steps);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch remediation steps" });
    }
  });

  app.get("/api/agents", async (req, res) => {
    try {
      const agents = await storage.getAgents();
      res.json(agents);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch agents" });
    }
  });

  app.get("/api/agents/:id", async (req, res) => {
    try {
      const agent = await storage.getAgent(req.params.id);
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
      const links = await storage.getTopologyLinks();
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
      const incident = await storage.getIncident(incidentId);
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

  return httpServer;
}
