import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Brain, Sparkles } from "lucide-react";
import type { LearningUpdate } from "@shared/schema";

interface LearningUpdatesProps {
  updates: LearningUpdate[];
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export function LearningUpdatesCard({ updates }: LearningUpdatesProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <div>
          <CardTitle className="text-base">Recent Learning Updates</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            AI-powered pattern recognition
          </p>
        </div>
        <Brain className="h-5 w-5 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-48">
          <div className="space-y-3 pr-4">
            {updates.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Sparkles className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm font-medium">No Recent Updates</p>
                <p className="text-xs text-muted-foreground">
                  Learning patterns will appear here
                </p>
              </div>
            ) : (
              updates.map((update) => (
                <div
                  key={update.id}
                  className="flex items-start gap-3 p-2 rounded-md hover-elevate"
                  data-testid={`learning-${update.id}`}
                >
                  <div className="mt-0.5">
                    <Sparkles className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium truncate">
                        {update.pattern}
                      </span>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatTimeAgo(update.timestamp)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {update.description}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
