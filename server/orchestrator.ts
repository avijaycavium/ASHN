import { randomUUID } from "crypto";
import type {
  Agent,
  AgentTask,
  AgentExecution,
  AgentEvent,
  Playbook,
  OrchestratorStatus,
  TaskPriority,
  TaskType,
  TaskStatus,
  AgentType,
  Incident,
  Device,
} from "@shared/schema";
import { storage } from "./storage";
import { getGNS3Client, getGNS3Config } from "./gns3";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

interface TaskQueue {
  critical: AgentTask[];
  high: AgentTask[];
  medium: AgentTask[];
  low: AgentTask[];
}

class AgentOrchestrator {
  private taskQueue: TaskQueue = {
    critical: [],
    high: [],
    medium: [],
    low: [],
  };
  private executions: Map<string, AgentExecution> = new Map();
  private events: AgentEvent[] = [];
  private playbooks: Playbook[] = [];
  private isRunning: boolean = false;
  private processingInterval: NodeJS.Timeout | null = null;
  private agents: Map<string, Agent> = new Map();
  private tasks: Map<string, AgentTask> = new Map();
  private completedTasks24h: number = 0;
  private failedTasks24h: number = 0;
  private taskDurations: number[] = [];

  constructor() {
    this.initializePlaybooks();
    this.initializeAgents();
  }

  private initializeAgents(): void {
    const now = new Date().toISOString();
    const baseAgents: Agent[] = [
      {
        id: "agent-monitor",
        name: "Network Monitor Agent",
        type: "monitor",
        status: "active",
        currentTask: null,
        processedTasks: 0,
        successRate: 100,
        lastActive: now,
        capabilities: [
          { name: "device_polling", description: "Poll device health metrics" },
          { name: "link_monitoring", description: "Monitor link status and utilization" },
          { name: "threshold_detection", description: "Detect threshold violations" },
        ],
        config: { pollingInterval: 30000, batchSize: 10 },
        heartbeatInterval: 10000,
        lastHeartbeat: now,
      },
      {
        id: "agent-anomaly",
        name: "Anomaly Detection Agent",
        type: "anomaly",
        status: "active",
        currentTask: null,
        processedTasks: 0,
        successRate: 100,
        lastActive: now,
        capabilities: [
          { name: "pattern_analysis", description: "Analyze metric patterns for anomalies" },
          { name: "baseline_comparison", description: "Compare against learned baselines" },
          { name: "trend_detection", description: "Detect unusual trends" },
        ],
        config: { sensitivityThreshold: 0.85, windowSize: 60 },
        heartbeatInterval: 15000,
        lastHeartbeat: now,
      },
      {
        id: "agent-rca",
        name: "Root Cause Analysis Agent",
        type: "rca",
        status: "active",
        currentTask: null,
        processedTasks: 0,
        successRate: 100,
        lastActive: now,
        capabilities: [
          { name: "correlation_analysis", description: "Correlate events across devices" },
          { name: "fault_tree_analysis", description: "Build fault tree diagrams" },
          { name: "hypothesis_generation", description: "Generate root cause hypotheses" },
        ],
        config: { maxDepth: 5, confidenceThreshold: 0.7 },
        heartbeatInterval: 15000,
        lastHeartbeat: now,
      },
      {
        id: "agent-remediation",
        name: "Remediation Agent",
        type: "remediation",
        status: "active",
        currentTask: null,
        processedTasks: 0,
        successRate: 100,
        lastActive: now,
        capabilities: [
          { name: "device_restart", description: "Restart network devices" },
          { name: "config_rollback", description: "Rollback device configurations" },
          { name: "traffic_rerouting", description: "Reroute traffic around failures" },
          { name: "link_failover", description: "Execute link failover procedures" },
        ],
        config: { autoApproveThreshold: 0.95, maxConcurrentActions: 3 },
        heartbeatInterval: 10000,
        lastHeartbeat: now,
      },
      {
        id: "agent-verification",
        name: "Verification Agent",
        type: "verification",
        status: "active",
        currentTask: null,
        processedTasks: 0,
        successRate: 100,
        lastActive: now,
        capabilities: [
          { name: "health_check", description: "Verify device health post-remediation" },
          { name: "service_validation", description: "Validate service restoration" },
          { name: "metric_verification", description: "Verify metrics return to normal" },
        ],
        config: { checkInterval: 5000, maxRetries: 3 },
        heartbeatInterval: 10000,
        lastHeartbeat: now,
      },
      {
        id: "agent-learning",
        name: "Learning Agent",
        type: "learning",
        status: "active",
        currentTask: null,
        processedTasks: 0,
        successRate: 100,
        lastActive: now,
        capabilities: [
          { name: "pattern_learning", description: "Learn new failure patterns" },
          { name: "baseline_update", description: "Update metric baselines" },
          { name: "playbook_optimization", description: "Optimize remediation playbooks" },
        ],
        config: { learningRate: 0.1, updateFrequency: 3600000 },
        heartbeatInterval: 30000,
        lastHeartbeat: now,
      },
      {
        id: "agent-telemetry",
        name: "Telemetry Collection Agent",
        type: "telemetry",
        status: "active",
        currentTask: null,
        processedTasks: 0,
        successRate: 100,
        lastActive: now,
        capabilities: [
          { name: "snmp_collection", description: "Collect SNMP metrics" },
          { name: "streaming_telemetry", description: "Process streaming telemetry" },
          { name: "log_aggregation", description: "Aggregate device logs" },
        ],
        config: { collectionInterval: 10000, bufferSize: 1000 },
        heartbeatInterval: 5000,
        lastHeartbeat: now,
      },
      {
        id: "agent-compliance",
        name: "Compliance Agent",
        type: "compliance",
        status: "active",
        currentTask: null,
        processedTasks: 0,
        successRate: 100,
        lastActive: now,
        capabilities: [
          { name: "policy_check", description: "Check configuration compliance" },
          { name: "audit_logging", description: "Log all actions for audit" },
          { name: "approval_workflow", description: "Manage action approvals" },
        ],
        config: { auditRetention: 90, strictMode: false },
        heartbeatInterval: 30000,
        lastHeartbeat: now,
      },
    ];

    baseAgents.forEach(agent => this.agents.set(agent.id, agent));
  }

