import { z } from 'zod'
import { session } from '../session.ts'
import { apiRequest, ok, err } from '../client.ts'
import type { FlowNode, FlowEdge } from '../types.ts'

const NODE_SCHEMA_REFERENCE = `
WapiSender Flow Node Types:
- trigger: { type: "trigger", data: { match: "any"|"contains"|"exact"|"regex", keywords: string[] } }
- send_message: { type: "send_message", data: { messageType: "text"|"image"|"video"|"document"|"audio"|"voice"|"buttons"|"list"|"location"|"poll"|"sticker", text?: string, mediaUrl?: string, audioUrl?: string, stickerUrl?: string } }
- condition: { type: "condition", data: { source: "last_message"|"custom", variableName?: string, operator: "equals"|"contains"|"starts_with"|"ends_with"|"regex", value: string } }
  condition has two output handles: "true" and "false"
- delay: { type: "delay", data: { amount: number, unit: "seconds"|"minutes"|"hours"|"days" } }
- webhook: { type: "webhook", data: { method: "GET"|"POST"|"PUT"|"PATCH"|"DELETE", url: string, headers?: object, body?: string, responseVariable?: string } }
- wait_for_reply: { type: "wait_for_reply", data: {} }
- human_handoff: { type: "human_handoff", data: { message?: string, resumeAfterMinutes: number } }
- ai_agent: { type: "ai_agent", data: { mode: "reply"|"router"|"extract", credentialId: string, provider: string, model: string, systemPrompt: string, promptTemplate: string, outputVariable: string } }
- end: { type: "end", data: {} }

Edge format: { id: "e1", source: "nodeId", target: "nodeId", sourceHandle?: "true"|"false" }
Positions: spread nodes with ~250px vertical spacing starting at { x: 250, y: 100 }
`

