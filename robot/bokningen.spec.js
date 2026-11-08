// Robotens kontroller för bokningsappen. Roboten BOKAR ALDRIG och sparar aldrig något:
// - varje anrop som skulle skriva i databasen stoppas och gör testet rött,
// - bokningssidan får PÅHITTADE tider av roboten själv (inga riktiga koder, inga riktiga namn),
//   och även "bokningen" i test 4 besvaras av roboten — anropet lämnar aldrig datorn.
import { test, expect } from '@playwright/test'
import { INLOGGNING_FIL } from './inloggning.js'

let stoppade
let fel

// Läsande funktioner i databasen som bokningssidan använder.
const LASANDE_RPC = new Set(['get_booking_session', 'get_booking_slots'])

test.beforeEach(async ({ page }) => {
  stoppade = []
  fel = []
  page.on('pageerror', e => fel.push(`krasch: ${e.message}`))
  page.on('console', m => { if (m.type() === 'error') fel.push(`konsol: ${m.text()}`) })
  await page.route(/\/(rest|storage|functions|auth)\/v1\//, route => {
    const req = route.request()
    const metod = req.method()
    const vag = new URL(req.url()).pathname
    if (['GET', 'HEAD', 'OPTIONS'].includes(metod)) return route.continue()
    if (vag.endsWith('/auth/v1/token') || vag.endsWith('/auth/v1/logout')) return route.continue()
    if (vag.includes('/rest/v1/rpc/') && LASANDE_RPC.has(vag.split('/rpc/')[1])) return route.continue()
    stoppade.push(`${metod} ${vag}`)
    return route.abort()
  })
})

test.afterEach(async () => {
  expect(stoppade, 'bokningsappen försökte skriva något').toEqual([])
  expect(fel, 'fel i webbläsaren').toEqual([])
})

// ── Påhittade data till bokningssidan ──
const UPPDRAG = { id: '00000000-0000-4000-8000-000000000001', company_name: 'Robottest AB', code: 'ROBOTTEST' }
const TIDER = [
  { id: '00000000-0000-4000-8000-0000000000a1', session_id: UPPDRAG.id, slot_date: '2030-03-12', start_time: '09:00:00', end_time: '09:40:00', is_booked: false },
  { id: '00000000-0000-4000-8000-0000000000a2', session_id: UPPDRAG.id, slot_date: '2030-03-12', start_time: '09:40:00', end_time: '10:20:00', is_booked: true },
  { id: '00000000-0000-4000-8000-0000000000a3', session_id: UPPDRAG.id, slot_date: '2030-03-13', start_time: '13:00:00', end_time: '13:40:00', is_booked: false },
]

// Svara som databasen gör: ett objekt om appen bett om en rad, annars en lista.
const svara = (route, rader) => {
  const enRad = (route.request().headers()['accept'] || '').includes('vnd.pgrst.object')
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(enRad ? rader[0] ?? null : rader) })
}

async function pahittadeTider(page, { bokning } = {}) {
  await page.route('**/rest/v1/rpc/get_booking_session*', r => svara(r, [UPPDRAG]))
  await page.route('**/rest/v1/rpc/get_booking_slots*', r => svara(r, TIDER))
  if (bokning) {
    // Roboten svarar själv på bokningen. Anropet når aldrig databasen.
    await page.route('**/rest/v1/rpc/book_slot*', r => {
      const { p_slot_id, p_name } = JSON.parse(r.request().postData() || '{}')
      bokning.push({ p_slot_id, p_name })
      const tid = TIDER.find(t => t.id === p_slot_id)
      return svara(r, [{ ...tid, is_booked: true, booked_by_name: p_name }])
    })
  }
}

test.describe('utan inloggning', () => {
  test('1. utan kod visas inloggningen', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Lösenord', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Logga in' })).toBeVisible()
  })

  test('2. en felaktig kod ger ett tydligt besked', async ({ page }) => {
    await page.goto('/?boka=ROBOTFINNSINTE')
    await expect(page.getByText('Ogiltig bokningslänk.', { exact: false })).toBeVisible()
  })

  test('3. bokningssidan visar lediga och bokade tider', async ({ page }) => {
    await pahittadeTider(page)
    await page.goto('/?boka=robottest')
    await expect(page.locator('.page-title', { hasText: 'Robottest AB' })).toBeVisible()
    await expect(page.getByText('2 tider kvar.', { exact: false })).toBeVisible()
    await expect(page.getByText('Ledig — tryck för att boka')).toHaveCount(2)
    await expect(page.getByText('Bokad', { exact: true })).toHaveCount(1)
    await expect(page.getByText('09:00 – 09:40')).toBeVisible()
  })

  test('4. en bokning går hela vägen till bekräftelsen', async ({ page }) => {
    const bokning = []
    await pahittadeTider(page, { bokning })
    await page.goto('/?boka=robottest')
    await page.getByText('Ledig — tryck för att boka').first().click()
    const namn = page.getByPlaceholder('För- och efternamn')
    await expect(namn).toBeVisible()
    // Utan namn går det inte att boka.
    await expect(page.getByRole('button', { name: 'Bekräfta bokning' })).toBeDisabled()
    // Avbryt stänger formuläret.
    await page.getByRole('button', { name: 'Avbryt' }).click()
    await expect(namn).toHaveCount(0)
    // Boka på riktigt (mot robotens påhittade svar).
    await page.getByText('Ledig — tryck för att boka').first().click()
    await namn.fill('Robot Testsson')
    await page.getByRole('button', { name: 'Bekräfta bokning' }).click()
    await expect(page.getByText('— Robot Testsson', { exact: false })).toBeVisible()
    await expect(page.getByText('1 tid kvar.', { exact: false })).toBeVisible()
    expect(bokning).toEqual([{ p_slot_id: TIDER[0].id, p_name: 'Robot Testsson' }])
  })
})

test.describe('inloggad som testkontot', () => {
  test.use({ storageState: INLOGGNING_FIL })

  test('5. administrationen öppnas (testkontot ser inga uppdrag)', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('+ Nytt uppdrag')).toBeVisible()
    await expect(page.getByText('Inga uppdrag skapade än')).toBeVisible()
  })

  test('6. Logga ut loggar bara ut den här skärmen', async ({ page }) => {
    // Roboten svarar själv på utloggningen, så att testkontots inloggning finns kvar för
    // de andra testerna. Kontrollen: appen ber bara om att logga ut den här skärmen.
    const utloggningar = []
    await page.route('**/auth/v1/logout*', route => {
      utloggningar.push(new URL(route.request().url()).searchParams.get('scope') || 'utan scope')
      return route.fulfill({ status: 204, body: '' })
    })
    await page.goto('/')
    await page.getByRole('button', { name: 'Logga ut', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Logga in' })).toBeVisible()
    expect(utloggningar, 'utloggningen ska vara scope=local').toEqual(['local'])
  })
})
