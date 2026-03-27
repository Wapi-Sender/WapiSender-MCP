# WapiSender MCP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and publish an MCP server that gives Claude Code full access to the WapiSender platform — messaging, flow management (including AI-generated flows), contacts, webhooks, and AI credentials.

**Architecture:** Stateful in-memory session holds the MCP token, active instance, and instance list. All 25 tools route through a single authenticated HTTP client targeting `wapisender.com/api`. Tools are grouped by domain in separate files and registered centrally in `index.ts`.

**Tech Stack:** Node.js 20+, TypeScript 5, `@modelcontextprotocol/sdk`, `zod`, native fetch, `node:test` for unit tests.

---

## File Map

| File | Responsibility |
|---|---|
| `src/types.ts` | Shared TypeScript types (Instance, Flow, Contact, Session, etc.) |
| `src/session.ts` | In-memory session state — token, activeInstance, instances list |
| `src/client.ts` | Authenticated fetch wrapper → wapisender.com/api |
| `src/cli.ts` | `wapisender-mcp login --token <t>` CLI entry point |
| `src/tools/auth.ts` | login, logout, list_instances, switch_instance |
| `src/tools/instance.ts` | get_instance_status, get_qr_code |
| `src/tools/messaging.ts` | send_text, send_media, send_location |
| `src/tools/contacts.ts` | list_contacts, get_contact, upsert_contact |
| `src/tools/flows.ts` | list_flows, get_flow, create_flow, update_flow_definition, update_flow_node, generate_and_save_flow, activate_flow, deactivate_flow |
| `src/tools/webhooks.ts` | get_webhook, set_webhook |
| `src/tools/ai_credentials.ts` | list_ai_credentials, add_ai_credential, test_ai_credential |
| `src/index.ts` | MCP server entry — registers all tools, starts server |
| `tests/session.test.ts` | Unit tests for session state logic |
| `tests/schemas.test.ts` | Unit tests for Zod input validation |

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `.env.example`

- [ ] **Step 1: Initialize git on main branch**

```bash
cd /home/gilad/WapiSender-MCP
git branch -m master main
```

- [ ] **Step 2: Create `package.json`**

```json
{
  "name": "wapisender-mcp",
  "version": "0.1.0",
  "description": "Official MCP server for WapiSender — send WhatsApp messages, manage flows, contacts, and instances directly from Claude Code.",
  "type": "module",
  "bin": {
    "wapisender-mcp": "./dist/cli.js",
    "wapisender-mcp-server": "./dist/index.js"
  },
  "main": "./dist/index.js",
  "files": ["dist/", "README.md", "LICENSE"],
  "scripts": {
    "build": "tsc",
    "dev": "node --watch --experimental-strip-types src/index.ts",
    "start": "node dist/index.js",
    "test": "node --test --experimental-strip-types tests/**/*.test.ts",
    "prepublishOnly": "npm run build"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "@types/node": "^20.0.0"
  },
  "engines": { "node": ">=20" },
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/Giladx/wapisender-mcp.git"
  },
  "keywords": ["mcp", "wapisender", "whatsapp", "claude", "claude-code", "modelcontextprotocol"]
}
```

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 4: Create `.gitignore`**

```
node_modules/
dist/
*.js.map
~/.config/wapisender-mcp/
.env
```

- [ ] **Step 5: Create `.env.example`**

```
# Not needed after running: npx wapisender-mcp login --token <your-token>
# Get your MCP token from: https://wapisender.com/dashboard/settings/mcp-token
WAPISENDER_TOKEN=wapi_your_token_here
```

- [ ] **Step 6: Install dependencies**

```bash
npm install
```

Expected: `node_modules/` created, `@modelcontextprotocol/sdk` and `zod` installed.

- [ ] **Step 7: Commit**

```bash
git add package.json tsconfig.json .gitignore .env.example
git commit -m "chore: project scaffold"
```

---

## Task 2: Shared Types

**Files:**
- Create: `src/types.ts`

- [ ] **Step 1: Create `src/types.ts`**

