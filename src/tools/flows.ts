import { z } from 'zod'
import { session } from '../session.ts'
import { apiRequest, ok, err } from '../client.ts'
import type { FlowNode, FlowEdge } from '../types.ts'

const NODE_SCHEMA_REFERENCE = `
WapiSender Flow Node Types:
- trigger: { type: "trigger", data: { triggerType: "all_messages"|"keyword", keyword?: string } }
- send_message: { type: "send_message", data: { messageType: "text"|"image"|"audio", message: string, url?: string } }
- condition: { type: "condition", data: { variable: string, operator: "equals"|"contains"|"starts_with", value: string } }
  condition has two output handles: "true" and "false"
- delay: { type: "delay", data: { delaySeconds: number } }
- wait_for_reply: { type: "wait_for_reply", data: { timeoutSeconds: number, timeoutAction: "continue"|"end" } }
- ai_agent: { type: "ai_agent", data: { mode: "reply"|"router"|"extract", credentialId: string, provider: string, model: string, systemPrompt: string, promptTemplate: string } }
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
        const data = await apiRequest<{ flows: unknown[] }>('GET', `/api/instances/${inst.id}/flows`)
        return ok(JSON.stringify(data.flows, null, 2))
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
      triggerType: z.enum(['all_messages', 'keyword']).default('all_messages').describe('What triggers this flow'),
    }),
    handler: async ({ name, description, triggerType }: { name: string; description?: string; triggerType: string }) => {
      try {
        const inst = session.requireActiveInstance()
        const data = await apiRequest<{ flow: { id: string } }>('POST', `/api/instances/${inst.id}/flows`, {
          name, description, trigger_type: triggerType, nodes: [], edges: []
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
        const data = await apiRequest('PATCH', `/api/instances/${inst.id}/flows/${flowId}`, { nodes, edges })
        return ok(`Flow updated.\n${JSON.stringify(data, null, 2)}`)
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
        const flowData = await apiRequest<{ flow: { nodes: FlowNode[]; edges: FlowEdge[] } }>('GET', `/api/instances/${inst.id}/flows/${flowId}`)
        const nodes: FlowNode[] = flowData.flow?.nodes ?? []
        const nodeIndex = nodes.findIndex(n => n.id === nodeId)
        if (nodeIndex === -1) return err(`Node "${nodeId}" not found in flow.`)
        nodes[nodeIndex] = { ...nodes[nodeIndex], data: { ...nodes[nodeIndex].data, ...data } }
        const updated = await apiRequest('PATCH', `/api/instances/${inst.id}/flows/${flowId}`, {
          nodes, edges: flowData.flow?.edges ?? []
        })
        return ok(`Node "${nodeId}" updated.\n${JSON.stringify(updated, null, 2)}`)
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e))
      }
    }
  },
  {
    name: 'generate_and_save_flow',
    description: `Generate a complete WhatsApp flow from a plain-English description and save it to WapiSender.

You (Claude) will generate valid nodes and edges matching the WapiSender node schema, then create and save the flow.

${NODE_SCHEMA_REFERENCE}

Example: "A support flow that greets the user, asks if they need sales or support, then routes accordingly"
→ trigger → send_message("Hello! Do you need Sales or Support?") → wait_for_reply → condition(reply contains "sales") → [true: end as sales, false: end as support]`,
    inputSchema: z.object({
      description: z.string().describe('Plain-English description of the flow behavior'),
      name: z.string().describe('Name for the new flow'),
      triggerType: z.enum(['all_messages', 'keyword']).default('all_messages'),
    }),
    handler: async ({ description, name, triggerType }: { description: string; name: string; triggerType: string }) => {
      try {
        const inst = session.requireActiveInstance()
        const created = await apiRequest<{ flow: { id: string } }>('POST', `/api/instances/${inst.id}/flows`, {
          name, description, trigger_type: triggerType, nodes: [], edges: []
        })
        const flowId = created.flow?.id
        return ok(
          `Flow shell created. ID: ${flowId}\n\n` +
          `Now generate nodes and edges for: "${description}"\n` +
          `Then call update_flow_definition with flowId="${flowId}" and your generated nodes+edges.\n\n` +
          NODE_SCHEMA_REFERENCE
        )
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
        const data = await apiRequest('PATCH', `/api/instances/${inst.id}/flows/${flowId}/toggle`, { is_active: true })
        return ok(`Flow activated.\n${JSON.stringify(data, null, 2)}`)
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
        const data = await apiRequest('PATCH', `/api/instances/${inst.id}/flows/${flowId}/toggle`, { is_active: false })
        return ok(`Flow deactivated.\n${JSON.stringify(data, null, 2)}`)
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e))
      }
    }
  },
]
