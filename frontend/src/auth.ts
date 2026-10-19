export type User = { name: string; email: string }

export async function accountRequest(action: string, data?: Record<string, string>): Promise<User | null> {
  const response = await fetch(`/api/auth/${action}`, {
    method: action === 'session' ? 'GET' : 'POST',
    headers: data ? { 'Content-Type': 'application/json' } : undefined,
    body: data ? JSON.stringify(data) : undefined,
    credentials: 'same-origin',
  })
  const result = await response.json()
  if (!response.ok) throw new Error(typeof result.detail === 'string' ? result.detail : 'Check your details and try again.')
  return result.user
}