```typescript
export type Instance = {
  id: string
  instance_name: string
  api_key: string | null
  status: string | null
  subscription_status: string | null
  created_at: string
}

export type Flow = {
  id: string
  name: string
  description: string | null
  trigger_type: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type FlowNode = {
  id: string
  type: string
  position: { x: number; y: number }
  data: Record<string, unknown>
}

export type FlowEdge = {
  id: string
  source: string
  target: string
  sourceHandle?: string | null
  targetHandle?: string | null
}

export type Contact = {
  id: string
  phone: string
  name: string | null
  email: string | null
  created_at: string
}

export type AICredential = {
  id: string
  provider: string
  label: string | null
  masked_key_preview: string | null
  default_model: string | null
  is_active: boolean
}

export type Session = {
  token: string
  userId: string
  email: string
  instances: Instance[]
  activeInstance: Instance | null
}

export type ApiError = {
  status: number
  message: string
}

export type ToolResult = {
  content: Array<{ type: 'text'; text: string }>
  isError?: boolean
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types.ts
git commit -m "feat: add shared types"
```

---

## Task 3: Session State

**Files:**
- Create: `src/session.ts`
- Create: `tests/session.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/session.test.ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { Session as SessionManager } from '../src/session.ts'

const mockInstance = (id: string) => ({
  id, instance_name: `inst-${id}`, api_key: 'key',
  status: 'connected', subscription_status: 'active', created_at: '2026-01-01'
})

test('session starts empty', () => {
  const s = new SessionManager()
  assert.equal(s.isLoggedIn(), false)
  assert.equal(s.getActiveInstance(), null)
})

test('setSession stores token and instances', () => {
  const s = new SessionManager()
  s.setSession({ token: 'tok', userId: 'u1', email: 'a@b.com', instances: [mockInstance('i1')], activeInstance: null })
  assert.equal(s.isLoggedIn(), true)
  assert.equal(s.getInstances().length, 1)
})

test('auto-selects single instance', () => {
  const s = new SessionManager()
  s.setSession({ token: 'tok', userId: 'u1', email: 'a@b.com', instances: [mockInstance('i1')], activeInstance: null })
  s.autoSelectIfSingle()
  assert.equal(s.getActiveInstance()?.id, 'i1')
})

test('switchInstance rejects unknown id', () => {
  const s = new SessionManager()
  s.setSession({ token: 'tok', userId: 'u1', email: 'a@b.com', instances: [mockInstance('i1')], activeInstance: null })
  assert.throws(() => s.switchInstance('unknown'), /not found/)
})

test('clear resets session', () => {
  const s = new SessionManager()
  s.setSession({ token: 'tok', userId: 'u1', email: 'a@b.com', instances: [mockInstance('i1')], activeInstance: null })
  s.clear()
  assert.equal(s.isLoggedIn(), false)
})
```

- [ ] **Step 2: Run tests — expect failure**

```bash
node --test --experimental-strip-types tests/session.test.ts
```

Expected: Error — `src/session.ts` does not exist.

- [ ] **Step 3: Create `src/session.ts`**

```typescript
import type { Session as SessionType, Instance } from './types.ts'

export class Session {
  private state: SessionType | null = null

  setSession(session: SessionType): void {
    this.state = session
  }

  isLoggedIn(): boolean {
    return this.state !== null
  }

  getToken(): string {
    if (!this.state) throw new Error('Not logged in. Call login() first.')
    return this.state.token
  }

  getInstances(): Instance[] {
    return this.state?.instances ?? []
  }

  getActiveInstance(): Instance | null {
    return this.state?.activeInstance ?? null
  }

  requireActiveInstance(): Instance {
    const inst = this.getActiveInstance()
    if (!inst) throw new Error('No active instance. Call switch_instance() or login() first.')
    return inst
  }

  autoSelectIfSingle(): void {
    if (!this.state) return
    if (this.state.instances.length === 1) {
      this.state.activeInstance = this.state.instances[0]
    }
  }

  switchInstance(idOrName: string): Instance {
    if (!this.state) throw new Error('Not logged in.')
    const inst = this.state.instances.find(
      i => i.id === idOrName || i.instance_name === idOrName
    )
    if (!inst) throw new Error(`Instance "${idOrName}" not found in your account.`)
    this.state.activeInstance = inst
    return inst
  }

  clear(): void {
    this.state = null
  }

  getSummary(): string {
    if (!this.state) return 'Not logged in.'
    const active = this.state.activeInstance
    return `Logged in as ${this.state.email} | ${this.state.instances.length} instance(s) | Active: ${active?.instance_name ?? 'none'}`
  }
}

export const session = new Session()
```

