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
