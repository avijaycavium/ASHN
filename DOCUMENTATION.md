# AASHN - Agentic Autonomous Self-Healing Networks

## Complete Documentation

**Version:** 1.0.0 (Proof of Concept)  
**Last Updated:** December 2025

---

## Table of Contents

1. [Executive Overview](#executive-overview)
2. [System Architecture](#system-architecture)
3. [Technology Stack](#technology-stack)
4. [Getting Started](#getting-started)
5. [Configuration](#configuration)
6. [Data Models](#data-models)
7. [REST API Reference](#rest-api-reference)
8. [GNS3 Integration](#gns3-integration)
9. [Autonomous Agent Framework](#autonomous-agent-framework)
10. [Network Copilot](#network-copilot)
11. [Demo Console](#demo-console)
12. [User Interface Guide](#user-interface-guide)
13. [Self-Healing Workflows](#self-healing-workflows)
14. [Operations & Troubleshooting](#operations--troubleshooting)
15. [Security Considerations](#security-considerations)

---

## Executive Overview

### What is AASHN?

AASHN (Agentic Autonomous Self-Healing Networks) is a **proof-of-concept** network monitoring dashboard that demonstrates autonomous self-healing capabilities. This POC showcases how AI-driven agents could detect, diagnose, and remediate network issues.

**Current Implementation Status:**
- **Dashboard UI**: Fully functional React-based monitoring interface
- **Mock Data Mode**: In-memory storage with realistic sample data for demonstration
- **GNS3 Integration**: Optional live network simulation backend
- **Demo Console**: Interactive fault injection scenarios with simulated healing workflows
- **Network Copilot**: Natural language interface for GNS3 topology management (requires OpenAI)

**Note:** This is a demonstration/POC system. The autonomous healing workflows are simulated with realistic timing and metrics to showcase the concept.

### Demonstrated Capabilities

| Capability | Implementation Status |
|------------|----------------------|
| Device Monitoring Dashboard | Implemented (mock + GNS3 data) |
| Incident Management | Implemented (mock data) |
| Agent Status Display | Implemented (simulated agents) |
| Demo Fault Injection | Implemented (simulated workflows) |
| GNS3 Live Integration | Implemented (optional) |
| Network Copilot | Implemented (requires OpenAI) |
| Real ML-based Detection | Not implemented (simulated) |
| Real SNMP Polling | Not implemented (simulated) |

### Demonstrated Use Cases

The Demo Console showcases three self-healing scenarios with simulated metrics:

1. **Optical Link Degradation**: Simulates SNR/BER anomaly detection and power level adjustment
2. **Port Flapping**: Simulates interface state oscillation detection and dampening
3. **Memory Pressure**: Simulates memory exhaustion detection and service restart

---

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              AASHN Platform                             │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐  │
│  │   React Frontend │  │  Express Backend │  │  Agent Orchestrator  │  │
│  │   (Vite + TS)    │──│   (REST API)     │──│   (Self-Healing)     │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────────┘  │
│           │                     │                       │               │
│           └─────────────────────┴───────────────────────┘               │
│                                 │                                       │
├─────────────────────────────────┼───────────────────────────────────────┤
│  ┌──────────────────┐  ┌────────┴────────┐  ┌──────────────────────┐   │
│  │   GNS3 Client    │  │   Data Storage  │  │   OpenAI Integration │   │
│  │   (Optional)     │  │   (In-Memory)   │  │   (Network Copilot)  │   │
│  └──────────────────┘  └─────────────────┘  └──────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
                     ┌────────────┴────────────┐
                     │    External Systems     │
                     │  ┌────────┐ ┌────────┐  │
                     │  │  GNS3  │ │ OpenAI │  │
                     │  │ Server │ │  API   │  │
                     │  └────────┘ └────────┘  │
                     └─────────────────────────┘
```

### Component Overview

| Component | Description | Location |
|-----------|-------------|----------|
| Frontend | React SPA with Material Design 3 styling | `client/src/` |
| Backend | Express.js REST API server | `server/` |
| Orchestrator | Autonomous agent management system | `server/orchestrator.ts` |
| GNS3 Client | GNS3 network simulation interface | `server/gns3.ts` |
| Network Copilot | Natural language topology management | `server/copilot.ts` |
| Storage | In-memory data store with mock data | `server/storage.ts` |
| Shared Types | TypeScript interfaces and schemas | `shared/schema.ts` |

### Data Flow

1. **Monitoring Flow**: Devices → Storage → API → Frontend Dashboard
2. **Incident Flow**: Detection → RCA Analysis → Remediation → Verification → Resolution
3. **Agent Flow**: Orchestrator → Task Queue → Agent Execution → Event Logging
4. **Copilot Flow**: User Command → AI Processing → GNS3 Operations → Response

---

## Technology Stack

### Frontend

| Technology | Purpose | Notes |
|------------|---------|-------|
| React 18 | UI framework | Component-based architecture |
| TypeScript | Type safety | Strict mode enabled |
| Vite | Build tool & dev server | Fast HMR development |
| Tailwind CSS | Utility-first styling | Custom theme with dark mode |
| Shadcn/ui | Component library | Built on Radix UI primitives |
| TanStack Query v5 | Server state management | Data fetching and caching |
| Wouter | Client-side routing | Lightweight router |
| Recharts | Chart visualization | Line, area, and bar charts |
| Lucide React | Icon library | Consistent iconography |

### Backend

| Technology | Purpose | Notes |
|------------|---------|-------|
| Node.js 20 | Runtime environment | ES modules support |
| Express 4 | HTTP server framework | REST API endpoints |
| TypeScript | Type safety | Shared types with frontend |
| Zod | Schema validation | Request/response validation |
| OpenAI SDK | AI/LLM integration | Network Copilot feature |

### Data Storage

| Mode | Description |
|------|-------------|
| In-Memory (Default) | MemStorage class with mock data for demonstration |
| PostgreSQL (Optional) | Drizzle ORM configured but not required for POC |

### External Integrations

| Integration | Purpose | Required |
|-------------|---------|----------|
| GNS3 | Network simulation | Optional |
| OpenAI API | Network Copilot AI | Optional (auto-configured on Replit) |

---

## Getting Started

### Prerequisites

- Node.js 20.x or later
- npm or yarn package manager
- (Optional) GNS3 server for live network simulation
- (Optional) OpenAI API key for Network Copilot

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd aashn
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables** (see [Configuration](#configuration))

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Access the application**
   - Open http://localhost:5000 in your browser

### Project Structure

```
aashn/
├── client/
│   └── src/
│       ├── components/      # Reusable UI components
│       │   ├── ui/          # Shadcn base components
│       │   └── dashboard/   # Dashboard-specific widgets
│       ├── pages/           # Route pages
│       ├── hooks/           # Custom React hooks
│       └── lib/             # Utilities and helpers
├── server/
│   ├── index.ts             # Server entry point
│   ├── routes.ts            # API route definitions
│   ├── storage.ts           # Data storage layer
│   ├── orchestrator.ts      # Agent orchestration
│   ├── gns3.ts              # GNS3 integration
│   ├── copilot.ts           # Network Copilot AI
│   └── vite.ts              # Vite dev server setup
├── shared/
│   └── schema.ts            # Shared TypeScript types
└── package.json
```

---

## Configuration

### Environment Variables

Configure the following environment variables in your `.env` file or Replit Secrets:

#### Core Settings

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `SESSION_SECRET` | Session encryption key | Yes | - |
| `NODE_ENV` | Environment mode | No | `development` |
| `PORT` | Server port | No | `5000` |

#### GNS3 Integration

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `GNS3_ENABLED` | Enable GNS3 integration | Yes | `false` |
| `GNS3_SERVER_URL` | GNS3 server URL | If enabled | `http://localhost:3080` |
| `GNS3_PROJECT_ID` | GNS3 project UUID | If enabled | - |
| `GNS3_USERNAME` | GNS3 auth username | No | - |
| `GNS3_PASSWORD` | GNS3 auth password | No | - |

#### AI Integration

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `OPENAI_API_KEY` | OpenAI API key | For Copilot | Auto-configured via Replit |

### Example Configuration

```env
# Core
SESSION_SECRET=your-secure-session-secret

# GNS3
GNS3_ENABLED=true
GNS3_SERVER_URL=http://192.168.1.100:3080
GNS3_PROJECT_ID=abc12345-def6-7890-ghij-klmnopqrstuv
GNS3_USERNAME=admin
GNS3_PASSWORD=admin123
```

---

## Data Models

### Device

Represents a network device in the infrastructure.

```typescript
interface Device {
  id: string;              // Unique identifier
  name: string;            // Display name
  type: DeviceType;        // "core" | "spine" | "tor" | "dpu"
  status: DeviceStatus;    // "healthy" | "degraded" | "critical" | "offline"
  location: string;        // Physical or logical location
  cpu: number;             // CPU utilization (0-100)
  memory: number;          // Memory utilization (0-100)
  uptime: string;          // Uptime duration
  ipAddress: string;       // Management IP address
  ports: number;           // Total port count
  activePorts: number;     // Active port count
}
```

### Incident

Represents a network incident or alert.

```typescript
interface Incident {
  id: string;              // Unique identifier
  title: string;           // Incident title
  description: string;     // Detailed description
  severity: IncidentSeverity;  // "critical" | "high" | "medium" | "low"
  status: IncidentStatus;  // "active" | "investigating" | "remediating" | "resolved" | "closed"
  ttd: number;             // Time to detect (seconds)
  ttr: number | null;      // Time to remediate (seconds)
  tttr: number | null;     // Total time to resolve (seconds)
  affectedDevices: string[];   // List of affected device IDs
  rootCause: string | null;    // Root cause analysis result
  confidence: number;      // RCA confidence (0-100)
  createdAt: string;       // ISO timestamp
  updatedAt: string;       // ISO timestamp
  resolvedAt: string | null;   // Resolution timestamp
}
```

### Agent

Represents an autonomous healing agent.

```typescript
interface Agent {
  id: string;              // Unique identifier
  name: string;            // Agent name
  type: AgentType;         // "monitor" | "anomaly" | "rca" | "remediation" | "verification" | "learning" | "compliance" | "telemetry"
  status: AgentStatus;     // "active" | "processing" | "idle" | "error" | "offline"
  currentTask: string | null;  // Current task ID
  processedTasks: number;  // Total tasks processed
  successRate: number;     // Success rate (0-100)
  lastActive: string;      // Last activity timestamp
  capabilities: AgentCapability[];  // List of capabilities
  config: Record<string, unknown>;  // Agent configuration
  heartbeatInterval: number;    // Heartbeat interval (ms)
  lastHeartbeat: string | null; // Last heartbeat timestamp
}
```

### AgentTask

Represents a task assigned to an agent.

```typescript
interface AgentTask {
  id: string;              // Unique identifier
  type: TaskType;          // "monitor" | "analyze" | "diagnose" | "remediate" | "verify" | "learn"
  priority: TaskPriority;  // "critical" | "high" | "medium" | "low"
  status: TaskStatus;      // "queued" | "assigned" | "running" | "completed" | "failed" | "cancelled"
  assignedAgentId: string | null;  // Assigned agent ID
  payload: Record<string, unknown>;  // Task parameters
  result: Record<string, unknown> | null;  // Execution result
  error: string | null;    // Error message if failed
  retryCount: number;      // Retry attempts
  maxRetries: number;      // Maximum retries allowed
  createdAt: string;       // Creation timestamp
  assignedAt: string | null;   // Assignment timestamp
  startedAt: string | null;    // Start timestamp
  completedAt: string | null;  // Completion timestamp
  incidentId: string | null;   // Related incident ID
  deviceIds: string[];     // Related device IDs
  parentTaskId: string | null; // Parent task for subtasks
}
```

### Playbook

Defines automated remediation procedures.

```typescript
interface Playbook {
  id: string;              // Unique identifier
  name: string;            // Playbook name
  description: string;     // Description
  triggerConditions: {     // Automatic trigger conditions
    incidentSeverity?: IncidentSeverity[];
    deviceTypes?: DeviceType[];
    patterns?: string[];
  };
  steps: PlaybookStep[];   // Remediation steps
  autoApprove: boolean;    // Auto-approve execution
  enabled: boolean;        // Enabled status
  createdAt: string;       // Creation timestamp
  updatedAt: string;       // Last update timestamp
}

interface PlaybookStep {
  id: string;              // Step identifier
  order: number;           // Execution order
  action: string;          // Action to perform
  description: string;     // Step description
  parameters: Record<string, unknown>;  // Action parameters
  rollbackAction: string | null;  // Rollback if failed
  timeout: number;         // Timeout (seconds)
  continueOnFailure: boolean;  // Continue on failure
}
```

---

## REST API Reference

### Device Endpoints

#### GET /api/devices
Retrieve all network devices.

**Response:**
```json
[
  {
    "id": "device-1",
    "name": "Core-Router-1",
    "type": "core",
    "status": "healthy",
    "location": "DC1-Rack-1",
    "cpu": 45,
    "memory": 62,
    "uptime": "45d 12h 30m",
    "ipAddress": "10.0.0.1",
    "ports": 48,
    "activePorts": 32
  }
]
```

#### GET /api/devices/:id
Retrieve a specific device by ID.

#### POST /api/devices/:id/start
Start a GNS3 node (requires GNS3 enabled).

#### POST /api/devices/:id/stop
Stop a GNS3 node (requires GNS3 enabled).

#### POST /api/devices/:id/reload
Reload a GNS3 node (requires GNS3 enabled).

### Incident Endpoints

#### GET /api/incidents
Retrieve all incidents.

#### GET /api/incidents/:id
Retrieve a specific incident.

#### GET /api/incidents/:id/timeline
Retrieve the event timeline for an incident.

**Response:**
```json
[
  {
    "id": "event-1",
    "incidentId": "inc-001",
    "timestamp": "2025-12-25T10:30:00Z",
    "event": "Anomaly detected",
    "agent": "Anomaly Detection Agent",
    "details": "SNR deviation detected on port eth0/1"
  }
]
```

#### GET /api/incidents/:id/remediation
Retrieve remediation steps for an incident.

### Agent Endpoints

#### GET /api/agents
Retrieve all registered agents.

#### GET /api/agents/:id
Retrieve a specific agent.

### Orchestrator Endpoints

#### GET /api/orchestrator/status
Get orchestrator operational status.

**Response:**
```json
{
  "status": "running",
  "activeAgents": 6,
  "totalAgents": 8,
  "queuedTasks": 2,
  "runningTasks": 3,
  "completedTasks24h": 156,
  "failedTasks24h": 2,
  "avgTaskDurationMs": 2340
}
```

#### POST /api/orchestrator/start
Start the agent orchestrator.

#### POST /api/orchestrator/stop
Stop the agent orchestrator.

#### GET /api/orchestrator/agents
Get all orchestrator-managed agents.

#### GET /api/orchestrator/tasks
Get all tasks in the system.

#### POST /api/orchestrator/tasks
Create a new task.

**Request Body:**
```json
{
  "type": "diagnose",
  "priority": "high",
  "payload": { "incidentId": "inc-001" },
  "incidentId": "inc-001",
  "deviceIds": ["device-1", "device-2"]
}
```

#### GET /api/orchestrator/executions
Get all task executions.

#### GET /api/orchestrator/events
Get orchestrator events.

**Query Parameters:**
- `limit` (optional): Maximum events to return (default: 100)

#### GET /api/orchestrator/playbooks
Get all defined playbooks.

#### POST /api/orchestrator/trigger-analysis
Trigger incident analysis workflow.

**Request Body:**
```json
{
  "incidentId": "inc-001"
}
```

### Demo Endpoints

#### POST /api/demo/inject-fault
Inject a fault scenario for demonstration.

**Request Body:**
```json
{
  "scenario": "optical_link_degradation",
  "deviceId": "device-1",
  "targetDeviceId": "device-2"
}
```

**Available Scenarios:**
- `optical_link_degradation`: Simulate optical link SNR/BER degradation
- `port_flapping`: Simulate interface state oscillation
- `memory_pressure`: Simulate memory exhaustion

#### GET /api/demo/scenario-status
Get current demo scenario status including stage details.

**Response:**
```json
{
  "scenario": "optical_link_degradation",
  "stage": "remediation",
  "events": [...],
  "stageDetails": {
    "detection": {
      "ttd": 2.3,
      "confidence": 98.7,
      "anomalyType": "snr_degradation",
      "method": "SNMP polling + Isolation Forest ML",
      "metrics": {
        "snr": { "baseline": 35.2, "current": 28.1, "threshold": 30.0, "unit": "dB" }
      }
    },
    "diagnosis": { ... },
    "remediation": { ... },
    "verification": { ... }
  }
}
```

#### POST /api/demo/reset
Reset the demo scenario state.

### GNS3 Endpoints

#### GET /api/gns3/status
Get GNS3 connection status.

#### POST /api/gns3/test
Test GNS3 server connectivity.

#### GET /api/gns3/projects
List all GNS3 projects.

#### GET /api/gns3/nodes
Get all nodes in the configured project.

#### GET /api/gns3/links
Get all links in the configured project.

#### GET /api/gns3/templates
Get available GNS3 templates.

### Copilot Endpoints

#### POST /api/copilot/chat
Process a natural language command.

**Request Body:**
```json
{
  "message": "Create a new router using the Cisco IOSv template"
}
```

**Response:**
```json
{
  "actions": [
    {
      "action": "create_node",
      "status": "success",
      "message": "Created node Router-3",
      "details": { "nodeId": "abc-123", "name": "Router-3" }
    }
  ]
}
```

#### POST /api/copilot/clear
Clear conversation history.

### Metrics & Health Endpoints

#### GET /api/health
Get system health metrics.

#### GET /api/kpis
Get KPI metrics (TTD, TTR, MTTR).

#### GET /api/metrics/trends
Get historical metric trends.

#### GET /api/audit
Get audit log entries.

#### GET /api/learning
Get machine learning model updates.

#### GET /api/topology/links
Get network topology link data.

---

## GNS3 Integration

### Overview

AASHN integrates with GNS3 network simulation to provide real device data instead of mock data. When GNS3 is enabled, the platform:

- Fetches live node status from the GNS3 project
- Maps GNS3 nodes to AASHN device types
- Allows node control (start/stop/reload) through the UI
- Enables Network Copilot for topology management

### Device Type Mapping

GNS3 nodes are automatically classified based on naming conventions:

| AASHN Type | GNS3 Patterns | Node Types |
|------------|---------------|------------|
| Core | `core`, `cr-` in name | `dynamips`, router types |
| Spine | `spine`, `sp-` in name | `ethernet_switch`, switch types |
| TOR | `tor`, `leaf`, `sw-` in name | - |
| DPU | `dpu`, `host`, `pc` in name | `vpcs`, `docker` |

### Status Mapping

| GNS3 Status | AASHN Status |
|-------------|--------------|
| `started` | `healthy` |
| `stopped` | `offline` |
| `suspended` | `degraded` |

### GNS3 Client API

The `GNS3Client` class provides methods for interacting with GNS3:

```typescript
class GNS3Client {
  // Connection
  testConnection(): Promise<boolean>
  getVersion(): Promise<GNS3Version>
  
  // Projects
  getProjects(): Promise<GNS3Project[]>
  getProject(projectId: string): Promise<GNS3Project>
  openProject(projectId: string): Promise<GNS3Project>
  createProject(name: string): Promise<GNS3Project>
  deleteProject(projectId: string): Promise<void>
  
  // Nodes
  getNodes(projectId?: string): Promise<GNS3Node[]>
  getNode(nodeId: string): Promise<GNS3Node>
  startNode(nodeId: string): Promise<void>
  stopNode(nodeId: string): Promise<void>
  reloadNode(nodeId: string): Promise<void>
  createNodeFromTemplate(templateId: string, params?: CreateNodeParams): Promise<GNS3Node>
  deleteNode(nodeId: string): Promise<void>
  startAllNodes(): Promise<void>
  stopAllNodes(): Promise<void>
  
  // Links
  getLinks(projectId?: string): Promise<GNS3Link[]>
  getLink(linkId: string): Promise<GNS3Link>
  createLink(params: CreateLinkParams): Promise<GNS3Link>
  deleteLink(linkId: string): Promise<void>
  
  // Templates
  getTemplates(): Promise<GNS3Template[]>
  getTemplate(templateId: string): Promise<GNS3Template>
  
  // Utilities
  mapNodeToDevice(node: GNS3Node, links: GNS3Link[]): Device
}
```

### Caching

Device data from GNS3 is cached for 5 seconds to reduce API load. The cache is automatically invalidated when:
- Node control actions are performed
- Manual refresh is triggered
- Cache TTL expires

---

## Autonomous Agent Framework

### Architecture

The Agent Orchestrator manages a fleet of specialized agents that work together to provide autonomous self-healing capabilities.

```
┌─────────────────────────────────────────────────────────────────┐
│                     Agent Orchestrator                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ Monitor  │  │ Anomaly  │  │   RCA    │  │Remediation│       │
│  │  Agent   │  │  Agent   │  │  Agent   │  │  Agent    │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │Verification│ │ Learning │ │Compliance│  │Telemetry │        │
│  │  Agent    │ │  Agent   │  │  Agent   │  │  Agent   │        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
├─────────────────────────────────────────────────────────────────┤
│                        Task Queue                               │
│  [Task] → [Task] → [Task] → ...                                │
└─────────────────────────────────────────────────────────────────┘
```

### Agent Types

| Agent Type | Description | Capabilities |
|------------|-------------|--------------|
| Monitor | Continuous device monitoring | SNMP polling, threshold checks |
| Anomaly | ML-based anomaly detection | Isolation Forest, statistical analysis |
| RCA | Root cause analysis | Dependency mapping, correlation |
| Remediation | Automated remediation | Playbook execution, rollback |
| Verification | Post-remediation validation | Health checks, metric comparison |
| Learning | Continuous improvement | Pattern learning, model updates |
| Compliance | Policy enforcement | Security checks, config validation |
| Telemetry | Metrics collection | Performance data, trend analysis |

### Task Lifecycle

1. **Created**: Task added to queue
2. **Assigned**: Task assigned to capable agent
3. **Running**: Agent executing task
4. **Completed/Failed**: Task finished with result or error

### Playbook Execution

Playbooks define multi-step remediation procedures:

```typescript
// Example: Optical Link Recovery Playbook
{
  name: "Optical Link Recovery",
  triggerConditions: {
    patterns: ["snr_degradation", "ber_exceeded"]
  },
  steps: [
    { action: "verify_issue", description: "Confirm optical degradation" },
    { action: "adjust_power", description: "Tune optical power levels" },
    { action: "verify_recovery", description: "Validate metric improvement" },
    { action: "activate_backup", description: "Enable backup path if needed" }
  ],
  autoApprove: true
}
```

### Event System

The orchestrator emits events for all significant actions:

| Event Type | Description |
|------------|-------------|
| `task_started` | Agent began task execution |
| `task_completed` | Task finished successfully |
| `task_failed` | Task failed with error |
| `heartbeat` | Agent health check |
| `status_change` | Agent status changed |
| `action_executed` | Remediation action performed |

---

## Network Copilot

### Overview

Network Copilot provides a natural language interface for managing GNS3 network topologies. Powered by OpenAI GPT-4, it translates conversational commands into GNS3 API operations.

### Supported Commands

#### Topology Queries
- "List all available templates"
- "Show me the current nodes"
- "What links exist in the topology?"
- "How many devices are running?"

#### Node Management
- "Create a new router using the Cisco IOSv template"
- "Start node Router-1"
- "Stop all nodes"
- "Delete node Switch-2"

#### Link Management
- "Create a link between Router-1 and Switch-1"
- "Delete the link between Router-1 and Router-2"
- "Show all connections for Router-1"

### Architecture

```
User Command → OpenAI GPT-4 → Zod Validation → GNS3 Operations → Response
                    │
                    └── Context: Current nodes, links, templates
```

### Safety Features

1. **Schema Validation**: All AI responses validated against Zod schemas
2. **Existence Checks**: Nodes/links verified before mutations
3. **Status Checks**: Prevents redundant operations
4. **Error Handling**: Descriptive feedback for failures
5. **Conversation Memory**: Context maintained across commands

### Usage Example

```
User: "Create a router named Core-1 and connect it to Spine-1"

Copilot: I'll help you create and connect those devices.

[Action 1] Created node Core-1 using cisco_iosv template
[Action 2] Created link between Core-1 (e0/0) and Spine-1 (e0/1)

Both operations completed successfully. The new router Core-1 is now 
connected to Spine-1.
```

---

## Demo Console

### Overview

The Demo Console provides an interactive environment for demonstrating AASHN's self-healing capabilities. Users can inject faults and observe the autonomous detection, diagnosis, and remediation process in real-time.

### Available Scenarios

#### 1. Optical Link Degradation
**Description**: Simulates optical signal quality degradation on a fiber link.

**Detection Metrics**:
- SNR: Baseline 35.2 dB → Anomalous 28.1 dB (threshold: 30.0 dB)
- BER: Baseline 1e-12 → Anomalous 5e-9 (threshold: 1e-9)
- Detection Method: SNMP polling + Isolation Forest ML model
- TTD: ~2-3 seconds

**Remediation Steps**:
1. Adjust optical power levels
2. Verify signal improvement
3. Activate protection path if needed
4. Update routing tables

#### 2. Port Flapping
**Description**: Simulates interface state oscillation due to cable or hardware issues.

**Detection Metrics**:
- Flap Count: Baseline 0/hour → Anomalous 47/hour (threshold: 5/hour)
- Interface State Changes: 156 in 10 minutes
- Detection Method: State change frequency analysis
- TTD: ~1-2 seconds

**Remediation Steps**:
1. Enable interface dampening
2. Log detailed event data
3. Notify NOC for physical inspection
4. Failover to alternate path

#### 3. Memory Pressure
**Description**: Simulates memory exhaustion affecting device performance.

**Detection Metrics**:
- Memory Utilization: Baseline 45% → Anomalous 94% (threshold: 85%)
- Free Memory: 850 MB → 47 MB
- Detection Method: Resource monitoring + trend analysis
- TTD: ~2-3 seconds

**Remediation Steps**:
1. Identify memory-hungry processes
2. Gracefully restart non-critical services
3. Clear unnecessary caches
4. Rebalance workload if needed

### Stage Details

Each demo scenario tracks detailed information through four phases:

#### Detection Phase
- **TTD**: Time to detect in seconds
- **Confidence**: Detection confidence percentage
- **Anomaly Type**: Classification of the anomaly
- **Method**: Detection algorithm used
- **Metrics**: Baseline vs current values with thresholds

#### Diagnosis Phase
- **RCA Hypothesis**: Root cause hypothesis
- **Evidence**: Supporting evidence list
- **Affected Devices**: Impacted infrastructure
- **Risk Level**: Assessment of impact

#### Remediation Phase
- **Plan**: Remediation approach
- **Actions**: Steps to be executed
- **Policy Compliance**: Security/policy checks
- **Rollback Available**: Rollback capability

#### Verification Phase
- **TTR**: Time to remediate
- **TTTR**: Total time to resolve
- **Success Criteria**: What defines success
- **Metrics Comparison**: Before/after improvements

### UI Components

- **Scenario Selector**: Choose fault type and target devices
- **Event Timeline**: Real-time event stream with details
- **Stage Indicator**: Visual progress through phases
- **Stage Details Panel**: Comprehensive breakdown of each phase
- **Success Summary**: TTD/TTR/TTTR metrics after resolution

---

## User Interface Guide

### Dashboard

The main dashboard provides an overview of network health:

| Component | Description |
|-----------|-------------|
| KPI Cards | TTD, TTR, MTTR metrics with trend indicators |
| Device Heatmap | Visual grid of device status by type |
| Active Incidents | List of current incidents by severity |
| Metric Charts | Real-time CPU, memory, latency trends |
| Agent Status | Autonomous agent activity feed |
| System Health | Overall platform health indicators |

### Devices Page

Displays all network devices with:
- Device cards showing status, metrics, and location
- Filtering by type (Core/Spine/TOR/DPU) and status
- Device detail modal with port utilization
- Start/Stop/Reload controls (GNS3 mode)

### Incidents Page

Incident management interface:
- Incident list with severity indicators
- Status workflow visualization
- Timeline of events for each incident
- Remediation step tracking
- RCA findings display

### Agents Page

Agent monitoring dashboard:
- Agent cards with status and metrics
- Task queue visualization
- Execution history
- Capability details
- Heartbeat status

### Topology Page

Network topology visualization:
- Device node layout
- Link status display
- Bandwidth utilization
- Interactive zoom/pan

### Metrics Page

Historical metrics analysis:
- Time series charts
- Metric correlation
- Trend analysis
- Threshold visualization

### Use Cases Page

Self-healing workflow demonstrations:
- Three scenario descriptions
- Architecture diagrams
- Performance metrics
- Success criteria

### Copilot Page

Natural language interface:
- Chat-style command input
- Action result display
- Conversation history
- Quick command suggestions

### Demo Console Page

Live fault injection:
- Scenario selection
- Target device picker
- Real-time event stream
- Stage progress indicator
- Detailed metrics display

### Settings

Configuration management:
- Theme selection (Light/Dark/System)
- GNS3 settings
- Display preferences

---

## Self-Healing Workflows

### Optical Link Degradation Recovery

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Detection  │ ──► │  Diagnosis  │ ──► │ Remediation │ ──► │Verification │
│   (2.3s)    │     │   (1.8s)    │     │   (4.2s)    │     │   (1.5s)    │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
      │                   │                   │                   │
      ▼                   ▼                   ▼                   ▼
 SNMP Polling        Dependency         Power Level          Health
 + ML Analysis       Correlation         Adjustment          Checks
```

**Key Metrics**:
- Total Time to Resolve: < 10 seconds
- Detection Confidence: > 98%
- Remediation Success Rate: > 99.5%

### Port Flapping Mitigation

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Detection  │ ──► │  Diagnosis  │ ──► │ Remediation │ ──► │Verification │
│   (1.5s)    │     │   (2.1s)    │     │   (3.8s)    │     │   (1.2s)    │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
      │                   │                   │                   │
      ▼                   ▼                   ▼                   ▼
 State Change        Upstream            Interface           Stability
 Frequency           Analysis            Dampening           Check
```

**Key Metrics**:
- Total Time to Resolve: < 9 seconds
- Detection Confidence: > 96%
- Remediation Success Rate: > 99%

### Memory Pressure Relief

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Detection  │ ──► │  Diagnosis  │ ──► │ Remediation │ ──► │Verification │
│   (2.8s)    │     │   (2.5s)    │     │   (5.1s)    │     │   (2.0s)    │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
      │                   │                   │                   │
      ▼                   ▼                   ▼                   ▼
 Resource           Process             Service              Memory
 Monitoring         Analysis            Restart              Check
```

**Key Metrics**:
- Total Time to Resolve: < 13 seconds
- Detection Confidence: > 97%
- Remediation Success Rate: > 98%

---

## Operations & Troubleshooting

### Logging

Application logs are available through:
- Console output in development mode
- Audit trail API (`GET /api/audit`)
- Orchestrator events (`GET /api/orchestrator/events`)

### Common Issues

#### GNS3 Connection Failed
**Symptoms**: Devices show mock data, GNS3 status shows disconnected

**Resolution**:
1. Verify `GNS3_ENABLED=true` in environment
2. Check `GNS3_SERVER_URL` is accessible
3. Verify `GNS3_PROJECT_ID` is valid UUID
4. Test connection via `POST /api/gns3/test`

#### Copilot Not Responding
**Symptoms**: Chat returns errors, no actions executed

**Resolution**:
1. Verify OpenAI API key is configured
2. Check GNS3 connection (required for operations)
3. Review rate limits on API key

#### Agent Tasks Stuck
**Symptoms**: Tasks remain in "running" state

**Resolution**:
1. Check orchestrator status via API
2. Restart orchestrator: `POST /api/orchestrator/stop` then `start`
3. Review agent heartbeat timestamps

### Health Monitoring

Monitor system health via:
- `GET /api/health` - System metrics
- `GET /api/orchestrator/status` - Orchestrator status
- `GET /api/gns3/status` - GNS3 connection status

### Performance Tuning

| Parameter | Default | Description |
|-----------|---------|-------------|
| GNS3 Cache TTL | 5s | Device data cache duration |
| Heartbeat Interval | 30s | Agent health check frequency |
| Task Timeout | 300s | Maximum task execution time |
| Event Retention | 1000 | Maximum events stored |

---

## Security Considerations

### Authentication

The application supports session-based authentication with:
- Secure session cookies
- Password hashing
- CSRF protection

### API Security

- Input validation via Zod schemas
- Error message sanitization
- Rate limiting recommended for production

### GNS3 Security

- Credentials stored in environment variables
- Basic auth support for GNS3 API
- Passwords masked in API responses

### Best Practices

1. Use strong `SESSION_SECRET`
2. Enable HTTPS in production
3. Restrict GNS3 server access
4. Implement API rate limiting
5. Regular security audits
6. Monitor audit logs

---

## Appendix

### Glossary

| Term | Definition |
|------|------------|
| AASHN | Agentic Autonomous Self-Healing Networks |
| BER | Bit Error Rate |
| DPU | Data Processing Unit |
| GNS3 | Graphical Network Simulator 3 |
| ML | Machine Learning |
| MTTR | Mean Time To Repair |
| RCA | Root Cause Analysis |
| SNR | Signal-to-Noise Ratio |
| TOR | Top of Rack |
| TTD | Time to Detect |
| TTR | Time to Remediate |
| TTTR | Total Time to Resolve |

### References

- [GNS3 Documentation](https://docs.gns3.com/)
- [OpenAI API Documentation](https://platform.openai.com/docs)
- [Shadcn/ui Components](https://ui.shadcn.com/)
- [TanStack Query](https://tanstack.com/query)

---

*This documentation was generated for the AASHN POC. For the latest updates, refer to the project repository.*
