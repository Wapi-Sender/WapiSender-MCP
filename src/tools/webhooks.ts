import { z } from 'zod'
import { session } from '../session.ts'
import { apiRequest, ok, err } from '../client.ts'

export const webhooksTools = [
  {
    name: 'get_webhook',
    description: 'Get the current webhook configuration for the active instance.',
    inputSchema: z.object({}),
    handler: async () => {
      try {
        const inst = session.requireActiveInstance()
        const data = await apiRequest<unknown>('GET', `/api/instances/${inst.id}/webhooks`)
        return ok(JSON.stringify(data, null, 2))
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e))
      }
    }
  },
  {
    name: 'set_webhook',
    description: 'Set the webhook URL and events for the active instance.',
    inputSchema: z.object({
      url: z.string().url().describe('Webhook endpoint URL'),
      enabled: z.boolean().default(true),
      events: z.array(z.string()).optional().describe('Event types to subscribe to, e.g. ["MESSAGES_UPSERT"]'),
    }),
    handler: async ({ url, enabled, events }: { url: string; enabled: boolean; events?: string[] }) => {
      try {
        const inst = session.requireActiveInstance()
        const data = await apiRequest('POST', `/api/instances/${inst.id}/webhooks`, { url, enabled, events })
        return ok(`Webhook updated.\n${JSON.stringify(data, null, 2)}`)
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e))
      }
    }
  },
]
