import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface KPICardProps {
  title: string;
  value: string | number;
  unit?: string;
  change?: number;
  trend?: "up" | "down" | "neutral";
  description?: string;
  icon?: React.ReactNode;
}

export function KPICard({
  title,
  value,
  unit,
  change,
  trend = "neutral",
  description,
  icon,
}: KPICardProps) {
  const isPositive = trend === "up";
  const isNegative = trend === "down";

  return (
    <Card className="relative overflow-visible">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {icon && (
          <div className="text-muted-foreground">
            {icon}
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-semibold tracking-tight" data-testid={`kpi-${title.toLowerCase().replace(/\s+/g, '-')}`}>
            {value}
          </span>
          {unit && (
            <span className="text-sm text-muted-foreground font-mono">{unit}</span>
          )}
        </div>
        {(change !== undefined || description) && (
          <div className="mt-2 flex items-center gap-2">
            {change !== undefined && (
              <div
                className={cn(
                  "flex items-center gap-0.5 text-xs font-medium",
                  isPositive && "text-status-online",
                  isNegative && "text-status-busy"
                )}
              >
                {isPositive ? (
                  <ArrowUp className="h-3 w-3" />
                ) : isNegative ? (
                  <ArrowDown className="h-3 w-3" />
                ) : null}
                <span>{Math.abs(change)}%</span>
              </div>
            )}
            {description && (
              <span className="text-xs text-muted-foreground">{description}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
