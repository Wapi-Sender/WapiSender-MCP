import { z } from 'zod'
import { session } from '../session.ts'
import { apiRequest, ok, err } from '../client.ts'

function normalizePhone(input: string): string {
  return input.replace(/\D/g, '')
}

type ContactRecord = {
  id?: string
  phone?: string | null
  number?: string | null
  name?: string | null
  displayName?: string | null
  pushName?: string | null
  remoteJid?: string | null
  contactType?: string | null
  isGroup?: boolean
  isChannel?: boolean
  [key: string]: unknown
}

async function fetchContacts(instanceId: string): Promise<ContactRecord[]> {
  const data = await apiRequest<{ contacts?: ContactRecord[] } | ContactRecord[]>(
    'GET',
    `/api/instances/${instanceId}/contacts`
  )
  return Array.isArray(data) ? data : (data.contacts ?? [])
}

export const contactsTools = [
  {
    name: 'list_contacts',
    description: 'List contacts on the active instance with optional search and pagination.',
    inputSchema: z.object({
      search: z.string().optional().describe('Search by name or phone number'),
      limit: z.number().int().min(1).max(100).default(20).describe('Max results (default 20)'),
      offset: z.number().int().min(0).default(0).describe('Pagination offset — skip this many results (default 0)'),
    }),
    handler: async ({ search, limit, offset }: { search?: string; limit?: number; offset?: number }) => {
      try {
        const inst = session.requireActiveInstance()
        const allContacts = await fetchContacts(inst.id)
        const needle = search?.trim().toLowerCase()
        const filtered = needle
          ? allContacts.filter(contact => [
              contact.phone,
              contact.number,
              contact.name,
              contact.displayName,
              contact.pushName,
              contact.remoteJid,
            ].some(value => String(value ?? '').toLowerCase().includes(needle)))
          : allContacts
        const contacts = filtered.slice(offset ?? 0, (offset ?? 0) + (limit ?? 20))
        if (contacts.length === 0) return ok('No contacts found.')

        const lines = contacts.map(c =>
          `${c.phone ?? c.number ?? c.remoteJid ?? 'unknown'} | ${c.displayName ?? c.name ?? c.pushName ?? '(no name)'} | ${c.contactType ?? 'contact'}${c.id ? ` | ${c.id}` : ''}`
        )
        return ok(`Contacts ${offset ?? 0}-${(offset ?? 0) + contacts.length} of ${filtered.length}:\n${lines.join('\n')}`)
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
        const requested = normalizePhone(phone)
        const contacts = await fetchContacts(inst.id)
        const exact = contacts.find(c =>
          normalizePhone(c.phone ?? c.number ?? c.remoteJid ?? '') === requested
        )
        if (!exact) return err(`Contact ${phone} not found.`)
        return ok(JSON.stringify(exact, null, 2))
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e))
      }
    }
  },
  {
    name: 'set_contact_block_status',
    description: 'Block or unblock a WhatsApp contact on the active instance.',
    inputSchema: z.object({
      phone: z.string().trim().min(1).describe('Phone number with country code'),
      status: z.enum(['block', 'unblock']).describe('Whether to block or unblock this contact'),
    }),
    handler: async ({ phone, status }: { phone: string; status: 'block' | 'unblock' }) => {
      try {
        const inst = session.requireActiveInstance()
        const data = await apiRequest('POST', `/api/instances/${inst.id}/contacts`, {
          number: phone,
          status,
        })
        return ok(`Contact ${phone} ${status === 'block' ? 'blocked' : 'unblocked'}.\n${JSON.stringify(data, null, 2)}`)
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e))
      }
    }
  },
]