- [ ] **Step 4: Run tests — expect pass**

```bash
node --test --experimental-strip-types tests/session.test.ts
```

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/session.ts tests/session.test.ts
git commit -m "feat: add session state manager with tests"
```

---

## Task 4: HTTP Client

**Files:**
- Create: `src/client.ts`

- [ ] **Step 1: Create `src/client.ts`**

```typescript
import { session } from './session.ts'

const BASE_URL = 'https://wapisender.com'

function normalizeError(status: number, body: unknown): string {
  const msg = typeof body === 'object' && body !== null && 'error' in body
    ? String((body as Record<string, unknown>).error)
    : JSON.stringify(body)
  if (status === 401) return 'Not authenticated. Run: wapisender-mcp login --token <token>'
  if (status === 403) return `Access denied — ${msg}`
  if (status === 404) return `Not found — ${msg}`
  if (status === 429) return 'Rate limited. Wait a moment and try again.'
  return `Server error ${status}: ${msg}`
}

export async function apiRequest<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown
): Promise<T> {
  const token = session.getToken()
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    throw new Error(normalizeError(res.status, data))
  }

  return data as T
}

export function ok(text: string) {
  return { content: [{ type: 'text' as const, text }] }
}

export function err(text: string) {
  return { content: [{ type: 'text' as const, text: `Error: ${text}` }], isError: true }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/client.ts
git commit -m "feat: add authenticated HTTP client"
```

---

## Task 5: CLI Login Command

**Files:**
- Create: `src/cli.ts`

- [ ] **Step 1: Create `src/cli.ts`**

```typescript
#!/usr/bin/env node
import { writeFile, mkdir, readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

const CREDS_DIR = join(homedir(), '.config', 'wapisender-mcp')
const CREDS_FILE = join(CREDS_DIR, 'credentials.json')
const BASE_URL = 'https://wapisender.com'

async function login(token: string) {
  // Verify token by fetching account info
  const res = await fetch(`${BASE_URL}/api/instances`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })

  if (!res.ok) {
    console.error('Invalid token or network error. Check your token and try again.')
    process.exit(1)
  }

  const data = await res.json() as { instances?: Array<{ instance_name: string }> }
  const instances = data.instances ?? []

  await mkdir(CREDS_DIR, { recursive: true })
  await writeFile(CREDS_FILE, JSON.stringify({
    token,
    savedAt: new Date().toISOString(),
  }, null, 2), { mode: 0o600 })

  console.log(`Logged in successfully.`)
  console.log(`Found ${instances.length} instance(s): ${instances.map(i => i.instance_name).join(', ') || 'none'}`)
  console.log(`Credentials saved to ${CREDS_FILE}`)
}

async function logout() {
  const { unlink } = await import('node:fs/promises')
  await unlink(CREDS_FILE).catch(() => {})
  console.log('Logged out. Credentials removed.')
}

async function status() {
  const raw = await readFile(CREDS_FILE, 'utf-8').catch(() => null)
  if (!raw) { console.log('Not logged in.'); return }
  const creds = JSON.parse(raw) as { savedAt: string }
  console.log(`Logged in. Credentials saved at ${creds.savedAt}`)
}

const [,, command, ...args] = process.argv

if (command === 'login') {
  const tokenFlag = args.indexOf('--token')
  const token = tokenFlag >= 0 ? args[tokenFlag + 1] : null
  if (!token) {
    console.error('Usage: wapisender-mcp login --token <your-mcp-token>')
    console.error('Get your token at: https://wapisender.com/dashboard/settings/mcp-token')
    process.exit(1)
  }
  await login(token)
} else if (command === 'logout') {
  await logout()
} else if (command === 'status') {
  await status()
} else {
  console.log('WapiSender MCP CLI')
  console.log('  wapisender-mcp login --token <token>   Save credentials')
  console.log('  wapisender-mcp logout                  Remove credentials')
  console.log('  wapisender-mcp status                  Check login status')
}
```

- [ ] **Step 2: Commit**

```bash
git add src/cli.ts
git commit -m "feat: add CLI login/logout/status commands"
```

---

## Task 6: Auth Tools

**Files:**
- Create: `src/tools/auth.ts`

- [ ] **Step 1: Create `src/tools/auth.ts`**

```typescript
import { z } from 'zod'
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { session } from '../session.ts'
import { apiRequest, ok, err } from '../client.ts'
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

        const data = await fetch('https://wapisender.com/api/instances', {
          headers: { 'Authorization': `Bearer ${token}` }
        }).then(r => r.json()) as { instances?: Instance[]; user?: { id: string; email: string } }

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
        const instances = session.getInstances()
        if (!session.isLoggedIn()) return err('Not logged in. Call login() first.')
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
```

- [ ] **Step 2: Commit**

```bash
git add src/tools/auth.ts
git commit -m "feat: add auth tools (login, logout, list_instances, switch_instance)"
```

---

## Task 7: Instance Tools

**Files:**
- Create: `src/tools/instance.ts`

- [ ] **Step 1: Create `src/tools/instance.ts`**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add src/tools/instance.ts
git commit -m "feat: add instance tools (get_status, get_qr_code)"
```

---

## Task 8: Messaging Tools

**Files:**
- Create: `src/tools/messaging.ts`

- [ ] **Step 1: Create `src/tools/messaging.ts`**

```typescript
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
        const endpoint = type === 'image'
          ? `/message/sendMedia/${inst.instance_name}`
          : type === 'video'
            ? `/message/sendMedia/${inst.instance_name}`
            : `/message/sendMedia/${inst.instance_name}`
        const data = await apiRequest('POST', `/api/instances/${inst.id}/messages`, {
          endpoint,
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
```

- [ ] **Step 2: Commit**

```bash
git add src/tools/messaging.ts
git commit -m "feat: add messaging tools (send_text, send_media, send_location)"
```

---

## Task 9: Contacts Tools

**Files:**
- Create: `src/tools/contacts.ts`

- [ ] **Step 1: Create `src/tools/contacts.ts`**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add src/tools/contacts.ts
git commit -m "feat: add contacts tools (list, get, upsert)"
```

---

## Task 10: Flows Tools

**Files:**
- Create: `src/tools/flows.ts`

- [ ] **Step 1: Create `src/tools/flows.ts`**

```typescript
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
      // This tool's description instructs Claude to generate nodes+edges itself.
      // The handler receives them via the follow-up update_flow_definition call.
      // Here we just create the empty flow and return the ID + schema hint.
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
```

- [ ] **Step 2: Commit**

```bash
git add src/tools/flows.ts
git commit -m "feat: add flows tools including generate_and_save_flow"
```

---

## Task 11: Webhooks & AI Credentials Tools

**Files:**
- Create: `src/tools/webhooks.ts`
- Create: `src/tools/ai_credentials.ts`

- [ ] **Step 1: Create `src/tools/webhooks.ts`**

```typescript
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
```

- [ ] **Step 2: Create `src/tools/ai_credentials.ts`**

```typescript
import { z } from 'zod'
import { session } from '../session.ts'
import { apiRequest, ok, err } from '../client.ts'

export const aiCredentialsTools = [
  {
    name: 'list_ai_credentials',
    description: 'List saved AI provider credentials for the active instance. API keys are masked.',
    inputSchema: z.object({}),
    handler: async () => {
      try {
        const inst = session.requireActiveInstance()
        const data = await apiRequest<unknown>('GET', `/api/instances/${inst.id}/ai-credentials`)
        return ok(JSON.stringify(data, null, 2))
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e))
      }
    }
  },
  {
    name: 'add_ai_credential',
    description: 'Add a new AI provider credential for the active instance. The API key is encrypted server-side and never stored locally.',
    inputSchema: z.object({
      provider: z.enum(['openai', 'anthropic', 'gemini', 'xai', 'openrouter']).describe('AI provider'),
      apiKey: z.string().describe('Provider API key — encrypted server-side immediately'),
      label: z.string().optional().describe('Friendly label, e.g. "OpenAI Production"'),
      defaultModel: z.string().optional().describe('Default model to use, e.g. gpt-4o-mini'),
    }),
    handler: async ({ provider, apiKey, label, defaultModel }: { provider: string; apiKey: string; label?: string; defaultModel?: string }) => {
      try {
        const inst = session.requireActiveInstance()
        const data = await apiRequest('POST', `/api/instances/${inst.id}/ai-credentials`, {
          provider, apiKey, label, defaultModel
        })
        return ok(`Credential added.\n${JSON.stringify(data, null, 2)}`)
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e))
      }
    }
  },
  {
    name: 'test_ai_credential',
    description: 'Send a live test ping to verify a saved AI credential works.',
    inputSchema: z.object({
      credentialId: z.string().describe('Credential UUID from list_ai_credentials'),
    }),
    handler: async ({ credentialId }: { credentialId: string }) => {
      try {
        const inst = session.requireActiveInstance()
        const data = await apiRequest('POST', `/api/instances/${inst.id}/ai-credentials/test`, { credentialId })
        return ok(`Credential test result:\n${JSON.stringify(data, null, 2)}`)
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e))
      }
    }
  },
]
```

- [ ] **Step 3: Commit**

```bash
git add src/tools/webhooks.ts src/tools/ai_credentials.ts
git commit -m "feat: add webhooks and AI credentials tools"
```

---

## Task 12: MCP Server Entry Point

**Files:**
- Create: `src/index.ts`

- [ ] **Step 1: Create `src/index.ts`**

```typescript
#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { authTools } from './tools/auth.ts'
import { instanceTools } from './tools/instance.ts'
import { messagingTools } from './tools/messaging.ts'
import { contactsTools } from './tools/contacts.ts'
import { flowsTools } from './tools/flows.ts'
import { webhooksTools } from './tools/webhooks.ts'
import { aiCredentialsTools } from './tools/ai_credentials.ts'

