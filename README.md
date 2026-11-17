# @domstack/create-app

[![npm version](https://img.shields.io/npm/v/@domstack/create-app.svg)](https://www.npmjs.com/package/@domstack/create-app)
[![Actions Status](https://github.com/bcomnes/create-domstack-app/workflows/tests/badge.svg)](https://github.com/bcomnes/create-domstack-app/actions)
[![neostandard JavaScript style](https://img.shields.io/badge/code_style-neostandard-7fffff?style=flat&labelColor=ff80ff)](https://github.com/neostandard/neostandard)

Create a new [DOMStack](https://github.com/bcomnes/domstack) app.

## Usage

```sh
npm create @domstack/app@latest my-app
```

The npm `create` convention maps `@domstack/app` to this package, `@domstack/create-app`.
In an interactive terminal, the command asks for the source language (TypeScript by default), browser JSX runtime (none by default, Preact recommended when wanted, or React), Tailwind CSS (off by default), and deployment (none by default, GitHub Pages, Neocities, Wix, Cloudflare, Vercel, or Netlify).
Explicit flags skip their corresponding questions.
Interactive menus list choices on separate lines, highlight defaults, and use Node's built-in terminal styling, respecting terminal color support and `NO_COLOR`.
Boolean questions accept case-insensitive `y`/`n` (or `yes`/`no`), state their default, and use that default when you press Enter; Tailwind shows `[y/N] (default: no)`.
Use `--yes` to skip all questions; non-interactive input also uses defaults for unspecified choices.
The command creates the project, installs its dependencies, and ejects DOMStack's customizable default layout, global stylesheet, and client script in the selected language.

```sh
npm create @domstack/app@latest my-app -- --yes --language ts --framework preact --tailwind --deploy github-pages
```

### Options

| Flag | Choices / behavior |
| --- | --- |
| `--language` | `ts` (default), `js` |
| `--framework` | `none` (default), `preact`, `react` |
| `--tailwind` | Enable Tailwind CSS (default: disabled) |
| `--deploy` | `none` (default), `github-pages`, `neocities`, `wix`, `cloudflare`, `vercel`, `netlify` |
| `-y`, `--yes` | Skip prompts, retaining explicit choices |
| `--no-install` | Write starter files without installing or ejecting |
| `-h`, `--help` | Show usage |
| `-v`, `--version` | Show the generator version |

The target directory defaults to `domstack-app` and must be empty if it already exists.

### Upstream release requirement

The minimum supported DOMStack release is `12.0.0-beta.9`, verified on npm to support `--eject --language ts|js --yes` after upstream PR #320 merged.
The generator declares `@domstack/static` as `^12.0.0-beta.9`.

To create the starter files without installing dependencies or ejecting DOMStack's defaults:

```sh
npm create @domstack/app@latest my-app -- --no-install
```

With `--no-install`, first run `npm install`, `npx domstack --eject --language ts --yes`, and `npm install` inside the project to install DOMStack, eject its defaults, and install the added dependencies.
Use `--language js` instead for a JavaScript project.
Eject overwrites the default layout, stylesheet, and client, so only use it in a fresh project or after backing up customizations.
For Tailwind projects, manual eject also replaces `src/globals/global.css`; restore that file to `@import "tailwindcss" source("../");` afterward.
Automatic setup restores the Tailwind stylesheet for you.

Then start the development server:

```sh
cd my-app
npm run dev
```

## Generated project

```text
my-app/
├── src/
│   ├── globals/
│   │   ├── global.client.ts
│   │   └── global.css
│   ├── layouts/
│   │   └── root.layout.ts
│   ├── page.md
│   └── style.css
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

The generated scripts are:

- `npm run dev` starts DOMStack in watch mode.
- `npm run build` builds the site into `public/`.
- `npm run preview` builds once and serves the site.
- `npm run typecheck` checks TypeScript projects without emitting files.

JavaScript selection generates `.js` layout/client files and omits TypeScript configuration and tooling.
Preact or React adds a browser counter at `/interactive/` using `.tsx` or `.jsx`, plus an esbuild settings file with the selected JSX runtime.
Tailwind adds the esbuild plugin and a global Tailwind import; starter styles use a base layer so utility classes can override them.

The generated project uses the `@domstack/static` version range declared in this generator's `devDependencies`.
Its default layout, global stylesheet, and client script are ejected into `src/` so they can be customized.

## Deployment

`--deploy github-pages` generates `.github/workflows/github-pages.yml` and a language-appropriate `src/globals/global.vars.ts` or `.js`.
Select **GitHub Actions** in repository Settings → Pages.
The workflow obtains `base_path` from `actions/configure-pages` and passes it through `DOMSTACK_BASE_PATH` to DOMStack's `basePath` variable, supporting repository sites, user/organization sites, and configured custom domains.
The default layout uses this variable for script and stylesheet URLs; it does not rewrite arbitrary page links or image URLs.
Use relative content URLs or account for `vars.basePath` in rendered content.
Local builds use an empty base path.

`--deploy neocities` generates `.github/workflows/neocities.yml` using [bcomnes/deploy-to-neocities@v3](https://github.com/bcomnes/deploy-to-neocities), the GitHub Action built on [async-neocities](https://github.com/bcomnes/async-neocities).
`async-neocities` itself is an npm API client and interactive CLI, not an action to put in `uses:`.
The generated action needs no additional npm dependency.
Add your site's Neocities API key as the repository Actions secret `NEOCITIES_API_TOKEN`; never commit it.
The workflow uploads `public/`, preserves orphaned remote files (`cleanup: false`), and leaves Supporter-only file support disabled.
Enable those settings only when appropriate for your site and account.

`--deploy wix` adds the local `@wix/cli` dev dependency, `wix:login`, `wix`, and `deploy` scripts, and `.github/workflows/wix.yml`.
It also generates `AGENTS.md` with numbered compatibility notes covering the static build/release flow, favicon interception, video range requests and Safari playback, credential handling, optional business SDK integration, migration identities, and hosted verification.
The generated project's Node requirement is `>=24.22.1` for compatibility with the Wix CLI.
For a new Wix project, follow the generated README to log in and run `npm create @wix/new@latest init`; for an existing site's migration, use the owner's downloaded `wix.config.json` instead.
Set `site.outputDirectory` to `./public`, preserve the real Wix project IDs, and commit that config before enabling deployment.
The starter does not invent project IDs or write an unconfigured `wix.config.json`.
Add a dedicated Wix API key with the required release permissions and target-site access as the repository Actions secret `WIX_API_KEY`.
The workflow builds with DOMStack, authenticates through `wix login --api-key`, and uploads the output with `wix release`.
For local deployment after setup, run `npm run deploy` to build and release.
`.env*` and `.wix/` are ignored; no owner password, copied CLI tokens, or environment pull is needed by the generated workflow.
This option configures static hosting only; Wix Forms, OAuth visitor integration, and migration finalization are separate tasks.

`--deploy cloudflare` uses Cloudflare Workers Static Assets.
It adds Wrangler as a local dev dependency, `cloudflare:login`, `wrangler`, and `deploy` scripts, `wrangler.jsonc`, and `.github/workflows/cloudflare.yml`.
The config derives a valid Worker name from the project directory, enables `workers.dev`, serves `public/`, and uses `404-page` handling without a Worker script or SPA fallback.
Review the name before deploying; `npm run deploy` runs Wrangler, whose build hook invokes `npm run build` once before upload.
For local deployment, run `npm run cloudflare:login` first; `npm run deploy -- --dry-run` checks the build/config without publishing.
For GitHub Actions, add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as repository Actions secrets, using a token with Workers Scripts edit access to the intended account.
The account ID is an identifier rather than a credential.
The generated workflow invokes `npm run deploy` and relies on Wrangler's build hook instead of building twice.
`.wrangler/`, `.dev.vars*`, and `.env*` are ignored.
No custom domain is required; add one later through Cloudflare Workers settings if needed.

`--deploy vercel` adds the local Vercel CLI, `vercel:login`, `vercel`, and `deploy` scripts, `vercel.json`, and `.github/workflows/vercel.yml`.
The config uses the Other framework preset, `npm run build`, and `public` as the output directory.
Log in and link the intended project with `npm run vercel:login` and `npm run vercel -- link` before deploying locally with `npm run deploy`.
Local deployment uploads source for Vercel to build remotely; the GitHub Actions workflow instead pulls production settings, runs `vercel build --prod`, and deploys `.vercel/output` with `--prebuilt`.
Add repository Actions secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID`; the IDs come from `.vercel/project.json` after linking.
`.vercel/` and `.env*` are ignored.
Choose either this workflow or Vercel's native Git integration to avoid duplicate production deployments.

`--deploy netlify` adds the local Netlify CLI, `netlify:login`, `netlify`, and `deploy` scripts, `netlify.toml`, and `.github/workflows/netlify.yml`.
The generated project's Node requirement is `>=22.13.0` for the CLI.
The config builds with `npm run build` and publishes `public`, without adding SPA catch-all routing or server code.
Create/select a site in Netlify, log in with `npm run netlify:login`, and run `npm run netlify -- link` before local deployment.
`npm run deploy` runs `netlify deploy --prod --context production`; the current CLI builds by default, so no separate CI build step is needed.
Add repository Actions secrets `NETLIFY_AUTH_TOKEN` and `NETLIFY_SITE_ID`, and keep `.netlify/` and `.env*` out of Git.
Choose either the generated workflow or Netlify's native Git deployment to avoid duplicate production deployments.

All workflows run on pushes to `main` or manual dispatch, build with Node.js 24, and serialize deployments without cancelling an active deployment.
Change the branch if needed.
They use `npm install` so a lockfile is not required; commit a npm lockfile and switch to `npm ci` for reproducible installs, or adapt the workflow to your preferred package manager.
Generated READMEs include provider-specific setup instructions.
No hosting account is created and no deployment occurs during scaffolding.

## Other package managers

```sh
pnpm create @domstack/app@latest my-app
```

## Programmatic API

```js
import { createApp } from '@domstack/create-app'

await createApp({
  targetDirectory: 'my-app',
  install: false,
  language: 'ts',
  framework: 'preact',
  tailwind: true,
  deploy: 'github-pages',
})
```

`createApp` is asynchronous and returns a promise with `directory`, `packageName`, `packageManager`, `installed`, and `ejected` fields.
It does not prompt; unspecified features use the same defaults as `--yes`.
Set `eject: false` to install without ejecting, or `packageManager` to `npm`, `pnpm`, `yarn`, or `bun` to override detection.
With `install: false`, no eject runs regardless of the `eject` option.

## Maintaining starter dependencies

Generated dependency ranges are read from this package's `devDependencies` in `package.json`, rather than duplicated in templates.
Dependabot updates those ranges, and subsequent generator releases pass them on to newly created apps.
The generator reads manifest metadata only; its development dependencies are not installed when users run the published CLI.
Browser runtimes still go into the generated app's `dependencies`, while build and type-checking tools go into its `devDependencies`.
Dependencies added by DOMStack's eject command remain controlled by DOMStack itself.

## Validation

```sh
npm test
npm run smoke:registry
npm run smoke:local -- ../domstack
```

The registry smoke check builds and packs this generator, installs the packed CLI, and creates all fourteen projects using actual published dependencies, with no local npm wrapper or manifest modifications.
It reports the installed DOMStack version and checks builds, TS typechecking, Tailwind output, and GitHub Pages asset prefixes.

The optional local smoke check requires a DOMStack checkout with development dependencies installed and the new eject interface.
It builds declarations in a disposable upstream copy (never in that checkout), builds and packs this generator, installs the packed CLI, and creates fourteen projects covering JS/TS, no JSX/Preact/React, Tailwind, and all deployment selections.
It installs a local packed DOMStack through a temporary npm wrapper without changing the generated registry dependency range, then checks builds, TS typechecking, Tailwind output, and GitHub Pages asset prefixes.
Both checks install dependencies from npm, require network access unless cached, and do not deploy anything.
Temporary projects and generated declaration/JavaScript build outputs are cleaned afterward.

## License

MIT
