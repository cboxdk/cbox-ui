/**
 * The fixture page the visual snapshots render: the real `CboxShell` on the fixture `shell` prop,
 * a stand-in Deployments page, and the tokens and shell CSS as published. Query parameters:
 * `theme=light|dark`, `sandbox=1` (the current environment has test data), `help=1` (Help was
 * left open), `page=releases` (another page of the Deploy area), `nav=settings` (the Settings
 * area with group headings, a count and a locked page), `banners=1` (an app banner beside the
 * sandbox strip), `locked=1` (an Analytics area whose pages are all locked), `charts=1` (the page
 * shows the bar, stacked-bar and waterfall charts instead of the deployments), `long=1` (40
 * deployments: a page several screens tall). `fixture=billing` renders the Billing-shaped shell
 * of the V6 mockup instead, with `area=`, `pg=` (a page label) and `env=` (an environment id).
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BarChart, WaterfallChart } from '../../src/charts';
import { CboxShell, applyTheme } from '../../src/shell';
import { ENVIRONMENTS, makeShell } from '../../src/shell/testing/fixture';
import { makeBillingShell } from '../../src/shell/testing/billing';
import { renderBillingCreate } from '../../src/shell/testing/billing-forms';

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
if (params.get('nav') === 'settings') {
    shell.page = { title: 'Members', route: 'settings.members' };
    shell.nav.activeArea = 'settings';
    shell.nav.activePage = 'settings.members';
    shell.nav.areas = shell.nav.areas.map(area =>
        area.key !== 'settings'
            ? area
            : {
                  ...area,
                  pages: [
                      { key: 'settings.general', label: 'General', url: '/orgs/cbox/settings', group: 'Organization' },
                      { key: 'settings.members', label: 'Members', url: '/orgs/cbox/settings/members', group: 'Organization', count: 4 },
                      { key: 'settings.sso', label: 'Single sign-on', url: '/orgs/cbox/upgrade?feature=sso', group: 'Organization', locked: true },
                      { key: 'settings.project', label: 'General', url: '/orgs/cbox/projects/webshop/settings', group: 'Project' },
                      { key: 'settings.keys', label: 'API keys', url: '/orgs/cbox/projects/webshop/environments/production/keys', group: 'Environment', count: 12 },
                  ],
              },
    );
}
if (params.get('sandbox') === '1') shell.context.levels[2]!.current = ENVIRONMENTS.prj_webshop![1]!;
if (params.get('banners') === '1') {
    shell.banners = [
        shell.banner!,
        { kind: 'notice', text: 'Invoices are on hold. Cbox Tax is not answering, so tax cannot be calculated.', action: { label: 'See what is held', url: '#tax' } },
    ];
}
if (params.get('locked') === '1') {
    shell.nav.areas = [
        ...shell.nav.areas,
        {
            key: 'analytics',
            label: 'Analytics',
            url: '/orgs/cbox/upgrade?feature=analytics',
            icon: 'bar-chart',
            pages: [
                { key: 'analytics.mrr', label: 'MRR', url: '/orgs/cbox/upgrade?feature=analytics', locked: true },
                { key: 'analytics.churn', label: 'Churn', url: '/orgs/cbox/upgrade?feature=analytics', locked: true },
            ],
        },
    ];
}
// `<cbox-support>` stands in for the Assistant SDK: the snapshots never load a real chat.
shell.help.scriptUrl = '/support-stub.js';

const recent = [
    ['main · 3f9c21a', 'Fix the checkout total on a coupon', 'Live', '2 min ago'],
    ['main · a81be04', 'Upgrade the payment client', 'Superseded', '1 h ago'],
    ['main · 77d0c3e', 'Cache product images at the edge', 'Superseded', 'Yesterday'],
    ['main · 52e9a11', 'Add the order export', 'Failed', '2 days ago'],
];
// `long=1`: a page several screens tall, for the document scroll.
const rows = params.get('long') === '1'
    ? Array.from({ length: 40 }, (_, index) => [`main · ${(0x10000 + index * 7919).toString(16)}`, `Deployment number ${40 - index}`, index === 0 ? 'Live' : 'Superseded', `${index + 1} days ago`])
    : recent;

const MONTHS = ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'];
const money = (value: number) => (value >= 1000 || value <= -1000 ? `${value / 1000}k` : String(value));

function Charts() {
    return (
        <div className="fixture-page">
            <h1 className="fixture-title">Analytics</h1>
            <p className="fixture-desc">Bar, stacked bar and waterfall, in the chart tokens.</p>
            <div className="fixture-charts">
                <div className="fixture-card fixture-chart">
                    <BarChart
                        label="New and churned customers per month"
                        categories={MONTHS}
                        series={[
                            { key: 'new', label: 'New', values: [42, 38, 51, 47, 63, 58], tone: 1 },
                            { key: 'churned', label: 'Churned', values: [-12, -9, -15, -11, -8, null], tone: 3 },
                        ]}
                        formatValue={money}
                        height={220}
                    />
                </div>
                <div className="fixture-card fixture-chart">
                    <BarChart
                        label="Revenue by plan per month, in EUR"
                        categories={MONTHS}
                        stacked
                        series={[
                            { key: 'starter', label: 'Starter', values: [4200, 4600, 5100, 5400, 6000, 6300] },
                            { key: 'pro', label: 'Pro', values: [8800, 9400, 9900, 11200, 12100, 12800] },
                            { key: 'enterprise', label: 'Enterprise', values: [6000, 6000, 9000, 9000, 9000, 12000] },
                        ]}
                        formatValue={money}
                        unit="EUR"
                        height={220}
                    />
                </div>
                <div className="fixture-card fixture-chart">
                    <WaterfallChart
                        label="MRR movement in November, in EUR"
                        steps={[
                            { key: 'start', label: 'Start', value: 27300, total: true },
                            { key: 'new', label: 'New', value: 4100 },
                            { key: 'expansion', label: 'Expansion', value: 2300 },
                            { key: 'contraction', label: 'Contraction', value: -900 },
                            { key: 'churn', label: 'Churn', value: -1700 },
                            { key: 'end', label: 'End', value: 31100, total: true },
                        ]}
                        formatValue={money}
                        unit="EUR"
                        height={220}
                    />
                </div>
                <div className="fixture-card fixture-chart">
                    <BarChart label="Customers by country" categories={['Denmark', 'Germany', 'Sweden', 'Norway']} horizontal series={[{ key: 'customers', label: 'Customers', values: [412, 186, 97, 64] }]} formatValue={money} height={220} />
                </div>
            </div>
        </div>
    );
}

function Page() {
    if (params.get('charts') === '1') return <Charts />;
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

const INVOICES = [
    ['INV-2026-0142', 'Hubhus ApS', '12.500 DKK', 'Overdue'],
    ['INV-2026-0141', 'Fjord Studio', '4.900 DKK', 'Open'],
    ['INV-2026-0140', 'Nordic Logistics', '28.000 DKK', 'Paid'],
    ['INV-2026-0139', 'Staldplan ApS', '3.200 DKK', 'Paid'],
    ['INV-2026-0138', 'Hverdag', '1.250 DKK', 'Paid'],
];

function BillingPage({ title }: { title: string }) {
    return (
        <div className="fixture-page">
            <h1 className="fixture-eyebrow">{title}</h1>
            <div className="fixture-card">
                {INVOICES.map(([number, customer, amount, status]) => (
                    <div key={number} className="fixture-row">
                        <span className="fixture-mono">{number}</span>
                        <span>{customer}</span>
                        <span className={`fixture-pill is-${status!.toLowerCase() === 'paid' ? 'live' : status!.toLowerCase() === 'overdue' ? 'failed' : 'open'}`}>{status}</span>
                        <span className="fixture-when">{amount}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

const navigateLog = (url: string, options?: unknown) => console.info('navigate', url, JSON.stringify(options ?? {}));

if (params.get('fixture') === 'billing') {
    const billing = makeBillingShell({ area: params.get('area') ?? 'billing', page: params.get('pg') ?? 'Invoices', environment: params.get('env') ?? 'env_production' });
    billing.preferences.theme = theme;
    billing.help.scriptUrl = '/support-stub.js';
    createRoot(document.getElementById('root')!).render(
        <StrictMode>
            <CboxShell shell={billing} navigate={navigateLog} onPreferenceChange={() => undefined} renderCreate={renderBillingCreate}>
                <BillingPage title={billing.page!.title} />
            </CboxShell>
        </StrictMode>,
    );
} else {
    createRoot(document.getElementById('root')!).render(
        <StrictMode>
            <CboxShell shell={shell} navigate={navigateLog} onPreferenceChange={() => undefined}>
                <Page />
            </CboxShell>
        </StrictMode>,
    );
}
