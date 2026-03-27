#!/usr/bin/env node
import { writeFile, mkdir, readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

const CREDS_DIR = join(homedir(), '.config', 'wapisender-mcp')
const CREDS_FILE = join(CREDS_DIR, 'credentials.json')
const BASE_URL = 'https://wapisender.com'

async function login(token: string) {
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
