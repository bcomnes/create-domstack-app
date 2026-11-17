import type { Language } from './template.ts'
import { dependencyVersion } from './dependencies.ts'
import { wixAgentNotes } from './wix-agents.ts'

export type Deployment = 'none' | 'github-pages' | 'neocities' | 'wix'

const buildSteps = `      - uses: actions/checkout@v4
        with:
          persist-credentials: false
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
      - run: npm install
`

export function projectDeployment (deploy: Deployment, language: Language): {
  files: Record<string, string>
  readme: string
  scripts?: Record<string, string>
  devDependencies?: Record<string, string>
  engines?: Record<string, string>
} {
  if (deploy === 'none') return { files: {}, readme: '' }

  const workflowNotes = `The workflow runs on pushes to \`main\` and can also be run manually from the Actions tab.
Change the branch in the workflow if your default branch has another name.
CI uses Node.js 24 and \`npm install\`, so it also works before a lockfile is committed.
For reproducible installs, commit a \`package-lock.json\` and change the install step to \`npm ci\`, or adapt the workflow to your chosen package manager and lockfile.
`

  if (deploy === 'github-pages') {
    return {
      files: {
        [`src/globals/global.vars.${language}`]: `export default {
  basePath: (process.env['DOMSTACK_BASE_PATH'] ?? '').replace(/\\/+$/, ''),
}
`,
        '.github/workflows/github-pages.yml': `name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: github-pages
  cancel-in-progress: false

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    steps:
${buildSteps}      - uses: actions/configure-pages@v5
        id: pages
      - run: npm run build
        env:
          DOMSTACK_BASE_PATH: \${{ steps.pages.outputs.base_path }}
      - uses: actions/upload-pages-artifact@v3
        with:
          path: public
      - uses: actions/deploy-pages@v4
        id: deployment
`,
      },
      readme: `
## GitHub Pages deployment

In the repository's Settings → Pages, select **GitHub Actions** as the build and deployment source.
Commit and push this project, including \`.github/workflows/github-pages.yml\`.
${workflowNotes}
The workflow uses \`actions/configure-pages\` to obtain the site's base path, including repository subpaths and custom-domain configuration, rather than guessing from the repository name.
It passes that value as \`DOMSTACK_BASE_PATH\` to \`src/globals/global.vars.${language}\`, which exposes DOMStack's \`basePath\` variable without a trailing slash.
The ejected root layout prefixes root-relative script and stylesheet URLs with \`basePath\`.
Local builds default to an empty base path.
DOMStack does not automatically rewrite links or image URLs in page content; use relative URLs or incorporate \`vars.basePath\` in rendered content where needed.
For a custom domain, configure it in Settings → Pages before deploying.
`,
    }
  }

  if (deploy === 'wix') {
    return {
      scripts: {
        'wix:login': 'wix login',
        wix: 'wix',
        deploy: 'npm run build && wix release',
      },
      devDependencies: { '@wix/cli': dependencyVersion('@wix/cli') },
      engines: { node: '>=24.22.1' },
      files: {
        'AGENTS.md': wixAgentNotes,
        '.gitignore': `node_modules
public
.DS_Store
.env*
.wix/
`,
        '.github/workflows/wix.yml': `name: Deploy to Wix

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: wix
  cancel-in-progress: false

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
${buildSteps}      - run: npm run build
      - name: Authenticate Wix CLI
        run: npm run wix -- login --api-key "$WIX_API_KEY"
        env:
          WIX_API_KEY: \${{ secrets.WIX_API_KEY }}
      - run: npm run wix -- release
`,
      },
      readme: `
## Wix deployment

Wix hosts the generated static files; this project keeps its DOMStack build and does not use Astro.
Node.js 24.22.1 or newer is required by the Wix CLI.
Scaffolding adds the local CLI and deployment workflow, but does not create a Wix project, log in, or deploy anything.
\`AGENTS.md\` enumerates Wix compatibility notes for future changes, including favicon routing, Safari video delivery, credentials, and optional SDK integration.

### Connect to Wix

For a new Wix project, run \`npm run wix:login\`, then \`npm create @wix/new@latest init\` from this project directory.
Initialization creates a new Wix project and its \`wix.config.json\`.
For an existing Wix site's migration, use the owner's migration download's \`wix.config.json\` instead; do not initialize another project.
Preserve the supplied \`appId\` and \`siteId\`, and set \`site.outputDirectory\` to \`./public\` before deploying:

\`\`\`json
"site": {
  "outputDirectory": "./public"
}
\`\`\`

Commit the completed \`wix.config.json\`; its project identifiers are not credentials.
The starter deliberately leaves that file absent until Wix supplies the real deployment target.
Run \`npm run deploy\` for a local build and release after setup.
The CLI's \`release\` command uploads existing output and does not run DOMStack for you.
During migration, releases target the preview until Wix's completion flow switches the project to production.

### GitHub Actions

Create a dedicated Wix API key with the required deployment permissions and site access, then add it as the repository Actions secret \`WIX_API_KEY\`.
Confirm that the key can release the intended project; do not assume a general role or unrelated CLI permission grants headless deployment access.
Commit and push the configuration and \`.github/workflows/wix.yml\` once the target and secret are ready.
${workflowNotes}
The workflow builds \`public/\`, logs in with \`wix login --api-key\`, and releases to the configured Wix project.
No account password, copied CLI login tokens, or \`.env.local\` file is needed by this static starter's workflow.
Keep API keys, \`.env*\`, and \`.wix/\` out of Git and public output.

Forms and other Wix business features require their own SDK integration; this deployment option does not install apps, fetch schemas, or seed data.
Wix's static hosting may intercept root favicon paths and ignore video byte ranges; verify the deployed assets and Safari playback, using distinct icon paths and suitable video delivery when needed.
See [deploy your own frontend](https://dev.wix.com/docs/go-headless/wix-managed-headless/other-frameworks/your-own-frontend/deploy-your-own-frontend-with-the-cli) and [CLI authentication](https://dev.wix.com/docs/wix-cli/command-reference/global-commands/login).
`,
    }
  }

  return {
    files: {
      '.github/workflows/neocities.yml': `name: Deploy to Neocities

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: neocities
  cancel-in-progress: false

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
${buildSteps}      - run: npm run build
      - uses: bcomnes/deploy-to-neocities@v3
        with:
          api_key: \${{ secrets.NEOCITIES_API_TOKEN }}
          dist_dir: public
          cleanup: false
          neocities_supporter: false
          preview_before_deploy: true
`,
    },
    readme: `
## Neocities deployment

Get your site's API key from https://neocities.org/settings/YOUR-SITE#api_key and add it as the repository Actions secret \`NEOCITIES_API_TOKEN\`.
Never commit the key.
Commit and push this project, including \`.github/workflows/neocities.yml\`.
${workflowNotes}
The workflow builds \`public/\` and uploads it with [bcomnes/deploy-to-neocities@v3](https://github.com/bcomnes/deploy-to-neocities).
This action uses [async-neocities](https://github.com/bcomnes/async-neocities), which is the underlying npm API client and interactive CLI, not the action name.
No extra npm deployment dependency is required for the generated workflow.
Only new or changed files are uploaded; \`cleanup: false\` preserves remote files absent from the build.
Enable cleanup only if you intend to delete those remote files.
Set \`neocities_supporter: true\` only for a paid Supporter account when you want to upload otherwise unsupported file types.
Neocities deployments are not atomic; the workflow serializes deployments without cancelling an in-progress upload.
`,
  }
}
