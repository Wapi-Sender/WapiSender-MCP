# WapiSender MCP

> Official MCP server for WapiSender. Use it from Claude Code, Codex, and other MCP-compatible clients to manage WhatsApp instances, send messages, manage contacts, configure webhooks, and build flows.

## What This MCP Does

WapiSender MCP gives your MCP client access to the WapiSender platform through a stateful session.

It supports:

- Logging into your WapiSender account with an MCP token
- Listing and switching between WhatsApp instances
- Refreshing live instance status and metadata
- Sending text, media, voice notes, stickers, locations, buttons, lists, reactions, contact cards, and polls
- Searching contacts and changing contact block status
- Creating, updating, cloning, simulating, activating, and inspecting flows
- Managing instance webhooks
- Managing AI provider credentials used by flows

## What's New in v0.2.0

This release realigns the MCP with the current WapiSender application and expands the catalog from 25 to 42 tools.

### Messaging

- Added voice-note, sticker, button, list, reaction, contact-card, poll, bulk-text, and personalized-template tools.
- Updated interactive button payloads to use reply buttons shaped as `type`, `displayText`, and `id`.
- Updated list rows to use `rowId` and list footers to use `footerText`.
- Corrected the current reaction, poll, contact-card, audio, media, and location payload contracts.
- Message tools now distinguish API acceptance from recipient-visible delivery.

### Flows

- Added current `message_received` and `manual` trigger types.
- Added the current webhook and human-handoff node definitions.
- Added atomic full-flow creation and cloning.
- Added race-safe single-node updates through the dedicated node route.
- Added `simulate_flow` and `get_flow_logs` for testing and execution inspection.

### Contacts, instances, and webhooks

- Added live instance refresh through `?live=true`.
- Added client-side contact search and pagination over WapiSender's normalized contact response.
- Replaced the unsupported contact upsert with `set_contact_block_status`.
- Corrected webhook updates to send the nested `{ webhook: ... }` contract.

### AI providers and self-hosting

- Added Ollama, Mistral, DeepSeek, Groq, Kimi, and Hugging Face alongside the existing providers.
- Added credential updates for API-key rotation, base URLs, models, labels, and active state.
- Added `WAPISENDER_BASE_URL` for self-hosted WapiSender deployments.

### Compatibility cleanup

- Removed MCP tools for application routes that do not currently exist: QR retrieval, disconnect, number checking, chat history, mark-as-read, and contact deletion.
- Added 30-second API request timeouts and clearer HTTP error handling.
- Replaced duplicated test-only schemas with contract tests against the actual registered tools and emitted payloads.

## Requirements

