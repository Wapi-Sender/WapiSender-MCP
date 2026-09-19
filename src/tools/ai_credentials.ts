import { z } from 'zod'
import { session } from '../session.ts'
import { apiRequest, ok, err } from '../client.ts'

const AI_PROVIDERS = [
  'openai',
  'anthropic',
  'gemini',
  'xai',
  'openrouter',
  'ollama',
  'mistral',
  'deepseek',
  'groq',
  'kimi',
  'huggingface',
] as const

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
      provider: z.enum(AI_PROVIDERS).describe('AI provider'),
      apiKey: z.string().max(4096).default('').describe('Provider API key. Optional only for Ollama.'),
      label: z.string().trim().min(1).max(80).describe('Friendly label, e.g. "OpenAI Production"'),
      defaultModel: z.string().optional().describe('Default model to use, e.g. gpt-4o-mini'),
      baseUrl: z.string().url().optional().describe('Custom provider base URL. Required for Ollama.'),
    }).superRefine((value, ctx) => {
      if (value.provider === 'ollama' && !value.baseUrl) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['baseUrl'], message: 'baseUrl is required for Ollama.' })
      }
      if (value.provider !== 'ollama' && value.apiKey.trim().length < 8) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['apiKey'], message: 'apiKey must be at least 8 characters.' })
      }
    }),
    handler: async ({ provider, apiKey, label, defaultModel, baseUrl }: {
      provider: typeof AI_PROVIDERS[number]
      apiKey: string
      label: string
      defaultModel?: string
      baseUrl?: string
    }) => {
      try {
        const inst = session.requireActiveInstance()
        const data = await apiRequest('POST', `/api/instances/${inst.id}/ai-credentials`, {
          provider, apiKey, label, defaultModel, baseUrl
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
  {
    name: 'delete_ai_credential',
    description: 'Remove a saved AI provider credential from the active instance.',
    inputSchema: z.object({
      credentialId: z.string().describe('Credential UUID from list_ai_credentials'),
    }),
    handler: async ({ credentialId }: { credentialId: string }) => {
      try {
        const inst = session.requireActiveInstance()
        const data = await apiRequest('DELETE', `/api/instances/${inst.id}/ai-credentials/${credentialId}`)
        return ok(`Credential ${credentialId} deleted.\n${JSON.stringify(data, null, 2)}`)
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e))
      }
    }
  },
  {
    name: 'update_ai_credential',
    description: 'Update an AI credential, including its label, model, base URL, active state, or rotated API key.',
    inputSchema: z.object({
      credentialId: z.string().describe('Credential UUID from list_ai_credentials'),
      label: z.string().optional().describe('New friendly label'),
      defaultModel: z.string().optional().describe('New default model, e.g. gpt-4o-mini'),
      baseUrl: z.string().url().or(z.literal('')).optional().describe('New custom provider base URL, or an empty string to clear it'),
      isActive: z.boolean().optional().describe('Enable or disable this credential'),
      apiKey: z.string().min(8).max(4096).optional().describe('Replacement API key, encrypted server-side'),
    }),
    handler: async ({ credentialId, label, defaultModel, baseUrl, isActive, apiKey }: {
      credentialId: string
      label?: string
      defaultModel?: string
      baseUrl?: string
      isActive?: boolean
      apiKey?: string
    }) => {
      try {
        const inst = session.requireActiveInstance()
        const body: Record<string, unknown> = {}
        if (label !== undefined) body.label = label
        if (defaultModel !== undefined) body.defaultModel = defaultModel
        if (baseUrl !== undefined) body.baseUrl = baseUrl
        if (isActive !== undefined) body.isActive = isActive
        if (apiKey !== undefined) body.apiKey = apiKey
        if (Object.keys(body).length === 0) return err('Provide at least one field to update.')
        const data = await apiRequest('PATCH', `/api/instances/${inst.id}/ai-credentials/${credentialId}`, body)
        return ok(`Credential updated.\n${JSON.stringify(data, null, 2)}`)
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e))
      }
    }
  },
]
