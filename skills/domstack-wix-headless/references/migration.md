# Wix migration and deployment

## Verify access and migration state

Use a local `@wix/cli` dev dependency with a compatible Node version and the project's existing scripts.
Browser and CLI authentication are separate; verify the intended account with `wix whoami` before provider operations.
Let the user complete device login when needed.

If the operator is the owner, use their existing access without creating a collaborator role.
For a collaborator-managed migration, have the owner assign Website Designer permissions plus **Site Dashboard → Manage headless settings**, for example through a custom role.
Inspect combined permissions to avoid redundant assignments.
Headless Settings includes OAuth apps, redirect URIs, and API keys; it is broader than deployment-only access.
If data restrictions are required, verify Contacts and submission-history access after role changes and again after cutover.
Dashboard restrictions do not imply environment secrets are inaccessible.

Determine the current migration state from Wix before choosing an action; a local config or old handoff alone does not establish it.

| Current state | Action |
| --- | --- |
| Active and accessible to the intended operator | Resume its existing preview and configuration; do not initiate another migration. |
| Active but inaccessible | Report the access failure and resolve it with the owner; do not cancel or restart automatically. |
| No active migration, including after cancellation or Switch Back | Initiate only when requested, then obtain fresh preview configuration. |
| Unknown | Inspect the current state or request the missing information; do not initiate or replace configuration based on a guess. |

When initiation is appropriate, use the original site's **Settings → Headless Settings** as the intended deploying account and review the app compatibility list.
For collaborator workflows, prefer collaborator initiation to avoid a separate owner-created preview access boundary.
Wix's migration help describes initiation as an owner/co-owner action; verify the current account's controls and report a denial rather than assuming Headless Settings guarantees initiation.

### Preview access denied

If `wix env pull` or `wix release` returns `access_denied`, verify the CLI account and exact parent/preview IDs.
Check original-site and preview access separately; parent permissions may not carry over to an owner-initiated preview.
The generic "Failed to renew access token" message can wrap a permission denial, so do not repeatedly re-login without evidence of a stale session.
Capture sanitized errors because raw CLI crash reports may contain credentials.

If access remains blocked, explain the options to the owner, including cancellation and a fresh migration initiated by the intended deploying collaborator.
Cancellation can remove deployed previews; do not perform it implicitly as a retry.
An administrative API key uses different permissions and is not a verification of collaborator access.
Never substitute parent IDs or an unrelated new project to bypass preview denial.

## Inspect the handoff

