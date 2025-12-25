import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Device, DeviceStatus } from "@shared/schema";

interface DeviceHeatmapProps {
  devices: Device[];
  onDeviceClick?: (device: Device) => void;
}

const statusColors: Record<DeviceStatus, string> = {
  healthy: "bg-status-online",
  degraded: "bg-status-away",
  critical: "bg-status-busy",
  offline: "bg-status-offline",
};

const statusLabels: Record<DeviceStatus, string> = {
  healthy: "Healthy",
  degraded: "Degraded",
  critical: "Critical",
  offline: "Offline",
};

function groupDevicesByType(devices: Device[]): Record<string, Device[]> {
  return devices.reduce((acc, device) => {
    if (!acc[device.type]) {
      acc[device.type] = [];
    }
    acc[device.type].push(device);
    return acc;
  }, {} as Record<string, Device[]>);
}

export function DeviceHeatmap({ devices, onDeviceClick }: DeviceHeatmapProps) {
  const groupedDevices = groupDevicesByType(devices);
  const typeOrder = ["core", "spine", "tor", "dpu"];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <div>
          <CardTitle className="text-base">Device Health Heatmap</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            {devices.length} devices monitored
          </p>
        </div>
        <div className="flex items-center gap-3">
          {Object.entries(statusLabels).map(([status, label]) => (
            <div key={status} className="flex items-center gap-1.5">
              <div
                className={cn(
                  "h-2.5 w-2.5 rounded-sm",
                  statusColors[status as DeviceStatus]
                )}
              />
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {typeOrder.map((type) => {
            const typeDevices = groupedDevices[type] || [];
            if (typeDevices.length === 0) return null;

            return (
              <div key={type} className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {type}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ({typeDevices.length})
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {typeDevices.map((device) => (
                    <Tooltip key={device.id}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => onDeviceClick?.(device)}
                          className={cn(
                            "h-6 w-6 rounded-sm transition-all hover:scale-110 hover:ring-2 hover:ring-ring hover:ring-offset-1 hover:ring-offset-background",
                            statusColors[device.status]
                          )}
                          data-testid={`device-cell-${device.id}`}
                        />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">
                        <div className="font-medium">{device.name}</div>
                        <div className="text-muted-foreground">
                          {statusLabels[device.status]} | CPU: {device.cpu}% | Mem: {device.memory}%
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
