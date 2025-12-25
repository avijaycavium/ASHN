import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { 
  Send, 
  Trash2, 
  Loader2, 
  Network, 
  Plus, 
  Minus, 
  Play, 
  Square,
  Link2,
  Info,
  AlertCircle,
  CheckCircle2,
  RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface CopilotAction {
  type: "create_node" | "delete_node" | "start_node" | "stop_node" | "create_link" | "delete_link" | "list_nodes" | "list_templates" | "info" | "error";
  description: string;
  result?: unknown;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  actions?: CopilotAction[];
  timestamp: Date;
}

interface GNS3Status {
  enabled: boolean;
  connected: boolean;
  serverUrl?: string;
  projectId?: string;
  version?: string;
  project?: {
    name: string;
    status: string;
  };
  message: string;
}

const ACTION_ICONS = {
  create_node: Plus,
  delete_node: Minus,
  start_node: Play,
  stop_node: Square,
  create_link: Link2,
  delete_link: Minus,
  list_nodes: Network,
  list_templates: Network,
  info: Info,
  error: AlertCircle,
};

const ACTION_COLORS = {
  create_node: "bg-status-online text-white",
  delete_node: "bg-status-busy text-white",
  start_node: "bg-status-online text-white",
  stop_node: "bg-status-away text-black",
  create_link: "bg-primary text-primary-foreground",
  delete_link: "bg-status-busy text-white",
  list_nodes: "bg-muted text-muted-foreground",
  list_templates: "bg-muted text-muted-foreground",
  info: "bg-muted text-muted-foreground",
  error: "bg-destructive text-destructive-foreground",
};

const EXAMPLE_COMMANDS = [
  "List all available templates",
  "Show me the current nodes",
  "Create a new router using the Cisco IOSv template",
  "Start all nodes",
  "Create a link between Router-1 and Switch-1",
  "Stop node Router-2",
];

export default function CopilotPage() {
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: gns3Status, isLoading: loadingStatus } = useQuery<GNS3Status>({
    queryKey: ["/api/gns3/status"],
  });

  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      const response = await apiRequest("POST", "/api/copilot/chat", { message });
      return response.json();
    },
    onSuccess: (data, message) => {
      const actions = data.actions as CopilotAction[];
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: actions.map(a => a.description).join("\n"),
        actions,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);
      
      const hasError = actions.some(a => a.type === "error");
      if (hasError) {
        toast({
          title: "Action Failed",
          description: actions.find(a => a.type === "error")?.description,
          variant: "destructive",
        });
      } else if (actions.some(a => ["create_node", "delete_node", "start_node", "stop_node", "create_link", "delete_link"].includes(a.type))) {
        toast({
          title: "Action Completed",
          description: actions.map(a => a.description).join(", "),
        });
      }
    },
    onError: (error) => {
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: error instanceof Error ? error.message : "Failed to process command",
        actions: [{ type: "error", description: "An error occurred while processing your request" }],
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to process command",
        variant: "destructive",
      });
    },
  });

  const clearMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/copilot/clear");
      return response.json();
    },
    onSuccess: () => {
      setMessages([]);
      toast({
        title: "Conversation Cleared",
        description: "Chat history has been reset",
      });
    },
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || chatMutation.isPending) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: input,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    chatMutation.mutate(input);
    setInput("");
  };

  const handleExampleClick = (command: string) => {
    setInput(command);
    inputRef.current?.focus();
  };

  const isGNS3Available = gns3Status?.enabled && gns3Status?.connected;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-4 p-4 border-b border-border bg-card/50">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Network Copilot</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your GNS3 network topology using natural language
          </p>
        </div>
        <div className="flex items-center gap-2">
          {loadingStatus ? (
            <Badge variant="secondary" className="gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              Checking
            </Badge>
          ) : isGNS3Available ? (
            <Badge className="gap-1 bg-status-online text-white">
              <CheckCircle2 className="h-3 w-3" />
              GNS3 Connected
            </Badge>
          ) : (
            <Badge variant="destructive" className="gap-1">
              <AlertCircle className="h-3 w-3" />
              {gns3Status?.enabled ? "GNS3 Disconnected" : "GNS3 Disabled"}
            </Badge>
          )}
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-1.5"
            onClick={() => clearMutation.mutate()}
            disabled={clearMutation.isPending || messages.length === 0}
            data-testid="button-clear-chat"
          >
            {clearMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Clear Chat
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col">
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Network className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-lg font-semibold mb-2">Welcome to Network Copilot</h2>
                <p className="text-sm text-muted-foreground max-w-md mb-6">
                  {isGNS3Available 
                    ? "I can help you create nodes, links, start/stop devices, and manage your GNS3 network topology. Try one of the examples below or type your own command."
                    : "Connect to a GNS3 server in Settings to start managing your network topology with natural language commands."}
                </p>
                
                {isGNS3Available && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-w-2xl">
                    {EXAMPLE_COMMANDS.map((command, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        className="justify-start text-left h-auto py-2 px-3 text-sm"
                        onClick={() => handleExampleClick(command)}
                        data-testid={`button-example-${index}`}
                      >
                        {command}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg p-3 ${
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      
                      {message.actions && message.actions.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {message.actions.map((action, index) => {
                            const Icon = ACTION_ICONS[action.type] || Info;
                            const colorClass = ACTION_COLORS[action.type] || "bg-muted";
                            return (
                              <div
                                key={index}
                                className="flex items-start gap-2 p-2 rounded bg-background/50"
                              >
                                <Badge className={`shrink-0 ${colorClass}`}>
                                  <Icon className="h-3 w-3" />
                                </Badge>
                                <span className="text-xs">{action.description}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      
                      <p className="text-xs opacity-60 mt-2">
                        {message.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
                
                {chatMutation.isPending && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-lg p-3">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm text-muted-foreground">Processing...</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          <div className="p-4 border-t border-border">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={isGNS3Available ? "Type a command... (e.g., 'Create a new router')" : "Connect to GNS3 first..."}
                disabled={!isGNS3Available || chatMutation.isPending}
                className="flex-1"
                data-testid="input-copilot-message"
              />
              <Button 
                type="submit" 
                disabled={!isGNS3Available || !input.trim() || chatMutation.isPending}
                data-testid="button-send-message"
              >
                {chatMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </form>
          </div>
        </div>

        <div className="w-80 border-l border-border p-4 hidden lg:block">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">GNS3 Status</CardTitle>
              <CardDescription className="text-xs">
                Current connection information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {gns3Status && (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <Badge className={isGNS3Available ? "bg-status-online text-white" : "bg-status-offline text-white"}>
                      {isGNS3Available ? "Connected" : "Disconnected"}
                    </Badge>
                  </div>
                  {gns3Status.serverUrl && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Server</span>
                      <span className="font-mono text-xs truncate max-w-32">{gns3Status.serverUrl}</span>
                    </div>
                  )}
                  {gns3Status.version && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Version</span>
                      <span className="font-mono">v{gns3Status.version}</span>
                    </div>
                  )}
                  {gns3Status.project && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Project</span>
                      <span className="truncate max-w-32">{gns3Status.project.name}</span>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Separator className="my-4" />

          <div className="space-y-2">
            <h4 className="text-sm font-medium">Quick Commands</h4>
            <div className="space-y-1">
              {[
                "List templates",
                "List nodes",
                "Start all nodes",
                "Stop all nodes",
              ].map((cmd, i) => (
                <Button
                  key={i}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-xs h-8"
                  onClick={() => handleExampleClick(cmd)}
                  disabled={!isGNS3Available}
                  data-testid={`quick-command-${i}`}
                >
                  {cmd}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