- Node.js 20+
- A WapiSender account at [wapisender.com](https://wapisender.com)
- A WapiSender MCP token from [wapisender.com/dashboard/settings/mcp-token](https://wapisender.com/dashboard/settings/mcp-token)

## Installation Model

You do not need to install this package globally.

Most clients can run it directly with:

```bash
npx wapisender-mcp@latest
```

If you prefer a local installation, install it from npm:

```bash
npm install -g wapisender-mcp@latest
```

After installing globally you can run the CLI and server directly:

```bash
wapisender-mcp
wapisender-mcp-server
```

The package includes:

- `wapisender-mcp`: CLI entrypoint
- `wapisender-mcp-server`: MCP server entrypoint over stdio

For a self-hosted WapiSender deployment, set `WAPISENDER_BASE_URL` for both the CLI login and the MCP server process:

```bash
export WAPISENDER_BASE_URL="https://your-wapisender.example.com"
```

## Quick Start

### 1. Generate your MCP token

Go to:

```text
https://wapisender.com/dashboard/settings/mcp-token
```

### 2. Save your credentials locally

```bash
npx wapisender-mcp login --token <your-mcp-token>
```

This validates the token and stores it at:

```text
~/.config/wapisender-mcp/credentials.json
```

### 3. Add the MCP server to your client

#### Codex

Add this to `~/.codex/config.toml`:

```toml
[mcp_servers.wapisender]
command = "npx"
args = ["wapisender-mcp@latest"]
```

Explicit server form:

```toml
[mcp_servers.wapisender]
command = "npx"
args = ["-y", "-p", "wapisender-mcp@latest", "wapisender-mcp-server"]
```

#### Claude Code

Add this to `~/.claude/settings.json`:

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

Explicit server form:

```json
{
  "mcpServers": {
    "wapisender": {
      "command": "npx",
      "args": ["-y", "-p", "wapisender-mcp@latest", "wapisender-mcp-server"]
    }
  }
}
```

### 4. Use it in your MCP client

Natural-language examples:

```text
login to wapisender
list my instances
switch to instance WABZ3
show me the current instance status
send a WhatsApp message to +5491112345678 saying "Hello from WapiSender MCP"
list my flows
create a support flow that asks whether the user needs sales or billing help
```

Tool-call examples for the same session:

`login`

```json
{}
```

`switch_instance`

```json
{
  "instanceIdOrName": "WABZ3"
}
```

`send_text`

```json
{
  "to": "5491112345678",
  "message": "Hello from WapiSender MCP"
}
```

## How Authentication Works

The CLI stores only your MCP token locally. The MCP server loads that token and creates an in-memory session when you call `login`.

The session tracks:

- Your WapiSender account
- The list of instances available to that account
- The active instance used by all instance-scoped tools

If your account has exactly one instance, it is auto-selected during `login`.

If your account has more than one instance, you should call:

1. `list_instances`
2. `switch_instance`

After that, all instance-scoped tools use the selected instance.

## Multiple Instances

Yes, multi-instance accounts are supported.

### Typical workflow

1. Log in
2. List your instances
3. Pick the instance you want to work on
4. Switch to it
5. Run your messaging, flow, webhook, or contact tools

Example:

```text
login to wapisender
list my instances
switch to instance Sales-BR
send a message to 5491112345678 saying "Hello from the Brazil sales number"
```

Tool-call example:

`list_instances`

```json
{}
```

`switch_instance`

```json
{
  "instanceIdOrName": "Sales-BR"
}
```

Expected behavior:

- `login` auto-selects the instance if the account has only one
- `switch_instance` accepts either the instance name or the instance ID
- All subsequent tool calls use the new active instance

## CLI Commands

```bash
npx wapisender-mcp
npx wapisender-mcp serve
npx wapisender-mcp login --token <your-mcp-token>
npx wapisender-mcp logout
npx wapisender-mcp status
```

### CLI examples

Save credentials:

```bash
npx wapisender-mcp login --token wapi_xxxxxxxxxxxxxxxxx
```

Check whether credentials are saved:

```bash
npx wapisender-mcp status
```

Remove saved credentials:

```bash
npx wapisender-mcp logout
```

## Available Tools

There are 42 tools grouped into 7 areas. The catalog is generated from routes that currently exist in WapiSender; unsupported chat-history, contact-delete, QR, disconnect, and number-check routes are intentionally not exposed.

### Auth

#### `login`

Loads saved credentials and connects to your WapiSender account.

Notes:

- No arguments
- Auto-selects the active instance if your account has only one instance

Example:

```json
{}
```

#### `logout`

Clears the current WapiSender session.

Example:

```json
{}
```

#### `list_instances`

Lists all WhatsApp instances on your WapiSender account.

Example:

```json
{}
```

#### `switch_instance`

Sets the active instance by ID or by `instance_name`.

Example:

```json
{
  "instanceIdOrName": "WABZ3"
}
```

#### `refresh_instances`

Re-fetches the instance list from the API and updates the session — without requiring a full re-login. Useful after adding a new instance.

Example:

```json
{}
```

#### `get_session_info`

Returns the current session state: who you are logged in as, all instances, and which instance is active. Makes no API calls — reads local session only.

Example:

```json
{}
```

### Instance

#### `get_instance_status`

Returns the connection state for the active instance, including phone number and battery level when available.

Example:

```json
{}
```

### Messaging

#### `send_text`

Submits a text WhatsApp message. API acceptance does not prove recipient delivery.

Example:

```json
{
  "to": "5491112345678",
  "message": "Hello from WapiSender MCP"
}
```

#### `send_media`

Sends an image, video, or document from a public URL. `caption` is optional and omitted when not provided.

Example image:

```json
{
  "to": "5491112345678",
  "type": "image",
  "url": "https://example.com/banner.jpg",
  "caption": "Campaign preview"
}
```

Example document:

```json
{
  "to": "5491112345678",
  "type": "document",
  "url": "https://example.com/invoice.pdf",
  "caption": "Invoice attached"
}
```

#### `send_audio`

Sends a WhatsApp audio/voice note from a public URL.

Example:

```json
{
  "to": "5491112345678",
  "url": "https://example.com/voice-note.ogg"
}
```

#### `send_sticker`

Submits a WhatsApp sticker from a public image URL.

```json
{
  "to": "5491112345678",
  "url": "https://example.com/sticker.webp"
}
```

#### `send_location`

Sends a WhatsApp location pin.

Example:

```json
{
  "to": "5491112345678",
  "lat": -34.6037,
  "lng": -58.3816,
  "name": "Buenos Aires Office",
  "address": "Buenos Aires, Argentina"
}
```

#### `send_buttons`

Sends an interactive button message. The recipient sees up to 3 tappable buttons.

Example:

```json
{
  "to": "5491112345678",
  "title": "Choose an option",
  "body": "How can we help you today?",
  "footer": "WapiSender Support",
  "buttons": [
    { "id": "sales", "title": "Sales" },
    { "id": "support", "title": "Support" },
    { "id": "billing", "title": "Billing" }
  ]
}
```

#### `send_list`

Sends an interactive list message. A button opens a scrollable menu of options.

Example:

```json
{
  "to": "5491112345678",
  "title": "Our Services",
  "body": "Please select a department:",
  "footer": "We reply within 1 hour",
  "buttonText": "View options",
  "sections": [
    {
      "title": "Support",
      "rows": [
        { "id": "tech", "title": "Technical Support", "description": "Hardware & software issues" },
        { "id": "billing", "title": "Billing", "description": "Invoices & payments" }
      ]
    }
  ]
}
```

#### `send_reaction`

Reacts to a WhatsApp message with an emoji. Pass an empty string `""` to remove a reaction.

Example:

```json
{
  "to": "5491112345678",
  "messageId": "ABC123DEF456",
  "emoji": "👍"
}
```

#### `send_contact_card`

Sends a WhatsApp contact card (vCard). Shares a contact's name and phone number.

Example:

```json
{
  "to": "5491112345678",
  "contactName": "Alice Smith",
  "contactPhone": "5491187654321",
  "organization": "Acme Corp"
}
```

#### `send_poll`

Sends a WhatsApp poll with a question and 2-12 options.

Example:

```json
{
  "to": "5491112345678",
  "question": "Which plan do you prefer?",
  "options": ["Starter", "Pro", "Enterprise"],
  "selectableCount": 1
}
```

#### `send_bulk_text`

Sends the same text to multiple recipients and returns a per-recipient success/failure summary.

Example:

```json
{
  "recipients": ["5491112345678", "5491187654321"],
  "message": "Hello from WapiSender MCP",
  "dedupe": true
}
```

#### `send_template_text`

Sends personalized text messages by replacing `{{placeholders}}` with each recipient's variables.

Example:

```json
{
  "template": "Hi {{name}}, your verification code is {{code}}.",
  "recipients": [
    { "to": "5491112345678", "variables": { "name": "Ana", "code": 123456 } },
    { "to": "5491187654321", "variables": { "name": "Leo", "code": 654321 } }
  ],
  "dedupe": true
}
```

### Contacts

#### `list_contacts`

Lists contacts on the active instance. Supports search, limit, and offset for pagination, and returns a compact formatted summary.

Example:

```json
{
  "limit": 20,
  "offset": 0
}
```

Page 2 example:

```json
{
  "limit": 20,
  "offset": 20
}
```

Example with search:

```json
{
  "search": "gilad",
  "limit": 10
}
```

#### `get_contact`

Looks up a single contact by phone number.

Example:

```json
{
  "phone": "5491112345678"
}
```

#### `set_contact_block_status`

Blocks or unblocks a WhatsApp contact using the current WapiSender contact route.

Example:

```json
{
  "phone": "5491112345678",
  "status": "block"
}
```

### Flows

#### `list_flows`

Lists all flows on the active instance and returns a compact formatted summary (`id | name | status | trigger`).

Example:

```json
{}
```

#### `get_flow`

Returns the full definition and health status of a flow.

Example:

```json
{
  "flowId": "a07692d5-a56c-4027-9cb9-19b44c33eb2c"
}
```

#### `create_flow`

Creates an empty flow shell. Current trigger types are `message_received` and `manual`; keyword matching belongs in a trigger node's `data`.

Example:

```json
{
  "name": "Support Router",
  "description": "Routes inbound messages to sales or support",
  "triggerType": "message_received",
  "triggerConfig": {}
}
```

#### `update_flow_definition`

Replaces the full node and edge graph of an existing flow.

Minimal example:

```json
{
  "flowId": "a07692d5-a56c-4027-9cb9-19b44c33eb2c",
  "nodes": [
    {
      "id": "trigger-1",
      "type": "trigger",
      "position": { "x": 250, "y": 100 },
      "data": { "match": "any", "keywords": [] }
    },
    {
      "id": "message-1",
      "type": "send_message",
      "position": { "x": 250, "y": 350 },
      "data": {
        "messageType": "text",
        "text": "Hello. Reply with sales or support."
      }
    },
    {
      "id": "end-1",
      "type": "end",
      "position": { "x": 250, "y": 600 },
      "data": {}
    }
  ],
  "edges": [
    { "id": "e1", "source": "trigger-1", "target": "message-1" },
    { "id": "e2", "source": "message-1", "target": "end-1" }
  ]
}
```

#### `update_flow_node`

Updates just one node inside an existing flow.

Example:

```json
{
  "flowId": "a07692d5-a56c-4027-9cb9-19b44c33eb2c",
  "nodeId": "message-1",
  "data": {
    "text": "Hello. Reply with sales, support, or billing."
  }
}
```

#### `generate_and_save_flow`

Generates a complete WhatsApp flow from a plain-English description and saves it **fully in one step** — including the node graph. The AI generates the nodes and edges, then this tool creates and saves everything atomically.

Example:

```json
{
  "name": "Lead Qualification",
  "description": "A flow that greets the user, asks for their company size, and routes enterprise leads to sales.",
  "triggerType": "message_received",
  "triggerConfig": {},
  "nodes": [ ... ],
  "edges": [ ... ]
}
```

Natural-language example:

```text
Generate and save a WhatsApp flow named "Lead Qualification" that greets the user, asks for company size, and routes enterprise leads to sales.
```

#### `rename_flow`

Renames an existing flow without touching its node graph or activation state.

Example:

```json
{
  "flowId": "a07692d5-a56c-4027-9cb9-19b44c33eb2c",
  "name": "New Flow Name"
}
```

#### `activate_flow`

Enables a flow after a health check.

Example:

```json
{
  "flowId": "a07692d5-a56c-4027-9cb9-19b44c33eb2c"
}
```

#### `deactivate_flow`

Disables a flow.

Example:

```json
{
  "flowId": "a07692d5-a56c-4027-9cb9-19b44c33eb2c"
}
```

#### Flow node schema

`update_flow_definition` and `generate_and_save_flow` use these node types:

```text
trigger:      { type: "trigger", data: { match: "any"|"contains"|"exact"|"regex", keywords: string[] } }
send_message: { type: "send_message", data: { messageType: "text"|"image"|"video"|"document"|"audio"|"voice"|"buttons"|"list"|"location"|"poll"|"sticker", text?: string } }
condition:    { type: "condition", data: { source: "last_message"|"custom", variableName?: string, operator: "equals"|"contains"|"starts_with"|"ends_with"|"regex", value: string } }
delay:        { type: "delay", data: { amount: number, unit: "seconds"|"minutes"|"hours"|"days" } }
webhook:      { type: "webhook", data: { method: string, url: string, headers?: object, body?: string, responseVariable?: string } }
wait_for_reply:{ type: "wait_for_reply", data: {} }
human_handoff:{ type: "human_handoff", data: { message?: string, resumeAfterMinutes: number } }
ai_agent:     { type: "ai_agent", data: { mode: "reply"|"router"|"extract", credentialId: string, provider: string, model: string, systemPrompt: string, promptTemplate: string, outputVariable: string } }
end:          { type: "end", data: {} }
```

Edge format:

```text
{ id: "e1", source: "nodeId", target: "nodeId", sourceHandle?: "true"|"false" }
```

Recommended positioning:

```text
Start near { x: 250, y: 100 } and space nodes vertically by about 250px.
```

#### `delete_flow`

Permanently deletes a flow. This cannot be undone.

Example:

```json
{
  "flowId": "a07692d5-a56c-4027-9cb9-19b44c33eb2c"
}
```

#### `clone_flow`

Duplicates an existing flow under a new name. The clone starts inactive so you can edit before activating.

Example:

```json
{
  "flowId": "a07692d5-a56c-4027-9cb9-19b44c33eb2c",
  "name": "Support Router v2"
}
```

#### `simulate_flow`

Simulates an incoming message and returns flow logs without sending WhatsApp messages.

```json
{
  "flowId": "a07692d5-a56c-4027-9cb9-19b44c33eb2c",
  "message": "I need support",
  "from": "5491112345678"
}
```

#### `get_flow_logs`

Returns recent execution logs for a flow.

```json
{
  "flowId": "a07692d5-a56c-4027-9cb9-19b44c33eb2c",
  "limit": 50
}
```

### Webhooks

#### `get_webhook`

Returns the current webhook configuration for the active instance.

Example:

```json
{}
```

#### `set_webhook`

Creates or updates the webhook URL and event subscriptions. The `events` array accepts only known event types:

```
MESSAGES_UPSERT         — new message received or sent
MESSAGES_UPDATE         — message status update
MESSAGE_RECEIPT_UPDATE  — delivery/read receipt updates
CONNECTION_UPDATE       — connection state changes
QRCODE_UPDATED          — new QR code available
CONTACTS_UPSERT         — contact added or updated
CONTACTS_UPDATE         — contact updated
PRESENCE_UPDATE         — user presence changes
CHATS_UPSERT            — chat metadata updates
GROUPS_UPSERT           — group created or updated
GROUP_PARTICIPANTS_UPDATE — group participant changes
```

Example:

```json
{
  "url": "https://example.com/api/webhooks/wapisender",
  "enabled": true,
  "byEvents": false,
  "base64": false,
  "events": ["MESSAGES_UPSERT", "CONNECTION_UPDATE"]
}
```

### AI Credentials

#### `list_ai_credentials`

Lists saved AI credentials for the active instance. Keys are masked.

Example:

```json
{}
```

#### `add_ai_credential`

Adds an AI provider credential to the active instance.

Supported providers:

- `openai`
- `anthropic`
- `gemini`
- `xai`
- `openrouter`
- `ollama`
- `mistral`
- `deepseek`
- `groq`
- `kimi`
- `huggingface`

Example:

```json
{
  "provider": "openai",
  "apiKey": "sk-...",
  "label": "OpenAI Production",
  "defaultModel": "gpt-4o-mini"
}
```

#### `test_ai_credential`

Runs a live verification for a saved AI credential.

Example:

```json
{
  "credentialId": "cred_12345678"
}
```

#### `delete_ai_credential`

Removes a saved AI provider credential from the active instance.

Example:

```json
{
  "credentialId": "cred_12345678"
}
```

#### `update_ai_credential`

Updates the label, default model, base URL, active state, or API key of an existing AI provider credential.

Example:

```json
{
  "credentialId": "cred_12345678",
  "label": "OpenAI Staging",
  "defaultModel": "gpt-4o"
}
```

## End-to-End Usage Examples

### Example 1: Send a WhatsApp message

```text
login to wapisender
list my instances
switch to instance WABZ3
send a WhatsApp message to +5491112345678 saying "Hello from the MCP"
```

### Example 2: Configure a webhook

```text
login to wapisender
switch to instance Support-Number
set the webhook to https://example.com/api/webhooks/wapisender and subscribe to MESSAGES_UPSERT
```

Equivalent tool call:

```json
{
  "url": "https://example.com/api/webhooks/wapisender",
  "enabled": true,
  "events": ["MESSAGES_UPSERT"]
}
```

### Example 3: Create and activate a simple support flow

```text
login to wapisender
switch to instance Support-Number
create a flow named "Support Router"
update that flow so it greets the user and asks whether they need sales or support
activate the flow
```

### Example 4: Add and test an AI credential

```text
login to wapisender
switch to instance Demo-Instance
add an OpenAI credential labeled "OpenAI Production" using model gpt-4o-mini
list my AI credentials
test the credential I just added
```

## Common Usage Patterns

### Pattern: Start every session cleanly

```text
login to wapisender
list my instances
switch to instance <name>
get the instance status
```

### Pattern: Work with multiple instances safely

```text
list my instances
switch to instance Sales-AR
send a message to 5491112345678 saying "Sales team checking in"
switch to instance Support-AR
send a message to 5491112345678 saying "Support team following up"
```

### Pattern: Build a flow incrementally

```text
create a flow named "Lead Capture"
get the flow details
update a single node
activate the flow
```

## Troubleshooting

### `Not authenticated` or `Not logged in`

Save credentials first:

```bash
npx wapisender-mcp login --token <your-mcp-token>
```

Then call `login` again inside your MCP client.

### `No active instance. Call switch_instance() or login() first.`

Your account probably has multiple instances and none is selected yet.

Run:

```text
list my instances
switch to instance <instance name or id>
```

### `Instance "<name>" not found in your account.`

Use `list_instances` first and copy the exact instance name or ID.

### `Invalid token or network error`

Check:

- The token was copied correctly
- The token is still valid in WapiSender
- The client machine can reach `wapisender.com`

## Security Notes

- The CLI stores your MCP token locally in `~/.config/wapisender-mcp/credentials.json`
- AI provider API keys passed through `add_ai_credential` are encrypted server-side by WapiSender
- The MCP server keeps active session state in memory while it is running

## Package Metadata

This repository publishes the npm package:

```text
wapisender-mcp
```

The top-level `README.md` is the package README used by npm and by MCP clients that display package documentation, so keeping this file current keeps the Codex-facing package docs current as well.

(Wapi Sender Site)[https://wapisender.com]

## License

MIT
