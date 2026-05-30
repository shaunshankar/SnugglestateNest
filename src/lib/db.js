import { client } from './auth'

export async function dbFetch(sql, params = []) {
  const { data: session } = await client.auth.getSession()
  const token = session?.session?.token ?? session?.token ?? null
  const res = await fetch(import.meta.env.VITE_NEON_DATA_API_URL + '/sql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/sql',
      'Accept': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(params.length ? { 'Prefer': 'params=' + JSON.stringify(params) } : {}),
    },
    body: sql,
  })
  if (!res.ok) throw new Error(await res.text())
  const json = await res.json()
  return Array.isArray(json) ? (json[0]?.rows ?? json) : (json.rows ?? json)
}
