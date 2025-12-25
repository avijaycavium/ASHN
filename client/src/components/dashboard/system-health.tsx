import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Cpu, HardDrive, Activity, Users, Server } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SystemHealth } from "@shared/schema";

interface SystemHealthProps {
  health: SystemHealth;
}

function getProgressColor(value: number, thresholds: { warning: number; critical: number }) {
  if (value >= thresholds.critical) return "bg-status-busy";
  if (value >= thresholds.warning) return "bg-status-away";
  return "bg-status-online";
}

export function SystemHealthCard({ health }: SystemHealthProps) {
  const metrics = [
    {
      label: "CPU Usage",
      value: health.cpu,
      unit: "%",
      icon: <Cpu className="h-4 w-4" />,
      thresholds: { warning: 60, critical: 85 },
    },
    {
      label: "Memory",
      value: health.memory,
      unit: "%",
      icon: <HardDrive className="h-4 w-4" />,
      thresholds: { warning: 70, critical: 90 },
    },
    {
      label: "Latency P95",
      value: health.latencyP95,
      unit: "ms",
      icon: <Activity className="h-4 w-4" />,
      thresholds: { warning: 100, critical: 200 },
      maxValue: 300,
    },
    {
      label: "API Latency",
      value: health.apiLatency,
      unit: "ms",
      icon: <Activity className="h-4 w-4" />,
      thresholds: { warning: 80, critical: 150 },
      maxValue: 200,
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">System Health</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {metrics.map((metric) => {
          const percentage = metric.maxValue
            ? (metric.value / metric.maxValue) * 100
            : metric.value;
          const color = getProgressColor(metric.value, metric.thresholds);

          return (
            <div key={metric.label} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">{metric.icon}</span>
                  <span>{metric.label}</span>
                </div>
                <span className="text-sm font-mono font-medium" data-testid={`health-${metric.label.toLowerCase().replace(/\s+/g, '-')}`}>
                  {metric.value}{metric.unit}
                </span>
              </div>
              <div className="relative h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full transition-all duration-500", color)}
                  style={{ width: `${Math.min(percentage, 100)}%` }}
                />
              </div>
            </div>
          );
        })}

        <div className="pt-2 border-t border-border space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span>Active Sessions</span>
            </div>
            <span className="font-mono font-medium">{health.activeSessions}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-muted-foreground" />
              <span>Devices</span>
            </div>
            <div className="flex items-center gap-2 font-mono text-sm">
              <span className="text-status-online">{health.healthyDevices}</span>
              <span className="text-muted-foreground">/</span>
              <span className="text-status-away">{health.degradedDevices}</span>
              <span className="text-muted-foreground">/</span>
              <span className="text-status-busy">{health.criticalDevices}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
