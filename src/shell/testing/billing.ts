import type { ContextItem, NavArea, NavPage, Shell } from '../types';

/**
 * A Billing-shaped `shell` prop (V6 mockup): eight areas and about sixty pages, three context
 * levels with seven environments in four groups, help, records and create targets. For the unit
 * tests and the visual fixture (`?fixture=billing`). Not part of the package's public entry.
 */

const slug = (label: string) => label.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

type AreaSpec = { key: string; label: string; icon: string; groups: Array<{ name: string; items: string[] }> };

const AREAS: AreaSpec[] = [
    { key: 'home', label: 'Home', icon: 'home', groups: [{ name: '', items: ['Dashboard'] }] },
    { key: 'customers', label: 'Customers', icon: 'users', groups: [{ name: '', items: ['Customers', 'Waitlist', 'Access grants'] }] },
    { key: 'billing', label: 'Billing', icon: 'receipt', groups: [{ name: '', items: ['Subscriptions', 'Invoices', 'Credit notes', 'Bank reconciliation', 'Disputes', 'Dunning', 'Quotes'] }] },
    { key: 'catalog', label: 'Catalog', icon: 'package', groups: [{ name: '', items: ['Products', 'Plans & pricing', 'Product access', 'Features', 'Meters', 'Coupons', 'Bundles', 'Pricing tables', 'Experiments', 'Changes'] }] },
    { key: 'analytics', label: 'Analytics', icon: 'bar-chart', groups: [{ name: '', items: ['Revenue', 'Retention'] }] },
    { key: 'tax', label: 'Tax', icon: 'percent', groups: [{ name: '', items: ['Overview', 'Documents', 'Returns', 'Registrations', 'Exemptions', 'Exposure & filing'] }] },
    {
        key: 'developers',
        label: 'Developers',
        icon: 'code',
        groups: [
            { name: 'API', items: ['API tokens', 'Webhooks'] },
            { name: 'Environments', items: ['Environments', 'Promote', 'Test clocks'] },
            { name: 'Data', items: ['Exports', 'Warehouse sinks', 'Licence data', 'Import', 'Mail log'] },
        ],
    },
    {
        key: 'settings',
        label: 'Settings',
        icon: 'settings',
        groups: [
            { name: 'Organization', items: ['Organization', 'Members', 'Your profile'] },
            { name: 'Project', items: ['Project', 'Licenses', 'License distribution', 'Signals', 'Audit log', 'GDPR / DSAR'] },
            { name: 'Environment', items: ['Sellers', 'Payments', 'Billing settings', 'Custom domain', 'Emails', 'Legal terms', 'Agreements', 'Quote signing', 'Retry strategy'] },
        ],
    },
];

export function billingPageUrl(area: string, label: string): string {
    return `/b/${area}/${slug(label)}`;
}

export const BILLING_AREAS: NavArea[] = AREAS.map(area => {
    const pages: NavPage[] = area.groups.flatMap(group => group.items.map(label => ({ key: `${area.key}.${slug(label)}`, label, url: billingPageUrl(area.key, label), ...(group.name !== '' ? { group: group.name } : {}) })));
    return { key: area.key, label: area.label, icon: area.icon, url: pages[0]!.url, pages };
});

export const BILLING_ORGANIZATIONS: ContextItem[] = [
    { id: 'org_cbox', name: 'Cbox', initials: 'CB', label: 'Owner' },
    { id: 'org_test', name: 'Test', initials: 'TE', label: 'Owner' },
    { id: 'org_sheila', name: 'Sheila’s MixBix', initials: 'SM', label: 'Member' },
];

export const BILLING_PROJECTS: ContextItem[] = [
    { id: 'prj_cbox', name: 'Cbox' },
    { id: 'prj_staldplan', name: 'Staldplan' },
    { id: 'prj_hverdag', name: 'Hverdag' },
];

export const BILLING_ENVIRONMENTS: ContextItem[] = [
    { id: 'env_production', name: 'Production', tone: 'production', live: true, group: 'Live', description: 'Live customers' },
    { id: 'env_staging', name: 'Staging', tone: 'staging', live: false, group: 'Test', description: 'Mirrors production, test cards' },
    { id: 'env_sandbox', name: 'Sandbox', tone: 'sandbox', live: false, testData: true, group: 'Test', description: 'Test cards, test clock' },
    { id: 'env_demo', name: 'Demo', tone: 'sandbox', live: false, group: 'Test', description: 'Sales demo data' },
    { id: 'env_pr412', name: 'Preview · pr-412', tone: 'preview', live: false, group: 'Preview', description: 'From branch feat/quotes' },
    { id: 'env_pr418', name: 'Preview · pr-418', tone: 'preview', live: false, group: 'Preview', description: 'From branch fix/dunning' },
    { id: 'env_dev', name: 'Dev · sylvester', tone: 'development', live: false, group: 'Development', description: 'Personal' },
];