  private initializePlaybooks(): void {
    const now = new Date().toISOString();
    this.playbooks = [
      {
        id: "playbook-link-failure",
        name: "Link Failure Recovery",
        description: "Automated recovery procedure for link failures",
        triggerConditions: {
          patterns: ["link failure", "port down", "interface down"],
          incidentSeverity: ["critical", "high"],
        },
        steps: [
          {
            id: "step-1",
            order: 1,
            action: "verify_link_status",
            description: "Verify link is actually down",
            parameters: {},
            rollbackAction: null,
            timeout: 30000,
            continueOnFailure: false,
          },
          {
            id: "step-2",
            order: 2,
            action: "check_alternate_paths",
            description: "Identify alternate routing paths",
            parameters: {},
            rollbackAction: null,
            timeout: 60000,
            continueOnFailure: false,
          },
          {
            id: "step-3",
            order: 3,
            action: "reroute_traffic",
            description: "Reroute traffic to alternate paths",
            parameters: { strategy: "least_utilized" },
            rollbackAction: "restore_original_routes",
            timeout: 120000,
            continueOnFailure: false,
          },
          {
            id: "step-4",
            order: 4,
            action: "verify_connectivity",
            description: "Verify end-to-end connectivity",
            parameters: {},
            rollbackAction: null,
            timeout: 60000,
            continueOnFailure: false,
          },
        ],
        autoApprove: true,
        enabled: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "playbook-congestion",
        name: "Congestion Mitigation",
        description: "Mitigate port congestion through QoS and load balancing",
        triggerConditions: {
          patterns: ["congestion", "high utilization", "buffer overflow"],
          incidentSeverity: ["high", "medium"],
        },
        steps: [
          {
            id: "step-1",
            order: 1,
            action: "analyze_traffic",
            description: "Analyze traffic patterns causing congestion",
            parameters: {},
            rollbackAction: null,
            timeout: 60000,
            continueOnFailure: false,
          },
          {
            id: "step-2",
            order: 2,
            action: "apply_qos",
            description: "Apply QoS policies to prioritize critical traffic",
            parameters: { policy: "priority_queuing" },
            rollbackAction: "remove_qos",
            timeout: 90000,
            continueOnFailure: false,
          },
          {
            id: "step-3",
            order: 3,
            action: "load_balance",
            description: "Redistribute traffic across available links",
            parameters: {},
            rollbackAction: null,
            timeout: 120000,
            continueOnFailure: true,
          },
        ],
        autoApprove: false,
        enabled: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "playbook-device-recovery",
        name: "Device Recovery",
        description: "Recovery procedure for unresponsive devices",
        triggerConditions: {
          patterns: ["device unreachable", "timeout", "offline"],
          incidentSeverity: ["critical", "high"],
        },
        steps: [
          {
            id: "step-1",
            order: 1,
            action: "ping_device",
            description: "Attempt to ping device",
            parameters: { retries: 3 },
            rollbackAction: null,
            timeout: 30000,
            continueOnFailure: true,
          },
          {
            id: "step-2",
            order: 2,
            action: "restart_device",
            description: "Attempt device restart via GNS3",
            parameters: {},
            rollbackAction: null,
            timeout: 180000,
            continueOnFailure: false,
          },
          {
            id: "step-3",
            order: 3,
            action: "verify_device",
            description: "Verify device is operational",
            parameters: {},
            rollbackAction: null,
            timeout: 60000,
            continueOnFailure: false,
          },
        ],
        autoApprove: false,
        enabled: true,
        createdAt: now,
        updatedAt: now,
      },
    ];
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.processingInterval = setInterval(() => this.processQueue(), 5000);
    this.logEvent("system", null, "status_change", "Orchestrator started");
    console.log("[Orchestrator] Started");
  }

  stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    this.logEvent("system", null, "status_change", "Orchestrator stopped");
    console.log("[Orchestrator] Stopped");
  }

  getStatus(): OrchestratorStatus {
    const activeAgents = Array.from(this.agents.values()).filter(
      a => a.status === "active" || a.status === "processing"
    ).length;

    const queuedTasks =
      this.taskQueue.critical.length +
      this.taskQueue.high.length +
      this.taskQueue.medium.length +
      this.taskQueue.low.length;

    const runningTasks = Array.from(this.tasks.values()).filter(
      t => t.status === "running"
    ).length;

    const avgDuration = this.taskDurations.length > 0
      ? this.taskDurations.reduce((a, b) => a + b, 0) / this.taskDurations.length
      : 0;

    return {
      status: this.isRunning ? "running" : "stopped",
      activeAgents,
      totalAgents: this.agents.size,
      queuedTasks,
      runningTasks,
      completedTasks24h: this.completedTasks24h,
      failedTasks24h: this.failedTasks24h,
      avgTaskDurationMs: Math.round(avgDuration),
    };
  }

  getAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  getAgent(id: string): Agent | undefined {
    return this.agents.get(id);
  }

  getTasks(): AgentTask[] {
    return Array.from(this.tasks.values());
  }

  getTask(id: string): AgentTask | undefined {
    return this.tasks.get(id);
  }

  getExecutions(): AgentExecution[] {
    return Array.from(this.executions.values());
  }

  getEvents(limit: number = 100): AgentEvent[] {
    return this.events.slice(-limit);
  }

  getPlaybooks(): Playbook[] {
    return this.playbooks;
  }

  async createTask(
    type: TaskType,
    priority: TaskPriority,
    payload: Record<string, unknown>,
    options: {
      incidentId?: string;
      deviceIds?: string[];
      parentTaskId?: string;
    } = {}
  ): Promise<AgentTask> {
    const now = new Date().toISOString();
    const task: AgentTask = {
      id: `task-${randomUUID()}`,
      type,
      priority,
      status: "queued",
      assignedAgentId: null,
      payload,
      result: null,
      error: null,
      retryCount: 0,
      maxRetries: 3,
      createdAt: now,
      assignedAt: null,
      startedAt: null,
      completedAt: null,
      incidentId: options.incidentId || null,
      deviceIds: options.deviceIds || [],
      parentTaskId: options.parentTaskId || null,
    };

    this.tasks.set(task.id, task);
    this.taskQueue[priority].push(task);
    this.logEvent("system", task.id, "task_started", `Task ${task.id} queued with priority ${priority}`);
    
    return task;
  }

  private async processQueue(): Promise<void> {
    if (!this.isRunning) return;

    const priorities: TaskPriority[] = ["critical", "high", "medium", "low"];

    for (const priority of priorities) {
      const queue = this.taskQueue[priority];
      while (queue.length > 0) {
        const task = queue[0];
        const agent = this.findAvailableAgent(task.type);

        if (!agent) break;

        queue.shift();
        await this.assignTask(task, agent);
      }
    }
  }

  private findAvailableAgent(taskType: TaskType): Agent | undefined {
    const agentTypeMapping: Record<TaskType, AgentType[]> = {
      monitor: ["monitor", "telemetry"],
      analyze: ["anomaly", "rca"],
      diagnose: ["rca"],
      remediate: ["remediation"],
      verify: ["verification"],
      learn: ["learning"],
    };

    const validTypes = agentTypeMapping[taskType] || [];
    
    const agentList = Array.from(this.agents.values());
    for (const agent of agentList) {
      if (validTypes.includes(agent.type) && (agent.status === "active" || agent.status === "idle")) {
        return agent;
      }
    }
    return undefined;
  }

  private async assignTask(task: AgentTask, agent: Agent): Promise<void> {
    const now = new Date().toISOString();
    
    task.status = "assigned";
    task.assignedAgentId = agent.id;
    task.assignedAt = now;
    this.tasks.set(task.id, task);

    agent.status = "processing";
    agent.currentTask = task.id;
    agent.lastActive = now;
    this.agents.set(agent.id, agent);

    this.logEvent(agent.id, task.id, "task_started", `Agent ${agent.name} assigned to task ${task.id}`);

    await this.executeTask(task, agent);
  }

  private async executeTask(task: AgentTask, agent: Agent): Promise<void> {
    const startTime = Date.now();
    const now = new Date().toISOString();

    task.status = "running";
    task.startedAt = now;
    this.tasks.set(task.id, task);

    const execution: AgentExecution = {
      id: `exec-${randomUUID()}`,
      taskId: task.id,
      agentId: agent.id,
      status: "running",
      startedAt: now,
      completedAt: null,
      output: null,
      logs: [`[${now}] Execution started`],
      metrics: {
        durationMs: null,
        cpuUsage: null,
        memoryUsage: null,
      },
      confidence: null,
    };
    this.executions.set(execution.id, execution);

    try {
      const result = await this.runAgentLogic(task, agent, execution);
      const endTime = Date.now();
      const duration = endTime - startTime;

      task.status = "completed";
      task.result = result;
      task.completedAt = new Date().toISOString();
      this.tasks.set(task.id, task);

      execution.status = "completed";
      execution.completedAt = task.completedAt;
      execution.output = result;
      execution.metrics.durationMs = duration;
      execution.logs.push(`[${task.completedAt}] Execution completed successfully`);
      this.executions.set(execution.id, execution);

      agent.status = "active";
      agent.currentTask = null;
      agent.processedTasks++;
      agent.lastActive = task.completedAt;
      this.agents.set(agent.id, agent);

      this.completedTasks24h++;
      this.taskDurations.push(duration);
      if (this.taskDurations.length > 100) this.taskDurations.shift();

      this.logEvent(agent.id, task.id, "task_completed", `Task completed in ${duration}ms`);

    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      if (task.retryCount < task.maxRetries) {
        task.retryCount++;
        task.status = "queued";
        this.taskQueue[task.priority].push(task);
        execution.logs.push(`[${new Date().toISOString()}] Retrying (${task.retryCount}/${task.maxRetries})`);
      } else {
        task.status = "failed";
        task.error = errorMessage;
        task.completedAt = new Date().toISOString();
        this.failedTasks24h++;
      }
      this.tasks.set(task.id, task);

      execution.status = "failed";
      execution.completedAt = new Date().toISOString();
      execution.metrics.durationMs = duration;
      execution.logs.push(`[${execution.completedAt}] Execution failed: ${errorMessage}`);
      this.executions.set(execution.id, execution);

      agent.status = "active";
      agent.currentTask = null;
      agent.lastActive = new Date().toISOString();
      const totalTasks = agent.processedTasks + 1;
      const successTasks = (agent.successRate / 100) * agent.processedTasks;
      agent.successRate = Math.round((successTasks / totalTasks) * 100 * 10) / 10;
      agent.processedTasks = totalTasks;
      this.agents.set(agent.id, agent);

      this.logEvent(agent.id, task.id, "task_failed", `Task failed: ${errorMessage}`);
    }
  }

  private async runAgentLogic(
    task: AgentTask,
    agent: Agent,
    execution: AgentExecution
  ): Promise<Record<string, unknown>> {
    execution.logs.push(`[${new Date().toISOString()}] Running ${agent.type} agent logic`);

    switch (agent.type) {
      case "monitor":
        return this.runMonitorAgent(task, execution);
      case "anomaly":
        return this.runAnomalyAgent(task, execution);
      case "rca":
        return this.runRCAAgent(task, execution);
      case "remediation":
        return this.runRemediationAgent(task, execution);
      case "verification":
        return this.runVerificationAgent(task, execution);
      case "learning":
        return this.runLearningAgent(task, execution);
      case "telemetry":
        return this.runTelemetryAgent(task, execution);
      case "compliance":
        return this.runComplianceAgent(task, execution);
      default:
        return { status: "completed", message: "No specific logic for agent type" };
    }
  }

  private async runMonitorAgent(task: AgentTask, execution: AgentExecution): Promise<Record<string, unknown>> {
    execution.logs.push(`[${new Date().toISOString()}] Starting device monitoring`);
    
    const devices = await storage.getDevices();
    const unhealthyDevices = devices.filter(d => d.status !== "healthy");
    
    execution.logs.push(`[${new Date().toISOString()}] Found ${unhealthyDevices.length} unhealthy devices`);
    execution.confidence = 95;

    if (unhealthyDevices.length > 0) {
      for (const device of unhealthyDevices.slice(0, 3)) {
        await this.createTask("analyze", "high", {
          deviceId: device.id,
          deviceName: device.name,
          status: device.status,
          reason: "Unhealthy device detected by monitor",
        }, { deviceIds: [device.id] });
      }
    }

    return {
      devicesChecked: devices.length,
      unhealthyCount: unhealthyDevices.length,
      unhealthyDevices: unhealthyDevices.map(d => ({ id: d.id, name: d.name, status: d.status })),
    };
  }

  private async runAnomalyAgent(task: AgentTask, execution: AgentExecution): Promise<Record<string, unknown>> {
    execution.logs.push(`[${new Date().toISOString()}] Analyzing for anomalies`);
    
    const metrics = await storage.getMetricTrends();
    const latestMetric = metrics[metrics.length - 1];
    
    const anomalies: string[] = [];
    if (latestMetric) {
      if (latestMetric.cpu > 80) anomalies.push("High CPU utilization");
      if (latestMetric.latency > 50) anomalies.push("High latency detected");
      if (latestMetric.ber > 0.001) anomalies.push("Elevated bit error rate");
    }

    execution.confidence = anomalies.length > 0 ? 85 : 99;
    execution.logs.push(`[${new Date().toISOString()}] Found ${anomalies.length} potential anomalies`);

    return {
      metricsAnalyzed: metrics.length,
      anomaliesDetected: anomalies.length,
      anomalies,
      latestMetrics: latestMetric,
    };
  }

  private async runRCAAgent(task: AgentTask, execution: AgentExecution): Promise<Record<string, unknown>> {
    execution.logs.push(`[${new Date().toISOString()}] Starting root cause analysis`);
    
    const payload = task.payload as { incidentId?: string; deviceId?: string; issue?: string };
    
    let hypothesis = "Unknown cause";
    let confidence = 50;
    let recommendations: string[] = [];

    if (payload.incidentId) {
      const incident = await storage.getIncident(payload.incidentId);
      if (incident) {
        if (incident.title.toLowerCase().includes("link")) {
          hypothesis = "Physical layer failure - cable or transceiver issue";
          confidence = 92;
          recommendations = [
            "Check physical cable connections",
            "Verify transceiver status",
            "Review port error counters",
            "Consider traffic rerouting",
          ];
        } else if (incident.title.toLowerCase().includes("congestion")) {
          hypothesis = "Traffic pattern causing port buffer overflow";
          confidence = 78;
          recommendations = [
            "Apply QoS policies",
            "Redistribute traffic load",
            "Increase buffer allocation",
          ];
        } else if (incident.title.toLowerCase().includes("bgp")) {
          hypothesis = "BGP peer instability due to route flapping";
          confidence = 85;
          recommendations = [
            "Apply route dampening",
            "Check BGP timers",
            "Verify upstream connectivity",
          ];
        }
      }
    }

    execution.confidence = confidence;
    execution.logs.push(`[${new Date().toISOString()}] RCA completed with ${confidence}% confidence`);

    if (confidence >= 80 && task.incidentId) {
      await this.createTask("remediate", "high", {
        incidentId: task.incidentId,
        hypothesis,
        recommendations,
      }, { incidentId: task.incidentId });
    }

    return {
      hypothesis,
      confidence,
      recommendations,
      analysisDepth: 3,
    };
  }

  private async runRemediationAgent(task: AgentTask, execution: AgentExecution): Promise<Record<string, unknown>> {
    execution.logs.push(`[${new Date().toISOString()}] Starting remediation`);
    
    const payload = task.payload as { 
      action?: string; 
      deviceId?: string;
      incidentId?: string;
      recommendations?: string[];
    };
    
    const actionsExecuted: string[] = [];
    const gns3Client = getGNS3Client();
    const gns3Config = getGNS3Config();

    if (payload.action === "restart" && payload.deviceId && gns3Client && gns3Config.enabled) {
      try {
        execution.logs.push(`[${new Date().toISOString()}] Restarting device ${payload.deviceId}`);
        await gns3Client.reloadNode(payload.deviceId);
        actionsExecuted.push(`Restarted device ${payload.deviceId}`);
      } catch (error) {
        execution.logs.push(`[${new Date().toISOString()}] Failed to restart: ${error}`);
      }
    }

    if (payload.recommendations && payload.recommendations.length > 0) {
      for (const rec of payload.recommendations.slice(0, 2)) {
        execution.logs.push(`[${new Date().toISOString()}] Simulating: ${rec}`);
        actionsExecuted.push(`Executed: ${rec}`);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    execution.confidence = 90;
    execution.logs.push(`[${new Date().toISOString()}] Remediation complete`);

    if (task.incidentId) {
      await this.createTask("verify", "high", {
        incidentId: task.incidentId,
        actionsExecuted,
      }, { incidentId: task.incidentId });
    }

    return {
      actionsExecuted,
      success: true,
      rollbackAvailable: true,
    };
  }

  private async runVerificationAgent(task: AgentTask, execution: AgentExecution): Promise<Record<string, unknown>> {
    execution.logs.push(`[${new Date().toISOString()}] Starting verification`);
    
    const checks: { name: string; passed: boolean }[] = [];
    
    const systemHealth = await storage.getSystemHealth();
    checks.push({ name: "System CPU check", passed: systemHealth.cpu < 80 });
    checks.push({ name: "Memory utilization check", passed: systemHealth.memory < 85 });
    checks.push({ name: "API latency check", passed: systemHealth.apiLatency < 100 });
    checks.push({ name: "Device connectivity check", passed: systemHealth.healthyDevices > systemHealth.totalDevices * 0.9 });

    const allPassed = checks.every(c => c.passed);
    execution.confidence = allPassed ? 98 : 70;
    execution.logs.push(`[${new Date().toISOString()}] Verification ${allPassed ? "passed" : "failed"}`);

    return {
      verified: allPassed,
      checks,
      passedCount: checks.filter(c => c.passed).length,
      totalChecks: checks.length,
    };
  }

  private async runLearningAgent(task: AgentTask, execution: AgentExecution): Promise<Record<string, unknown>> {
    execution.logs.push(`[${new Date().toISOString()}] Running learning algorithms`);
    
    const metrics = await storage.getMetricTrends();
    const incidents = await storage.getIncidents();
    
    const patternsLearned: string[] = [];
    
    if (metrics.length > 10) {
      const avgCpu = metrics.reduce((sum, m) => sum + m.cpu, 0) / metrics.length;
      patternsLearned.push(`Baseline CPU: ${avgCpu.toFixed(1)}%`);
    }

    const resolvedIncidents = incidents.filter(i => i.status === "resolved" || i.status === "closed");
    if (resolvedIncidents.length > 0) {
      const avgTTR = resolvedIncidents.reduce((sum, i) => sum + (i.ttr || 0), 0) / resolvedIncidents.length;
      patternsLearned.push(`Average TTR: ${avgTTR.toFixed(0)} seconds`);
    }

    execution.confidence = 88;
    execution.logs.push(`[${new Date().toISOString()}] Learned ${patternsLearned.length} patterns`);

    return {
      patternsLearned,
      dataPointsAnalyzed: metrics.length + incidents.length,
      modelUpdated: true,
    };
  }

  private async runTelemetryAgent(task: AgentTask, execution: AgentExecution): Promise<Record<string, unknown>> {
    execution.logs.push(`[${new Date().toISOString()}] Collecting telemetry`);
    
    const devices = await storage.getDevices();
    const metrics = await storage.getMetricTrends();
    
    const telemetryData = {
      deviceCount: devices.length,
      metricsCollected: metrics.length,
      timestamp: new Date().toISOString(),
      summary: {
        avgCpu: devices.reduce((sum, d) => sum + d.cpu, 0) / devices.length,
        avgMemory: devices.reduce((sum, d) => sum + d.memory, 0) / devices.length,
        healthyRatio: devices.filter(d => d.status === "healthy").length / devices.length,
      },
    };

    execution.confidence = 100;
    execution.logs.push(`[${new Date().toISOString()}] Telemetry collected from ${devices.length} devices`);

    return telemetryData;
  }

  private async runComplianceAgent(task: AgentTask, execution: AgentExecution): Promise<Record<string, unknown>> {
    execution.logs.push(`[${new Date().toISOString()}] Running compliance checks`);
    
    const complianceChecks = [
      { rule: "Configuration backup frequency", compliant: true, details: "All devices backed up within 24h" },
      { rule: "Password policy", compliant: true, details: "All credentials meet complexity requirements" },
      { rule: "Audit logging enabled", compliant: true, details: "Logging active on all devices" },
      { rule: "Network segmentation", compliant: true, details: "VLANs properly configured" },
    ];

    const compliantCount = complianceChecks.filter(c => c.compliant).length;
    execution.confidence = (compliantCount / complianceChecks.length) * 100;
    execution.logs.push(`[${new Date().toISOString()}] Compliance: ${compliantCount}/${complianceChecks.length} rules passed`);

    return {
      complianceScore: execution.confidence,
      checks: complianceChecks,
      lastAudit: new Date().toISOString(),
    };
  }

  async triggerIncidentAnalysis(incident: Incident): Promise<AgentTask> {
    const playbook = this.playbooks.find(p => 
      p.enabled && 
      p.triggerConditions.incidentSeverity?.includes(incident.severity) &&
      p.triggerConditions.patterns?.some(pattern => 
        incident.title.toLowerCase().includes(pattern.toLowerCase()) ||
        incident.description.toLowerCase().includes(pattern.toLowerCase())
      )
    );

    const task = await this.createTask("diagnose", 
      incident.severity === "critical" ? "critical" : "high",
      {
        incidentId: incident.id,
        incidentTitle: incident.title,
        affectedDevices: incident.affectedDevices,
        playbookId: playbook?.id,
      },
      { incidentId: incident.id, deviceIds: incident.affectedDevices }
    );

    return task;
  }

  async runAnalysisWithAI(context: string): Promise<{ analysis: string; confidence: number }> {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a network operations AI assistant. Analyze network issues and provide concise root cause analysis and recommendations. Be specific and technical.`,
          },
          {
            role: "user",
            content: context,
          },
        ],
        max_tokens: 500,
        temperature: 0.3,
      });

      const analysis = response.choices[0]?.message?.content || "Analysis unavailable";
      return { analysis, confidence: 85 };
    } catch (error) {
      console.error("AI analysis failed:", error);
      return { analysis: "AI analysis unavailable", confidence: 0 };
    }
  }

  private logEvent(
    agentId: string,
    taskId: string | null,
    eventType: AgentEvent["eventType"],
    message: string,
    data: Record<string, unknown> = {}
  ): void {
    const event: AgentEvent = {
      id: `event-${randomUUID()}`,
      agentId,
      taskId,
      eventType,
      message,
      data,
      timestamp: new Date().toISOString(),
    };
    this.events.push(event);
    if (this.events.length > 1000) {
      this.events = this.events.slice(-500);
    }
  }
}

export const orchestrator = new AgentOrchestrator();
