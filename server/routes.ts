import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Get all devices
  app.get("/api/devices", async (req, res) => {
    try {
      const devices = await storage.getDevices();
      res.json(devices);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch devices" });
    }
  });

  // Get single device
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

  // Get all incidents
  app.get("/api/incidents", async (req, res) => {
    try {
      const incidents = await storage.getIncidents();
      res.json(incidents);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch incidents" });
    }
  });

  // Get single incident
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

  // Get incident timeline
  app.get("/api/incidents/:id/timeline", async (req, res) => {
    try {
      const timeline = await storage.getIncidentTimeline(req.params.id);
      res.json(timeline);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch incident timeline" });
    }
  });

  // Get incident remediation steps
  app.get("/api/incidents/:id/remediation", async (req, res) => {
    try {
      const steps = await storage.getIncidentRemediation(req.params.id);
      res.json(steps);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch remediation steps" });
    }
  });

  // Get all agents
  app.get("/api/agents", async (req, res) => {
    try {
      const agents = await storage.getAgents();
      res.json(agents);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch agents" });
    }
  });

  // Get single agent
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

  // Get audit entries
  app.get("/api/audit", async (req, res) => {
    try {
      const entries = await storage.getAuditEntries();
      res.json(entries);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch audit entries" });
    }
  });

  // Get metric trends
  app.get("/api/metrics/trends", async (req, res) => {
    try {
      const trends = await storage.getMetricTrends();
      res.json(trends);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch metric trends" });
    }
  });

  // Get system health
  app.get("/api/health", async (req, res) => {
    try {
      const health = await storage.getSystemHealth();
      res.json(health);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch system health" });
    }
  });

  // Get KPI metrics
  app.get("/api/kpis", async (req, res) => {
    try {
      const kpis = await storage.getKPIMetrics();
      res.json(kpis);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch KPI metrics" });
    }
  });

  // Get learning updates
  app.get("/api/learning", async (req, res) => {
    try {
      const updates = await storage.getLearningUpdates();
      res.json(updates);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch learning updates" });
    }
  });

  return httpServer;
}
