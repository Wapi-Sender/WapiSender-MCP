#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { authTools } from './tools/auth.js'
import { instanceTools } from './tools/instance.js'
import { messagingTools } from './tools/messaging.js'
import { contactsTools } from './tools/contacts.js'
import { flowsTools } from './tools/flows.js'
import { webhooksTools } from './tools/webhooks.js'
import { aiCredentialsTools } from './tools/ai_credentials.js'

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
  server.registerTool(
    tool.name,
    {
      description: tool.description,
      inputSchema: tool.inputSchema,
    },
    tool.handler as Parameters<typeof server.registerTool>[2]
  )
}

const transport = new StdioServerTransport()
await server.connect(transport)

console.error('WapiSender MCP server running. 25 tools registered.')
