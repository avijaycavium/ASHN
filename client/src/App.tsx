import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { Bell, Search, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import IncidentsPage from "@/pages/incidents";
import IncidentDetailPage from "@/pages/incident-detail";
import DevicesPage from "@/pages/devices";
import AgentsPage from "@/pages/agents";
import AuditPage from "@/pages/audit";
import MetricsPage from "@/pages/metrics";
import TopologyPage from "@/pages/topology";
import SettingsPage from "@/pages/settings";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/incidents" component={IncidentsPage} />
      <Route path="/incidents/:id" component={IncidentDetailPage} />
      <Route path="/devices" component={DevicesPage} />
      <Route path="/metrics" component={MetricsPage} />
      <Route path="/topology" component={TopologyPage} />
      <Route path="/agents" component={AgentsPage} />
      <Route path="/audit" component={AuditPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function Header() {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-border bg-background px-4">
      <div className="flex items-center gap-4">
        <SidebarTrigger data-testid="button-sidebar-toggle" />
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search devices, incidents..."
            className="pl-9 w-64 lg:w-80"
            data-testid="input-global-search"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative" data-testid="button-notifications">
              <Bell className="h-4 w-4" />
              <Badge 
                variant="destructive" 
                className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
              >
                3
              </Badge>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel>Notifications</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="flex flex-col items-start gap-1 py-3">
              <div className="flex items-center gap-2">
                <Badge className="bg-status-busy text-white text-xs">CRITICAL</Badge>
                <span className="text-xs text-muted-foreground">2m ago</span>
              </div>
              <span className="text-sm font-medium">INC-2025-001: Link Failure</span>
              <span className="text-xs text-muted-foreground">Spine-1:port1 connection down</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="flex flex-col items-start gap-1 py-3">
              <div className="flex items-center gap-2">
                <Badge className="bg-status-away text-black text-xs">HIGH</Badge>
                <span className="text-xs text-muted-foreground">15m ago</span>
              </div>
              <span className="text-sm font-medium">INC-2025-002: Port Congestion</span>
              <span className="text-xs text-muted-foreground">TOR-3 experiencing high traffic</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="flex flex-col items-start gap-1 py-3">
              <div className="flex items-center gap-2">
                <Badge className="bg-status-online text-white text-xs">RESOLVED</Badge>
                <span className="text-xs text-muted-foreground">1h ago</span>
              </div>
              <span className="text-sm font-medium">INC-2025-003: BGP Flap</span>
              <span className="text-xs text-muted-foreground">Auto-remediated successfully</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-center text-sm text-primary cursor-pointer">
              View all notifications
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <ThemeToggle />
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="flex h-8 shrink-0 items-center justify-between gap-4 border-t border-border bg-muted/30 px-4 text-xs text-muted-foreground">
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3 text-status-online" />
          All Systems Operational
        </span>
      </div>
      <div className="flex items-center gap-4">
        <span>Graph v2.1</span>
        <span>50 Devices</span>
      </div>
    </footer>
  );
}

function App() {
  const sidebarStyle = {
    "--sidebar-width": "15rem",
    "--sidebar-width-icon": "3.5rem",
  } as React.CSSProperties;

  return (
    <ThemeProvider defaultTheme="dark" storageKey="aashn-ui-theme">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <SidebarProvider style={sidebarStyle}>
            <div className="flex h-screen w-full">
              <AppSidebar />
              <SidebarInset className="flex flex-col">
                <Header />
                <main className="flex-1 overflow-hidden">
                  <Router />
                </main>
                <Footer />
              </SidebarInset>
            </div>
          </SidebarProvider>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
