import type { ContextItem, Shell } from '../types';

/**
 * A complete `shell` prop and the answers its URLs give, for the unit tests and the visual
 * fixture page. Not part of the package's public entry.
 */

export const ORGANIZATIONS: ContextItem[] = [
    { id: 'org_cbox', name: 'Cbox', initials: 'C' },
    { id: 'org_acme', name: 'Acme ApS' },
    { id: 'org_nordic', name: 'Nordic Logistics Holding A/S with a very long legal name' },
];

export const PROJECTS: ContextItem[] = [
    { id: 'prj_webshop', name: 'Webshop' },
    { id: 'prj_status', name: 'Status page' },
    { id: 'prj_billing', name: 'Billing API' },
];

export const ENVIRONMENTS: Record<string, ContextItem[]> = {
    prj_webshop: [
        { id: 'env_web_prod', name: 'Production', tone: 'production', label: 'default' },
        { id: 'env_web_sandbox', name: 'Sandbox', tone: 'sandbox', label: 'test data', testData: true },
        { id: 'env_web_preview', name: 'Preview', tone: 'neutral' },
    ],
    prj_status: [
        { id: 'env_status_staging', name: 'Staging', tone: 'neutral' },
        { id: 'env_status_prod', name: 'Production', tone: 'production' },
    ],
    prj_billing: [{ id: 'env_billing_dev', name: 'Development', tone: 'sandbox', testData: true }],
};

export const CATALOG = {
    apps: [
        { key: 'id', name: 'Cbox · ID', launch_url: 'https://app.cboxid.com', purpose: 'Identity and sign-in' },
        { key: 'infra', name: 'Cbox · Infra', launch_url: 'https://app.cboxinfra.com', purpose: 'Servers and deployments' },
        { key: 'billing', name: 'Cbox · Billing', launch_url: 'https://app.cboxbilling.com', purpose: 'Plans and invoices' },
        { key: 'telemetry', name: 'Cbox · Telemetry', launch_url: 'https://app.cboxtelemetry.com', purpose: 'Metrics, logs and traces' },
        { key: 'work', name: 'Cbox · Work', launch_url: 'https://app.cboxwork.com', purpose: 'Time and invoices' },
        { key: 'engage', name: 'Cbox · Engage', in_organization: false, admission_url: 'https://app.cboxengage.com/orgs/cbox/join', purpose: 'Customer messages' },
        { key: 'brain', name: 'Cbox · Brain', in_organization: false, admission_url: 'https://app.cboxbrain.com/orgs/cbox/join', purpose: 'Team memory' },
        { key: 'status', name: 'Cbox · Status', in_organization: false, admission_url: 'https://app.cboxstatus.com/orgs/cbox/join', purpose: 'Status pages' },
    ],
    refresh_after: 60,
};

export const UPDATES = {
    data: [
        { id: 'upd_1', kind: 'ticket', title: 'Deploy stuck on “building”', excerpt: 'We found the cause: a cache lock on the build runner. It is released now.', at: '2026-11-10T09:12:00Z', unread: true, url: 'https://support.cbox.dk/tickets/1042' },
        { id: 'upd_2', kind: 'chat', title: 'Question about environments', excerpt: 'You can copy settings from Production when you create Sandbox.', at: '2026-11-09T15:40:00Z', unread: true },
        { id: 'upd_3', kind: 'ticket', title: 'Invoice address', excerpt: 'Updated on your account.', at: '2026-11-02T08:00:00Z', unread: false, url: 'https://support.cbox.dk/tickets/1001' },
    ],
};

export const ARTICLES = {
    data: [
        { id: 'art_1', title: 'Deploy a project', excerpt: 'Push to the branch an environment follows, or deploy by hand.', body: 'Every environment follows one branch.\n\nPush to it and a deployment starts. You can also deploy by hand from Deployments.' },
        { id: 'art_2', title: 'Roll back a deployment', excerpt: 'Any earlier deployment can be made live again in one step.' },
        { id: 'art_3', title: 'Environments and test data', excerpt: 'How sandboxes keep test data apart from production.' },
    ],
};

