import { z } from 'zod'
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { session } from '../session.ts'
import { ok, err } from '../client.ts'
import type { Instance } from '../types.ts'

const CREDS_FILE = join(homedir(), '.config', 'wapisender-mcp', 'credentials.json')

async function loadToken(): Promise<string | null> {
  const raw = await readFile(CREDS_FILE, 'utf-8').catch(() => null)
  if (!raw) return null
  return (JSON.parse(raw) as { token: string }).token
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

        const res = await fetch('https://wapisender.com/api/instances', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        const data = await res.json() as { instances?: Instance[]; user?: { id: string; email: string } }

        const instances = data.instances ?? []
        session.setSession({
          token,
          userId: data.user?.id ?? '',
          email: data.user?.email ?? '',
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
    description: 'List all WhatsApp instances on your WapiSender account with their status.',
    inputSchema: z.object({}),
    handler: async () => {
      try {
        if (!session.isLoggedIn()) return err('Not logged in. Call login() first.')
        const instances = session.getInstances()
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
      instanceIdOrName: z.string().describe('Instance ID or instance_name')
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
]
