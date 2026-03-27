import { z } from 'zod'
import { session } from '../session.ts'
import { apiRequest, ok, err } from '../client.ts'

export const messagingTools = [
  {
    name: 'send_text',
    description: 'Send a WhatsApp text message to a phone number.',
    inputSchema: z.object({
      to: z.string().describe('Phone number with country code, e.g. 5491112345678'),
      message: z.string().describe('Text message to send'),
    }),
    handler: async ({ to, message }: { to: string; message: string }) => {
      try {
        const inst = session.requireActiveInstance()
        const data = await apiRequest('POST', `/api/instances/${inst.id}/messages`, {
          endpoint: `/message/sendText/${inst.instance_name}`,
          payload: { number: to, text: message }
        })
        return ok(`Message sent to ${to}.\n${JSON.stringify(data, null, 2)}`)
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e))
      }
    }
  },
  {
    name: 'send_media',
    description: 'Send a WhatsApp media message (image, video, or document) with an optional caption.',
    inputSchema: z.object({
      to: z.string().describe('Phone number with country code'),
      url: z.string().url().describe('Publicly accessible URL of the media file'),
      type: z.enum(['image', 'video', 'document']).describe('Media type'),
      caption: z.string().optional().describe('Optional caption text'),
    }),
    handler: async ({ to, url, type, caption }: { to: string; url: string; type: string; caption?: string }) => {
      try {
        const inst = session.requireActiveInstance()
        const data = await apiRequest('POST', `/api/instances/${inst.id}/messages`, {
          endpoint: `/message/sendMedia/${inst.instance_name}`,
          payload: { number: to, mediatype: type, media: url, caption: caption ?? '' }
        })
        return ok(`Media sent to ${to}.\n${JSON.stringify(data, null, 2)}`)
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e))
      }
    }
  },
  {
    name: 'send_location',
    description: 'Send a WhatsApp location pin to a phone number.',
    inputSchema: z.object({
      to: z.string().describe('Phone number with country code'),
      lat: z.number().describe('Latitude'),
      lng: z.number().describe('Longitude'),
      name: z.string().optional().describe('Optional location name/label'),
    }),
    handler: async ({ to, lat, lng, name }: { to: string; lat: number; lng: number; name?: string }) => {
      try {
        const inst = session.requireActiveInstance()
        const data = await apiRequest('POST', `/api/instances/${inst.id}/messages`, {
          endpoint: `/message/sendLocation/${inst.instance_name}`,
          payload: { number: to, latitude: lat, longitude: lng, name: name ?? '' }
        })
        return ok(`Location sent to ${to}.\n${JSON.stringify(data, null, 2)}`)
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e))
      }
    }
  },
]
