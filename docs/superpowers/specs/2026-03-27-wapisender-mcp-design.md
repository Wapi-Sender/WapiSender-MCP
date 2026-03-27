# WapiSender MCP — Design Spec

**Date:** 2026-03-27
**Status:** Approved
**Scope:** v1 — Stateful session MCP, full platform tools, npm published, open source

---

## Overview

A Model Context Protocol (MCP) server that gives Claude Code and Codex full access to the WapiSender platform. Users log in with a WapiSender MCP token, select an instance, and Claude can send messages, manage flows (including generating them from natural language), manage contacts, configure webhooks, and manage AI credentials — all from the terminal.

---

## Architecture

### Approach

Stateful session MCP with smart tools. The server holds an in-memory session (token, selected instance, instance list). Tools are designed around what Claude needs to do, not what the raw API exposes. Auth token management is internal and transparent.

### Tech Stack

- Node.js + TypeScript
- `@modelcontextprotocol/sdk` — official MCP protocol implementation
- Native `fetch` — no extra HTTP dependencies
- `zod` — input validation on every tool
- No framework, no ORM, no heavy deps

### Project Structure

```
wapisender-mcp/
├── src/
│   ├── index.ts              # MCP server entry point, registers all tools
│   ├── session.ts            # In-memory session: token, active instance, instance list
│   ├── client.ts             # Authenticated HTTP client → wapisender.com/api
│   ├── cli.ts                # `wapisender-mcp login` CLI command
│   ├── tools/
│   │   ├── auth.ts           # login, logout, list_instances, switch_instance
│   │   ├── instance.ts       # get_instance_status, get_qr_code
│   │   ├── messaging.ts      # send_text, send_media, send_location
│   │   ├── contacts.ts       # list_contacts, get_contact, upsert_contact
│   │   ├── flows.ts          # list_flows, get_flow, create_flow, update_flow_definition,
│   │   │                     # update_flow_node, generate_and_save_flow,
│   │   │                     # activate_flow, deactivate_flow
│   │   ├── webhooks.ts       # get_webhook, set_webhook
│   │   └── ai_credentials.ts # list_ai_credentials, add_ai_credential, test_ai_credential
│   └── types.ts              # Shared TypeScript types
├── tests/
│   ├── session.test.ts       # Session state unit tests
│   ├── schemas.test.ts       # Zod schema validation unit tests
│   └── integration/
│       └── live.test.ts      # Optional live tests against real account
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

---

## Authentication — v1 (Token-based)

### User Flow

1. User generates an MCP token from the WapiSender dashboard (Settings → MCP Token)
2. Runs `npx wapisender-mcp login --token <token>`
3. CLI verifies token, fetches account info, saves to `~/.config/wapisender-mcp/credentials.json`
4. On MCP server start, token is read automatically from credentials file
5. No env vars or credentials needed in Claude Code config

### Token File

Stored at `~/.config/wapisender-mcp/credentials.json`. Never committed (gitignored globally).

```json
{
  "token": "wapi_...",
  "email": "user@example.com",
  "savedAt": "2026-03-27T12:00:00.000Z"
}
```

### Claude Code Config

Users add this once to `~/.claude/settings.json`:

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

### v2 Follow-up — Browser OAuth Flow

A future `wapisender-mcp login` (no `--token` flag) will open `wapisender.com/auth/mcp-connect` in the browser. The user approves, WapiSender redirects back with a short-lived code, MCP exchanges it for a long-lived token. Requires adding a callback/exchange endpoint to the WapiSender Next.js app. Planned for after v1 is live and validated.

---

## Session Management

In-memory session for the lifetime of the MCP server process:

```ts
type Session = {
  token: string
  userId: string
  email: string
  instances: Instance[]       // fetched at startup
  activeInstance: Instance | null
}
```

- On server start: token loaded from credentials file, account + instances fetched
- If user has exactly 1 instance: auto-selected
- If user has multiple: `list_instances` is returned, user calls `switch_instance`
- `switch_instance` validates against `session.instances` before accepting
- All tools check `session.activeInstance` before proceeding; return a clear error if not set

---

## Data Flow

```
Claude calls tool
  → Zod validates inputs (rejects early with clear message on bad input)
  → client.ts attaches Authorization: Bearer {token}
  → POST/GET https://wapisender.com/api/...
  → 4xx/5xx normalized to human-readable error string
  → typed response returned to Claude
