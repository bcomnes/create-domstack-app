import type { Language } from './template.ts'

export type Deployment = 'none' | 'github-pages' | 'neocities'

const buildSteps = `      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
      - run: npm install
`

export function projectDeployment (deploy: Deployment, language: Language): {
  files: Record<string, string>
  readme: string
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
