// Roboten: webbläsartester för bokningsappen.
// Bygger bokningsappen, startar den lokalt och klickar runt som testkontot (kontakt@performarehab.se).
// Testkontot är inte med i något segment, så det ser inga uppdrag eller bokningar.
// Kör: npm run robot   (lösenordet hämtas ur Macens nyckelring, eller ROBOT_LOSENORD i GitHub)
import { defineConfig, devices } from '@playwright/test'
import { PORT } from './robot/inloggning.js'

export default defineConfig({
  testDir: './robot',
  globalSetup: './robot/inloggning.js',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'sv-SE',
    timezoneId: 'Europe/Stockholm',
    // Spårfilen innehåller testkontots inloggningsbiljett: bara lokalt, aldrig i GitHub.
    trace: process.env.CI ? 'off' : 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
