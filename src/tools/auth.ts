import { z } from 'zod'
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { session } from '../session.ts'
import { apiRequest, apiRequestWithToken, ok, err } from '../client.ts'
import type { Instance } from '../types.ts'

const CREDS_FILE = join(homedir(), '.config', 'wapisender-mcp', 'credentials.json')

async function loadToken(): Promise<string | null> {
  const raw = await readFile(CREDS_FILE, 'utf-8').catch(() => null)
  if (!raw) return null
  return (JSON.parse(raw) as { token: string }).token
}

async function fetchInstances(token: string): Promise<{ instances: Instance[]; user?: { id: string; email: string } }> {
  const data = await apiRequestWithToken<{ instances?: Instance[]; user?: { id: string; email: string } }>(
    token,
    'GET',
    '/api/instances?live=true'
  )
  return { instances: data.instances ?? [], user: data.user }
}

export const authTools = [
  {
    name: 'login',
    description: 'Load saved credentials and connect to your WapiSender account. Auto-selects instance if you only have one.',
    inputSchema: z.object({}),
    handler: async () => {
      try {
        const token = await loadToken()
        if (!token) return err('No credentials found. Run: wapisender-mcp login --token <token>')

        const { instances, user } = await fetchInstances(token)
        session.setSession({
          token,
          userId: user?.id ?? '',
          email: user?.email ?? '',
          instances,
          activeInstance: null,
        })
        session.autoSelectIfSingle()

        const active = session.getActiveInstance()
        const lines = [
          `Logged in successfully.`,
          `Instances (${instances.length}):`,
          ...instances.map(i => `  - ${i.instance_name} [${i.status ?? 'unknown'}]${active?.id === i.id ? ' ← active' : ''}`),
        ]
        if (!active && instances.length > 1) lines.push(`\nCall switch_instance to select one.`)
        return ok(lines.join('\n'))
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e))
      }
    }
  },
  {
    name: 'logout',
    description: 'Clear the current WapiSender session.',
    inputSchema: z.object({}),
    handler: async () => {
      session.clear()
      return ok('Logged out. Session cleared.')
    }
  },
  {
    name: 'list_instances',
    description: 'List all WhatsApp instances on your WapiSender account with their live status. Always fetches fresh data from the API.',
    inputSchema: z.object({}),
    handler: async () => {
      try {
        if (!session.isLoggedIn()) return err('Not logged in. Call login() first.')
        const data = await apiRequest<{ instances?: Instance[] }>('GET', '/api/instances?live=true')
        const instances = data.instances ?? []
        session.updateInstances(instances)
        const active = session.getActiveInstance()
        const lines = instances.map(i =>
          `${i.id} | ${i.instance_name} | ${i.status ?? 'unknown'}${active?.id === i.id ? ' [ACTIVE]' : ''}`
        )
        return ok(lines.length ? lines.join('\n') : 'No instances found.')
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e))
      }
    }
  },
  {
    name: 'switch_instance',
    description: 'Set the active instance by name or ID. All subsequent tool calls will use this instance.',
    inputSchema: z.object({
      instanceIdOrName: z.string().trim().min(1).describe('Instance ID or instance_name')
    }),
    handler: async ({ instanceIdOrName }: { instanceIdOrName: string }) => {
      try {
        const inst = session.switchInstance(instanceIdOrName)
        return ok(`Active instance set to: ${inst.instance_name} (${inst.id})`)
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e))
      }
    }
  },
  {
    name: 'refresh_instances',
    description: 'Re-fetch the instance list from the WapiSender API and update the session. Useful after adding a new instance without needing to re-login.',
    inputSchema: z.object({}),
    handler: async () => {
      try {
        if (!session.isLoggedIn()) return err('Not logged in. Call login() first.')
        const data = await apiRequest<{ instances?: Instance[] }>('GET', '/api/instances?live=true')
        const instances = data.instances ?? []
        session.updateInstances(instances)
        const active = session.getActiveInstance()
        const lines = [
          `Instances refreshed (${instances.length} total):`,
          ...instances.map(i =>
            `  - ${i.instance_name} [${i.status ?? 'unknown'}]${active?.id === i.id ? ' ← active' : ''}`
          ),
        ]
        return ok(lines.join('\n'))
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e))
      }
    }
  },
  {
    name: 'get_session_info',
    description: 'Return the current session state: whether you are logged in, which account, and which instance is active. Does not make any API calls.',
    inputSchema: z.object({}),
    handler: async () => {
      if (!session.isLoggedIn()) return ok('Not logged in. Call login() first.')
      return ok(session.getSummary())
    }
  },
]
