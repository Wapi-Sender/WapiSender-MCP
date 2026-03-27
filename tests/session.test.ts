import test from 'node:test'
import assert from 'node:assert/strict'
import { Session as SessionManager } from '../src/session.ts'

const mockInstance = (id: string) => ({
  id, instance_name: `inst-${id}`, api_key: 'key',
  status: 'connected', subscription_status: 'active', created_at: '2026-01-01'
})

test('session starts empty', () => {
  const s = new SessionManager()
  assert.equal(s.isLoggedIn(), false)
  assert.equal(s.getActiveInstance(), null)
})

test('setSession stores token and instances', () => {
  const s = new SessionManager()
  s.setSession({ token: 'tok', userId: 'u1', email: 'a@b.com', instances: [mockInstance('i1')], activeInstance: null })
  assert.equal(s.isLoggedIn(), true)
  assert.equal(s.getInstances().length, 1)
})

test('auto-selects single instance', () => {
  const s = new SessionManager()
  s.setSession({ token: 'tok', userId: 'u1', email: 'a@b.com', instances: [mockInstance('i1')], activeInstance: null })
  s.autoSelectIfSingle()
  assert.equal(s.getActiveInstance()?.id, 'i1')
})

test('switchInstance rejects unknown id', () => {
  const s = new SessionManager()
  s.setSession({ token: 'tok', userId: 'u1', email: 'a@b.com', instances: [mockInstance('i1')], activeInstance: null })
  assert.throws(() => s.switchInstance('unknown'), /not found/)
})

test('clear resets session', () => {
  const s = new SessionManager()
  s.setSession({ token: 'tok', userId: 'u1', email: 'a@b.com', instances: [mockInstance('i1')], activeInstance: null })
  s.clear()
  assert.equal(s.isLoggedIn(), false)
})
