import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, useCallback } from "react";
import { Network, ZoomIn, ZoomOut, Maximize2, RefreshCw, X, Server, Activity, Cpu, HardDrive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { queryClient } from "@/lib/queryClient";
import type { Device, TopologyLink, SSEMessage } from "@shared/schema";

const statusColors: Record<string, string> = {
  healthy: "bg-status-online",
  degraded: "bg-status-away",
  critical: "bg-status-busy",
  offline: "bg-status-offline",
};

const statusBorderColors: Record<string, string> = {
  healthy: "border-status-online",
  degraded: "border-status-away",
  critical: "border-status-busy",
  offline: "border-status-offline",
};

export default function TopologyPage() {
  const [isSSEConnected, setIsSSEConnected] = useState(false);
  const [hoveredDeviceId, setHoveredDeviceId] = useState<string | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);

  const { data: devices, isLoading: devicesLoading } = useQuery<Device[]>({
    queryKey: ["/api/devices"],
  });

  const { data: links, isLoading: linksLoading } = useQuery<TopologyLink[]>({
    queryKey: ["/api/topology/links"],
  });

  // Subscribe to SSE for real-time device status updates
  useEffect(() => {
    const eventSource = new EventSource("/api/stream/events");
    
    eventSource.onopen = () => {
      setIsSSEConnected(true);
    };
    
    eventSource.onmessage = (event) => {
      try {
        const message: SSEMessage = JSON.parse(event.data);
        
        if (message.type === "device_status_changed" || 
            message.type === "incident_created" ||
            message.type === "incident_resolved") {
          queryClient.invalidateQueries({ queryKey: ["/api/devices"] });
          queryClient.invalidateQueries({ queryKey: ["/api/topology/links"] });
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

  // Get connected device IDs for a given device
  const getConnectedDeviceIds = useCallback((deviceId: string): Set<string> => {
    const connected = new Set<string>();
    if (!links) return connected;
    
    links.forEach(link => {
      if (link.sourceId === deviceId) {
        connected.add(link.targetId);
      }
      if (link.targetId === deviceId) {
        connected.add(link.sourceId);
      }
    });
    return connected;
  }, [links]);

  // Get links for a given device
  const getDeviceLinks = useCallback((deviceId: string): TopologyLink[] => {
    if (!links) return [];
    return links.filter(link => link.sourceId === deviceId || link.targetId === deviceId);
  }, [links]);

  // Check if device should be highlighted (connected to hovered device)
  const isHighlighted = useCallback((deviceId: string): boolean => {
    if (!hoveredDeviceId) return false;
    if (deviceId === hoveredDeviceId) return true;
    return getConnectedDeviceIds(hoveredDeviceId).has(deviceId);
  }, [hoveredDeviceId, getConnectedDeviceIds]);

  // Handle click outside to close panel
  const handleBackgroundClick = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-device-node]') === null &&
        (e.target as HTMLElement).closest('[data-detail-panel]') === null) {
      setSelectedDevice(null);
    }
  }, []);

  const coreDevices = devices?.filter(d => d.type === "core") || [];
  const spineDevices = devices?.filter(d => d.type === "spine") || [];
  const torDevices = devices?.filter(d => d.type === "tor") || [];
  const endpointDevices = devices?.filter(d => d.type === "endpoint") || [];

  const isLoading = devicesLoading || linksLoading;

  // Device node component with hover and click handlers
  const DeviceNode = ({ 
    device, 
    size = "md",
    showLabel = true 
  }: { 
    device: Device; 
    size?: "sm" | "md" | "lg";
    showLabel?: boolean;
  }) => {
    const sizeClasses = {
      sm: "h-6 w-6",
      md: "h-10 w-10",
      lg: "h-12 w-12",
    };
    const iconSizes = {
      sm: "h-3 w-3",
      md: "h-5 w-5",
      lg: "h-6 w-6",
    };
    
    const highlighted = isHighlighted(device.id);
    const isHovered = hoveredDeviceId === device.id;
    const isSelected = selectedDevice?.id === device.id;
    const dimmed = hoveredDeviceId !== null && !highlighted;

    return (
      <div
        data-device-node
        className={cn(
          "flex flex-col items-center gap-1 p-2 rounded-md cursor-pointer transition-all duration-200",
          size === "lg" && "p-3",
          dimmed ? "opacity-30" : "opacity-100",
          isHovered && "ring-2 ring-primary ring-offset-2",
          isSelected && "ring-2 ring-primary",
          !dimmed && "hover-elevate"
        )}
        onMouseEnter={() => setHoveredDeviceId(device.id)}
        onMouseLeave={() => setHoveredDeviceId(null)}
        onClick={(e) => {
          e.stopPropagation();
          setSelectedDevice(device);
        }}
        data-testid={`topo-${device.id}`}
      >
        <div className={cn(
          "rounded-md flex items-center justify-center transition-all",
          sizeClasses[size],
          statusColors[device.status],
          highlighted && "scale-110 shadow-lg"
        )}>
          <Network className={cn(iconSizes[size], "text-white")} />
        </div>
        {showLabel && (
          <span className={cn(
            "font-medium transition-colors",
            size === "sm" ? "text-xs" : "text-xs",
            highlighted && "text-primary"
          )}>
            {device.name}
          </span>
        )}
      </div>
    );
  };

  // Detail panel for selected device
  const DetailPanel = () => {
    if (!selectedDevice) return null;
    
    const deviceLinks = getDeviceLinks(selectedDevice.id);
    const connectedIds = getConnectedDeviceIds(selectedDevice.id);
    const connectedDevices = devices?.filter(d => connectedIds.has(d.id)) || [];

    return (
      <div 
        data-detail-panel
        className="absolute right-0 top-0 h-full w-80 bg-card border-l border-border shadow-lg z-10 animate-in slide-in-from-right duration-200"
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-semibold">Device Details</h3>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setSelectedDevice(null)}
            data-testid="button-close-detail"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <ScrollArea className="h-[calc(100%-60px)]">
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className={cn(
                "h-12 w-12 rounded-md flex items-center justify-center",
                statusColors[selectedDevice.status]
              )}>
                <Server className="h-6 w-6 text-white" />
              </div>
              <div>
                <h4 className="font-medium">{selectedDevice.name}</h4>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-xs capitalize">{selectedDevice.type}</Badge>
                  <Badge 
                    className={cn("text-xs capitalize", statusColors[selectedDevice.status], "text-white")}
                  >
                    {selectedDevice.status}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Cpu className="h-3.5 w-3.5" /> CPU
                  </span>
                  <span className="font-medium">{selectedDevice.cpu}%</span>
                </div>
                <Progress value={selectedDevice.cpu} className="h-2" />
              </div>
              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <HardDrive className="h-3.5 w-3.5" /> Memory
                  </span>
                  <span className="font-medium">{selectedDevice.memory}%</span>
                </div>
                <Progress value={selectedDevice.memory} className="h-2" />
              </div>
            </div>

            <div>
              <h5 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                <Activity className="h-4 w-4" />
                Connections ({deviceLinks.length})
              </h5>
              <div className="space-y-2">
                {connectedDevices.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No connections found</p>
                ) : (
                  connectedDevices.map(connDevice => {
                    const link = deviceLinks.find(l => 
                      l.sourceId === connDevice.id || l.targetId === connDevice.id
                    );
                    return (
                      <div 
                        key={connDevice.id}
                        className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                      >
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "h-6 w-6 rounded flex items-center justify-center",
                            statusColors[connDevice.status]
                          )}>
                            <Network className="h-3 w-3 text-white" />
                          </div>
                          <div>
                            <span className="text-sm font-medium">{connDevice.name}</span>
                            <span className="text-xs text-muted-foreground ml-2">({connDevice.type})</span>
                          </div>
                        </div>
                        {link && (
                          <span className="text-xs text-muted-foreground">
                            Port {link.sourceId === selectedDevice.id ? link.sourcePort : link.targetPort}
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

          </div>
        </ScrollArea>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full" onClick={handleBackgroundClick}>
      <div className="flex items-center justify-between gap-4 p-4 border-b border-border bg-card/50">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Network Topology</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {devices?.length || 0} devices, {links?.length || 0} connections
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
          <Button 
            variant="outline" 
            className="gap-1.5" 
            data-testid="button-refresh"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ["/api/devices"] });
              queryClient.invalidateQueries({ queryKey: ["/api/topology/links"] });
            }}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative">
        {isLoading ? (
          <div className="p-4">
            <Skeleton className="h-full w-full" />
          </div>
        ) : (
          <div className="h-full overflow-auto p-4">
            <Card className="h-full min-h-[600px]">
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
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Core Layer ({coreDevices.length})
                    </span>
                    <div className="flex items-center gap-4">
                      {coreDevices.map((device) => (
                        <DeviceNode key={device.id} device={device} size="lg" />
                      ))}
                    </div>
                  </div>

                  <div className="w-px h-8 bg-border" />

                  <div className="flex flex-col items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Spine Layer ({spineDevices.length})
                    </span>
                    <div className="flex items-center gap-3 flex-wrap justify-center">
                      {spineDevices.map((device) => (
                        <DeviceNode key={device.id} device={device} size="md" />
                      ))}
                    </div>
                  </div>

                  <div className="w-px h-8 bg-border" />

                  <div className="flex flex-col items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      TOR Layer ({torDevices.length})
                    </span>
                    <div className="flex items-center gap-2 flex-wrap justify-center max-w-4xl">
                      {torDevices.map((device) => (
                        <DeviceNode key={device.id} device={device} size="md" />
                      ))}
                    </div>
                  </div>

                  <div className="w-px h-8 bg-border" />

                  <div className="flex flex-col items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Endpoint Layer ({endpointDevices.length})
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap justify-center max-w-4xl">
                      {endpointDevices.map((device) => {
                        const highlighted = isHighlighted(device.id);
                        const isHovered = hoveredDeviceId === device.id;
                        const isSelected = selectedDevice?.id === device.id;
                        const dimmed = hoveredDeviceId !== null && !highlighted;
                        
                        return (
                          <div
                            key={device.id}
                            data-device-node
                            className={cn(
                              "h-6 w-6 rounded-sm cursor-pointer transition-all duration-200",
                              statusColors[device.status],
                              dimmed ? "opacity-30" : "opacity-100",
                              isHovered && "ring-2 ring-primary ring-offset-1 scale-125",
                              isSelected && "ring-2 ring-primary",
                              highlighted && !isHovered && "scale-110"
                            )}
                            title={device.name}
                            onMouseEnter={() => setHoveredDeviceId(device.id)}
                            onMouseLeave={() => setHoveredDeviceId(null)}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDevice(device);
                            }}
                            data-testid={`topo-${device.id}`}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <DetailPanel />
      </div>
    </div>
  );
}
