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
