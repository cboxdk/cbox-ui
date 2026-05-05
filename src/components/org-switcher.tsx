import { useState, type ComponentType, type ReactNode } from 'react';
import { useCboxId, type CboxOrganization } from '../context/cbox-id';
import { cn } from '../utils/cn';

type Props = {
    /**
     * Optional renderer override for the trigger so apps can match
     * their topbar style (filled button vs ghost vs icon-only).
     */
    Trigger?: ComponentType<{
        organization: CboxOrganization | null;
        onClick: () => void;
        open: boolean;
    }>;
    className?: string;
};

/**
 * Dropdown that surfaces the user's orgs and dispatches the picked
 * one through `onSwitchOrganization` (or POSTs to switchOrgUrl as a
 * fallback). Reads everything else from CboxIdProvider so the same
 * component works in id, cortex, atlas — no per-app data wiring.
 */
export function OrgSwitcher({ Trigger = DefaultTrigger, className }: Props) {
    const { currentOrganization, organizations, urls, onSwitchOrganization } = useCboxId();
    const [open, setOpen] = useState(false);

    const onPick = (org: CboxOrganization) => {
        setOpen(false);
        if (onSwitchOrganization) {
            onSwitchOrganization(org);
            return;
        }
        // Fallback: form-POST to id's switch endpoint and let the
        // server bounce us back. CSRF token comes from the meta tag
        // most Cbox apps already render in their layout head.
        const csrf = document
            .querySelector<HTMLMetaElement>('meta[name="csrf-token"]')
            ?.content;
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = urls.switchOrgUrl;
        form.style.display = 'none';
        if (csrf) {
            const input = document.createElement('input');
            input.name = '_token';
            input.value = csrf;
            form.appendChild(input);
        }
        const idInput = document.createElement('input');
        idInput.name = 'organization_id';
        idInput.value = String(org.id);
        form.appendChild(idInput);
        document.body.appendChild(form);
        form.submit();
    };

    return (
        <div className={cn('relative', className)}>
            <Trigger
                organization={currentOrganization}
                onClick={() => setOpen((v) => !v)}
                open={open}
            />
            {open ? (
                <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-md border border-border bg-popover p-1 shadow-md">
                    <p className="text-eyebrow px-2 py-1.5 text-muted-foreground">
                        Switch organization
                    </p>
                    <ul className="space-y-0.5">
                        {organizations.map((org) => {
                            const active = currentOrganization?.id === org.id;
                            return (
                                <li key={org.id}>
                                    <button
                                        type="button"
                                        onClick={() => onPick(org)}
                                        className={cn(
                                            'flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-sm',
                                            active
                                                ? 'bg-accent-soft text-foreground'
                                                : 'hover:bg-secondary',
                                        )}
                                    >
                                        <span className="truncate">{org.name}</span>
                                        {active ? (
                                            <span className="text-mono text-[10px] text-muted-foreground">
                                                current
                                            </span>
                                        ) : null}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            ) : null}
        </div>
    );
}

const DefaultTrigger: ComponentType<{
    organization: CboxOrganization | null;
    onClick: () => void;
    open: boolean;
}> = ({ organization, onClick }) => (
    <button
        type="button"
        onClick={onClick}
        className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-secondary"
    >
        <span className="truncate max-w-[180px]">
            {organization?.name ?? 'Pick an organization'}
        </span>
        <Chevron />
    </button>
);

function Chevron(): ReactNode {
    return (
        <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden
        >
            <path
                d="M2 4l3 3 3-3"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}
