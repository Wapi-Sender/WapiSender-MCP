# WapiSender MCP

> Official MCP server for WapiSender. Use it from Claude Code, Codex, and other MCP-compatible clients to manage WhatsApp instances, send messages, manage contacts, configure webhooks, and build flows.

## What This MCP Does

WapiSender MCP gives your MCP client access to the WapiSender platform through a stateful session.

It supports:

- Logging into your WapiSender account with an MCP token
- Listing and switching between WhatsApp instances
- Checking instance status and QR codes
- Sending text, media, and location WhatsApp messages
- Managing contacts
- Creating, updating, activating, and deactivating flows
- Managing instance webhooks
- Managing AI provider credentials used by flows

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

The package includes:

- `wapisender-mcp`: CLI entrypoint
- `wapisender-mcp-server`: MCP server entrypoint over stdio

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
npx wapisender-mcp login --token ws_xxxxxxxxxxxxxxxxx
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

There are 25 tools grouped into 7 areas.

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

Example using an instance name:

```json
{
  "instanceIdOrName": "Sales-BR"
}
```

### Instance

#### `get_instance_status`

Returns the connection state for the active instance, including phone number and battery level when available.

Example:

```json
{}
```

#### `get_qr_code`

Returns the QR code needed to connect WhatsApp on the active instance.

Example:

```json
{}
```

### Messaging

#### `send_text`

Sends a text WhatsApp message.

Example:

```json
{
  "to": "5491112345678",
  "message": "Hello from WapiSender MCP"
}
```

#### `send_media`

Sends an image, video, or document from a public URL.

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

#### `send_location`

Sends a WhatsApp location pin.

Example:

```json
{
  "to": "5491112345678",
  "lat": -34.6037,
  "lng": -58.3816,
  "name": "Buenos Aires Office"
}
```

### Contacts

#### `list_contacts`

Lists contacts on the active instance. You can optionally filter by search string and limit.

Example:

```json
{
  "limit": 20
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

#### `upsert_contact`

Creates or updates a contact on the active instance.

Example:

```json
{
  "phone": "5491112345678",
  "name": "Gilad",
  "email": "gilad@example.com"
}
```

### Flows

#### `list_flows`

Lists all flows on the active instance.

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

Creates an empty flow shell.

Example:

```json
{
  "name": "Support Router",
  "description": "Routes inbound messages to sales or support",
  "triggerType": "all_messages"
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
      "data": { "triggerType": "all_messages" }
    },
    {
      "id": "message-1",
      "type": "send_message",
      "position": { "x": 250, "y": 350 },
      "data": {
        "messageType": "text",
        "message": "Hello. Reply with sales or support."
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
    "message": "Hello. Reply with sales, support, or billing."
  }
}
```

#### `generate_and_save_flow`

Creates a flow shell from a natural-language description, then returns the schema guidance needed to finish the node graph.

Example:

```json
{
  "name": "Lead Qualification",
  "description": "A flow that greets the user, asks for their company size, and routes enterprise leads to sales.",
  "triggerType": "all_messages"
}
```

Natural-language example:

```text
Generate and save a WhatsApp flow named "Lead Qualification" that greets the user, asks for company size, and routes enterprise leads to sales.
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
trigger:      { type: "trigger", data: { triggerType: "all_messages"|"keyword", keyword?: string } }
send_message: { type: "send_message", data: { messageType: "text"|"image"|"audio", message: string, url?: string } }
condition:    { type: "condition", data: { variable: string, operator: "equals"|"contains"|"starts_with", value: string } }
delay:        { type: "delay", data: { delaySeconds: number } }
wait_for_reply:{ type: "wait_for_reply", data: { timeoutSeconds: number, timeoutAction: "continue"|"end" } }
ai_agent:     { type: "ai_agent", data: { mode: "reply"|"router"|"extract", credentialId: string, provider: string, model: string, systemPrompt: string, promptTemplate: string } }
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

### Webhooks

#### `get_webhook`

Returns the current webhook configuration for the active instance.

Example:

```json
{}
```

#### `set_webhook`

Creates or updates the webhook URL and event subscriptions.

Example:

```json
{
  "url": "https://example.com/api/webhooks/wapisender",
  "enabled": true,
  "events": ["MESSAGES_UPSERT"]
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

## License

MIT