export const BILLING_CREATABLES = [
    { key: 'invoice', label: 'Invoice', area: 'billing', submitLabel: 'Create draft' },
    { key: 'credit', label: 'Credit note', area: 'billing', submitLabel: 'Create draft' },
    { key: 'quote', label: 'Quote', area: 'billing', submitLabel: 'Create draft' },
    { key: 'subscription', label: 'Subscription', area: 'billing' },
    { key: 'customer', label: 'Customer', area: 'customers' },
    { key: 'grant', label: 'Access grant', area: 'customers' },
    { key: 'product', label: 'Product', area: 'catalog' },
    { key: 'plan', label: 'Plan', area: 'catalog' },
    { key: 'coupon', label: 'Coupon', area: 'catalog' },
    { key: 'feature', label: 'Feature', area: 'catalog' },
    { key: 'meter', label: 'Meter', area: 'catalog' },
    { key: 'token', label: 'API token', area: 'developers' },
    { key: 'webhook', label: 'Webhook', area: 'developers' },
    { key: 'environment', label: 'Environment', area: 'developers' },
    { key: 'member', label: 'Member invite', area: 'settings' },
    { key: 'seller', label: 'Seller', area: 'settings' },
];

/** Which creatable a page makes, by page label (V7's `pageCreate`). */
const PAGE_CREATE: Record<string, string> = {
    Invoices: 'invoice', 'Credit notes': 'credit', Quotes: 'quote', Subscriptions: 'subscription', Customers: 'customer', 'Access grants': 'grant', Products: 'product', 'Plans & pricing': 'plan', Coupons: 'coupon', Features: 'feature', Meters: 'meter', 'API tokens': 'token', Webhooks: 'webhook', Environments: 'environment', Members: 'member', Sellers: 'seller',
};

const PAGE_ACTIONS: Record<string, Array<{ id: string; label: string; hint: string; url: string; icon?: string; create?: string }>> = {
    billing: [
        { id: 'new-credit', label: 'New credit note', hint: 'Correct a sent invoice', url: '/b/billing/credit-notes/new', icon: 'file-text', create: 'credit' },
        { id: 'overdue', label: 'Show overdue invoices', hint: 'Filter this list', url: '/b/billing/invoices?status=overdue', icon: 'list' },
        { id: 'export', label: 'Export invoices', hint: 'CSV of the current filter', url: '/b/billing/invoices/export', icon: 'send' },
    ],
    customers: [
        { id: 'import', label: 'Import customers', hint: 'From CSV or Stripe', url: '/b/customers/import', icon: 'inbox' },
        { id: 'portal', label: 'Invite to portal', hint: 'Send a sign-in link', url: '/b/customers/portal', icon: 'mail' },
    ],
};

export function makeBillingShell({ area = 'billing', page = 'Invoices', environment = 'env_production' }: { area?: string; page?: string; environment?: string } = {}): Shell {
    const navArea = BILLING_AREAS.find(item => item.key === area)!;
    const navPage = navArea.pages!.find(item => item.label === page) ?? navArea.pages![0]!;
    return {
        app: { key: 'billing', name: 'Cbox · Billing', homeUrl: '/b' },
        person: { id: 'usr_1', name: 'Sylvester Damgaard', initials: 'SD', email: 'sd@cbox.dk' },
        page: { title: navPage.label, route: navPage.key, create: PAGE_CREATE[navPage.label], actions: PAGE_ACTIONS[area] ?? [] },
        nav: { areas: BILLING_AREAS, activeArea: area, activePage: navPage.key, tabs: ['home', 'customers', 'billing', 'catalog'] },
        context: {
            levels: [
                { key: 'organization', label: 'Organization', current: BILLING_ORGANIZATIONS[0]!, listUrl: '/billing/shell/organizations', createUrl: '/billing/shell/organizations', allUrl: '/b/orgs', settingsUrl: '/b/orgs/{id}/settings' },
                { key: 'project', label: 'Project', current: BILLING_PROJECTS[0]!, listUrl: '/billing/shell/projects', createUrl: '/billing/shell/projects', allUrl: '/b/projects' },
                { key: 'environment', label: 'Environment', current: BILLING_ENVIRONMENTS.find(item => item.id === environment) ?? BILLING_ENVIRONMENTS[0]!, listUrl: '/billing/shell/environments', createUrl: '/billing/shell/environments', allUrl: '/b/environments' },
            ],
            switchUrl: '/shell/switch',
        },
        palette: {
            searchUrl: '/billing/shell/search',
            placeholder: undefined,
            actions: [{ id: 'invite', label: 'Invite members', url: '/b/settings/members/invite', icon: 'users', keywords: ['team'] }],
            recent: [
                { id: 'inv_142', title: 'INV-2026-0142', subtitle: 'Invoice · Hubhus ApS · 12.500 DKK · overdue', url: '/b/invoices/inv_142' },
                { id: 'inv_139', title: 'INV-2026-0139', subtitle: 'Invoice · Staldplan ApS · 3.200 DKK · paid', url: '/b/invoices/inv_139' },
                { id: 'page_plans', title: 'Plans & pricing', subtitle: 'Catalog', url: billingPageUrl('catalog', 'Plans & pricing') },
                { id: 'page_dunning', title: 'Dunning', subtitle: 'Billing', url: billingPageUrl('billing', 'Dunning') },
            ],
        },
        create: { items: BILLING_CREATABLES, default: 'invoice' },
        help: {
            enabled: true,
            topic: 'invoices',
            sessionUrl: '/billing/help/session',
            portalUrl: 'https://support.cbox.dk',
            updatesUrl: '/billing/help/updates',
            searchUrl: '/billing/help/search',
            articlesUrl: '/billing/help/topics/{topic}/articles',
        },
        notifications: { enabled: false },
        apps: { catalogUrl: '/billing/apps/catalog' },
        account: {
            profileUrl: 'https://app.cboxid.com/settings',
            switchAccountUrl: '/switch-account',
            signOutUrl: '/logout',
        },
        preferences: { theme: 'system', locale: 'en', railPinned: false, helpOpen: false },
    };
}

