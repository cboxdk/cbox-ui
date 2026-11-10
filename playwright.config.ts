import { defineConfig, devices } from '@playwright/test';

const PORT = 4177;

/**
 * Visual snapshots of the shell's open states (spec §12.3): desktop 1440 and mobile 390, light
 * and dark. `bun run test:visual`; after an intended change, `bun run test:visual:update` and
 * review the new images. The snapshots are made on macOS (Chromium headless shell).
 */
export default defineConfig({
    testDir: 'tests/visual',
    snapshotPathTemplate: '{testDir}/__screenshots__/{projectName}/{arg}{ext}',
    fullyParallel: true,
    reporter: 'list',
    expect: { toHaveScreenshot: { animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.002 } },
    use: {
        baseURL: `http://localhost:${PORT}`,
        locale: 'en-GB',
        timezoneId: 'Europe/Copenhagen',
    },
    projects: [
        { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 } },
        { name: 'mobile', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } },
    ],
    webServer: {
        command: `bun tests/visual/server.ts ${PORT}`,
        url: `http://localhost:${PORT}`,
        reuseExistingServer: !process.env.CI,
        timeout: 30_000,
    },
});
