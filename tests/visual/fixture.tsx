/**
 * The fixture page the visual snapshots render: the real `CboxShell` on the fixture `shell` prop,
 * a stand-in Deployments page, and the tokens and shell CSS as published. Query parameters:
 * `theme=light|dark`, `sandbox=1` (the current environment has test data), `help=1` (Help was
 * left open), `page=releases` (another page of the Deploy area).
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { CboxShell, applyTheme } from '../../src/shell';
import { ENVIRONMENTS, makeShell } from '../../src/shell/testing/fixture';

const params = new URLSearchParams(window.location.search);
const theme = params.get('theme') === 'dark' ? 'dark' : 'light';
applyTheme(theme);

const shell = makeShell({
    banner: { kind: 'sandbox', text: 'Sandbox: test data only. Nothing is charged and no mail is sent.', action: { label: 'Go to Production', url: '#production' } },
});
shell.preferences.theme = theme;
shell.preferences.helpOpen = params.get('help') === '1';
if (params.get('page') === 'releases') {
    shell.page = { title: 'Releases', route: 'releases.index' };
    shell.nav.activePage = 'releases';
}
if (params.get('sandbox') === '1') shell.context.levels[2]!.current = ENVIRONMENTS.prj_webshop![1]!;
// `<cbox-support>` stands in for the Assistant SDK: the snapshots never load a real chat.
shell.help.scriptUrl = '/support-stub.js';

const rows = [
    ['main · 3f9c21a', 'Fix the checkout total on a coupon', 'Live', '2 min ago'],
    ['main · a81be04', 'Upgrade the payment client', 'Superseded', '1 h ago'],
    ['main · 77d0c3e', 'Cache product images at the edge', 'Superseded', 'Yesterday'],
    ['main · 52e9a11', 'Add the order export', 'Failed', '2 days ago'],
];

function Page() {
    return (
        <div className="fixture-page">
            <p className="fixture-eyebrow">Webshop · {shell.context.levels[2]!.current.name}</p>
            <h1 className="fixture-title">{shell.page?.title ?? 'Deployments'}</h1>
            <p className="fixture-desc">Every push to main is built and deployed to this environment.</p>
            <div className="fixture-card">
                {rows.map(([commit, message, status, when]) => (
                    <div key={commit} className="fixture-row">
                        <span className="fixture-mono">{commit}</span>
                        <span>{message}</span>
                        <span className={`fixture-pill is-${status!.toLowerCase()}`}>{status}</span>
                        <span className="fixture-when">{when}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <CboxShell shell={shell} navigate={(url, options) => console.info('navigate', url, JSON.stringify(options ?? {}))} onPreferenceChange={() => undefined}>
            <Page />
        </CboxShell>
    </StrictMode>,
);
