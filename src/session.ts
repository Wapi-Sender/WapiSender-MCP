type Instance = {
  id: string
  instance_name: string
  api_key: string | null
  status: string | null
  subscription_status: string | null
  created_at: string
}

type SessionState = {
  token: string
  userId: string
  email: string
  instances: Instance[]
  activeInstance: Instance | null
}

export class Session {
  private state: SessionState | null = null

  setSession(session: SessionState): void {
    this.state = session
  }

  isLoggedIn(): boolean {
    return this.state !== null
  }

  getToken(): string {
    if (!this.state) throw new Error('Not logged in. Call login() first.')
    return this.state.token
  }

  getInstances(): Instance[] {
    return this.state?.instances ?? []
  }

  getActiveInstance(): Instance | null {
    return this.state?.activeInstance ?? null
  }

  requireActiveInstance(): Instance {
    const inst = this.getActiveInstance()
    if (!inst) throw new Error('No active instance. Call switch_instance() or login() first.')
    return inst
  }

  autoSelectIfSingle(): void {
    if (!this.state) return
    if (this.state.instances.length === 1) {
      this.state.activeInstance = this.state.instances[0]
    }
  }

  switchInstance(idOrName: string): Instance {
    if (!this.state) throw new Error('Not logged in.')
    const inst = this.state.instances.find(
      i => i.id === idOrName || i.instance_name === idOrName
    )
    if (!inst) throw new Error(`Instance "${idOrName}" not found in your account.`)
    this.state.activeInstance = inst
    return inst
  }

  clear(): void {
    this.state = null
  }

  getSummary(): string {
    if (!this.state) return 'Not logged in.'
    const active = this.state.activeInstance
    return `Logged in as ${this.state.email} | ${this.state.instances.length} instance(s) | Active: ${active?.instance_name ?? 'none'}`
  }
}

export const session = new Session()
