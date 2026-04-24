const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const TIMEOUT_MS = 8000
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 800

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function request(path, options = {}, attempt = 0) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(`${BASE}${path}`, {
      ...options,
      signal: controller.signal,
      // Prevents iOS Safari from reusing stale connections
      cache: 'no-store',
    })
    clearTimeout(timer)

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.detail || `HTTP ${res.status}`)
    }
    if (res.status === 204) return null
    return res.json()
  } catch (err) {
    clearTimeout(timer)

    // Don't retry on explicit HTTP errors (4xx/5xx) or user-triggered aborts
    const isNetworkError = err.name === 'TypeError' || err.name === 'AbortError'
    if (isNetworkError && attempt < MAX_RETRIES) {
      await wait(RETRY_DELAY_MS)
      return request(path, options, attempt + 1)
    }

    throw err
  }
}

export async function login(username, password) {
  const data = await request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  return data.access_token
}

export function sendLocation(token, device_id, secret_key, latitude, longitude) {
  return request('/location', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ device_id, secret_key, latitude, longitude }),
  })
}
