/**
 * The `shell` Inertia prop: the one data contract every Cbox app shares (spec §11.1).
 *
 * The server (laravel-console-kit) produces it; `<CboxShell>` renders it. It carries only the
 * current selection and URLs. Lists, the app catalog, help and search load in the browser after
 * the page has painted, so building this prop never calls another service (local first, §11.2a).
 */

/** The product key (URL standard §1). Unknown keys are allowed so a new app needs no release here. */
export type AppKey =
    | 'id'
    | 'billing'
    | 'telemetry'
    | 'work'
    | 'brain'
    | 'infra'
    | 'engage'
    | 'assistant'
    | 'sites'
    | 'stache'
    | 'status'
    | 'tax'
    | 'signals'
    | 'domains'
    | (string & {});

/**
 * A labelled link. `href` is the same URL under the name laravel-console-kit 0.2 sends; the
 * shell reads `url` first, then `href`.
 */
export type Link = { label: string; url: string; href?: string };

/**
 * One page inside an area. `icon` is a Lucide icon name (`"git-branch"`), resolved by the shell.
 * `href` is the same URL under the name laravel-console-kit 0.2 sends; the shell reads `url`
 * first, then `href`.
 */
export type NavPage = {
    key: string;
    label: string;
    url: string;
    href?: string;
    icon?: string;
    /**
     * The page is not part of the organization's plan: it shows with a lock and an accessible
     * "(locked)", and `url` leads to the upgrade prompt.
     */
    locked?: boolean;
    /** A badge, such as open drafts. Not shown when 0 or absent. */
    count?: number;
    /**
     * A heading inside the area's subnav (Settings → "Organization", "Project"). Pages of one
     * group show together under it, in the order each group first appears.
     */
    group?: string;
};

/** One area in the rail. The subnav shows its pages when it has more than one. */
export type NavArea = { key: string; label: string; url: string; href?: string; icon?: string; pages?: NavPage[] };

export type ContextTone = 'production' | 'sandbox' | 'neutral';

/**
 * One selectable item of a level: the current one in the prop, and every row a level's
 * `listUrl` returns. Environments are app-defined (§5.1a): `tone`, `label` and `testData` are
 * all optional and the shell never sorts the items.
 */
export type ContextItem = {
    id: string;
    name: string;
    /** Chip text. Defaults to the first letters of the name. */
    initials?: string;
    /** The coloured square: production green, sandbox amber, neutral grey. */
    tone?: ContextTone;
    /** Short app-defined label beside the name ("default", "test data"). */
    label?: string;
    /** The sandbox strip shows while the current item has test data. */
    testData?: boolean;
};

export type ContextLevel = {
    /** `organization`, `project`, `environment`, or the app's own key (`site`, `space`). */
    key: 'organization' | 'project' | 'environment' | (string & {});
    /** Singular, as the app names it: "Organization", "Site", "Space", "Environment". */
    label: string;
    /** Plural for headings ("Organizations"). Defaults to `label` + "s". */
    labelPlural?: string;
    current: ContextItem;
    /**
     * Lazy JSON list, fetched when a menu opens: `GET listUrl?q=&parent=&cursor=&limit=` answering
     * `{ data: ContextItem[], has_more: boolean, next_cursor: string | null }`.
     */
    listUrl: string;
    /** `POST createUrl { name, parent? }` answering `{ id, detailsUrl }`. Absent: no "New …". */
    createUrl?: string;
    /** "View all". */
    allUrl: string;
    /**
     * Settings page of one item, as a URL template on the wire: `{id}` is replaced with the
     * item's id (`/orgs/{id}/settings`). Absent: no gear.
     */
    settingsUrl?: string;
};

export type PaletteAction = {
    id: string;
    label: string;
    url: string;
    /** `post` for actions that change something. Default `get`. */
    method?: 'get' | 'post';
    icon?: string;
    /** Extra words the palette matches on. */
    keywords?: string[];
};

