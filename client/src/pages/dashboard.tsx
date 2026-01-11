import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { RefreshCw, Download, Clock, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { KPICard } from "@/components/dashboard/kpi-card";
import { DeviceHeatmap } from "@/components/dashboard/device-heatmap";
import { IncidentList } from "@/components/dashboard/incident-list";
import { SystemHealthCard } from "@/components/dashboard/system-health";
import { MetricChart } from "@/components/dashboard/metric-chart";
import { AgentStatusCard } from "@/components/dashboard/agent-status";
import { LearningUpdatesCard } from "@/components/dashboard/learning-updates";
import { useLocation } from "wouter";
import { queryClient } from "@/lib/queryClient";
import type { 
  Device, 
  Incident, 
  KPIMetrics, 
  SystemHealth, 
  MetricTrend, 
  Agent, 
  LearningUpdate,
  SSEMessage
} from "@shared/schema";

function formatLastUpdated(): string {
  const now = new Date();
  return now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function Dashboard() {
  const [, navigate] = useLocation();
  const [isSSEConnected, setIsSSEConnected] = useState(false);

  const { data: devices, isLoading: loadingDevices } = useQuery<Device[]>({
    queryKey: ["/api/devices"],
  });

  const { data: incidents, isLoading: loadingIncidents } = useQuery<Incident[]>({
    queryKey: ["/api/incidents"],
  });

  const { data: kpis, isLoading: loadingKPIs } = useQuery<KPIMetrics>({
    queryKey: ["/api/kpis"],
  });

  const { data: health, isLoading: loadingHealth } = useQuery<SystemHealth>({
    queryKey: ["/api/health"],
  });

  const { data: trends, isLoading: loadingTrends } = useQuery<MetricTrend[]>({
    queryKey: ["/api/metrics/trends"],
  });

  const { data: agents, isLoading: loadingAgents } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  const { data: learningUpdates, isLoading: loadingLearning } = useQuery<LearningUpdate[]>({
    queryKey: ["/api/learning"],
  });

  // Subscribe to SSE for real-time updates
  useEffect(() => {
    const eventSource = new EventSource("/api/stream/events");
    
    eventSource.onopen = () => {
      setIsSSEConnected(true);
    };
    
    eventSource.onmessage = (event) => {
      try {
        const message: SSEMessage = JSON.parse(event.data);
        
        // Refresh relevant queries based on event type
        if (message.type === "incident_created" || 
            message.type === "incident_updated" || 
            message.type === "incident_resolved") {
          queryClient.invalidateQueries({ queryKey: ["/api/incidents"] });
          queryClient.invalidateQueries({ queryKey: ["/api/kpis"] });
        }
        
        if (message.type === "device_status_changed" || message.type === "telemetry_update") {
          queryClient.invalidateQueries({ queryKey: ["/api/devices"] });
          queryClient.invalidateQueries({ queryKey: ["/api/health"] });
        }
        
        if (message.type === "agent_log") {
          queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
        }
      } catch (e) {
        console.error("Failed to parse SSE message:", e);
      }
    };
    
    eventSource.onerror = () => {
      setIsSSEConnected(false);
    };
    
    return () => {
      eventSource.close();
    };
  }, []);

  const handleDeviceClick = (device: Device) => {
    navigate(`/devices/${device.id}`);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-4 p-4 border-b border-border bg-card/50">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">System Overview</h1>
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>Last Updated: {formatLastUpdated()}</span>
            <span className="text-status-online">(live)</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" data-testid="button-refresh">
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" data-testid="button-export">
            <Download className="h-3.5 w-3.5" />
            Export
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {loadingKPIs ? (
            <>
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </>
          ) : kpis ? (
            <>
              <KPICard
                title="Avg Time to Detect"
                value={kpis.avgTTD}
                unit="s"
                change={kpis.ttdChange}
                trend={kpis.ttdChange < 0 ? "up" : "down"}
                description="vs last week"
              />
              <KPICard
                title="Avg Time to Remediate"
                value={kpis.avgTTR}
                unit="s"
                change={kpis.ttrChange}
                trend={kpis.ttrChange < 0 ? "up" : "down"}
                description="vs last week"
              />
              <KPICard
                title="Mean Time to Recovery"
                value={kpis.avgMTTR}
                unit="s"
                change={kpis.mttrChange}
                trend={kpis.mttrChange < 0 ? "up" : "down"}
                description="vs last week"
              />
              <KPICard
                title="Active Incidents"
                value={kpis.activeIncidents}
                change={kpis.resolvedToday}
                trend="neutral"
                description="resolved today"
              />
            </>
          ) : null}
        </div>

        <div>
          {loadingDevices ? (
            <Skeleton className="h-48" />
          ) : devices ? (
            <DeviceHeatmap devices={devices} onDeviceClick={handleDeviceClick} />
          ) : null}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3">
            {loadingIncidents ? (
              <Skeleton className="h-96" />
            ) : incidents ? (
              <IncidentList incidents={incidents} maxHeight="340px" />
            ) : null}
          </div>
          <div className="lg:col-span-2">
            {loadingHealth ? (
              <Skeleton className="h-96" />
            ) : health ? (
              <SystemHealthCard health={health} />
            ) : null}
          </div>
        </div>

        <div>
          {loadingTrends ? (
            <Skeleton className="h-80" />
          ) : trends ? (
            <MetricChart data={trends} title="Metric Trends (Last 1 Hour)" />
          ) : null}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            {loadingAgents ? (
              <Skeleton className="h-80" />
            ) : agents ? (
              <AgentStatusCard agents={agents} />
            ) : null}
          </div>
          <div>
            {loadingLearning ? (
              <Skeleton className="h-80" />
            ) : learningUpdates ? (
              <LearningUpdatesCard updates={learningUpdates} />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
