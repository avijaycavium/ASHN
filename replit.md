# AASHN - Agentic Autonomous Self-Healing Networks

## Overview

AASHN is an enterprise network monitoring dashboard with autonomous self-healing capabilities. It provides real-time monitoring of network devices, incident management, agent execution tracking, and system health visualization. The application is designed for complex data-rich enterprise environments requiring clear information hierarchy, real-time updates, and high-density information display.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack React Query for server state and data fetching
- **UI Components**: Shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming (light/dark mode support)
- **Charts**: Recharts for metric visualization

The frontend follows a page-based architecture with shared components. Dashboard components are organized into specialized display widgets (KPI cards, device heatmaps, incident lists, metric charts). The application uses a sidebar navigation pattern with a fixed header.

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **API Pattern**: RESTful API endpoints under `/api/*`
- **Development Server**: Vite dev server with HMR for frontend, integrated with Express
- **Production Build**: esbuild bundles server code, Vite builds client assets

The backend serves both API endpoints and static files. In development, Vite middleware handles frontend assets with hot module replacement. In production, pre-built static files are served from the `dist/public` directory.

### Data Layer
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Location**: `shared/schema.ts` contains all type definitions and database schema
- **Validation**: Zod schemas generated from Drizzle schemas via drizzle-zod
- **Storage**: PostgreSQL database via DatabaseStorage class (`server/database-storage.ts`)

The database is automatically seeded on first run with:
- 53 devices (5 core, 12 spine, 16 TOR, 20 endpoint switches)
- 84 topology links (dual-plane architecture)
- 5 autonomous agents (Detection, RCA, Remediation, Verification, Orchestrator)

All API endpoints fetch data from PostgreSQL. System health, KPIs, and audit logs are derived from database entities (devices, incidents).

### Key Design Patterns
- **Shared Types**: TypeScript interfaces in `shared/schema.ts` are used by both frontend and backend
- **Path Aliases**: `@/*` maps to client source, `@shared/*` maps to shared code
- **Component Organization**: UI primitives in `components/ui/`, feature components in `components/dashboard/`
- **API Fetching**: Centralized query client with credential handling and error management

## External Dependencies

### Database
- **PostgreSQL**: Primary database (requires `DATABASE_URL` environment variable)
- **Drizzle Kit**: Database migrations stored in `./migrations` directory

### UI Framework Dependencies
- **Radix UI**: Complete primitive component library for accessibility
- **Shadcn/ui**: Pre-configured component variants using class-variance-authority
- **Lucide React**: Icon library used throughout the application

### Build & Development
- **Vite**: Frontend build tool with React plugin
- **esbuild**: Server bundling for production
- **tsx**: TypeScript execution for development

### Key Runtime Dependencies
- **TanStack React Query**: Data fetching and caching
- **Recharts**: Chart visualizations
- **Wouter**: Client-side routing
- **date-fns**: Date formatting utilities
- **Tailwind CSS**: Utility-first styling

The application is configured for Replit deployment with specific plugins for development banners and runtime error overlays.

## GNS3 Integration

AASHN supports integration with GNS3 network simulation for real device data instead of mock data.

### Configuration

Set the following environment variables in the Secrets panel:

| Variable | Description | Required |
|----------|-------------|----------|
| `GNS3_ENABLED` | Set to "true" to enable GNS3 integration | Yes |
| `GNS3_SERVER_URL` | GNS3 server URL (default: http://localhost:3080) | Yes |
| `GNS3_PROJECT_ID` | UUID of the GNS3 project to monitor | Yes |
| `GNS3_USERNAME` | GNS3 authentication username | Optional |
| `GNS3_PASSWORD` | GNS3 authentication password | Optional |

### GNS3 API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/gns3/status` | Get GNS3 connection status and configuration |
| `POST /api/gns3/test` | Test connection to GNS3 server |
| `GET /api/gns3/projects` | List all GNS3 projects |
| `GET /api/gns3/nodes` | Get all nodes in the configured project |
| `GET /api/gns3/links` | Get all links in the configured project |
| `POST /api/devices/:id/start` | Start a GNS3 node |
| `POST /api/devices/:id/stop` | Stop a GNS3 node |
| `POST /api/devices/:id/reload` | Reload a GNS3 node |

### Device Type Mapping

GNS3 nodes are automatically mapped to AASHN device types based on naming patterns:

| AASHN Type | GNS3 Patterns |
|------------|---------------|
| Core | Names containing "core", "cr-", or Dynamips nodes |
| Spine | Names containing "spine", "sp-", or ethernet_switch type |
| TOR | Names containing "tor", "leaf", "sw-" |
| DPU | Names containing "dpu", "host", "pc", or VPCS/Docker types |

### Data Flow

1. When GNS3 is enabled with a valid project ID, devices are fetched from GNS3
2. If GNS3 connection fails, the system falls back to mock data
3. Data is cached for 5 seconds to reduce API load
4. Node status from GNS3 maps to: started=healthy, stopped=offline, suspended=degraded

## Network Copilot

AASHN includes a natural language interface (Network Copilot) for managing GNS3 network topologies through conversational commands.

### Features

- Create nodes from available GNS3 templates
- Delete nodes from the topology
- Start/stop individual nodes
- Create links between nodes
- Delete links from the topology
- Query current topology (nodes, links, templates)

### API Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /api/copilot/chat` | Process a natural language command |
| `POST /api/copilot/clear` | Clear conversation history |
| `GET /api/gns3/templates` | List available GNS3 templates |

### Architecture

The Network Copilot uses:
- **OpenAI GPT-4o** via Replit AI Integrations (no API key required, charges billed to credits)
- **Zod schema validation** for validating AI responses before executing GNS3 operations
- **Topology context injection** - current nodes, links, and templates are provided with each request
- **Graceful error handling** with informative feedback for failed operations

### Example Commands

- "List all available templates"
- "Create a new router using the Cisco IOSv template"
- "Start node Router-1"
- "Create a link between Router-1 and Switch-1"
- "Show me the current nodes"
- "Stop all nodes"

### Safety Features

- All AI responses are validated against strict Zod schemas before execution
- Node/link existence is verified against live topology before mutations
- Status checks prevent redundant operations (e.g., starting an already running node)
- Each GNS3 operation is wrapped in try/catch with descriptive error messages

## LangGraph Autonomous Agents

AASHN implements a fully autonomous self-healing pipeline using LangGraph with Python. The agent system can automatically detect, diagnose, remediate, and verify network issues without human intervention.

### Architecture

```
Node.js Backend (Express)          Python LangGraph Agents
┌─────────────────────────┐       ┌─────────────────────────────────┐
│ - API endpoints          │       │ Detection → RCA → Remediation   │
│ - Database/WebSocket     │ HTTP  │ → Verification → Resolved       │
│ - UI serving             │ ◄────►│                                 │
│ - Fault injection        │       │ Tools: SONiC, Prometheus, GNS3  │
└─────────────────────────┘       └─────────────────────────────────┘
```

### Agent Pipeline

| Agent | Role | AI-Powered |
|-------|------|------------|
| DetectionAgent | Anomaly detection and fault classification | Yes |
| RCAAgent | Root cause analysis with hypothesis generation | Yes |
| RemediationAgent | Execute corrective actions via SONiC/GNS3 | No |
| VerificationAgent | Validate fix success via metrics | No |

### Supported Fault Types

| Fault Type | Description | Auto-Remediation |
|------------|-------------|------------------|
| `bgp_link_flap` | BGP session flapping due to unstable link | Yes |
| `bgp_session_instability` | BGP session instability without physical link issues | Yes |
| `traffic_drop` | Unexpected traffic drop indicating routing issues | Yes |
| `cpu_spike` | CPU utilization spike affecting performance | Yes |
| `memory_exhaustion` | Memory utilization approaching critical levels | Yes |

### LangGraph API Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /api/langgraph/trigger` | Trigger healing workflow for a device/fault |
| `GET /api/langgraph/status` | Get agent server connection status |
| `GET /api/langgraph/capabilities` | Get supported fault types and agents |
| `POST /api/langgraph/test` | Run a test workflow |
| `GET /api/langgraph/workflow/:id` | Get workflow result by incident ID |
| `POST /api/faults/inject-with-healing` | Inject fault and auto-trigger healing |

### Python Agent Directory Structure

```
agents/
├── __init__.py
├── graph.py           # LangGraph workflow definition
├── state.py           # IncidentState schema
├── server.py          # Flask API server (port 5001)
├── run.py             # Run script
├── nodes/
│   ├── detection.py   # Anomaly detection logic
│   ├── rca.py         # AI-powered root cause analysis
│   ├── remediation.py # SONiC remediation actions
│   └── verification.py # Fix validation
└── tools/
    ├── sonic.py       # SONiC vtysh commands
    ├── prometheus.py  # Metrics queries
    └── gns3.py        # GNS3 node control
```

### Running the Agent Server

The Python agent server runs on port 5001:

```bash
python agents/run.py
```

### Workflow State (IncidentState)

The LangGraph workflow tracks incident lifecycle through:
- `incident_id`: Unique incident identifier
- `fault_type`: Classified fault type
- `stage`: Current workflow stage (detection → rca → remediation → verification → resolved)
- `detection_confidence`: Confidence score from detection
- `root_cause`: Identified root cause
- `remediation_actions`: Actions taken to fix the issue
- `verification_checks`: Metric checks performed
- `ttd_seconds`: Time to detect
- `ttr_seconds`: Time to remediate
- `tttr_seconds`: Time to verify
- `events`: Full event timeline

### Conditional Routing

The workflow includes intelligent routing:
- Low detection confidence → ends early for human review
- Low RCA confidence or high risk → skips remediation
- Verification failure → retries with different approach (max 2 retries)
- Verification success → incident resolved