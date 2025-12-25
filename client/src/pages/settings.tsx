import { Settings, Bell, Shield, Database, Users, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";

export default function SettingsPage() {
  const [notifications, setNotifications] = useState({
    criticalAlerts: true,
    highAlerts: true,
    mediumAlerts: false,
    lowAlerts: false,
    emailNotifications: true,
    soundAlerts: false,
  });

  const [autoApproval, setAutoApproval] = useState({
    lowRisk: true,
    mediumRisk: false,
    highRisk: false,
  });

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-4 p-4 border-b border-border bg-card/50">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure system preferences and policies
          </p>
        </div>
        <Button className="gap-1.5" data-testid="button-save-settings">
          <Save className="h-4 w-4" />
          Save Changes
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <Tabs defaultValue="notifications" className="space-y-4">
          <TabsList>
            <TabsTrigger value="notifications" className="gap-1.5" data-testid="tab-notifications">
              <Bell className="h-4 w-4" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="policies" className="gap-1.5" data-testid="tab-policies">
              <Shield className="h-4 w-4" />
              Policies
            </TabsTrigger>
            <TabsTrigger value="system" className="gap-1.5" data-testid="tab-system">
              <Database className="h-4 w-4" />
              System
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-1.5" data-testid="tab-users">
              <Users className="h-4 w-4" />
              Users
            </TabsTrigger>
          </TabsList>

          <TabsContent value="notifications" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Alert Notifications</CardTitle>
                <CardDescription>
                  Configure which alerts trigger notifications
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Critical Alerts</Label>
                    <p className="text-xs text-muted-foreground">
                      Receive notifications for critical severity incidents
                    </p>
                  </div>
                  <Switch
                    checked={notifications.criticalAlerts}
                    onCheckedChange={(checked) =>
                      setNotifications((prev) => ({ ...prev, criticalAlerts: checked }))
                    }
                    data-testid="switch-critical"
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>High Severity Alerts</Label>
                    <p className="text-xs text-muted-foreground">
                      Receive notifications for high severity incidents
                    </p>
                  </div>
                  <Switch
                    checked={notifications.highAlerts}
                    onCheckedChange={(checked) =>
                      setNotifications((prev) => ({ ...prev, highAlerts: checked }))
                    }
                    data-testid="switch-high"
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Medium Severity Alerts</Label>
                    <p className="text-xs text-muted-foreground">
                      Receive notifications for medium severity incidents
                    </p>
                  </div>
                  <Switch
                    checked={notifications.mediumAlerts}
                    onCheckedChange={(checked) =>
                      setNotifications((prev) => ({ ...prev, mediumAlerts: checked }))
                    }
                    data-testid="switch-medium"
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Low Severity Alerts</Label>
                    <p className="text-xs text-muted-foreground">
                      Receive notifications for low severity incidents
                    </p>
                  </div>
                  <Switch
                    checked={notifications.lowAlerts}
                    onCheckedChange={(checked) =>
                      setNotifications((prev) => ({ ...prev, lowAlerts: checked }))
                    }
                    data-testid="switch-low"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Notification Channels</CardTitle>
                <CardDescription>
                  Choose how you receive notifications
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Email Notifications</Label>
                    <p className="text-xs text-muted-foreground">
                      Send alerts to your email address
                    </p>
                  </div>
                  <Switch
                    checked={notifications.emailNotifications}
                    onCheckedChange={(checked) =>
                      setNotifications((prev) => ({ ...prev, emailNotifications: checked }))
                    }
                    data-testid="switch-email"
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Sound Alerts</Label>
                    <p className="text-xs text-muted-foreground">
                      Play sound when new alerts arrive
                    </p>
                  </div>
                  <Switch
                    checked={notifications.soundAlerts}
                    onCheckedChange={(checked) =>
                      setNotifications((prev) => ({ ...prev, soundAlerts: checked }))
                    }
                    data-testid="switch-sound"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="policies" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Auto-Approval Policies</CardTitle>
                <CardDescription>
                  Configure automatic remediation approval thresholds
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Low Risk Remediations</Label>
                    <p className="text-xs text-muted-foreground">
                      Automatically approve low-risk remediation actions
                    </p>
                  </div>
                  <Switch
                    checked={autoApproval.lowRisk}
                    onCheckedChange={(checked) =>
                      setAutoApproval((prev) => ({ ...prev, lowRisk: checked }))
                    }
                    data-testid="switch-low-risk"
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Medium Risk Remediations</Label>
                    <p className="text-xs text-muted-foreground">
                      Automatically approve medium-risk remediation actions
                    </p>
                  </div>
                  <Switch
                    checked={autoApproval.mediumRisk}
                    onCheckedChange={(checked) =>
                      setAutoApproval((prev) => ({ ...prev, mediumRisk: checked }))
                    }
                    data-testid="switch-medium-risk"
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>High Risk Remediations</Label>
                    <p className="text-xs text-muted-foreground">
                      Automatically approve high-risk remediation actions
                    </p>
                  </div>
                  <Switch
                    checked={autoApproval.highRisk}
                    onCheckedChange={(checked) =>
                      setAutoApproval((prev) => ({ ...prev, highRisk: checked }))
                    }
                    data-testid="switch-high-risk"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Confidence Thresholds</CardTitle>
                <CardDescription>
                  Set minimum confidence levels for automated actions
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>RCA Confidence Threshold</Label>
                    <Select defaultValue="90">
                      <SelectTrigger data-testid="select-rca-threshold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="80">80%</SelectItem>
                        <SelectItem value="85">85%</SelectItem>
                        <SelectItem value="90">90%</SelectItem>
                        <SelectItem value="95">95%</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Remediation Confidence Threshold</Label>
                    <Select defaultValue="95">
                      <SelectTrigger data-testid="select-remediation-threshold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="85">85%</SelectItem>
                        <SelectItem value="90">90%</SelectItem>
                        <SelectItem value="95">95%</SelectItem>
                        <SelectItem value="99">99%</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="system" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Data Retention</CardTitle>
                <CardDescription>
                  Configure how long data is retained in the system
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Metrics Retention</Label>
                    <Select defaultValue="30">
                      <SelectTrigger data-testid="select-metrics-retention">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="7">7 days</SelectItem>
                        <SelectItem value="14">14 days</SelectItem>
                        <SelectItem value="30">30 days</SelectItem>
                        <SelectItem value="90">90 days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Audit Log Retention</Label>
                    <Select defaultValue="90">
                      <SelectTrigger data-testid="select-audit-retention">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="30">30 days</SelectItem>
                        <SelectItem value="90">90 days</SelectItem>
                        <SelectItem value="180">180 days</SelectItem>
                        <SelectItem value="365">1 year</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">System Information</CardTitle>
                <CardDescription>
                  Current system version and status
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Version</span>
                    <span className="font-mono">v2.1.0</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Graph Engine</span>
                    <span className="font-mono">v2.1</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Last Updated</span>
                    <span className="font-mono">Dec 25, 2025</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">User Management</CardTitle>
                <CardDescription>
                  Manage user access and roles
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">User management coming soon</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
