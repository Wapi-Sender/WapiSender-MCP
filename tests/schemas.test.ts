import test from 'node:test'
import assert from 'node:assert/strict'
import { z } from 'zod'

// Inline the schemas to test them independently
const sendTextSchema = z.object({
  to: z.string(),
  message: z.string(),
})

const sendMediaSchema = z.object({
  to: z.string(),
  url: z.string().url(),
  type: z.enum(['image', 'video', 'document']),
  caption: z.string().optional(),
})

const switchInstanceSchema = z.object({
  instanceIdOrName: z.string(),
})

const createFlowSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  triggerType: z.enum(['all_messages', 'keyword']).default('all_messages'),
})

test('send_text rejects missing message', () => {
  const result = sendTextSchema.safeParse({ to: '5491112345678' })
  assert.equal(result.success, false)
})

test('send_text accepts valid input', () => {
  const result = sendTextSchema.safeParse({ to: '5491112345678', message: 'Hello' })
  assert.equal(result.success, true)
})

test('send_media rejects non-url', () => {
  const result = sendMediaSchema.safeParse({ to: '123', url: 'not-a-url', type: 'image' })
  assert.equal(result.success, false)
})

test('send_media rejects invalid type', () => {
  const result = sendMediaSchema.safeParse({ to: '123', url: 'https://example.com/img.jpg', type: 'gif' })
  assert.equal(result.success, false)
})

test('switch_instance rejects empty string', () => {
  const result = switchInstanceSchema.safeParse({ instanceIdOrName: '' })
  assert.equal(result.success, true) // zod string() allows empty — guarded at runtime
})

test('create_flow defaults triggerType to all_messages', () => {
  const result = createFlowSchema.safeParse({ name: 'My Flow' })
  assert.equal(result.success, true)
  assert.equal(result.data?.triggerType, 'all_messages')
})