Read the supplied prompt, configuration download, and current guide at [wix.com/headless/skill.md](https://wix.com/headless/skill.md).
Inspect archives in a temporary directory before merging files or executing scripts.
Extract deployment configuration and applicable migration requirements; keep the existing DOMStack app rather than adopting bundled starter code or framework tooling.

The original **parent** site holds business data; the temporary **child** receives preview deployments.
Use the downloaded child IDs and DOMStack's actual static output directory:

```json
{
  "projectType": "Site",
  "appId": "DOWNLOADED_PREVIEW_APP_ID",
  "siteId": "DOWNLOADED_PREVIEW_SITE_ID",
  "site": { "outputDirectory": "./public" }
}
```

The static output setting affects CLI project detection; omitting it can select an Editor workflow or hide headless commands.

| Information | Source |
| --- | --- |
| Original site ID | Original site's dashboard URL or migration environment. |
| Preview app/site IDs | Current migration configuration download. |
| Original public visitor client ID, if needed | Original site's Headless Settings or migration environment. |
| Form ID and schema, if needed | Form dashboard URL and documented Forms APIs. |
| Completion instructions | Current Complete Migration dialog and migration checklist. |

Run `wix env pull` when migration environment values are needed.
Relevant settings include `EDITOR_MIGRATION_STATUS`, parent/child site IDs, child app ID, and `WIX_CLIENT_ID`.
Use the original site's visitor client for business APIs, not the child's app ID.
Environment pull does not load values into DOMStack automatically: deliberately read the needed public values at build time or configure them in source.
Do not expose the entire environment to browser variables.

## Deploy and review the preview

Finish requested business integrations; for forms, use [form-integration.md](form-integration.md).
Run the site's normal build/checks and verify that configuration targets the intended preview before release.
Use a build-then-release script such as `npm run deploy`; direct `npm run wix -- release` only uploads existing output.
Record the preview URL and verify the hosted result.

Check routes, HTTPS, styles, images, fonts, icons, and any business integrations.
Compare returned content types and bytes when assets fail; HTTP 200 alone does not establish correct delivery.
If a root favicon route is intercepted, use distinct paths such as `/site-icon.svg` with explicit icon links and a PNG fallback where needed.
Check the browser tab icon rather than relying on cached output.

For video and other range-sensitive media, probe a GET with `Range: bytes=0-1` and verify 206, the correct `Content-Range`, and the requested bytes.
An `Accept-Ranges` header alone is insufficient.
If hosting returns the full file or playback/seeking fails, adjust asset hosting or use a media CDN with working range delivery.
A full-file blob fallback is suitable only for small clips.
Test Safari and Chromium while preserving posters, lazy loading, playback controls, and reduced-motion/data-saving preferences.

Before the production build, replace obsolete demo/unconnected copy in UI, status messages, labels, titles, and metadata with accurate working states.
Keep truthful warnings while functionality is incomplete and intentional preview notices while staging.

## Production cutover

Check current eligibility and domain requirements before cutover; existing-site migration currently requires a custom domain.
Change DNS or plans only when required for the requested operation, using Wix's supplied targets.
Client approval and technical execution are separate: a permitted collaborator may execute finalization after production replacement is authorized.

1. Review the preview, required checks, and Wix's Switch Back route.
2. Run a fresh DOMStack build and applicable checks; confirm the output, CLI identity, and migration's parent/child IDs.
3. Save the preview configuration outside public output and follow the dashboard's **Complete Migration** step.
4. Run the local command, such as `npm run wix -- finalize-migration`.
5. Verify the resulting config, live domain, HTTPS redirects, assets, and integrations, including applicable form receipt and data-access checks.

For static projects configured with `site.outputDirectory`, finalization releases existing output without building.
Build beforehand; do not run an additional release after successful finalization.
Check installed CLI behavior if generic instructions claim it builds automatically.

Finalization rewrites configuration to the parent **before** release.
If it fails, inspect config, migration state, and the live frontend before retrying: the project can already point at production even though publication failed.

## Updates and Switch Back

After migration, ordinary build/release commands target production through the updated config.
Verify account, target, and current live frontend when changing operators or credentials; do not assume the same permissions apply after a role change.

When rollback is requested, use the original site's **Settings → Headless Settings → Switch Back**, follow its confirmation, and verify the Editor frontend is restored at the live domain.
The Editor site is retained by migration, but the current operator's ability to switch back must be checked.

After Switch Back, mark the completed migration's config as stale in the project checkpoint and do not deploy with it merely because it still targets the parent.
Retain the DOMStack source, initiate a new migration when returning to headless is requested, and obtain fresh preview configuration.
Verify current business client/form settings independently of those new hosting IDs.

## Official references

- [Collaborator and Headless Settings permissions](https://dev.wix.com/docs/go-headless/project-management/invite-collaborators)
- [Migration requirements and Switch Back](https://support.wix.com/en/article/wix-headless-moving-your-site-to-a-custom-frontend)
- [Pull environment variables](https://dev.wix.com/docs/wix-cli/command-reference/project-commands/env-pull)
- [Deploy your own frontend](https://dev.wix.com/docs/go-headless/wix-managed-headless/other-frameworks/your-own-frontend/deploy-your-own-frontend-with-the-cli)
- [Migration checklist](https://dev.wix.com/docs/go-headless/wix-managed-headless/full-integration-astro/get-started/post-migration-checklist-wix-studio-and-editor-sites-to-headless)