```

### Two API layers (both via wapisender.com)

- **Platform API** (`/api/instances`, `/api/flows`, `/api/contacts`, etc.) — uses MCP token
- **Wapi proxy** (`/api/instances/[id]/messages`, `/api/instances/[id]/status`, etc.) — uses MCP token, WapiSender proxies to Evolution internally

The MCP never talks to Evolution directly. All calls go through `wapisender.com/api`, which means entitlement checks, rate limits, and the security layer are respected automatically.

### Error Normalization

| HTTP Status | Message to Claude |
|---|---|
| `401` | "Not authenticated. Call login() or run `wapisender-mcp login`." |
| `403` | "Access denied — trial may be expired or instance outside plan capacity." |
| `404` | "Not found — check instance ID, flow ID, or contact ID." |
| `429` | "Rate limited. Wait a moment and try again." |
| `5xx` | Raw error message surfaced so Claude can reason about it. |

---

## Tool Catalog (25 tools)

### Auth & Account (4)

| Tool | Inputs | What it does |
|---|---|---|
| `login` | — | Loads token from credentials file, fetches account + instances, auto-selects if only one |
| `logout` | — | Clears in-memory session |
| `list_instances` | — | Returns all instances with name, status, phone number |
| `switch_instance` | `instanceId` or `instanceName` | Sets the active instance for all subsequent tool calls |

### Instance (2)

| Tool | Inputs | What it does |
|---|---|---|
| `get_instance_status` | — | Connection state, phone number, battery, connected since |
| `get_qr_code` | — | Returns QR code data for connecting a WhatsApp number |

### Messaging (3)

| Tool | Inputs | What it does |
|---|---|---|
| `send_text` | `to`, `message` | Send a WhatsApp text message |
| `send_media` | `to`, `url`, `type`, `caption?` | Send image/video/doc with optional caption |
| `send_location` | `to`, `lat`, `lng`, `name?` | Send a location pin |

### Contacts (3)

| Tool | Inputs | What it does |
|---|---|---|
| `list_contacts` | `search?`, `limit?` | List contacts with optional search |
| `get_contact` | `phone` | Get a single contact by phone number |
| `upsert_contact` | `phone`, `name?`, `email?` | Create or update a contact |

### Flows (8)

| Tool | Inputs | What it does |
|---|---|---|
| `list_flows` | — | List all flows with status (active/draft) |
| `get_flow` | `flowId` | Get full flow definition + health warnings |
| `create_flow` | `name`, `description?`, `triggerType` | Create a new empty flow |
| `update_flow_definition` | `flowId`, `nodes`, `edges` | Write a full node+edge graph to a flow |
| `update_flow_node` | `flowId`, `nodeId`, `data` | Edit a single node's config without touching the rest of the graph |
| `generate_and_save_flow` | `description`, `name`, `triggerType?` | Claude generates valid flow JSON from plain-English description, saves it, returns preview |
| `activate_flow` | `flowId` | Enable a flow (runs health check first, surfaces warnings) |
| `deactivate_flow` | `flowId` | Disable a flow |

The `generate_and_save_flow` tool embeds the full WapiSender node schema (trigger, send_message, condition, delay, wait_for_reply, ai_agent, end) in the tool description so Claude generates structurally valid graphs without hallucinating node types.

### Webhooks (2)

| Tool | Inputs | What it does |
|---|---|---|
| `get_webhook` | — | Get current webhook config for the active instance |
| `set_webhook` | `url`, `events?`, `enabled?` | Set webhook URL and event subscriptions |

### AI Credentials (3)

| Tool | Inputs | What it does |
|---|---|---|
| `list_ai_credentials` | — | List saved AI provider credentials |
| `add_ai_credential` | `provider`, `apiKey`, `label?`, `model?` | Add a new credential (encrypted server-side, never stored in MCP) |
| `test_ai_credential` | `credentialId` | Live-ping the provider to verify the credential works |

---

## Flow Generation

`generate_and_save_flow` is the signature tool of this MCP. The tool description includes:

1. **Node type registry** — all valid node types with their required fields
2. **Edge rules** — how nodes connect (trigger has one output, condition has true/false outputs, etc.)
3. **Example graph** — a minimal 3-node flow as a JSON reference

Claude uses this schema context to produce a valid flow graph. The tool then:
1. Calls `create_flow` to get a flow ID
2. Calls `update_flow_definition` with the generated nodes + edges
3. Runs the health check
4. Returns the flow ID, a node count summary, and any health warnings

---

## Distribution

**npm package:**
```json
{
  "name": "wapisender-mcp",
  "version": "0.1.0",
  "bin": {
    "wapisender-mcp": "./dist/cli.js",
    "wapisender-mcp-server": "./dist/index.js"
  },
  "files": ["dist/", "README.md", "LICENSE"]
}
```

**Two entry points:**
- `wapisender-mcp` — CLI for login/logout/status
- `wapisender-mcp-server` — the MCP server process (what Claude Code runs)

**GitHub repo:** Open source, MIT licensed. Contributions welcome. Issue tracker for bug reports.

---

## Testing

### Unit Tests (`npm test`)
- Session state: login, switch_instance, logout, auto-select single instance
- Zod schemas: invalid inputs rejected with correct error messages
- Error normalization: 401/403/404/429/500 produce correct strings

### Integration Tests (`npm run test:integration`)
- Opt-in, requires valid credentials file
- Covers: login, list_instances, send_text (to a test number), list_flows
- Not run in CI by default (requires live account)

---

## WapiSender App Prerequisites (must ship before MCP v1 release)

The MCP itself needs no changes to the WapiSender Next.js app except one:

- **Settings → MCP Token** — a page (or section) in the WapiSender dashboard where users can generate, view, and revoke a long-lived MCP token. The token is tied to the user's account and behaves like the Supabase JWT for API calls. Without this, users have no way to obtain a token for `wapisender-mcp login --token`.

---

## Open Questions / v2 Backlog

- Browser OAuth login flow (open `wapisender.com/auth/mcp-connect`)
- Separate Evolution API MCP project (self-hosted users, different repo)
- `wapisender-mcp doctor` command — checks credentials, connectivity, active instance
- Flow import/export tools
- Message history / conversation reading tools
