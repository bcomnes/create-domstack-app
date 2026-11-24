# Optional Wix form integration

Use this reference only when connecting an existing or requested form to Wix.
Hosting alone does not require form SDKs, a visitor client, or schema loading.
Preserve authored controls, labels, field arrangement, and styling.

## Prepare before Wix access

Use the authored frontend and supplied requirements while the destination Wix site is inaccessible.
Its form structure, identifiers, field keys, validation rules, and success behavior may all be unknown.
Prepare reusable integration code and configuration slots; confirm compatibility and bind real fields after access is granted.

- Add `@wix/sdk` and `@wix/forms` and check their installed types for current method signatures.
- Prepare a build-time schema provider, a browser visitor-session module, and an adapter that accepts explicit Wix field mappings once known.
- Leave unknown identifiers unset and avoid Wix requests while unconfigured.
  Disable sending with an accurate explanation; never simulate submission success.
- Implement frontend validation and interaction from the supplied requirements, including accessible errors, pending state, duplicate-submit prevention, reset, and retained values after failure.
  Treat those validation defaults as provisional until compared with the real Wix schema.
- Build and run applicable checks, then record the missing inputs in the project checkpoint.

When access becomes available, inspect the original Wix form's schema for fields, validation, conditional rules, steps, uploads, spam restrictions, and success behavior.
Do not infer field targets from labels or read submission history to discover schema.
Preserve any already-valid integration settings rather than clearing them for preparation.

## Configuration to obtain after access

Obtain the original site's visitor OAuth client ID, existing form ID, exact field targets, and current schema through permitted dashboard/API access.
These may be available before migration; a client secret or environment pull is not required for local preparation.
Keep business configuration separate from the migration preview's deployment IDs.
Empty identifiers and a disabled form are acceptable during local preparation only.
Before staging or deployment, verify that the required client ID, form ID, and field mappings are configured; report missing or invalid values as a blocking error rather than publishing an unintentionally disabled form.
This is a stage-specific verification step, not a requirement to add a release guard or separate tooling.

## Read schema at build time

Prefer build-time reads when form changes can wait for a rebuild.
If live schema changes are required, measure browser bundle cost before choosing runtime fetching.
For example, a DOMStack `src/global.vars.ts` provider can keep an unconfigured build working:

```ts
import { createClient, OAuthStrategy } from '@wix/sdk'
import { forms } from '@wix/forms'

const wix = { clientId: '', formId: '' }

export const browser = async () => {
  if (!wix.clientId && !wix.formId) {
    return { WIX_CLIENT_ID: '', WIX_CONTACT_FORM: null }
  }
  if (!wix.clientId || !wix.formId) {
    throw new Error('Configure both the Wix visitor client ID and form ID.')
  }
  const client = createClient({
    modules: { getForm: forms.getForm },
    auth: OAuthStrategy({ clientId: wix.clientId }),
  })
  return {
    WIX_CLIENT_ID: wix.clientId,
    WIX_CONTACT_FORM: await client.getForm(wix.formId),
  }
}
```

Merge this into existing global variables rather than replacing them.
The provider runs in Node during the build; return actual values because DOMStack serializes the `browser` export.
Do not double-serialize with `JSON.stringify` or import the provider into browser code.
Once configured, surface schema-fetch failures as build errors rather than silently producing a disabled production form.
Rebuild after changes to any schema or settings fetched during the build.

## Browser integration

Use `/// <reference lib="dom" />` on standalone browser TypeScript files.
Declare the injected browser variables and use type-only imports for the schema.
Register only the needed SDK methods, such as `{ createSubmission: submissions.createSubmission }`.
Initialize anonymous OAuth once, set visitor tokens on the client, and persist updated tokens when storage is available.
Handle unavailable storage in memory and clear failed initialization so a deliberate retry can work.
Do not authenticate while the form is unconfigured.

Map controls using explicit targets, such as `data-wix-target` attributes.
Apply supported schema constraints and success settings; surface unsupported field types, rules, or steps instead of silently dropping them.
Confirm the installed schema shape, including `formFields[].inputOptions` and its validation options, before using it.
Remove absent length constraints rather than assigning invalid negative DOM values.

Submit with the installed SDK's supported equivalent of:

```ts
client.createSubmission({ formId, submissions: { [fieldTarget]: value } })
```

Check its returned identifier/status instead of assuming every resolved request succeeded.
Honor success messages or redirects, restrict redirect protocols, and render labels/messages as text unless sanitizing supported rich content.
Provide a useful no-JavaScript explanation or a working fallback.

## Verify the integration

Inspect `public/domstack-esbuild-meta.json` and output contributions to ensure the schema reader adds no browser bytes.
Parsed inputs alone do not establish emitted size; inspect shared and lazy chunks as well as the entry bundle.
Confirm only public client/schema settings are embedded and document the rebuild requirement.

On the hosted form, check validation, pending/error/success states, reset, and retained input on failure.
When authorized, send one clearly marked synthetic submission and have an authorized data viewer confirm receipt on the original form.
If the operator lacks submission access, ask the owner to verify receipt without switching sessions or broadening roles.

## Official references

- [Create an OAuth SDK client](https://dev.wix.com/docs/go-headless/authentication/setup/create-an-sdk-client-with-oauth)
- [Authenticate visitors](https://dev.wix.com/docs/go-headless/authentication/visitors/authenticate-visitors-js-sdk)
- [Get Form](https://dev.wix.com/docs/api-reference/crm/forms/form-schemas/get-form?apiView=SDK)
- [Create Submission](https://dev.wix.com/docs/api-reference/crm/forms/form-submissions/create-submission?apiView=SDK)
