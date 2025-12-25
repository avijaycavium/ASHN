import { useQuery } from "@tanstack/react-query";
import { 
  Server, 
  Search, 
  Filter,
  Plus,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Wifi
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useState } from "react";
import type { Device, DeviceStatus, DeviceType } from "@shared/schema";

const statusConfig: Record<DeviceStatus, { color: string; icon: React.ReactNode; label: string }> = {
  healthy: { 
    color: "bg-status-online text-white", 
    icon: <CheckCircle2 className="h-3 w-3" />,
    label: "Healthy"
  },
  degraded: { 
    color: "bg-status-away text-black", 
    icon: <AlertTriangle className="h-3 w-3" />,
    label: "Degraded"
  },
  critical: { 
    color: "bg-status-busy text-white", 
    icon: <XCircle className="h-3 w-3" />,
    label: "Critical"
  },
  offline: { 
    color: "bg-status-offline text-white", 
    icon: <Wifi className="h-3 w-3" />,
    label: "Offline"
  },
};

const typeLabels: Record<DeviceType, string> = {
  core: "Core Router",
  spine: "Spine Switch",
  tor: "Top of Rack",
  dpu: "DPU",
};

export default function DevicesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: devices, isLoading } = useQuery<Device[]>({
    queryKey: ["/api/devices"],
  });

  const filteredDevices = devices?.filter((device) => {
    const matchesSearch = 
      device.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      device.ipAddress.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === "all" || device.type === typeFilter;
    const matchesStatus = statusFilter === "all" || device.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  const stats = {
    total: devices?.length || 0,
    healthy: devices?.filter(d => d.status === "healthy").length || 0,
    degraded: devices?.filter(d => d.status === "degraded").length || 0,
    critical: devices?.filter(d => d.status === "critical").length || 0,
    offline: devices?.filter(d => d.status === "offline").length || 0,
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-4 p-4 border-b border-border bg-card/50">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Devices</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Network device inventory and status
          </p>
        </div>
        <Button className="gap-1.5" data-testid="button-add-device">
          <Plus className="h-4 w-4" />
          Add Device
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Devices</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-semibold" data-testid="stat-total">{stats.total}</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-status-online" />
                Healthy
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-semibold text-status-online" data-testid="stat-healthy">{stats.healthy}</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-status-away" />
                Degraded
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-semibold text-status-away" data-testid="stat-degraded">{stats.degraded}</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-status-busy" />
                Critical
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-semibold text-status-busy" data-testid="stat-critical">{stats.critical}</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-status-offline" />
                Offline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-semibold text-status-offline" data-testid="stat-offline">{stats.offline}</span>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search devices..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-devices"
                />
              </div>
              <div className="flex items-center gap-2">
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-36" data-testid="select-type">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="core">Core Router</SelectItem>
                    <SelectItem value="spine">Spine Switch</SelectItem>
                    <SelectItem value="tor">Top of Rack</SelectItem>
                    <SelectItem value="dpu">DPU</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-36" data-testid="select-status">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="healthy">Healthy</SelectItem>
                    <SelectItem value="degraded">Degraded</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="offline">Offline</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-16" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead className="w-32">Type</TableHead>
                    <TableHead className="w-28">Status</TableHead>
                    <TableHead className="w-36">IP Address</TableHead>
                    <TableHead className="w-24">CPU</TableHead>
                    <TableHead className="w-24">Memory</TableHead>
                    <TableHead className="w-24">Ports</TableHead>
                    <TableHead className="w-28">Location</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDevices?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8">
                        <div className="flex flex-col items-center gap-2">
                          <Server className="h-8 w-8 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">No devices found</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredDevices?.map((device) => {
                      const statConfig = statusConfig[device.status];
                      return (
                        <TableRow key={device.id} className="cursor-pointer hover-elevate" data-testid={`row-${device.id}`}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Server className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{device.name}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {typeLabels[device.type]}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge className={cn("gap-1 text-xs", statConfig.color)}>
                              {statConfig.icon}
                              {statConfig.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-sm">{device.ipAddress}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress value={device.cpu} className="w-12 h-1.5" />
                              <span className="text-xs font-mono">{device.cpu}%</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress value={device.memory} className="w-12 h-1.5" />
                              <span className="text-xs font-mono">{device.memory}%</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            {device.activePorts}/{device.ports}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {device.location}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