export function makeShell(overrides: Partial<Shell> = {}): Shell {
    return {
        app: { key: 'infra', name: 'Cbox · Infra', homeUrl: '/orgs/cbox' },
        person: { id: 'usr_1', name: 'Sylvester Damgaard', initials: 'SD', email: 'sd@cbox.dk' },
        page: { title: 'Deployments', route: 'deployments.index' },
        nav: {
            areas: [
                { key: 'overview', label: 'Overview', url: '/orgs/cbox', icon: 'layout-dashboard' },
                {
                    key: 'deploy',
                    label: 'Deploy',
                    url: '/orgs/cbox/projects/webshop/environments/production/deployments',
                    icon: 'rocket',
                    pages: [
                        { key: 'deployments', label: 'Deployments', url: '/orgs/cbox/projects/webshop/environments/production/deployments' },
                        { key: 'releases', label: 'Releases', url: '/orgs/cbox/projects/webshop/environments/production/releases' },
                        { key: 'pipelines', label: 'Pipelines', url: '/orgs/cbox/projects/webshop/environments/production/pipelines' },
                    ],
                },
                { key: 'servers', label: 'Servers', url: '/orgs/cbox/servers', icon: 'server' },
                { key: 'domains', label: 'Domains', url: '/orgs/cbox/domains', icon: 'globe' },
                { key: 'settings', label: 'Settings', url: '/orgs/cbox/settings', icon: 'settings' },
            ],
            activeArea: 'deploy',
            activePage: 'deployments',
        },
        context: {
            levels: [
                { key: 'organization', label: 'Organization', current: ORGANIZATIONS[0]!, listUrl: '/shell/organizations', createUrl: '/shell/organizations', allUrl: '/orgs', settingsUrl: '/orgs/{id}/settings' },
                { key: 'project', label: 'Project', current: PROJECTS[0]!, listUrl: '/orgs/cbox/shell/projects', createUrl: '/orgs/cbox/shell/projects', allUrl: '/orgs/cbox/projects', settingsUrl: '/orgs/cbox/projects/{id}/settings' },
                { key: 'environment', label: 'Environment', current: ENVIRONMENTS.prj_webshop![0]!, listUrl: '/orgs/cbox/shell/environments', createUrl: '/orgs/cbox/shell/environments', allUrl: '/orgs/cbox/projects/webshop/environments', settingsUrl: '/orgs/cbox/environments/{id}/settings' },
            ],
            switchUrl: '/shell/switch',
        },
        palette: {
            searchUrl: '/orgs/cbox/shell/search',
            gotoUrl: '/shell/goto',
            actions: [
                { id: 'new-deployment', label: 'New deployment', url: '/orgs/cbox/deployments/create', icon: 'rocket' },
                { id: 'invite', label: 'Invite members', url: '/orgs/cbox/settings/members/invite', icon: 'users', keywords: ['team'] },
            ],
        },
        help: {
            enabled: true,
            topic: 'deployments',
            sessionUrl: '/orgs/cbox/help/session',
            portalUrl: 'https://support.cbox.dk',
            updatesUrl: '/orgs/cbox/help/updates',
            searchUrl: '/orgs/cbox/help/search',
            articlesUrl: '/orgs/cbox/help/topics/{topic}/articles',
        },
        notifications: { enabled: false },
        apps: { catalogUrl: '/orgs/cbox/apps/catalog' },
        account: {
            profileUrl: 'https://app.cboxid.com/settings',
            switchAccountUrl: '/switch-account',
            signOutUrl: '/logout',
            languages: [
                { code: 'en', label: 'English' },
                { code: 'da', label: 'Dansk' },
            ],
        },
        preferences: { theme: 'system', locale: 'en', railPinned: false, helpOpen: false, regionalFormat: 'da-DK', timeZone: 'Europe/Copenhagen' },
        ...overrides,
    };
}

