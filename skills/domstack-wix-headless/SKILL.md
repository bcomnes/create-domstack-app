---
name: domstack-wix-headless
description: Prepare an existing DOMStack site for Wix hosting and optional business integrations, then stage a headless migration and handle production cutover, updates, or rollback.
---

# DOMStack with Wix hosting

Preserve the site's DOMStack stack, design, and existing Wix business data.
Use native bundling and asset handling with official npm SDKs only for features the site needs.
Do not add a form, visitor authentication, business apps, or sample data simply because this skill describes them.

## Choose the stage

1. **Prepare locally.**
   Inspect the local app and requested integrations; access to the destination Wix site is not a prerequisite.
   Treat unavailable site configuration and business details as unknown inputs for the staging phase; do not invent them or require dashboard/API discovery to complete preparation.
   Prepare local CLI scripts and exclusions, portable asset URLs, and a production origin for canonical/social URLs when known.
   For an existing or requested Wix-backed form, follow [form-integration.md](references/form-integration.md).
   Preparation-only work stops before login, migration initiation, or deployment and leaves a buildable frontend with missing integrations clearly disabled.
2. **Stage the migration.**
   Follow [migration.md](references/migration.md) to establish the current migration state and operator access before applying configuration or deploying.
   Resume an accessible active migration; do not interpret “resume” as permission to create, cancel, or restart one.
   Use collaborator-role guidance only when the operator is a collaborator.
   Require configuration for each requested integration before staging or deployment; preparation-only disabled states are not a connected deployment.
   Stop at the reviewable preview unless production cutover is requested.
3. **Promote, update, or switch back.**
   Follow the lifecycle sections in the migration reference for the requested operation.
   Production replacement and rollback change the live frontend; preparation or preview work does not imply authorization for them.

## Shared constraints

- Adapt Wix's downloaded kit to the existing app; avoid replacement frameworks, vendored SDK/type trees, custom asset-copy steps, and template-only tooling.
- Use the project's existing commands and checks without declaration generation.
  Check the local Wix CLI's Node requirement separately from DOMStack's.
- Keep administrative credentials, CLI tokens, and private environment values out of Git, browser code, and public output.
  Export only the public settings required by the frontend.
- Use the intended operator's account; do not silently change credentials or permissions to bypass an access error.
- Check the installed CLI/SDK and current official instructions for version-sensitive operations.
  Report discrepancies between documentation and available controls rather than guessing at ownership or permissions.

## Leave a resumable checkpoint

Use project notes to record the current stage, account and roles, migration initiator, parent/preview identities, deployment target, completed checks, missing inputs, and next action.
Identify whether the target is preview, production, or stale after Switch Back.
Record sanitized failures and unverified behavior, without credentials or raw authentication responses.
On resume, inspect Git status and the checkpoint and verify current account, migration, and target state before continuing.

## Verification

Run the normal build and applicable checks for local preparation.
For deployed work, follow the hosted checks in the migration reference; for forms, use the form reference's bundle and submission checks.
Keep unconfigured states and preview notices accurate, and replace obsolete prototype copy once functionality works.
Report unperformed checks as unverified.
