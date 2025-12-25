# AASHN Design Guidelines

## Design Approach
**Selected System**: Material Design 3 / Enterprise Dashboard Pattern
**Justification**: Complex data-rich enterprise application requiring clear information hierarchy, real-time updates, and high-density information display

## Core Design Principles
1. **Information Hierarchy**: Critical alerts always visible, progressive disclosure for details
2. **Real-Time First**: Live updates via WebSocket, no page refreshes
3. **Contextual Awareness**: Role-based views, incident-focused data display
4. **Trust & Transparency**: Show agent reasoning, confidence scores, audit trails
5. **Action-Oriented**: Clear CTAs for manual overrides and approvals

## Typography
- **Primary Font**: Roboto (Material Design standard)
- **Monospace Font**: Roboto Mono (for logs, metrics, technical data)
- **Hierarchy**:
  - H1: 32px, Medium (Page titles)
  - H2: 24px, Medium (Section headers)
  - H3: 20px, Medium (Card headers)
  - Body: 14px, Regular (Main content)
  - Caption: 12px, Regular (Metadata, timestamps)
  - Code/Metrics: 13px, Monospace (Technical data)

## Layout System
**Spacing Units**: Use Tailwind spacing of 1, 2, 4, 6, 8, 12, 16, 24 (p-1, p-2, p-4, etc.)

**Grid System**:
- 12-column responsive grid for dashboard widgets
- Fixed sidebar: 240px width
- Fixed header: 64px height
- Fixed footer: 32px height
- Main content: fluid with max-width constraints

**Application Shell**:
- Top navigation bar: Fixed, full-width
- Left sidebar: Fixed, collapsible on mobile
- Main content area: Scrollable, responsive grid
- Footer status bar: Fixed, minimal information

## Component Library

### Navigation Components
- **Sidebar Menu**: Icon + label, active state highlighting, collapsible
- **Breadcrumbs**: Show current location in hierarchy
- **Floating Action Button**: Quick access to critical actions

### Data Display Components
- **KPI Cards**: Large metric display with trend indicators (↑↓), compact layout
- **Device Health Heatmap**: Color-coded grid (🟢🟡🔴), tooltip on hover
- **Incident List**: Priority badges, status indicators, timestamp, expandable details
- **Metric Charts**: Line/area charts for trends, time-range selectors
- **System Health Gauges**: Circular/linear progress indicators
- **Timeline/Gantt**: Incident lifecycle visualization
- **Agent Execution DAG**: Interactive flowchart showing agent reasoning
- **Network Topology Graph**: Force-directed graph with device nodes, link status

### Interactive Components
- **Alert Panels**: Real-time notifications with severity badges, dismissible
- **Approval Modals**: Action details, confidence scores, approve/reject buttons
- **Metric Filters**: Time range pickers, device selectors, metric type toggles
- **Log Viewers**: Scrollable, syntax-highlighted, filterable
- **Data Tables**: Sortable columns, filterable rows, pagination, row selection

### Status Indicators
- **Severity Badges**: Critical (🔴), High (🟡), Medium (🟠), Low (🟢)
- **Health Status**: Healthy, Degraded, Critical with color coding
- **Progress Bars**: Show remediation progress, ETA display
- **Live Indicators**: Pulsing dots for active connections/updates

## Real-Time Features
- **WebSocket Connections**: Live metric updates, incident notifications
- **Auto-Refresh**: Dashboard widgets refresh every 2-5 seconds
- **Live Timestamps**: "2s ago", "just now" format, auto-updating
- **Notification System**: Toast notifications for new incidents, sound alerts (optional)

## Dashboard Layout
**Home View**: 
- Top row: 3 KPI cards (TTD, TTR, MTTR) - equal width
- Second row: Device health heatmap (full width)
- Third row: Split (60/40) - Active incidents list | System health metrics
- Fourth row: Metric trends chart (full width)
- Fifth row: Split (50/50) - Agent execution DAG | Recent activity log

**Incident Detail View**:
- Header: Incident ID, severity, status, timestamps
- Left column (70%): Timeline, RCA analysis, remediation steps, agent reasoning
- Right column (30%): Affected devices, related metrics, manual actions panel

**Topology View**:
- Full-screen interactive graph
- Floating controls: Zoom, filter, layout algorithm selector
- Side panel: Selected device/link details

## Responsive Breakpoints
- Desktop: >1280px (full layout)
- Tablet: 768-1279px (sidebar collapsible, 2-column grids)
- Mobile: <768px (stacked layout, hamburger menu, single column)

## Critical Constraints
- Never hide critical alerts below the fold
- All actions require confirmation modals with details
- Show audit trail for every automated action
- Maintain real-time sync across all open sessions
- Support keyboard navigation for power users
- Display loading states for async operations (skeleton screens)

## Images
No hero images for this application. This is a data-rich enterprise dashboard where every pixel serves an operational purpose. Use icons, charts, and data visualizations instead of decorative imagery.