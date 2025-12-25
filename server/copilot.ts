import OpenAI from "openai";
import { getGNS3Client, getGNS3Config } from "./gns3";
import type { GNS3Node, GNS3Link, GNS3Template } from "./gns3";

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
      let parsed;
      try {
        parsed = JSON.parse(response.trim());
      } catch {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        } else {
          return [{
            type: "info",
            description: response,
          }];
        }
      }

      const actionType = parsed.action;

      switch (actionType) {
        case "create_node": {
          const template = context.templates.find(
            t => t.name.toLowerCase() === parsed.template?.toLowerCase() ||
                 t.template_id === parsed.template
          );
          if (!template) {
            actions.push({
              type: "error",
              description: `Template "${parsed.template}" not found. Available templates: ${context.templates.map(t => t.name).join(", ")}`,
            });
          } else {
            const node = await client.createNodeFromTemplate(template.template_id, {
              name: parsed.name,
              x: parsed.x ?? Math.floor(Math.random() * 400),
              y: parsed.y ?? Math.floor(Math.random() * 300),
            });
            actions.push({
              type: "create_node",
              description: `Created node "${node.name}" from template "${template.name}"`,
              result: node,
            });
          }
          break;
        }

        case "delete_node": {
          const node = this.findNode(parsed.node_id, context.nodes);
          if (!node) {
            actions.push({
              type: "error",
              description: `Node "${parsed.node_id}" not found`,
            });
          } else {
            await client.deleteNode(node.node_id);
            actions.push({
              type: "delete_node",
              description: `Deleted node "${node.name}"`,
            });
          }
          break;
        }

        case "start_node": {
          const node = this.findNode(parsed.node_id, context.nodes);
          if (!node) {
            actions.push({
              type: "error",
              description: `Node "${parsed.node_id}" not found`,
            });
          } else {
            await client.startNode(node.node_id);
            actions.push({
              type: "start_node",
              description: `Started node "${node.name}"`,
            });
          }
          break;
        }

        case "stop_node": {
          const node = this.findNode(parsed.node_id, context.nodes);
          if (!node) {
            actions.push({
              type: "error",
              description: `Node "${parsed.node_id}" not found`,
            });
          } else {
            await client.stopNode(node.node_id);
            actions.push({
              type: "stop_node",
              description: `Stopped node "${node.name}"`,
            });
          }
          break;
        }

        case "create_link": {
          const sourceNode = this.findNode(parsed.source_node, context.nodes);
          const targetNode = this.findNode(parsed.target_node, context.nodes);
          
          if (!sourceNode || !targetNode) {
            actions.push({
              type: "error",
              description: `Could not find nodes: ${!sourceNode ? parsed.source_node : ""} ${!targetNode ? parsed.target_node : ""}`.trim(),
            });
          } else {
            const link = await client.createLink({
              nodes: [
                { node_id: sourceNode.node_id, adapter_number: 0, port_number: parsed.source_port ?? 0 },
                { node_id: targetNode.node_id, adapter_number: 0, port_number: parsed.target_port ?? 0 },
              ],
            });
            actions.push({
              type: "create_link",
              description: `Created link between "${sourceNode.name}:port${parsed.source_port ?? 0}" and "${targetNode.name}:port${parsed.target_port ?? 0}"`,
              result: link,
            });
          }
          break;
        }

        case "delete_link": {
          const link = context.links.find(l => l.link_id === parsed.link_id);
          if (!link) {
            actions.push({
              type: "error",
              description: `Link "${parsed.link_id}" not found`,
            });
          } else {
            await client.deleteLink(link.link_id);
            actions.push({
              type: "delete_link",
              description: `Deleted link ${link.link_id}`,
            });
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

        case "info":
        default: {
          actions.push({
            type: "info",
            description: parsed.message || response,
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
