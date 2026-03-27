import { z } from 'zod'
import { session } from '../session.ts'
import { apiRequest, ok, err } from '../client.ts'

export const contactsTools = [
  {
    name: 'list_contacts',
    description: 'List contacts on the active instance with optional search.',
    inputSchema: z.object({
      search: z.string().optional().describe('Search by name or phone number'),
      limit: z.number().int().min(1).max(100).default(20).describe('Max results (default 20)'),
    }),
    handler: async ({ search, limit }: { search?: string; limit?: number }) => {
      try {
        const inst = session.requireActiveInstance()
        const params = new URLSearchParams()
        if (search) params.set('search', search)
        if (limit) params.set('limit', String(limit))
        const data = await apiRequest<{ contacts: unknown[] }>('GET', `/api/instances/${inst.id}/contacts?${params}`)
        return ok(JSON.stringify(data.contacts, null, 2))
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e))
      }
    }
  },
  {
    name: 'get_contact',
    description: 'Get a single contact by phone number.',
    inputSchema: z.object({
      phone: z.string().describe('Phone number with country code'),
    }),
    handler: async ({ phone }: { phone: string }) => {
      try {
        const inst = session.requireActiveInstance()
        const data = await apiRequest<unknown>('GET', `/api/instances/${inst.id}/contacts?search=${encodeURIComponent(phone)}&limit=1`)
        return ok(JSON.stringify(data, null, 2))
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e))
      }
    }
  },
  {
    name: 'upsert_contact',
    description: 'Create or update a contact on the active instance.',
    inputSchema: z.object({
      phone: z.string().describe('Phone number with country code'),
      name: z.string().optional().describe('Contact display name'),
      email: z.string().email().optional().describe('Contact email address'),
    }),
    handler: async ({ phone, name, email }: { phone: string; name?: string; email?: string }) => {
      try {
        const inst = session.requireActiveInstance()
        const data = await apiRequest('POST', `/api/instances/${inst.id}/contacts`, { phone, name, email })
        return ok(`Contact saved.\n${JSON.stringify(data, null, 2)}`)
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e))
      }
    }
  },
]