export type ShellHelp = {
    /** False: Help still renders, and says it is not available here. */
    enabled: boolean;
    /** The page's help topic key (§7.2.3). */
    topic?: string;
    /** Same-origin route the Assistant SDK's `<cbox-support>` element fetches its session from. */
    sessionUrl?: string;
    /** Where the SDK script is served. Default `/ai-assistant/support.js` (laravel-assistant-client). */
    scriptUrl?: string;
    /** The support portal. Absent or offline: the link is hidden. */
    portalUrl?: string;
    /** `GET` support updates; `POST {updatesUrl}/{id}/read` marks one read. */
    updatesUrl?: string;
    /** `GET ?q=&topic=` docs, help centre and knowledge base search. */
    searchUrl?: string;
    /** Articles for a topic, as a template: `{topic}` is replaced. */
    articlesUrl?: string;
};

export type ShellNotifications = { enabled: false } | { enabled: true; unread: number; url: string };

export type ShellBanner = {
    kind: 'sandbox' | 'impersonation' | 'notice';
    text: string;
    action?: Link;
};

export type ShellTheme = 'system' | 'light' | 'dark';

export type ShellPreferences = {
    theme: ShellTheme;
    locale: string;
    railPinned: boolean;
    helpOpen: boolean;
    /** The subnav collapsed to its strip (⌘.). */
    subnavCollapsed?: boolean;
    /** Regional format (a BCP 47 locale for dates and numbers), from Cbox ID's preferences. */
    regionalFormat?: string;
    /** IANA time zone, from Cbox ID's preferences. */
    timeZone?: string;
};

export type ShellOption = { code: string; label: string };

/**
 * What the account menu (§10) links to. A row whose URL is absent is not shown (laravel-console-kit
 * leaves out what the app has no route for).
 */
export type ShellAccount = {
    /** Profile and security, in Cbox ID. */
    profileUrl?: string;
    switchAccountUrl?: string;
    signOutUrl?: string;
    /** Default `post`. */
    signOutMethod?: 'get' | 'post';
    /** Languages the app is translated into. */
    languages?: ShellOption[];
    /** Regional formats offered. Defaults to a short list. */
    formats?: ShellOption[];
    /** Line under the name in the account menu. Default "Signed in with Cbox ID". */
    signedInWith?: string;
};

export type Shell = {
    app: { key: AppKey; name: string; homeUrl: string };
    person: { id: string; name: string; initials: string; avatarUrl?: string; email?: string };
    /** The page title and route, for "On this page" and the chat's page intent. */
    page?: { title: string; route?: string };
    nav: { areas: NavArea[]; activeArea: string; activePage?: string };
    context: {
        /** 1–3, in order. The first is the organization. */
        levels: ContextLevel[];
        /** `POST` target; the server resolves same-page or list fallback (§5.6). */
        switchUrl: string;
    };
    palette: {
        /** `GET ?q=` → `{ data: [{ id, title, subtitle?, url }] }`, in the current context. */
        searchUrl?: string;
        /** `GET ?q=` → level 2/3 combinations across organizations (§6.1.4). */
        gotoUrl?: string;
        actions: PaletteAction[];
        /**
         * The palette search field's placeholder, e.g. "Search customers, invoices… or pages". Default
         * "Search or ask…". The header's Search button keeps "Search or ask…" in every app (spec §4.3).
         */
        placeholder?: string;
    };
    help: ShellHelp;
    notifications: ShellNotifications;
    apps: {
        /** The host's catalog endpoint (laravel-id-client `CboxId::appCatalogRoutes()`). */
        catalogUrl: string;
        /** "All products ↗". Default https://cbox.dk. */
        productsUrl?: string;
    };
    /** The account menu's links. Absent (laravel-console-kit 0.2.2): the menu has only the preferences. */
    account?: ShellAccount;
    /** The single strip of laravel-console-kit 0.2.3 and older. Shown only when `banners` is absent. */
    banner?: ShellBanner;
    /**
     * Every strip under the header, top to bottom: the sandbox strip first, then the app's banners
     * (a tax hold, impersonation). An app banner never hides the sandbox strip. Wins over `banner`.
     */
    banners?: ShellBanner[];
    preferences: ShellPreferences;
};

/** How the shell moves the person. An Inertia host passes `router.visit`. */
export type ShellNavigate = (url: string, options?: { method?: 'get' | 'post'; data?: Record<string, unknown>; newTab?: boolean }) => void;

/** Where the shell reports a preference the person changed, for the host to persist. */
export type ShellPreferenceChange = <K extends keyof ShellPreferences>(key: K, value: ShellPreferences[K]) => void;