const ARTICLES = [
    { id: 'kb_send', title: 'Send an invoice and get paid', body: 'Create a draft, add lines, and send it. The customer pays from the link in the mail.\n\nPaid invoices are matched in Bank reconciliation.' },
    { id: 'kb_credit', title: 'Correct an invoice with a credit note' },
    { id: 'kb_overdue', title: 'Why an invoice is overdue' },
    { id: 'kb_dunning', title: 'How dunning retries work' },
];

const RECORDS = [
    { id: 'inv_142', title: 'INV-2026-0142', subtitle: 'Invoice · Hubhus ApS · 12.500 DKK · overdue', url: '/b/invoices/inv_142' },
    { id: 'inv_139', title: 'INV-2026-0139', subtitle: 'Invoice · Staldplan ApS · 3.200 DKK · paid', url: '/b/invoices/inv_139' },
    { id: 'cus_hubhus', title: 'Hubhus ApS', subtitle: 'Customer · 14 invoices', url: '/b/customers/cus_hubhus' },
    { id: 'cus_staldplan', title: 'Staldplan ApS', subtitle: 'Customer · 3 subscriptions', url: '/b/customers/cus_staldplan' },
    { id: 'plan_pro', title: 'Pro monthly', subtitle: 'Plan · 499 DKK/month', url: '/b/plans/plan_pro' },
];

const CATALOG = {
    apps: ['Agents', 'Assistant', 'Billing', 'Brain', 'Domains', 'Engage', 'ID', 'Infra', 'Signals', 'Sites', 'Stache', 'Status', 'Tax', 'Telemetry', 'Work'].map(name => ({
        key: name.toLowerCase(),
        name: `Cbox · ${name}`,
        launch_url: `https://app.cbox${name.toLowerCase()}.com`,
    })),
};

/** The JSON answer for a Billing fixture URL (`/billing/…`), or `undefined`. */
export function billingAnswer(method: string, href: string): { status: number; body: unknown } | undefined {
    const url = new URL(href, 'https://app.test');
    const q = (url.searchParams.get('q') ?? '').toLowerCase();
    const list = (rows: ContextItem[]) => ({ status: 200, body: { object: 'list', data: rows.filter(row => row.name.toLowerCase().includes(q) || (row.group ?? '').toLowerCase().includes(q)), has_more: false, next_cursor: null } });
    const path = url.pathname;
    if (method === 'POST') {
        if (/\/help\/updates\/[^/]+\/read$/.test(path)) return { status: 204, body: null };
        if (path === '/billing/shell/environments') return { status: 201, body: { id: 'env_new', detailsUrl: '/b/environments/env_new' } };
        return undefined;
    }
    if (path === '/billing/shell/organizations') return list(BILLING_ORGANIZATIONS);
    if (path === '/billing/shell/projects') return list(BILLING_PROJECTS);
    if (path === '/billing/shell/environments') return list(BILLING_ENVIRONMENTS);
    if (path === '/billing/apps/catalog') return { status: 200, body: CATALOG };
    if (path === '/billing/help/updates') return { status: 200, body: { data: [{ id: 'thr_1', kind: 'chat', title: 'Dunning on Hubhus ApS', excerpt: 'Support: We found the retry rule. It now picks up the new card on the next run.', at: '2026-11-11T09:12:00Z', unread: true }] } };
    if (path.startsWith('/billing/help/topics/')) return { status: 200, body: { data: ARTICLES } };
    if (path === '/billing/help/search') return { status: 200, body: { data: ARTICLES.filter(article => article.title.toLowerCase().includes(q)) } };
    // console-kit's grouped search answer: records, and Go to (none in this fixture).
    if (path === '/billing/shell/search') {
        const groups = [
            { key: 'records', label: 'Records', items: RECORDS.filter(row => `${row.title} ${row.subtitle}`.toLowerCase().includes(q)) },
            { key: 'goto', label: 'Go to', items: [] },
        ];
        const group = url.searchParams.get('group');
        return { status: 200, body: { groups: groups.filter(item => group === null || item.key === group) } };
    }
    return undefined;
}
