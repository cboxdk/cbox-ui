import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Activity } from 'lucide-react';
import { CboxWorkspaceShell } from './cbox-workspace-shell';
import type { LinkComponent } from './cbox-app-sidebar';
const Link: LinkComponent = ({href, children, ...props}) => <a href={href} {...props}>{children}</a>;
function render(path: string) {
 return renderToStaticMarkup(<CboxWorkspaceShell appKey="signals" brandSubmark="Signals" currentPath={path} LinkComponent={Link} context="Organization" tools="Switch app" account="Account menu" areas={[
  {label:'Projects',href:'/projects',icon:Activity},
  {label:'Detection',href:'/signals',icon:Activity,items:[{label:'Signals',href:'/signals',icon:Activity},{label:'Detectors',href:'/detectors',icon:Activity}]},
 ]}>Page content</CboxWorkspaceShell>);
}
describe('workspace context navigation', () => {
 it('keeps child routes and query state in the matching area', () => {
  const html=render('/detectors/123?tab=versions');
  expect(html).toContain('cbx-subnav');
  expect(html).toMatch(/class="cbx-workspace-link is-active"[^>]*><svg[^]*?<span>Detection<\/span>/);
  expect(html).toContain('aria-label="Detectors"');
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
});
