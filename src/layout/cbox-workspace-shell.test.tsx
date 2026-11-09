import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Activity } from 'lucide-react';
import { CboxWorkspaceShell, activeNavArea, activeNavItem, navMatchLength } from './cbox-workspace-shell';
import type { LinkComponent } from './cbox-app-sidebar';
const Link: LinkComponent = ({href, children, ...props}) => <a href={href} {...props}>{children}</a>;
function render(path: string, extra: Partial<Parameters<typeof CboxWorkspaceShell>[0]> = {}) {
 return renderToStaticMarkup(<CboxWorkspaceShell appKey="signals" brandSubmark="Signals" currentPath={path} LinkComponent={Link} context="Organization" tools="Switch app" account="Account menu" areas={[
  {label:'Projects',href:'/projects',icon:Activity},
  {label:'Detection',href:'/signals',icon:Activity,items:[{label:'Signals',href:'/signals',icon:Activity},{label:'Detectors',href:'/detectors',icon:Activity}]},
 ]} {...extra}>Page content</CboxWorkspaceShell>);
}
describe('workspace context navigation', () => {
 it('keeps child routes and query state in the matching area', () => {
  const html=render('/detectors/123?tab=versions');
  expect(html).toContain('cbx-subnav');
  expect(html).toMatch(/class="cbx-workspace-link is-active"[^>]*><svg[^]*?<span>Detection<\/span>/);
  expect(html).toContain('aria-label="Detectors"');
  expect(html).toContain('aria-label="Detectors" aria-current="page"');
 });
 it('does not show a contextual panel for a single-page area', () => {
  expect(render('/projects')).not.toContain('<aside class="cbx-subnav"');
 });
 it('does not match sibling path prefixes or hide mobile navigation', () => {
  const html=render('/detectors-other');
  expect(html).not.toContain('<aside class="cbx-subnav"');
  expect(html).toContain('aria-label="Open navigation"');
  expect(html).toContain('cbx-rail-account');
  expect(html).toContain('Switch app');
 });
 it('names the main landmark for a skip link and lets the host point the brand home', () => {
  const html=render('/projects', {brandHref: '/acme'});
  expect(html).toContain('<main id="main-content"');
  expect(html).toContain('href="/acme" aria-label="Home"');
  expect(render('/projects', {mainId: 'content'})).toContain('<main id="content"');
 });
 it('renders the pinned rail and the collapsed strip from the host\'s preference', () => {
  const pinned=render('/detectors', {pinned: true});
  expect(pinned).toContain('data-pinned="true"');
  expect(pinned).toContain('aria-label="Unpin navigation"');
  expect(render('/detectors', {defaultCollapsed: true})).toContain('class="cbx-subnav-strip"');
 });
});
describe('most specific match wins', () => {
 const org = {label:'Overview',href:'/acme',icon:Activity};
 const projects = {label:'Projects',href:'/acme/projects',icon:Activity};
 const settings = {label:'Settings',href:'/acme/settings/organization',icon:Activity,items:[
  {label:'Organization',href:'/acme/settings/organization',icon:Activity},
  {label:'Members',href:'/acme/settings/members',icon:Activity},
 ]};
 it('does not let an area at the root claim every page beneath it', () => {
  expect(activeNavArea('/acme', [org, projects, settings])).toBe(org);
  expect(activeNavArea('/acme/projects/api', [org, projects, settings])).toBe(projects);
  expect(activeNavArea('/acme/settings/members', [org, projects, settings])).toBe(settings);
  expect(activeNavArea('/other', [org, projects, settings])).toBeUndefined();
 });
 it('lights one item, the deepest, and never a home item for other pages', () => {
  expect(activeNavItem('/acme/settings/members/inv_1', settings.items)?.label).toBe('Members');
  expect(navMatchLength('/anything', '/')).toBe(-1);
  expect(navMatchLength('/', '/')).toBe(1);
 });
});
