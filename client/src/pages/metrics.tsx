import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3, TrendingUp, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MetricChart } from "@/components/dashboard/metric-chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";
import type { MetricTrend, Device } from "@shared/schema";

type TierFilter = "all" | "core" | "spine" | "tor" | "endpoint";

export default function MetricsPage() {
  const [selectedDevice, setSelectedDevice] = useState<string>("all");
  const [selectedTier, setSelectedTier] = useState<TierFilter>("all");
  const queryClient = useQueryClient();

  const buildQueryParams = () => {
    const params = new URLSearchParams();
    if (selectedDevice !== "all") {
      params.append("deviceId", selectedDevice);
    } else if (selectedTier !== "all") {
      params.append("tier", selectedTier);
    }
    params.append("hoursBack", "24");
    params.append("limit", "500");
    return params.toString();
  };

  const queryParams = buildQueryParams();

  const { data: trends, isLoading: loadingTrends, refetch } = useQuery<MetricTrend[]>({
    queryKey: ["/api/metrics/trends", selectedDevice, selectedTier],
    queryFn: async () => {
      const response = await fetch(`/api/metrics/trends?${queryParams}`);
      if (!response.ok) throw new Error("Failed to fetch trends");
      return response.json();
    },
  });

  const { data: devices } = useQuery<Device[]>({
    queryKey: ["/api/devices"],
  });

  const handleRefresh = () => {
    refetch();
  };

  const handleDeviceChange = (value: string) => {
    setSelectedDevice(value);
    if (value !== "all") {
      setSelectedTier("all");
    }
  };

  const handleTierChange = (value: TierFilter) => {
    setSelectedTier(value);
    if (value !== "all") {
      setSelectedDevice("all");
    }
  };

  const currentMetrics = trends?.[trends.length - 1];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-4 p-4 border-b border-border bg-card/50">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Metrics</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time network performance metrics
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedTier} onValueChange={(v) => handleTierChange(v as TierFilter)}>
            <SelectTrigger className="w-36" data-testid="select-tier">
              <SelectValue placeholder="Layer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Layers</SelectItem>
              <SelectItem value="core">Core</SelectItem>
              <SelectItem value="spine">Spine</SelectItem>
              <SelectItem value="tor">TOR</SelectItem>
              <SelectItem value="endpoint">Endpoint</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedDevice} onValueChange={handleDeviceChange}>
            <SelectTrigger className="w-48" data-testid="select-device">
              <SelectValue placeholder="Select device" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Devices</SelectItem>
              {devices?.map((device) => (
                <SelectItem key={device.id} value={device.id}>
                  {device.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" className="gap-1.5" data-testid="button-refresh" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {loadingTrends ? (
            [...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))
          ) : currentMetrics ? (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">CPU</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-semibold font-mono" data-testid="metric-cpu">
                      {currentMetrics.cpu.toFixed(0)}
                    </span>
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                  <div className="flex items-center gap-1 mt-1 text-xs text-status-online">
                    <TrendingUp className="h-3 w-3" />
                    <span>Within limits</span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Memory</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-semibold font-mono" data-testid="metric-memory">
                      {currentMetrics.memory.toFixed(0)}
                    </span>
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                  <div className="flex items-center gap-1 mt-1 text-xs text-status-online">
                    <TrendingUp className="h-3 w-3" />
                    <span>Normal usage</span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Port Util</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-semibold font-mono" data-testid="metric-port-util">
                      {currentMetrics.portUtilization.toFixed(0)}
                    </span>
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                  <div className="flex items-center gap-1 mt-1 text-xs text-status-online">
                    <TrendingUp className="h-3 w-3" />
                    <span>Healthy bandwidth</span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Latency</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-semibold font-mono" data-testid="metric-latency">
                      {currentMetrics.latency.toFixed(1)}
                    </span>
                    <span className="text-sm text-muted-foreground">ms</span>
                  </div>
                  <div className="flex items-center gap-1 mt-1 text-xs text-status-online">
                    <TrendingUp className="h-3 w-3" />
                    <span>Low latency</span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">BGP Peers</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-semibold font-mono" data-testid="metric-bgp-peers">
                      {currentMetrics.bgpPeers}
                    </span>
                    <span className="text-sm text-muted-foreground">active</span>
                  </div>
                  <div className="flex items-center gap-1 mt-1 text-xs text-status-online">
                    <TrendingUp className="h-3 w-3" />
                    <span>All established</span>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>

        {loadingTrends ? (
          <Skeleton className="h-80" />
        ) : trends ? (
          <MetricChart data={trends} title="Performance Trends" />
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Switch Performance Targets</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm">CPU Utilization</span>
                  <span className="text-sm font-mono text-muted-foreground">
                    Target: &lt;80%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Memory Usage</span>
                  <span className="text-sm font-mono text-muted-foreground">
                    Target: &lt;85%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Port Utilization</span>
                  <span className="text-sm font-mono text-muted-foreground">
                    Target: &lt;75%
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Endpoint Performance Targets</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Network Latency P95</span>
                  <span className="text-sm font-mono text-muted-foreground">
                    Target: &lt;20ms
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Packet Drops</span>
                  <span className="text-sm font-mono text-muted-foreground">
                    Target: &lt;50/hr
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">BGP Peer Sessions</span>
                  <span className="text-sm font-mono text-muted-foreground">
                    Target: 100% established
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
