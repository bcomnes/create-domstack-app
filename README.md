# @domstack/create-app

[![npm version](https://img.shields.io/npm/v/@domstack/create-app.svg)](https://www.npmjs.com/package/@domstack/create-app)
[![Actions Status](https://github.com/bcomnes/create-domstack-app/workflows/tests/badge.svg)](https://github.com/bcomnes/create-domstack-app/actions)

Create a new [DOMStack](https://domstack.net) site with TypeScript or JavaScript, optional JSX, mine.css or Tailwind CSS, and a deployment workflow for your host.

## Get started

```sh
npm create @domstack/app@latest my-site
cd my-site
npm start
```

Pick your options when prompted.
The defaults are vanilla TypeScript, no JSX, mine.css, and no deployment setup.
Dependencies are installed for you.

You can also use pnpm:

```sh
pnpm create @domstack/app@latest my-site
```

Requires Node.js 22.18+ or 24+ and npm 10+.
Wix projects require Node.js 24.22.1+.

## Options

Pass flags to skip individual questions, or use `--yes` to accept the defaults for anything you haven't specified.

```sh
npm create @domstack/app@latest my-site -- --yes --framework preact --css tailwind --deploy cloudflare
```

| Option | Choices | Default |
| --- | --- | --- |
| `--typescript` | `none`, `vanilla`, `@voxpelli/tsconfig` | `vanilla` |
| `--framework` | `none`, `preact`, `react` | `none` |
| `--css` | `mine`, `tailwind`, `none` | `mine` |
| `--deploy` | `none`, `github-pages`, `neocities`, `wix`, `cloudflare`, `vercel`, `netlify` | `none` |
| `-y`, `--yes` | Skip remaining questions | |
| `--no-install` | Skip dependency installation and default file setup | |
| `-h`, `--help` | Show help | |
| `-v`, `--version` | Show version | |

If you leave out the directory, it uses `domstack-app`.
An existing directory must be empty.

### TypeScript setup

Choose `--typescript none` for JavaScript without a generated `tsconfig.json` or TypeScript checks.
Choose `--typescript vanilla` for the standalone DOMStack TypeScript configuration, with no shared-config dependency.
Choose `--typescript @voxpelli/tsconfig` to extend `@voxpelli/tsconfig/node26.json` and inherit its additional strict checks, while retaining DOMStack's browser types, bundler resolution, JSX settings, and no-emit workflow.
The shared config is added as a development dependency only when selected.

```sh
npm create @domstack/app@latest my-site -- --yes --typescript @voxpelli/tsconfig
```

The programmatic API accepts the same `typescript` choices.


## Working on your site

Your pages live in `src/`.
The starter includes a home page, styles, and DOMStack's default layout and client script, copied into your project so you can edit them.
Choosing Preact or React also adds an example at `/interactive/`.

```sh
npm start        # Build and watch for changes
npm run build    # Build into public/
npm run preview  # Build and serve production output locally
npm test         # Run all checks
```

Tests run through `npm-run-all2` using the `test:*` scripts: ESLint, Node's test runner, and type checking for TypeScript projects.
Add your tests using Node's usual `*.test.js` or `*.test.ts` filenames.
You can run a check on its own with `npm run test:eslint`, `npm run test:node`, or `npm run test:typecheck` (TypeScript only).

See the [DOMStack docs](https://domstack.net) for pages, layouts, assets, and configuration.

## Deployment

Choose a host during setup or pass `--deploy <host>`.
The starter adds the config, scripts, and GitHub Actions workflow for that host.
Your new project's README has the setup instructions.
You'll still need a hosting account and, for most hosts, to log in or link your project before deploying.
Creating a starter doesn't publish anything.

| Host | Setup |
| --- | --- |
| GitHub Pages | Select **GitHub Actions** in your repository's **Settings → Pages**. |
| Neocities | Add your site's API key as the `NEOCITIES_API_TOKEN` repository secret. |
| Wix | Run `npm run wix:login`, then initialize a Wix project or use your existing site's migration config. Set `site.outputDirectory` to `./public`. |
| Cloudflare | Run `npm run cloudflare:login`, then check the Worker name in `wrangler.jsonc`. A custom domain is optional. |
| Vercel | Run `npm run vercel:login`, then `npm run vercel -- link`. |
| Netlify | Create a site, run `npm run netlify:login`, then `npm run netlify -- link`. |

Wix, Cloudflare, Vercel, and Netlify starters include `npm run deploy` for local deployment after setup.
GitHub Pages and Neocities deploy through GitHub Actions.

### GitHub Actions

The workflows deploy on pushes to `main` and can also be run manually.
Change the branch in the workflow if yours is different.
Add these secrets under your repository's **Settings → Secrets and variables → Actions**:

| Host | Repository secrets |
| --- | --- |
| GitHub Pages | None |
| Neocities | `NEOCITIES_API_TOKEN` |
| Wix | `WIX_API_KEY` |
| Cloudflare | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` |
| Vercel | `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` |
| Netlify | `NETLIFY_AUTH_TOKEN`, `NETLIFY_SITE_ID` |

Use a Wix API key with release permissions and access to your site, or a Cloudflare token with Workers Scripts edit access to your account.
Vercel's project and organization IDs are in `.vercel/project.json` after linking.
Keep credentials out of Git.

If you use Vercel or Netlify's own Git integration, remove the generated workflow so each push only deploys once.
The workflows use `npm install`; if you commit a `package-lock.json`, you can switch them to `npm ci`.

### A couple of host details

GitHub Pages supports repository subpaths through `vars.basePath`.
Use relative links in your content, or include that prefix when building URLs yourself.

The Wix option sets up hosting.
Connecting Wix Forms or migrating an existing site takes additional setup.
Wix starters include an `AGENTS.md` with compatibility notes for working on the site with a coding agent.

## Skipping installation

Use `--no-install` if you want to handle dependencies yourself.
Then, inside the new project, run:

```sh
npm install
npx domstack eject --language ts --framework none --css mine --yes
npm install
```

Match the eject arguments to your project: `--language ts|js`, `--framework none|preact|react`, and `--css mine|tailwind|none`.
The creator already writes the shared integration settings and dependencies, including with `--no-install`.
Eject adds the default layout and client script and accepts identical integration settings; run it before customizing the generated defaults.
No stylesheet restoration is needed for Tailwind.
Normal setup handles eject for you.
This requires a DOMStack release providing the shared feature helper and the `domstack eject` feature flags.

## License

MIT