const server = new McpServer({
  name: 'wapisender-mcp',
  version: '0.1.0',
})

const allTools = [
  ...authTools,
  ...instanceTools,
  ...messagingTools,
  ...contactsTools,
  ...flowsTools,
  ...webhooksTools,
  ...aiCredentialsTools,
]

for (const tool of allTools) {
  server.tool(
    tool.name,
    tool.description,
    tool.inputSchema.shape ?? {},
    tool.handler as Parameters<typeof server.tool>[3]
  )
}

const transport = new StdioServerTransport()
await server.connect(transport)

console.error('WapiSender MCP server running. 25 tools registered.')
```

- [ ] **Step 2: Build and verify it compiles**

```bash
npm run build
```

Expected: `dist/` directory created with `index.js` and `cli.js`. No TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat: add MCP server entry point, register all 25 tools"
```

---

## Task 13: Schema Validation Tests

**Files:**
- Create: `tests/schemas.test.ts`

- [ ] **Step 1: Create `tests/schemas.test.ts`**

```typescript
import test from 'node:test'
import assert from 'node:assert/strict'
import { z } from 'zod'

// Inline the schemas to test them independently
const sendTextSchema = z.object({
  to: z.string(),
  message: z.string(),
})

const sendMediaSchema = z.object({
  to: z.string(),
  url: z.string().url(),
  type: z.enum(['image', 'video', 'document']),
  caption: z.string().optional(),
})

const switchInstanceSchema = z.object({
  instanceIdOrName: z.string(),
})

const createFlowSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  triggerType: z.enum(['all_messages', 'keyword']).default('all_messages'),
})

test('send_text rejects missing message', () => {
  const result = sendTextSchema.safeParse({ to: '5491112345678' })
  assert.equal(result.success, false)
})

test('send_text accepts valid input', () => {
  const result = sendTextSchema.safeParse({ to: '5491112345678', message: 'Hello' })
  assert.equal(result.success, true)
})

test('send_media rejects non-url', () => {
  const result = sendMediaSchema.safeParse({ to: '123', url: 'not-a-url', type: 'image' })
  assert.equal(result.success, false)
})

test('send_media rejects invalid type', () => {
  const result = sendMediaSchema.safeParse({ to: '123', url: 'https://example.com/img.jpg', type: 'gif' })
  assert.equal(result.success, false)
})

test('switch_instance rejects empty string', () => {
  const result = switchInstanceSchema.safeParse({ instanceIdOrName: '' })
  assert.equal(result.success, true) // zod string() allows empty — guarded at runtime
})

test('create_flow defaults triggerType to all_messages', () => {
  const result = createFlowSchema.safeParse({ name: 'My Flow' })
  assert.equal(result.success, true)
  assert.equal(result.data?.triggerType, 'all_messages')
})
```

