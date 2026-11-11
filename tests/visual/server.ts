/**
 * Serves the visual fixture: the bundled page, the published CSS, the logo files and the fixture
 * answers for every URL in the `shell` prop. `bun tests/visual/server.ts [port]`.
 */
import { fixtureAnswer } from '../../src/shell/testing/fixture';

const root = new URL('../../', import.meta.url).pathname;
const port = Number(process.argv[2] ?? process.env.PORT ?? 4177);

const build = await Bun.build({
    entrypoints: [`${root}tests/visual/fixture.tsx`],
    target: 'browser',
    minify: false,
    define: { 'process.env.NODE_ENV': '"production"' },
});
if (!build.success) {
    console.error(build.logs);
    process.exit(1);
}
const bundle = await build.outputs[0]!.text();

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content">
<title>Cbox shell fixture</title>
<link rel="stylesheet" href="/tokens/cbox.css">
<style>
html, body { margin: 0; }
.fixture-page { max-width: 1100px; padding: 28px 32px 48px; }
.fixture-eyebrow { margin: 0 0 6px; font-family: var(--font-mono, ui-monospace, monospace); font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted-foreground); }
.fixture-title { margin: 0; font-size: 26px; line-height: 1.2; }
.fixture-desc { margin: 6px 0 24px; color: var(--muted-foreground); }
.fixture-card { background: var(--card); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
.fixture-row { display: grid; grid-template-columns: minmax(120px, 160px) minmax(0, 1fr) 96px 88px; gap: 16px; align-items: center; padding: 14px 18px; border-top: 1px solid var(--border); }
.fixture-row:first-child { border-top: 0; }
.fixture-mono { font-family: var(--font-mono, ui-monospace, monospace); font-size: 12px; color: var(--muted-foreground); }
.fixture-pill { justify-self: start; padding: 2px 8px; border-radius: 6px; font-size: 12px; background: var(--secondary); }
.fixture-pill.is-live { background: var(--success-soft); }
.fixture-pill.is-failed { background: var(--destructive-soft); }
.fixture-charts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.fixture-chart { padding: 12px 14px; }
@media (max-width: 767px) { .fixture-charts { grid-template-columns: 1fr; } }
.fixture-when { text-align: right; font-size: 13px; color: var(--muted-foreground); }
@media (max-width: 767px) { .fixture-page { padding: 20px 16px; } .fixture-row { grid-template-columns: 1fr auto; } .fixture-row > :nth-child(2), .fixture-row > :nth-child(4) { display: none; } }
</style>
</head>
<body>
<div id="root"></div>
<script type="module" src="/fixture.js"></script>
</body>
</html>`;

const SUPPORT_STUB = `customElements.get('cbox-support') || customElements.define('cbox-support', class extends HTMLElement { open() {} ask() {} handover() {} });`;

Bun.serve({
    port,
    async fetch(request) {
        const url = new URL(request.url);
        if (url.pathname === '/' || url.pathname === '/index.html') return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
        if (url.pathname === '/fixture.js') return new Response(bundle, { headers: { 'Content-Type': 'text/javascript' } });
        if (url.pathname === '/support-stub.js') return new Response(SUPPORT_STUB, { headers: { 'Content-Type': 'text/javascript' } });
        if (url.pathname.startsWith('/tokens/') && url.pathname.endsWith('.css')) {
            const file = Bun.file(`${root}tokens/${url.pathname.slice('/tokens/'.length).replace(/[^a-z0-9.-]/gi, '')}`);
            if (await file.exists()) return new Response(file, { headers: { 'Content-Type': 'text/css' } });
        }
        if (url.pathname.startsWith('/brand/')) {
            const file = Bun.file(`${root}tests/visual/brand/${url.pathname.slice('/brand/'.length).replace(/[^a-z0-9.@-]/gi, '')}`);
            if (await file.exists()) return new Response(file, { headers: { 'Content-Type': 'image/png' } });
        }
        const body = request.method === 'POST' ? await request.json().catch(() => undefined) : undefined;
        const answer = fixtureAnswer(request.method, url.pathname + url.search, body);
        if (answer !== undefined) {
            return new Response(answer.body === null ? null : JSON.stringify(answer.body), { status: answer.status, headers: { 'Content-Type': 'application/json' } });
        }
        return new Response('Not found', { status: 404 });
    },
});

console.log(`fixture on http://localhost:${port}`);