/**
 * The JSON answer for a fixture URL, or `undefined` for an unknown one. `q`, `parent` and
 * `cursor` behave like a real list endpoint (two rows per page when `limit=2`).
 */
export function fixtureAnswer(method: string, href: string, body?: unknown): { status: number; body: unknown } | undefined {
    const url = new URL(href, 'https://app.test');
    const q = (url.searchParams.get('q') ?? '').toLowerCase();
    const parent = url.searchParams.get('parent');
    const limit = Number(url.searchParams.get('limit') ?? '25');
    const cursor = Number(url.searchParams.get('cursor') ?? '0');
    const page = (rows: ContextItem[]) => {
        const matching = rows.filter(row => row.name.toLowerCase().includes(q));
        const slice = matching.slice(cursor, cursor + limit);
        const more = cursor + limit < matching.length;
        return { status: 200, body: { object: 'list', data: slice, has_more: more, next_cursor: more ? String(cursor + limit) : null } };
    };
    const path = url.pathname;
    if (method === 'POST') {
        const name = typeof (body as { name?: unknown })?.name === 'string' ? (body as { name: string }).name : '';
        if (name.trim() === 'Taken') return { status: 422, body: { errors: { name: ['That name is taken.'] } } };
        if (path === '/shell/organizations') return { status: 201, body: { id: 'org_new', detailsUrl: '/orgs/new-org' } };
        if (path === '/orgs/cbox/shell/projects') return { status: 201, body: { id: 'prj_new', detailsUrl: '/orgs/cbox/projects/new-project' } };
        if (path === '/orgs/cbox/shell/environments') return { status: 201, body: { id: 'env_new', details_url: '/orgs/cbox/environments/new-env' } };
        if (/\/help\/updates\/[^/]+\/read$/.test(path)) return { status: 204, body: null };
        return undefined;
    }
    if (path === '/shell/organizations') return page(ORGANIZATIONS);
    if (path === '/orgs/cbox/shell/projects') return page(PROJECTS);
    if (path === '/orgs/cbox/shell/environments') return page(ENVIRONMENTS[parent ?? ''] ?? []);
    if (path === '/orgs/cbox/apps/catalog') return { status: 200, body: CATALOG };
    if (path === '/orgs/cbox/help/updates') return { status: 200, body: UPDATES };
    if (path === '/orgs/cbox/help/topics/deployments/articles') return { status: 200, body: ARTICLES };
    if (path === '/orgs/cbox/help/search') return { status: 200, body: { data: ARTICLES.data.filter(article => article.title.toLowerCase().includes(q)) } };
    if (path === '/orgs/cbox/shell/search') {
        return { status: 200, body: { data: [{ id: 'dep_1', title: 'Deployment 3f9c21a', subtitle: 'Webshop · Production', url: '/orgs/cbox/deployments/dep_1' }].filter(row => row.title.toLowerCase().includes(q) || q === 'deploy') } };
    }
    // console-kit's search endpoint: one answer, grouped; `?group=` asks for one group.
    if (path === '/shell/search') {
        const group = url.searchParams.get('group');
        const groups = [
            { key: 'records', label: 'Records', items: [{ id: 'cus_1', title: 'Fjord Studio', subtitle: 'Customer', url: '/orgs/cbox/customers/cus_1' }].filter(row => row.title.toLowerCase().includes(q)) },
            { key: 'goto', label: 'Go to', items: [{ id: 'goto_1', title: 'Fjord · Production', subtitle: 'Project · Cbox', url: '/shell/switch?select%5Bproject%5D=prj_fjord' }].filter(row => row.title.toLowerCase().includes(q)) },
        ];
        return { status: 200, body: { groups: groups.filter(g => group === null || g.key === group) } };
    }
    if (path === '/shell/goto') {
        return { status: 200, body: { data: [{ title: 'Webshop · Sandbox', subtitle: 'Cbox', levels: { organization: 'org_cbox', project: 'prj_webshop', environment: 'env_web_sandbox' } }].filter(row => row.title.toLowerCase().includes(q)) } };
    }
    return undefined;
}
