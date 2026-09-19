import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { createApp, parseArguments } from './index.ts'
import { projectDeployment } from './deployment.ts'
import type { Deployment } from './deployment.ts'
import type { Language } from './template.ts'

const deployments: Deployment[] = ['none', 'github-pages', 'neocities']
const languages: Language[] = ['ts', 'js']

test('parses deployment and feature flags, rejecting missing and invalid values', () => {
  for (const deploy of deployments) {
    const options = parseArguments(['site', '--deploy', deploy, '--language', 'js', '--framework', 'preact', '--tailwind', '--yes'])
    assert.equal(options.deploy, deploy)
    assert.equal(options.language, 'js')
    assert.equal(options.framework, 'preact')
    assert.equal(options.tailwind, true)
    assert.equal(options.yes, true)
    assert.equal(options.targetDirectory, 'site')
  }
  for (const flag of ['--deploy', '--language', '--framework']) {
    assert.throws(() => parseArguments([flag]), /must be/)
    assert.throws(() => parseArguments([flag, 'invalid']), /must be/)
    assert.throws(() => parseArguments([flag, '--yes']), /must be/)
  }
  assert.equal(parseArguments(['--tailwind', '--no-tailwind']).tailwind, false)
})

for (const language of languages) {
  for (const deploy of deployments) {
    test(`generates ${language}/${deploy} project deployment files and instructions`, async (t) => {
      const parent = mkdtempSync(join(tmpdir(), 'domstack-deploy-'))
      t.after(() => rmSync(parent, { recursive: true, force: true }))
      const directory = join(parent, 'site')
      await createApp({ targetDirectory: directory, language, deploy, install: false, framework: 'preact', tailwind: true })
      const result = projectDeployment(deploy, language)
      for (const [path, content] of Object.entries(result.files)) {
        assert.equal(readFileSync(join(directory, path), 'utf8'), content)
      }
      const readme = readFileSync(join(directory, 'README.md'), 'utf8')
      assert.ok(readme.includes(`--eject --language ${language} --yes`))
      assert.match(readme, /after manual eject, restore/)
      assert.match(readFileSync(join(directory, 'src/interactive/page.html'), 'utf8'), /href="\.\.\/"/)
      if (deploy === 'none') {
        assert.deepEqual(result, { files: {}, readme: '' })
        assert.ok(!readdirSync(directory).includes('.github'))
        assert.doesNotMatch(readme, /## .* deployment/)
      } else {
        assert.ok(readme.endsWith(result.readme))
        const workflow = result.files[`.github/workflows/${deploy}.yml`] ?? ''
        assert.ok(workflow.includes('uses: actions/checkout@v4\n        with:\n          persist-credentials: false'))
        assert.match(workflow, /branches: \[main\]/)
        assert.match(workflow, /workflow_dispatch:/)
        assert.match(workflow, /run: npm install/)
        assert.match(workflow, /run: npm run build/)
        assert.match(workflow, /cancel-in-progress: false/)
        if (deploy === 'github-pages') {
          assert.match(workflow, /pages: write/)
          assert.match(workflow, /id-token: write/)
          assert.match(workflow, /DOMSTACK_BASE_PATH: \$\{\{ steps.pages.outputs.base_path }}/)
          assert.match(workflow, /path: public/)
          assert.match(readme, /does not automatically rewrite/)
          const source = result.files[`src/globals/global.vars.${language}`] ?? ''
          const previous = process.env['DOMSTACK_BASE_PATH']
          t.after(() => {
            if (previous === undefined) delete process.env['DOMSTACK_BASE_PATH']
            else process.env['DOMSTACK_BASE_PATH'] = previous
          })
          for (const [input, expected] of [[undefined, ''], ['', ''], ['/', ''], ['/repo/', '/repo'], ['/repo', '/repo']]) {
            if (input === undefined) delete process.env['DOMSTACK_BASE_PATH']
            else process.env['DOMSTACK_BASE_PATH'] = input
            const { default: vars } = await import(`data:text/javascript,${encodeURIComponent(source)}#${String(input)}`)
            assert.equal(vars.basePath, expected)
          }
        } else {
          assert.match(workflow, /uses: bcomnes\/deploy-to-neocities@v3/)
          assert.match(workflow, /api_key: \$\{\{ secrets.NEOCITIES_API_TOKEN }}/)
          assert.match(workflow, /dist_dir: public/)
          assert.match(workflow, /cleanup: false/)
          assert.match(workflow, /neocities_supporter: false/)
          assert.doesNotMatch(workflow, /uses: .*async-neocities/)
          assert.match(readme, /not the action name/)
        }
      }
    })
  }
}
