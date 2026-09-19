import test, { afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { authTools } from '../src/tools/auth.ts'
import { instanceTools } from '../src/tools/instance.ts'
import { messagingTools } from '../src/tools/messaging.ts'
import { contactsTools } from '../src/tools/contacts.ts'
import { flowsTools } from '../src/tools/flows.ts'
import { webhooksTools } from '../src/tools/webhooks.ts'
import { aiCredentialsTools } from '../src/tools/ai_credentials.ts'
import { session } from '../src/session.ts'

const allTools = [
  ...authTools,
  ...instanceTools,
  ...messagingTools,
  ...contactsTools,
  ...flowsTools,
  ...webhooksTools,
  ...aiCredentialsTools,
]

function tool(name: string) {
  const match = allTools.find(item => item.name === name)
  assert.ok(match, `Expected tool ${name} to be registered`)
  return match
}

function parse(name: string, input: unknown) {
  return tool(name).inputSchema.safeParse(input)
}

function loginForTest() {
  const activeInstance = {
    id: 'instance-1',
    instance_name: 'Main',
    api_key: null,
    status: 'connected',
    subscription_status: 'active',
    created_at: '2026-01-01',
  }
  session.setSession({
    token: 'wapi_test',
    userId: 'user-1',
    email: 'test@example.com',
    instances: [activeInstance],
    activeInstance,
  })
}

async function invoke(name: string, input: Record<string, unknown>) {
  const selected = tool(name)
  return (selected.handler as (args: Record<string, unknown>) => Promise<unknown>)(input)
}

afterEach(() => {
  session.clear()
})

test('tool registry has unique names and excludes unsupported app routes', () => {
  const names = allTools.map(item => item.name)
  assert.equal(new Set(names).size, names.length)
  assert.equal(names.length, 42)
  for (const removed of ['get_qr_code', 'disconnect_instance', 'check_number', 'delete_contact', 'list_chats', 'get_chat_messages', 'mark_as_read']) {
    assert.equal(names.includes(removed), false)
  }
})

test('messaging schemas enforce current interactive limits', () => {
  assert.equal(parse('send_buttons', {
    to: '54911', title: 'Choose', body: 'Pick one', buttons: [],
  }).success, false)
  assert.equal(parse('send_buttons', {
    to: '54911', title: 'Choose', body: 'Pick one',
    buttons: [{ id: 'yes', title: 'Yes' }, { id: 'no', title: 'No' }],
  }).success, true)
  assert.equal(parse('send_list', {
    to: '54911', title: 'Choose', body: 'Pick one', buttonText: 'Open',
    sections: [{ title: 'Options', rows: [{ id: 'one', title: 'One' }] }],
  }).success, true)
})

test('flow schemas use current WapiSender trigger types', () => {
  assert.equal(parse('create_flow', { name: 'Support', triggerType: 'message_received' }).success, true)
  assert.equal(parse('create_flow', { name: 'Legacy', triggerType: 'all_messages' }).success, false)
  assert.equal(parse('generate_and_save_flow', {
    name: 'Support',
    description: 'Routes support requests',
    nodes: [{ id: 'trigger-1', type: 'trigger', position: { x: 0, y: 0 }, data: { match: 'any', keywords: [] } }],
    edges: [],
  }).success, true)
})

test('AI credential schema supports new providers and requires Ollama base URL', () => {
  assert.equal(parse('add_ai_credential', {
    provider: 'groq', label: 'Groq', apiKey: '12345678',
  }).success, true)
  assert.equal(parse('add_ai_credential', {
    provider: 'ollama', label: 'Local', apiKey: '',
  }).success, false)
  assert.equal(parse('add_ai_credential', {
    provider: 'ollama', label: 'Local', apiKey: '', baseUrl: 'http://localhost:11434',
  }).success, true)
})

test('send_buttons emits the deployed reply-button payload', async () => {
  loginForTest()
  let requestBody: Record<string, unknown> | undefined
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>
    return new Response(JSON.stringify({ result: { accepted: true } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  try {
    await invoke('send_buttons', {
      to: '54911', title: 'Choose', body: 'Pick one',
      buttons: [{ id: 'yes', title: 'Yes' }],
    })
  } finally {
    globalThis.fetch = originalFetch
  }

  const payload = requestBody?.payload as { buttons?: unknown[] }
  assert.deepEqual(payload.buttons, [{ type: 'reply', displayText: 'Yes', id: 'yes' }])
})

test('send_list maps row IDs and footerText to the deployed payload', async () => {
  loginForTest()
  let requestBody: Record<string, unknown> | undefined
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>
    return new Response(JSON.stringify({ result: { accepted: true } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  try {
    await invoke('send_list', {
      to: '54911', title: 'Choose', body: 'Pick one', footer: 'Footer', buttonText: 'Open',
      sections: [{ title: 'Options', rows: [{ id: 'one', title: 'One' }] }],
    })
  } finally {
    globalThis.fetch = originalFetch
  }

  const payload = requestBody?.payload as { footerText?: string; sections?: Array<{ rows?: unknown[] }> }
  assert.equal(payload.footerText, 'Footer')
  assert.deepEqual(payload.sections?.[0]?.rows, [{ rowId: 'one', title: 'One' }])
})

test('set_webhook nests the upstream webhook contract', async () => {
  loginForTest()
  let requestBody: Record<string, unknown> | undefined
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  try {
    await invoke('set_webhook', {
      url: 'https://example.com/hook', enabled: true, byEvents: false, base64: false,
      events: ['MESSAGES_UPSERT'],
    })
  } finally {
    globalThis.fetch = originalFetch
  }

  assert.deepEqual(requestBody, {
    webhook: {
      url: 'https://example.com/hook', enabled: true, byEvents: false, base64: false,
      events: ['MESSAGES_UPSERT'],
    },
  })
})

test('update_flow_node uses the race-safe single-node route', async () => {
  loginForTest()
  let requestedUrl = ''
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input) => {
    requestedUrl = String(input)
    return new Response(JSON.stringify({ flow: { id: 'flow-1', name: 'Flow' }, node: { id: 'node-1' } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  try {
    await invoke('update_flow_node', { flowId: 'flow-1', nodeId: 'node-1', data: { text: 'Hello' } })
  } finally {
    globalThis.fetch = originalFetch
  }

  assert.match(requestedUrl, /\/flows\/flow-1\/nodes\/node-1$/)
})
