import OpenAI from "openai";
import { z } from "zod";
import { getGNS3Client, getGNS3Config } from "./gns3";
import type { GNS3Node, GNS3Link, GNS3Template } from "./gns3";

const CreateNodeAction = z.object({
  action: z.literal("create_node"),
  template: z.string().min(1),
  name: z.string().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
});

const DeleteNodeAction = z.object({
  action: z.literal("delete_node"),
  node_id: z.string().min(1),
});

const StartNodeAction = z.object({
  action: z.literal("start_node"),
  node_id: z.string().min(1),
});

const StopNodeAction = z.object({
  action: z.literal("stop_node"),
  node_id: z.string().min(1),
});

const CreateLinkAction = z.object({
  action: z.literal("create_link"),
  source_node: z.string().min(1),
  source_port: z.number().int().min(0).default(0),
  target_node: z.string().min(1),
  target_port: z.number().int().min(0).default(0),
});

const DeleteLinkAction = z.object({
  action: z.literal("delete_link"),
  link_id: z.string().min(1),
});

const ListNodesAction = z.object({
  action: z.literal("list_nodes"),
});

const ListTemplatesAction = z.object({
  action: z.literal("list_templates"),
});

const InfoAction = z.object({
  action: z.literal("info"),
  message: z.string(),
});

const CopilotActionSchema = z.discriminatedUnion("action", [
  CreateNodeAction,
  DeleteNodeAction,
  StartNodeAction,
  StopNodeAction,
  CreateLinkAction,
  DeleteLinkAction,
  ListNodesAction,
  ListTemplatesAction,
  InfoAction,
]);

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export interface CopilotAction {
  type: "create_node" | "delete_node" | "start_node" | "stop_node" | "create_link" | "delete_link" | "list_nodes" | "list_templates" | "info" | "error";
  description: string;
  result?: unknown;
}

export interface TopologyContext {
  nodes: GNS3Node[];
  links: GNS3Link[];
  templates: GNS3Template[];
}

const SYSTEM_PROMPT = `You are a network topology assistant for GNS3 network simulation. You help users manage their network topology through natural language commands.

You can perform the following actions:
- Create nodes from templates (routers, switches, hosts)
- Delete nodes
- Start/stop nodes
- Create links between nodes
- Delete links
- List current topology (nodes, links)
- List available templates

When the user asks you to do something, respond with a JSON object that describes the action to take. Use this format:

For creating a node:
{"action": "create_node", "template": "<template_name>", "name": "<optional_node_name>", "x": <x_position>, "y": <y_position>}

For deleting a node:
{"action": "delete_node", "node_id": "<node_id or node_name>"}

For starting a node:
{"action": "start_node", "node_id": "<node_id or node_name>"}

For stopping a node:
{"action": "stop_node", "node_id": "<node_id or node_name>"}

For creating a link:
{"action": "create_link", "source_node": "<node_id or name>", "source_port": <port_number>, "target_node": "<node_id or name>", "target_port": <port_number>}

For deleting a link:
{"action": "delete_link", "link_id": "<link_id>"}

For listing nodes:
{"action": "list_nodes"}

For listing templates:
{"action": "list_templates"}

For informational responses (when no action is needed):
{"action": "info", "message": "<your response>"}

IMPORTANT: 
- Always respond with valid JSON only, no additional text
- Use the exact template names from the available templates list
- When referring to nodes, you can use either the node_id or the node name
- Port numbers start from 0
- If you're unsure about something, ask for clarification in an "info" response

Current topology context will be provided with each message.`;

export class NetworkCopilot {
  private conversationHistory: Array<{ role: "user" | "assistant" | "system"; content: string }> = [];

  constructor() {
    this.conversationHistory = [{ role: "system", content: SYSTEM_PROMPT }];
  }

  async processCommand(userMessage: string): Promise<CopilotAction[]> {
    const client = getGNS3Client();
    const config = getGNS3Config();

    if (!client || !config.enabled) {
      return [{
        type: "error",
        description: "GNS3 is not configured. Please enable GNS3 in Settings and provide connection details.",
      }];
    }

    try {
      const context = await this.getTopologyContext(client);
      const contextMessage = this.formatContextMessage(context);
      
      this.conversationHistory.push({
        role: "user",
        content: `${contextMessage}\n\nUser request: ${userMessage}`,
      });

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: this.conversationHistory,
        max_tokens: 1024,
        temperature: 0.3,
      });

      const assistantMessage = response.choices[0]?.message?.content || "";
      this.conversationHistory.push({
        role: "assistant",
        content: assistantMessage,
      });

