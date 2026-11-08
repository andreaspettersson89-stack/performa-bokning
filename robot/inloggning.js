// Loggar in testkontot EN gång innan testerna och sparar inloggningen åt webbläsaren,
// så att testerna av administrationen inte behöver logga in på nytt. (Inloggningsrutan har
// Andreas adress inbyggd.) Inget mejl skickas: inloggning med lösenord skickar aldrig mejl.
import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

export const INLOGGNING_FIL = 'robot/.inloggning.json'
export const PORT = 4176

// På Andreas Mac ligger testkontots lösenord i nyckelringen (tjänst "performa-robot"),
// inte i en fil. I GitHub kommer det som hemlighet i stället.
const NYCKELRING_TJANST = 'performa-robot'
const ROBOT_EPOST_STANDARD = 'kontakt@performarehab.se'

function franNyckelringen() {
  if (process.platform !== 'darwin') return null
  try {
    return execFileSync('security', ['find-generic-password', '-s', NYCKELRING_TJANST, '-w'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || null
  } catch { return null }
}

function lasEnv() {
  // Lokalt: läs .env (publik adress + publik nyckel). I GitHub: kommer som miljövariabler.
  const env = { ...process.env }
  if (existsSync('.env')) {
    for (const rad of readFileSync('.env', 'utf8').split('\n')) {
      const m = rad.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && !env[m[1]]) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
  return env
}

export default async function inloggning() {
  const env = lasEnv()
  const url = env.VITE_SUPABASE_URL
  const nyckel = env.VITE_SUPABASE_ANON_KEY
  const epost = env.ROBOT_EPOST || ROBOT_EPOST_STANDARD
  const losenord = env.ROBOT_LOSENORD || franNyckelringen()
  if (!url || !nyckel) throw new Error('Roboten: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY saknas.')
  if (!losenord) throw new Error('Roboten: testkontots lösenord saknas (ROBOT_LOSENORD, eller nyckelringen "performa-robot" på Macen).')

  // Testet av inloggningsrutan behöver uppgifterna. Miljövariabler som sätts här
  // ärvs av testprocesserna, och hamnar aldrig i en fil.
  process.env.ROBOT_EPOST = epost
  process.env.ROBOT_LOSENORD = losenord

  const supabase = createClient(url, nyckel, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await supabase.auth.signInWithPassword({ email: epost, password: losenord })
  if (error || !data.session) throw new Error(`Roboten: testkontot kunde inte logga in (${error?.message || 'ingen session'}).`)

  const ref = new URL(url).hostname.split('.')[0]
  const state = {
    cookies: [],
    origins: [{
      origin: `http://localhost:${PORT}`,
      localStorage: [{ name: `sb-${ref}-auth-token`, value: JSON.stringify(data.session) }],
    }],
  }
  mkdirSync('robot', { recursive: true })
  writeFileSync(INLOGGNING_FIL, JSON.stringify(state))

  // Efter testerna: logga ut just den här inloggningen, så att de inte samlas på kontot.
  return async () => { await supabase.auth.signOut({ scope: 'local' }) }
}