export const flowsTools = [
  {
    name: 'list_flows',
    description: 'List all flows on the active instance with their status (active/draft).',
    inputSchema: z.object({}),
    handler: async () => {
      try {
        const inst = session.requireActiveInstance()
        const data = await apiRequest<{ flows?: Array<{ id?: string; name?: string; is_active?: boolean; trigger_type?: string | null }> } | Array<{ id?: string; name?: string; is_active?: boolean; trigger_type?: string | null }>>(
          'GET',
          `/api/instances/${inst.id}/flows`
        )
        const flows = Array.isArray(data) ? data : (data.flows ?? [])
        if (flows.length === 0) return ok('No flows found.')
        const lines = flows.map(f =>
          `${f.id ?? 'unknown'} | ${f.name ?? '(unnamed)'} | ${f.is_active ? 'active' : 'draft'} | trigger=${f.trigger_type ?? 'message_received'}`
        )
        return ok(`Flows (${flows.length}):\n${lines.join('\n')}`)
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e))
      }
    }
  },
  {
    name: 'get_flow',
    description: 'Get the full definition and health status of a specific flow.',
    inputSchema: z.object({
      flowId: z.string().describe('Flow UUID'),
    }),
    handler: async ({ flowId }: { flowId: string }) => {
      try {
        const inst = session.requireActiveInstance()
        const data = await apiRequest<unknown>('GET', `/api/instances/${inst.id}/flows/${flowId}`)
        return ok(JSON.stringify(data, null, 2))
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e))
      }
    }
  },
  {
    name: 'create_flow',
    description: 'Create a new empty flow on the active instance.',
    inputSchema: z.object({
      name: z.string().describe('Flow name'),
      description: z.string().optional().describe('Flow description'),
      triggerType: z.enum(['message_received', 'manual']).default('message_received').describe('How the flow starts'),
      triggerConfig: z.record(z.unknown()).default({}).describe('Optional flow-level trigger configuration'),
    }),
    handler: async ({ name, description, triggerType, triggerConfig }: {
      name: string
      description?: string
      triggerType: 'message_received' | 'manual'
      triggerConfig: Record<string, unknown>
    }) => {
      try {
        const inst = session.requireActiveInstance()
        const data = await apiRequest<{ flow: { id: string } }>('POST', `/api/instances/${inst.id}/flows`, {
          name, description, trigger_type: triggerType, trigger_config: triggerConfig, nodes: [], edges: []
        })
        return ok(`Flow created. ID: ${data.flow?.id}\n${JSON.stringify(data, null, 2)}`)
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e))
      }
    }
  },
  {
    name: 'update_flow_definition',
    description: `Replace the full node+edge graph of an existing flow.\n\nNode schema reference:\n${NODE_SCHEMA_REFERENCE}`,
    inputSchema: z.object({
      flowId: z.string().describe('Flow UUID'),
      nodes: z.array(z.record(z.unknown())).describe('Array of flow nodes'),
      edges: z.array(z.record(z.unknown())).describe('Array of flow edges'),
    }),
    handler: async ({ flowId, nodes, edges }: { flowId: string; nodes: FlowNode[]; edges: FlowEdge[] }) => {
      try {
        const inst = session.requireActiveInstance()
        const data = await apiRequest<{ flow: { id: string; name: string } }>(
          'PATCH', `/api/instances/${inst.id}/flows/${flowId}`, { nodes, edges }
        )
        return ok(
          `Flow "${data.flow?.name ?? flowId}" updated — ${nodes.length} node(s), ${edges.length} edge(s).\n` +
          JSON.stringify(data, null, 2)
        )
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e))
      }
    }
  },
  {
    name: 'update_flow_node',
    description: 'Edit a single node\'s configuration within an existing flow without touching other nodes.',
    inputSchema: z.object({
      flowId: z.string().describe('Flow UUID'),
      nodeId: z.string().describe('Node ID within the flow'),
      data: z.record(z.unknown()).describe('New data object for the node'),
    }),
    handler: async ({ flowId, nodeId, data }: { flowId: string; nodeId: string; data: Record<string, unknown> }) => {
      try {
        const inst = session.requireActiveInstance()
        const updated = await apiRequest<{ flow: { id: string; name: string }; node: FlowNode }>(
          'PATCH',
          `/api/instances/${inst.id}/flows/${flowId}/nodes/${encodeURIComponent(nodeId)}`,
          { data }
        )
        return ok(
          `Node "${nodeId}" updated in flow "${updated.flow?.name ?? flowId}".\n` +
          JSON.stringify(updated, null, 2)
        )
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e))
      }
    }
  },
  {
    name: 'generate_and_save_flow',
    description: `Generate a complete WhatsApp flow from a plain-English description and save it fully in one step.

INSTRUCTIONS FOR THE AI:
1. Read the description and design the full node graph.
2. Build the nodes[] and edges[] arrays using the schema below.
3. Call this tool with name, description, triggerType, nodes, and edges — all in one shot.
4. The tool will create the flow AND save the node graph atomically.

${NODE_SCHEMA_REFERENCE}

Example: "A support flow that greets the user, asks if they need sales or support, then routes accordingly"
→ trigger → send_message("Hello! Do you need Sales or Support?") → wait_for_reply → condition(reply contains "sales") → [true: end-sales, false: end-support]`,
    inputSchema: z.object({
      name: z.string().describe('Name for the new flow'),
      description: z.string().describe('Plain-English description of the flow behavior'),
      triggerType: z.enum(['message_received', 'manual']).default('message_received'),
      triggerConfig: z.record(z.unknown()).default({}),
      nodes: z.array(z.record(z.unknown())).describe('Generated flow nodes matching the node schema above'),
      edges: z.array(z.record(z.unknown())).describe('Generated flow edges connecting the nodes'),
    }),
    handler: async ({ name, description, triggerType, triggerConfig, nodes, edges }: {
      name: string; description: string; triggerType: 'message_received' | 'manual'; triggerConfig: Record<string, unknown>;
      nodes: FlowNode[]; edges: FlowEdge[]
    }) => {
      try {
        const inst = session.requireActiveInstance()
        const created = await apiRequest<{ flow: { id: string; name: string; is_active: boolean } }>('POST', `/api/instances/${inst.id}/flows`, {
          name,
          description,
          trigger_type: triggerType,
          trigger_config: triggerConfig,
          nodes,
          edges,
        })
        const f = created.flow
        return ok(
          `Flow "${f?.name ?? name}" created and saved.\n` +
          `ID: ${f?.id} | Nodes: ${nodes.length} | Edges: ${edges.length} | Active: ${f?.is_active ? 'yes' : 'no (call activate_flow to enable)'}\n\n` +
          JSON.stringify(created, null, 2)
        )
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e))
      }
    }
  },
  {
    name: 'rename_flow',
    description: 'Rename an existing flow without touching its node graph or activation state.',
    inputSchema: z.object({
      flowId: z.string().describe('Flow UUID'),
      name: z.string().describe('New name for the flow'),
    }),
    handler: async ({ flowId, name }: { flowId: string; name: string }) => {
      try {
        const inst = session.requireActiveInstance()
        const data = await apiRequest<{ flow: { id: string; name: string } }>(
          'PATCH', `/api/instances/${inst.id}/flows/${flowId}`, { name }
        )
        return ok(`Flow renamed to "${data.flow?.name ?? name}".\n${JSON.stringify(data, null, 2)}`)
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e))
      }
    }
  },
  {
    name: 'activate_flow',
    description: 'Enable a flow so it processes incoming WhatsApp messages. Runs a health check first.',
    inputSchema: z.object({
      flowId: z.string().describe('Flow UUID'),
    }),
    handler: async ({ flowId }: { flowId: string }) => {
      try {
        const inst = session.requireActiveInstance()
        const data = await apiRequest<{ flow: { id: string; name: string; is_active: boolean } }>(
          'PATCH', `/api/instances/${inst.id}/flows/${flowId}/toggle`, { is_active: true }
        )
        const f = data.flow
        return ok(`Flow "${f?.name ?? flowId}" is now ACTIVE.\n${JSON.stringify(data, null, 2)}`)
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e))
      }
    }
  },
  {
    name: 'deactivate_flow',
    description: 'Disable a flow. Incoming messages will no longer be processed by it.',
    inputSchema: z.object({
      flowId: z.string().describe('Flow UUID'),
    }),
    handler: async ({ flowId }: { flowId: string }) => {
      try {
        const inst = session.requireActiveInstance()
        const data = await apiRequest<{ flow: { id: string; name: string; is_active: boolean } }>(
          'PATCH', `/api/instances/${inst.id}/flows/${flowId}/toggle`, { is_active: false }
        )
        const f = data.flow
        return ok(`Flow "${f?.name ?? flowId}" is now INACTIVE.\n${JSON.stringify(data, null, 2)}`)
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e))
      }
    }
  },
  {
    name: 'delete_flow',
    description: 'Permanently delete a flow from the active instance. This cannot be undone.',
    inputSchema: z.object({
      flowId: z.string().describe('Flow UUID to delete'),
    }),
    handler: async ({ flowId }: { flowId: string }) => {
      try {
        const inst = session.requireActiveInstance()
        const data = await apiRequest('DELETE', `/api/instances/${inst.id}/flows/${flowId}`)
        return ok(`Flow ${flowId} deleted.\n${JSON.stringify(data, null, 2)}`)
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e))
      }
    }
  },
  {
    name: 'clone_flow',
    description: 'Duplicate an existing flow with a new name. The clone starts as inactive (draft) so you can edit it before activating.',
    inputSchema: z.object({
      flowId: z.string().describe('UUID of the flow to clone'),
      name: z.string().describe('Name for the cloned flow'),
    }),
    handler: async ({ flowId, name }: { flowId: string; name: string }) => {
      try {
        const inst = session.requireActiveInstance()
        const source = await apiRequest<{ flow: { name: string; description: string | null; trigger_type: string | null; trigger_config?: Record<string, unknown>; nodes: FlowNode[]; edges: FlowEdge[] } }>(
          'GET', `/api/instances/${inst.id}/flows/${flowId}`
        )
        const f = source.flow
        const created = await apiRequest<{ flow: { id: string } }>('POST', `/api/instances/${inst.id}/flows`, {
          name,
          description: f.description,
          trigger_type: f.trigger_type ?? 'message_received',
          trigger_config: f.trigger_config ?? {},
          nodes: f.nodes ?? [],
          edges: f.edges ?? [],
        })
        const newId = created.flow?.id
        return ok(
          `Flow cloned: "${f.name}" → "${name}" (ID: ${newId}).\n` +
          JSON.stringify(created, null, 2)
        )
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e))
      }
    }
  },
  {
    name: 'simulate_flow',
    description: 'Simulate an incoming message against the active instance and return the generated flow logs. Simulation does not send WhatsApp messages.',
    inputSchema: z.object({
      message: z.string().min(1).describe('Incoming message text to simulate'),
      flowId: z.string().optional().describe('Optional flow UUID to test specifically'),
      from: z.string().optional().describe('Optional simulated sender phone number'),
    }),
    handler: async ({ message, flowId, from }: { message: string; flowId?: string; from?: string }) => {
      try {
        const inst = session.requireActiveInstance()
        const data = await apiRequest<unknown>('POST', `/api/instances/${inst.id}/flows/simulate`, {
          message,
          ...(flowId ? { flowId } : {}),
          ...(from ? { from } : {}),
        })
        return ok(JSON.stringify(data, null, 2))
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e))
      }
    }
  },
  {
    name: 'get_flow_logs',
    description: 'Get recent execution logs for a flow on the active instance.',
    inputSchema: z.object({
      flowId: z.string().describe('Flow UUID'),
      limit: z.number().int().min(1).max(200).default(50).describe('Maximum logs to return'),
    }),
    handler: async ({ flowId, limit }: { flowId: string; limit: number }) => {
      try {
        const inst = session.requireActiveInstance()
        const data = await apiRequest<unknown>(
          'GET',
          `/api/instances/${inst.id}/flows/${flowId}/logs?limit=${limit}`
        )
        return ok(JSON.stringify(data, null, 2))
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e))
      }
    }
  },
]
