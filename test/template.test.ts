import { ejectFeatures } from '@domstack/static/lib/cli/eject-features.js'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { projectFeatures } from '../src/template.ts'
import type { Css, Framework, Language } from '../src/template.ts'

const versions = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).devDependencies

const languages: Language[] = ['ts', 'js']
const frameworks: Framework[] = ['none', 'preact', 'react']

for (const language of languages) {
  for (const framework of frameworks) {
    for (const css of ['mine', 'tailwind', 'none'] satisfies Css[]) {
      test(`${language}/${framework}/css=${css}`, () => {
        const tailwind = css === 'tailwind'
        const integration = ejectFeatures({ language, framework, css, module: true })
        const result = projectFeatures({ language, framework, css })
        const { files, dependencies, devDependencies, scripts } = result
        assert.equal(scripts['test'], 'run-s test:*')
        assert.equal(scripts['test:eslint'], 'eslint .')
        assert.equal(scripts['test:node'], 'node --test')
        for (const name of ['npm-run-all2', 'eslint', 'neostandard']) {
          assert.equal(devDependencies[name], versions[name])
        }
        assert.match(files['eslint.config.js'] ?? '', /resolveIgnoresFromGitignore/)
        assert.equal(Boolean(files['tsconfig.json']), language === 'ts')
        assert.equal(Boolean(scripts['test:typecheck']), language === 'ts')
        if (language === 'ts') {
          const config = JSON.parse(files['tsconfig.json'] ?? '')
          assert.equal(config.extends, undefined)
          assert.deepEqual(config.include, ['src'])
          assert.equal(config.compilerOptions.strict, true)
          assert.equal(config.compilerOptions.noEmit, true)
          assert.equal(config.compilerOptions.allowJs, true)
          assert.equal(config.compilerOptions.checkJs, false)
          assert.equal(config.compilerOptions.moduleResolution, 'bundler')
          assert.deepEqual(config.compilerOptions.types, ['node'])
          assert.ok(config.compilerOptions.lib.includes('DOM'))
          assert.equal(config.compilerOptions.jsxImportSource, framework === 'none' ? undefined : framework)
          assert.equal(devDependencies['typescript'], versions['typescript'])
          assert.equal(devDependencies['@typescript/native'], versions['@typescript/native'])
          assert.equal(devDependencies['@types/node'], versions['@types/node'])
        }

        assert.deepEqual(dependencies, integration.dependencies)
        for (const [name, range] of Object.entries(integration.devDependencies)) {
          assert.equal(devDependencies[name], range)
        }
        for (const [path, contents] of Object.entries(integration.files)) {
          assert.equal(files[`src/${path}`], contents)
        }

        const settings = files[`src/globals/esbuild.settings.${language}`]
        assert.equal(Boolean(settings), framework !== 'none' || tailwind)
        assert.equal(files[`src/globals/esbuild.settings.${language === 'ts' ? 'js' : 'ts'}`], undefined)
        if (framework !== 'none') {
          assert.match(settings ?? '', /settings.jsx = 'automatic'/)
          assert.ok(settings?.includes(`settings.jsxImportSource = '${framework}'`))
          assert.match(files['src/interactive/page.html'] ?? '', /id="counter-root"/)
          const client = files[`src/interactive/client.${language === 'ts' ? 'tsx' : 'jsx'}`] ?? ''
          assert.match(client, /useState\(0\)/)
          assert.match(client, /setCount\(value => value \+ 1\)/)
          assert.ok(client.includes(framework === 'preact' ? 'render(<Counter />, container)' : 'createRoot(container).render(<Counter />)'))
        } else {
          assert.equal(files['src/interactive/page.html'], undefined)
        }

        assert.equal(devDependencies['esbuild-plugin-tailwindcss'], integration.devDependencies['esbuild-plugin-tailwindcss'])
        assert.equal(files['src/globals/global.css'], integration.files['globals/global.css'])
        assert.equal(Boolean(files['src/style.css']), tailwind)
        if (tailwind) {
          assert.match(settings ?? '', /settings.plugins = \[\.\.\.\(settings.plugins \?\? \[\]\), tailwindPlugin\(\)\]/)
          assert.match(files['src/globals/global.css'] ?? '', /@import "tailwindcss" source\("\.\.\/"\)/)
          assert.match(files['src/style.css'] ?? '', /@layer base/)
        }
        assert.deepEqual(result, projectFeatures({ language, framework, css }))
      })
    }
  }
}

test('legacy tailwind API inputs produce the same integration', () => {
  for (const tailwind of [false, true]) {
    assert.deepEqual(
      projectFeatures({ language: 'ts', framework: 'preact', tailwind }),
      projectFeatures({ language: 'ts', framework: 'preact', css: tailwind ? 'tailwind' : 'mine' })
    )
  }
})