      const actions = await this.parseAndExecuteResponse(assistantMessage, context, client);
      return actions;
    } catch (error) {
      console.error("Copilot error:", error);
      return [{
        type: "error",
        description: error instanceof Error ? error.message : "An error occurred processing your request",
      }];
    }
  }

  private async getTopologyContext(client: ReturnType<typeof getGNS3Client>): Promise<TopologyContext> {
    if (!client) {
      return { nodes: [], links: [], templates: [] };
    }

    try {
      const [nodes, links, templates] = await Promise.all([
        client.getNodes().catch(() => []),
        client.getLinks().catch(() => []),
        client.getTemplates().catch(() => []),
      ]);
      return { nodes, links, templates };
    } catch {
      return { nodes: [], links: [], templates: [] };
    }
  }

  private formatContextMessage(context: TopologyContext): string {
    const nodesInfo = context.nodes.length > 0
      ? context.nodes.map(n => `  - ${n.name} (ID: ${n.node_id}, Type: ${n.node_type}, Status: ${n.status})`).join("\n")
      : "  No nodes in topology";

    const linksInfo = context.links.length > 0
      ? context.links.map(l => {
          const n1 = context.nodes.find(n => n.node_id === l.nodes[0]?.node_id)?.name || l.nodes[0]?.node_id;
          const n2 = context.nodes.find(n => n.node_id === l.nodes[1]?.node_id)?.name || l.nodes[1]?.node_id;
          return `  - ${n1}:port${l.nodes[0]?.port_number} <-> ${n2}:port${l.nodes[1]?.port_number} (ID: ${l.link_id})`;
        }).join("\n")
      : "  No links in topology";

    const templatesInfo = context.templates.length > 0
      ? context.templates.map(t => `  - ${t.name} (Type: ${t.template_type})`).join("\n")
      : "  No templates available";

    return `Current Topology Context:

NODES:
${nodesInfo}

LINKS:
${linksInfo}

AVAILABLE TEMPLATES:
${templatesInfo}`;
  }

  private async parseAndExecuteResponse(
    response: string,
    context: TopologyContext,
    client: NonNullable<ReturnType<typeof getGNS3Client>>
  ): Promise<CopilotAction[]> {
    const actions: CopilotAction[] = [];

    try {
      let rawParsed;
      try {
        rawParsed = JSON.parse(response.trim());
      } catch {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          rawParsed = JSON.parse(jsonMatch[0]);
        } else {
          return [{
            type: "info",
            description: response,
          }];
        }
      }

      const validationResult = CopilotActionSchema.safeParse(rawParsed);
      if (!validationResult.success) {
        console.warn("Invalid action format from AI:", validationResult.error.issues);
        return [{
          type: "info",
          description: rawParsed.message || "I'm not sure how to process that request. Could you rephrase it?",
        }];
      }

      const parsed = validationResult.data;
      const actionType = parsed.action;

      switch (actionType) {
        case "create_node": {
          const parsedAction = parsed as z.infer<typeof CreateNodeAction>;
          const template = context.templates.find(
            t => t.name.toLowerCase() === parsedAction.template.toLowerCase() ||
                 t.template_id === parsedAction.template
          );
          if (!template) {
            const availableTemplates = context.templates.map(t => t.name).slice(0, 10).join(", ");
            actions.push({
              type: "error",
              description: `Template "${parsedAction.template}" not found. Available templates: ${availableTemplates || "none"}`,
            });
          } else {
            try {
              const node = await client.createNodeFromTemplate(template.template_id, {
                name: parsedAction.name,
                x: parsedAction.x ?? Math.floor(Math.random() * 400),
                y: parsedAction.y ?? Math.floor(Math.random() * 300),
              });
              actions.push({
                type: "create_node",
                description: `Created node "${node.name}" from template "${template.name}"`,
                result: node,
              });
            } catch (err) {
              actions.push({
                type: "error",
                description: `Failed to create node: ${err instanceof Error ? err.message : "Unknown error"}`,
              });
            }
          }
          break;
        }

        case "delete_node": {
          const parsedAction = parsed as z.infer<typeof DeleteNodeAction>;
          const node = this.findNode(parsedAction.node_id, context.nodes);
          if (!node) {
            const availableNodes = context.nodes.map(n => n.name).slice(0, 10).join(", ");
            actions.push({
              type: "error",
              description: `Node "${parsedAction.node_id}" not found. Available nodes: ${availableNodes || "none"}`,
            });
          } else {
            try {
              await client.deleteNode(node.node_id);
              actions.push({
                type: "delete_node",
                description: `Deleted node "${node.name}"`,
              });
            } catch (err) {
              actions.push({
                type: "error",
                description: `Failed to delete node: ${err instanceof Error ? err.message : "Unknown error"}`,
              });
            }
          }
          break;
        }

        case "start_node": {
          const parsedAction = parsed as z.infer<typeof StartNodeAction>;
          const node = this.findNode(parsedAction.node_id, context.nodes);
          if (!node) {
            const availableNodes = context.nodes.map(n => n.name).slice(0, 10).join(", ");
            actions.push({
              type: "error",
              description: `Node "${parsedAction.node_id}" not found. Available nodes: ${availableNodes || "none"}`,
            });
          } else if (node.status === "started") {
            actions.push({
              type: "info",
              description: `Node "${node.name}" is already running`,
            });
          } else {
            try {
              await client.startNode(node.node_id);
              actions.push({
                type: "start_node",
                description: `Started node "${node.name}"`,
              });
            } catch (err) {
              actions.push({
                type: "error",
                description: `Failed to start node: ${err instanceof Error ? err.message : "Unknown error"}`,
              });
            }
          }
          break;
        }

        case "stop_node": {
          const parsedAction = parsed as z.infer<typeof StopNodeAction>;
          const node = this.findNode(parsedAction.node_id, context.nodes);
          if (!node) {
            const availableNodes = context.nodes.map(n => n.name).slice(0, 10).join(", ");
            actions.push({
              type: "error",
              description: `Node "${parsedAction.node_id}" not found. Available nodes: ${availableNodes || "none"}`,
            });
          } else if (node.status === "stopped") {
            actions.push({
              type: "info",
              description: `Node "${node.name}" is already stopped`,
            });
          } else {
            try {
              await client.stopNode(node.node_id);
              actions.push({
                type: "stop_node",
                description: `Stopped node "${node.name}"`,
              });
            } catch (err) {
              actions.push({
                type: "error",
                description: `Failed to stop node: ${err instanceof Error ? err.message : "Unknown error"}`,
              });
            }
          }
          break;
        }

        case "create_link": {
          const parsedAction = parsed as z.infer<typeof CreateLinkAction>;
          const sourceNode = this.findNode(parsedAction.source_node, context.nodes);
          const targetNode = this.findNode(parsedAction.target_node, context.nodes);
          
          if (!sourceNode || !targetNode) {
            const availableNodes = context.nodes.map(n => n.name).slice(0, 10).join(", ");
            actions.push({
              type: "error",
              description: `Could not find nodes: ${!sourceNode ? parsedAction.source_node : ""} ${!targetNode ? parsedAction.target_node : ""}. Available nodes: ${availableNodes || "none"}`.trim(),
            });
          } else if (sourceNode.node_id === targetNode.node_id) {
            actions.push({
              type: "error",
              description: "Cannot create a link from a node to itself",
            });
          } else {
            try {
              const link = await client.createLink({
                nodes: [
                  { node_id: sourceNode.node_id, adapter_number: 0, port_number: parsedAction.source_port },
                  { node_id: targetNode.node_id, adapter_number: 0, port_number: parsedAction.target_port },
                ],
              });
              actions.push({
                type: "create_link",
                description: `Created link between "${sourceNode.name}:port${parsedAction.source_port}" and "${targetNode.name}:port${parsedAction.target_port}"`,
                result: link,
              });
            } catch (err) {
              actions.push({
                type: "error",
                description: `Failed to create link: ${err instanceof Error ? err.message : "Unknown error"}`,
              });
            }
          }
          break;
        }

        case "delete_link": {
          const parsedAction = parsed as z.infer<typeof DeleteLinkAction>;
          const link = context.links.find(l => l.link_id === parsedAction.link_id);
          if (!link) {
            actions.push({
              type: "error",
              description: `Link "${parsedAction.link_id}" not found in current topology`,
            });
          } else {
            try {
              await client.deleteLink(link.link_id);
              actions.push({
                type: "delete_link",
                description: `Deleted link ${link.link_id}`,
              });
            } catch (err) {
              actions.push({
                type: "error",
                description: `Failed to delete link: ${err instanceof Error ? err.message : "Unknown error"}`,
              });
            }
          }
          break;
        }

        case "list_nodes": {
          const nodesList = context.nodes.length > 0
            ? context.nodes.map(n => `${n.name} (${n.status})`).join(", ")
            : "No nodes in topology";
          actions.push({
            type: "list_nodes",
            description: `Current nodes: ${nodesList}`,
            result: context.nodes,
          });
          break;
        }

        case "list_templates": {
          const templatesList = context.templates.length > 0
            ? context.templates.map(t => `${t.name} (${t.template_type})`).join(", ")
            : "No templates available";
          actions.push({
            type: "list_templates",
            description: `Available templates: ${templatesList}`,
            result: context.templates,
          });
          break;
        }

        case "info": {
          const parsedAction = parsed as z.infer<typeof InfoAction>;
          actions.push({
            type: "info",
            description: parsedAction.message,
          });
          break;
        }
      }
    } catch (error) {
      actions.push({
        type: "error",
        description: error instanceof Error ? error.message : "Failed to process response",
      });
    }

    return actions;
  }

  private findNode(identifier: string, nodes: GNS3Node[]): GNS3Node | undefined {
    if (!identifier) return undefined;
    const lowerIdentifier = identifier.toLowerCase();
    return nodes.find(
      n => n.node_id === identifier || n.name.toLowerCase() === lowerIdentifier
    );
  }

  clearHistory(): void {
    this.conversationHistory = [{ role: "system", content: SYSTEM_PROMPT }];
  }
}

let copilotInstance: NetworkCopilot | null = null;

export function getCopilot(): NetworkCopilot {
  if (!copilotInstance) {
    copilotInstance = new NetworkCopilot();
  }
  return copilotInstance;
}
