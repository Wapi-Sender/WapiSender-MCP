import { z } from 'zod'
import { session } from '../session.ts'
import { apiRequest, ok, err } from '../client.ts'

export const instanceTools = [
  {
    name: 'get_instance_status',
    description: 'Get the current connection status of the active WhatsApp instance — connection state, phone number, battery level.',
    inputSchema: z.object({}),
    handler: async () => {
      try {
        const inst = session.requireActiveInstance()
        const data = await apiRequest<Record<string, unknown>>('GET', `/api/instances/${inst.id}/status`)
        return ok(JSON.stringify(data, null, 2))
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e))
      }
    }
  },
  {
    name: 'get_qr_code',
    description: 'Get the QR code for connecting a WhatsApp number to the active instance. Scan this with WhatsApp on your phone.',
    inputSchema: z.object({}),
    handler: async () => {
      try {
        const inst = session.requireActiveInstance()
        const data = await apiRequest<Record<string, unknown>>('GET', `/api/instances/${inst.id}/connect`)
        return ok(JSON.stringify(data, null, 2))
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e))
      }
    }
  },
]
