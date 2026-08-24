// Supabase connectivity check — run AFTER filling .env and applying full_setup.sql:
//   node scripts/verify-supabase.mjs
// Verifies URL + anon key validity, then probes for the HRMS tables.

import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

function loadEnv(path) {
  const env = {}
  if (!existsSync(path)) return env
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return env
}

const env = { ...loadEnv(resolve('.env')), ...process.env }
const url = env.VITE_SUPABASE_URL
const anonKey = env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey || url.includes('placeholder') || anonKey.includes('placeholder')) {
  console.error('✗ VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are missing or placeholder in .env')
  process.exit(1)
}

const tables = ['departments', 'employees', 'candidates', 'interviews', 'job_openings', 'offers', 'announcements']

const isOk = (r) => r === 200 || r === 204 || r === 401 || r === 403
const reason = (r) =>
  r === 200 || r === 204 ? 'OK' : r === 401 ? 'project exists (auth required)' : r === 403 ? 'RLS blocks anon select (expected)' : 'HTTP ' + r

const root = await fetch(url, { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } }).catch((e) => null)
if (!root) {
  console.error('✗ Could not reach', url, '— check the project URL')
  process.exit(1)
}
console.log(`✔ Project reachable: ${url} (${reason(root.status)})`)

const found = []
const missing = []
for (const t of tables) {
  const res = await fetch(`${url}/rest/v1/${t}?select=id&limit=1`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, Prefer: 'count=exact' },
  }).catch(() => null)
  if (!res) { missing.push(t); continue }
  if (res.status === 200) found.push(t)
  else if (res.status === 404) missing.push(t) // table does not exist
  else found.push(t) // exists but RLS hints; 400 JSON syntax errors would also mean table exists
}
if (found.length) console.log(`✔ Tables visible: ${found.join(', ')}`)
if (missing.length) {
  console.warn(`⚠ Tables not found (run full_setup.sql in the SQL Editor): ${missing.join(', ')}`)
}

const validKey = anonKey.split('.').length === 3 || anonKey.startsWith('sb_publishable_') || anonKey.startsWith('sb_secret_')
console.log(validKey ? '✔ Key format looks valid (JWT or sb_publishable_/sb_secret_)' : '⚠ Key looks malformed — double-check it in Project Settings → API')

if (found.length === tables.length) {
  console.log('\n✔ Connection verified — HRMS database is live.')
} else if (missing.length) {
  console.log('\n⚠ URL + key are valid; apply the missing schema with supabase/full_setup.sql.')
} else {
  console.log('\n⚠ No tables detected yet.')
}