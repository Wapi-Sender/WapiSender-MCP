import { z } from 'zod'
import { session } from '../session.ts'
import { apiRequest, ok, err } from '../client.ts'

const WEBHOOK_EVENTS = [
  'MESSAGES_UPSERT',
  'MESSAGES_UPDATE',
  'MESSAGE_RECEIPT_UPDATE',
  'CONNECTION_UPDATE',
  'QRCODE_UPDATED',
  'CONTACTS_UPSERT',
  'CONTACTS_UPDATE',
  'PRESENCE_UPDATE',
  'CHATS_UPSERT',
  'GROUPS_UPSERT',
  'GROUP_PARTICIPANTS_UPDATE',
] as const

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
    description: `Set the webhook URL and event subscriptions for the active instance.\n\nAvailable events:\n${WEBHOOK_EVENTS.map(e => `  - ${e}`).join('\n')}`,
    inputSchema: z.object({
      url: z.string().url().describe('Webhook endpoint URL'),
      enabled: z.boolean().default(true).describe('Enable or disable the webhook'),
      byEvents: z.boolean().default(false).describe('When true, WapiSender sends event-specific webhook payloads'),
      base64: z.boolean().default(false).describe('Include media as base64 in webhook payloads'),
      events: z.array(z.enum(WEBHOOK_EVENTS)).optional()
        .describe('Event types to subscribe to. Omit to use an empty event list.'),
    }),
    handler: async ({ url, enabled, byEvents, base64, events }: {
      url: string
      enabled: boolean
      byEvents: boolean
      base64: boolean
      events?: typeof WEBHOOK_EVENTS[number][]
    }) => {
      try {
        const inst = session.requireActiveInstance()
        const data = await apiRequest('POST', `/api/instances/${inst.id}/webhooks`, {
          webhook: {
            url,
            enabled,
            byEvents,
            base64,
            events: events ?? [],
          },
        })
        return ok(`Webhook updated.\n${JSON.stringify(data, null, 2)}`)
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e))
      }
    }
  },
]