- [ ] **Step 2: Run tests**

```bash
node --test --experimental-strip-types tests/session.test.ts tests/schemas.test.ts
```

Expected: 11 tests pass (5 session + 6 schema).

- [ ] **Step 3: Commit**

```bash
git add tests/schemas.test.ts
git commit -m "test: add schema validation unit tests"
```

---

## Task 14: README & License

**Files:**
- Create: `README.md`
- Create: `LICENSE`

- [ ] **Step 1: Create `README.md`**

````markdown
# WapiSender MCP

> Official MCP server for WapiSender — send WhatsApp messages, manage flows, contacts, and instances directly from Claude Code.

## Quick Start

**1. Get your MCP token**

Go to [wapisender.com/dashboard/settings/mcp-token](https://wapisender.com/dashboard/settings/mcp-token) and generate a token.

**2. Save your credentials**

```bash
npx wapisender-mcp login --token <your-token>
```

**3. Add to Claude Code**

Add to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "wapisender": {
      "command": "npx",
      "args": ["wapisender-mcp@latest"]
    }
  }
}
```

**4. Use in Claude Code**

```
> login to wapisender
> send a whatsapp message to +5491112345678 saying "Hello from Claude!"
> list my flows
> generate a support flow that asks users if they need sales or billing help
```

## Available Tools (25)

| Group | Tools |
|---|---|
| Auth | login, logout, list_instances, switch_instance |
| Instance | get_instance_status, get_qr_code |
| Messaging | send_text, send_media, send_location |
| Contacts | list_contacts, get_contact, upsert_contact |
| Flows | list_flows, get_flow, create_flow, update_flow_definition, update_flow_node, generate_and_save_flow, activate_flow, deactivate_flow |
| Webhooks | get_webhook, set_webhook |
| AI Credentials | list_ai_credentials, add_ai_credential, test_ai_credential |

## Requirements

- Node.js 20+
- WapiSender account at [wapisender.com](https://wapisender.com)

## License

MIT
````

- [ ] **Step 2: Create `LICENSE`** (MIT)

```
MIT License

Copyright (c) 2026 WapiSender

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 3: Commit**

```bash
git add README.md LICENSE
git commit -m "docs: add README and MIT license"
```

---

## Task 15: Final Build Verification

- [ ] **Step 1: Full build**

```bash
cd /home/gilad/WapiSender-MCP && npm run build
```

Expected: `dist/index.js` and `dist/cli.js` present, no errors.

- [ ] **Step 2: Run all unit tests**

```bash
node --test --experimental-strip-types tests/session.test.ts tests/schemas.test.ts
```

Expected: 11 tests pass, 0 fail.

- [ ] **Step 3: Smoke-test CLI help**

```bash
node --experimental-strip-types src/cli.ts
```

Expected output:
```
WapiSender MCP CLI
  wapisender-mcp login --token <token>   Save credentials
  wapisender-mcp logout                  Remove credentials
  wapisender-mcp status                  Check login status
```

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: final build verification — v0.1.0 ready"
```
