# AASHN - Agentic Autonomous Self-Healing Networks

## Overview

AASHN is an enterprise network monitoring dashboard with autonomous self-healing capabilities. It provides real-time monitoring of network devices, incident management, agent execution tracking, and system health visualization. The application is designed for complex data-rich enterprise environments requiring clear information hierarchy, real-time updates, and high-density information display. It aims to autonomously detect, diagnose, remediate, and verify network issues without human intervention.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The frontend uses React with TypeScript and Vite, employing Wouter for routing, TanStack React Query for state, Shadcn/ui (built on Radix UI) for components, and Tailwind CSS for styling with theming support. Recharts is used for data visualization. The UI follows a page-based architecture with a sidebar navigation and fixed header, organizing dashboard components into specialized widgets.

### Backend Architecture
The backend is built with Express.js and TypeScript, providing RESTful API endpoints. It integrates with the Vite dev server for frontend HMR during development and serves pre-built static files in production.

### Data Layer
Drizzle ORM with a PostgreSQL dialect manages the database, with schemas defined in `shared/schema.ts` and validated using Zod. The database is seeded on first run with network devices, topology links, and autonomous agents.

### Key Design Patterns
Shared TypeScript interfaces in `shared/schema.ts` are used across frontend and backend. Path aliases (`@/*` for client, `@shared/*` for shared code) are used. UI components are organized into `components/ui/` for primitives and `components/dashboard/` for features. A centralized query client handles API fetching.

### Real-Time SSE Infrastructure
The application uses Server-Sent Events (SSE) for real-time updates across all pages:
- **Unified endpoint**: `/api/stream/events` broadcasts all events via EventEmitter
- **Event types**: `incident_created`, `incident_updated`, `incident_resolved`, `stage_changed`, `device_status_changed`, `agent_log`, `telemetry_update`, `anomaly_detected`
- **Frontend subscriptions**: Dashboard, Incidents, Topology, Agents, and Demo Console pages subscribe to SSE and invalidate React Query caches when relevant events occur
- **Stage transitions**: `setStage()` helper in orchestrator persists stage changes to database and broadcasts SSE updates
- **Incident lifecycle**: Fault injection creates incidents → device status changes to degraded/critical → orchestrator runs healing workflow → incident resolved → device status reset to healthy

### GNS3 Integration
AASHN integrates with GNS3 network simulation to provide real device data. It connects to a GNS3 server and specific project, mapping GNS3 nodes to AASHN device types based on naming conventions. It allows starting, stopping, and reloading GNS3 nodes.

### Network Copilot
A natural language interface for managing GNS3 network topologies through conversational commands. It supports creating/deleting nodes and links, starting/stopping nodes, and querying topology using OpenAI GPT-4o via Replit AI Integrations. AI responses are validated with Zod schemas, and operations are verified against the live topology for safety.

### LangGraph Autonomous Agents
AASHN implements a fully autonomous self-healing pipeline using LangGraph in Python. This system detects, diagnoses, remediates, and verifies network issues.
The pipeline consists of:
- **DetectionAgent**: Anomaly detection and fault classification.
- **RCAAgent**: Root cause analysis.
- **RemediationAgent**: Executes corrective actions (e.g., via SONiC/GNS3).
- **VerificationAgent**: Validates fix success.

Supported fault types include BGP link/session instability, traffic drops, CPU spikes, and memory exhaustion. The LangGraph workflow includes conditional routing for early exit on low confidence, retries on verification failure, and graceful fallback to rule-based logic if AI credentials are not configured. The Python agent server (Flask) runs on port 5001 and supports both synchronous and asynchronous workflow execution.

## External Dependencies

- **PostgreSQL**: Primary database.
- **Drizzle Kit**: Database migrations.
- **Radix UI**: Primitive component library for accessibility.
- **Shadcn/ui**: Pre-configured UI component variants.
- **Lucide React**: Icon library.
- **Vite**: Frontend build tool.
- **esbuild**: Server bundling.
- **tsx**: TypeScript execution for development.
- **TanStack React Query**: Data fetching and caching.
- **Recharts**: Chart visualizations.
- **Wouter**: Client-side routing.
- **date-fns**: Date formatting utilities.
- **Tailwind CSS**: Utility-first styling.
- **OpenAI GPT-4o**: Used by Network Copilot and LangGraph agents for AI capabilities.
- **GNS3**: Network simulation environment for real device data.
- **SONiC**: Network operating system for remediation actions via agents.
- **Prometheus**: Metrics queries for agents.