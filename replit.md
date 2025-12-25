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
- **Current Storage**: In-memory storage implementation with mock data (database integration ready via Drizzle config)

The storage layer uses an interface pattern (`IStorage`) allowing easy swapping between in-memory mock data and database-backed implementations.

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