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
