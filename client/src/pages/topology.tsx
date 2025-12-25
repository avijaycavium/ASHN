import { useQuery } from "@tanstack/react-query";
import { Network, ZoomIn, ZoomOut, Maximize2, RefreshCw, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Device } from "@shared/schema";

const statusColors = {
  healthy: "bg-status-online",
  degraded: "bg-status-away",
  critical: "bg-status-busy",
  offline: "bg-status-offline",
};

export default function TopologyPage() {
  const { data: devices, isLoading } = useQuery<Device[]>({
    queryKey: ["/api/devices"],
  });

  const coreDevices = devices?.filter(d => d.type === "core") || [];
  const spineDevices = devices?.filter(d => d.type === "spine") || [];
  const torDevices = devices?.filter(d => d.type === "tor") || [];
  const dpuDevices = devices?.filter(d => d.type === "dpu") || [];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-4 p-4 border-b border-border bg-card/50">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Network Topology</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Visual representation of network infrastructure
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" data-testid="button-zoom-out">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" data-testid="button-zoom-in">
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" data-testid="button-fullscreen">
            <Maximize2 className="h-4 w-4" />
          </Button>
          <Button variant="outline" className="gap-1.5" data-testid="button-refresh">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <Skeleton className="h-full w-full" />
        ) : (
          <Card className="h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Topology View</CardTitle>
                <div className="flex items-center gap-3">
                  {Object.entries(statusColors).map(([status, color]) => (
                    <div key={status} className="flex items-center gap-1.5">
                      <div className={cn("h-2.5 w-2.5 rounded-full", color)} />
                      <span className="text-xs text-muted-foreground capitalize">{status}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center gap-8 py-8">
                <div className="flex flex-col items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Core Layer</span>
                  <div className="flex items-center gap-4">
                    {coreDevices.map((device) => (
                      <div
                        key={device.id}
                        className="flex flex-col items-center gap-1 p-3 rounded-md bg-muted/50 hover-elevate cursor-pointer"
                        data-testid={`topo-${device.id}`}
                      >
                        <div className={cn(
                          "h-12 w-12 rounded-md flex items-center justify-center",
                          statusColors[device.status]
                        )}>
                          <Network className="h-6 w-6 text-white" />
                        </div>
                        <span className="text-xs font-medium">{device.name}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="w-px h-8 bg-border" />

                <div className="flex flex-col items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Spine Layer</span>
                  <div className="flex items-center gap-3 flex-wrap justify-center">
                    {spineDevices.map((device) => (
                      <div
                        key={device.id}
                        className="flex flex-col items-center gap-1 p-2 rounded-md bg-muted/50 hover-elevate cursor-pointer"
                        data-testid={`topo-${device.id}`}
                      >
                        <div className={cn(
                          "h-10 w-10 rounded-md flex items-center justify-center",
                          statusColors[device.status]
                        )}>
                          <Network className="h-5 w-5 text-white" />
                        </div>
                        <span className="text-xs font-medium">{device.name}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="w-px h-8 bg-border" />

                <div className="flex flex-col items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">TOR Layer</span>
                  <div className="flex items-center gap-2 flex-wrap justify-center">
                    {torDevices.map((device) => (
                      <div
                        key={device.id}
                        className="flex flex-col items-center gap-1 p-2 rounded-md bg-muted/50 hover-elevate cursor-pointer"
                        data-testid={`topo-${device.id}`}
                      >
                        <div className={cn(
                          "h-8 w-8 rounded-md flex items-center justify-center",
                          statusColors[device.status]
                        )}>
                          <Network className="h-4 w-4 text-white" />
                        </div>
                        <span className="text-xs">{device.name}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="w-px h-8 bg-border" />

                <div className="flex flex-col items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">DPU Layer</span>
                  <div className="flex items-center gap-1.5 flex-wrap justify-center max-w-2xl">
                    {dpuDevices.map((device) => (
                      <div
                        key={device.id}
                        className={cn(
                          "h-6 w-6 rounded-sm cursor-pointer transition-all hover:scale-110",
                          statusColors[device.status]
                        )}
                        title={device.name}
                        data-testid={`topo-${device.id}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
