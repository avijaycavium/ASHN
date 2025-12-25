import { useQuery } from "@tanstack/react-query";
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

export default function MetricsPage() {
  const [selectedDevice, setSelectedDevice] = useState<string>("all");

  const { data: trends, isLoading: loadingTrends } = useQuery<MetricTrend[]>({
    queryKey: ["/api/metrics/trends"],
  });

  const { data: devices } = useQuery<Device[]>({
    queryKey: ["/api/devices"],
  });

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
          <Select value={selectedDevice} onValueChange={setSelectedDevice}>
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
          <Button variant="outline" className="gap-1.5" data-testid="button-refresh">
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
                  <CardTitle className="text-sm font-medium text-muted-foreground">SNR</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-semibold font-mono" data-testid="metric-snr">
                      {currentMetrics.snr.toFixed(1)}
                    </span>
                    <span className="text-sm text-muted-foreground">dB</span>
                  </div>
                  <div className="flex items-center gap-1 mt-1 text-xs text-status-online">
                    <TrendingUp className="h-3 w-3" />
                    <span>Normal range</span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">BER</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-semibold font-mono" data-testid="metric-ber">
                      {currentMetrics.ber.toFixed(1)}
                    </span>
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                  <div className="flex items-center gap-1 mt-1 text-xs text-status-online">
                    <TrendingUp className="h-3 w-3" />
                    <span>Low error rate</span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">FEC</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-semibold font-mono" data-testid="metric-fec">
                      {currentMetrics.fec.toFixed(1)}
                    </span>
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                  <div className="flex items-center gap-1 mt-1 text-xs text-status-online">
                    <TrendingUp className="h-3 w-3" />
                    <span>Correction active</span>
                  </div>
                </CardContent>
              </Card>
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
                  <CardTitle className="text-sm font-medium text-muted-foreground">Latency</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-semibold font-mono" data-testid="metric-latency">
                      {currentMetrics.latency.toFixed(0)}
                    </span>
                    <span className="text-sm text-muted-foreground">ms</span>
                  </div>
                  <div className="flex items-center gap-1 mt-1 text-xs text-status-online">
                    <TrendingUp className="h-3 w-3" />
                    <span>Low latency</span>
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
              <CardTitle className="text-base">Signal Quality Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Signal-to-Noise Ratio</span>
                  <span className="text-sm font-mono text-muted-foreground">
                    Target: &gt;10dB
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Bit Error Rate</span>
                  <span className="text-sm font-mono text-muted-foreground">
                    Target: &lt;1e-6
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Forward Error Correction</span>
                  <span className="text-sm font-mono text-muted-foreground">
                    Target: &lt;5%
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">System Performance Overview</CardTitle>
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
                  <span className="text-sm">Network Latency P95</span>
                  <span className="text-sm font-mono text-muted-foreground">
                    Target: &lt;150ms
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Memory Usage</span>
                  <span className="text-sm font-mono text-muted-foreground">
                    Target: &lt;85%
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
