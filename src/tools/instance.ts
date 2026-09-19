import { z } from 'zod'
import { session } from '../session.ts'
import { apiRequest, ok, err } from '../client.ts'
import type { Instance } from '../types.ts'

export const instanceTools = [
  {
    name: 'get_instance_status',
    description: 'Refresh and return the current connection status and metadata of the active WhatsApp instance.',
    inputSchema: z.object({}),
    handler: async () => {
      try {
        const inst = session.requireActiveInstance()
        const data = await apiRequest<{ instances?: Instance[] }>(
          'GET',
          '/api/instances?live=true'
        )
        const instances = data.instances ?? []
        session.updateInstances(instances)
        const current = instances.find(item => item.id === inst.id)
        if (!current) return err(`Active instance "${inst.instance_name}" no longer exists in this account.`)
        return ok(JSON.stringify(current, null, 2))
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e))
      }
    }
  },
]
