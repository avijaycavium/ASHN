import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useState } from "react";
import type { MetricTrend } from "@shared/schema";

interface MetricChartProps {
  data: MetricTrend[];
  title?: string;
}

const timeRanges = [
  { label: "1H", value: 60 },
  { label: "6H", value: 360 },
  { label: "24H", value: 1440 },
  { label: "7D", value: 10080 },
];

const metricColors = {
  snr: "hsl(var(--chart-1))",
  ber: "hsl(var(--chart-2))",
  fec: "hsl(var(--chart-3))",
  cpu: "hsl(var(--chart-4))",
  latency: "hsl(var(--chart-5))",
};

export function MetricChart({ data, title = "Metric Trends" }: MetricChartProps) {
  const [selectedRange, setSelectedRange] = useState(60);
  const [activeMetrics, setActiveMetrics] = useState<string[]>(["snr", "cpu", "latency"]);

  const toggleMetric = (metric: string) => {
    setActiveMetrics((prev) =>
      prev.includes(metric)
        ? prev.filter((m) => m !== metric)
        : [...prev, metric]
    );
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Real-time metric visualization
          </p>
        </div>
        <div className="flex items-center gap-1">
          {timeRanges.map((range) => (
            <Button
              key={range.value}
              variant={selectedRange === range.value ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setSelectedRange(range.value)}
              className="text-xs px-2"
              data-testid={`range-${range.label}`}
            >
              {range.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2 mb-4">
          {Object.entries(metricColors).map(([metric, color]) => (
            <Button
              key={metric}
              variant="outline"
              size="sm"
              onClick={() => toggleMetric(metric)}
              className="text-xs gap-1.5 toggle-elevate"
              style={{
                borderColor: activeMetrics.includes(metric) ? color : undefined,
                backgroundColor: activeMetrics.includes(metric) ? `${color}15` : undefined,
              }}
              data-testid={`toggle-${metric}`}
            >
              <div
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: color }}
              />
              {metric.toUpperCase()}
            </Button>
          ))}
        </div>

        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
                strokeOpacity={0.5}
              />
              <XAxis
                dataKey="timestamp"
                tickFormatter={formatTime}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                stroke="hsl(var(--border))"
              />
              <YAxis
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                stroke="hsl(var(--border))"
                domain={[0, 100]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "6px",
                  fontSize: "12px",
                }}
                labelFormatter={(label) => formatTime(label as string)}
              />
              <Legend
                wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }}
              />
              {activeMetrics.includes("snr") && (
                <Line
                  type="monotone"
                  dataKey="snr"
                  stroke={metricColors.snr}
                  strokeWidth={2}
                  dot={false}
                  name="SNR"
                />
              )}
              {activeMetrics.includes("ber") && (
                <Line
                  type="monotone"
                  dataKey="ber"
                  stroke={metricColors.ber}
                  strokeWidth={2}
                  dot={false}
                  name="BER"
                />
              )}
              {activeMetrics.includes("fec") && (
                <Line
                  type="monotone"
                  dataKey="fec"
                  stroke={metricColors.fec}
                  strokeWidth={2}
                  dot={false}
                  name="FEC"
                />
              )}
              {activeMetrics.includes("cpu") && (
                <Line
                  type="monotone"
                  dataKey="cpu"
                  stroke={metricColors.cpu}
                  strokeWidth={2}
                  dot={false}
                  name="CPU"
                />
              )}
              {activeMetrics.includes("latency") && (
                <Line
                  type="monotone"
                  dataKey="latency"
                  stroke={metricColors.latency}
                  strokeWidth={2}
                  dot={false}
                  name="Latency"
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
