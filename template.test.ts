import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { projectFeatures } from './template.ts'
import type { Framework, Language } from './template.ts'

const versions = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).devDependencies

const languages: Language[] = ['ts', 'js']
const frameworks: Framework[] = ['none', 'preact', 'react']

for (const language of languages) {
  for (const framework of frameworks) {
    for (const tailwind of [false, true]) {
      test(`${language}/${framework}/tailwind=${tailwind}`, () => {
        const result = projectFeatures({ language, framework, tailwind })
        const { files, dependencies, devDependencies, scripts } = result
        assert.equal(Boolean(files['tsconfig.json']), language === 'ts')
        assert.equal(Boolean(scripts['typecheck']), language === 'ts')
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
          assert.equal(devDependencies['@types/node'], versions['@types/node'])
        }

        assert.equal(dependencies['preact'], framework === 'preact' ? versions['preact'] : undefined)
        assert.equal(dependencies['react'], framework === 'react' ? versions['react'] : undefined)
        assert.equal(dependencies['react-dom'], framework === 'react' ? versions['react-dom'] : undefined)
        assert.equal(devDependencies['@types/react'], framework === 'react' && language === 'ts' ? versions['@types/react'] : undefined)
        assert.equal(devDependencies['@types/react-dom'], framework === 'react' && language === 'ts' ? versions['@types/react-dom'] : undefined)

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

        assert.equal(devDependencies['esbuild-plugin-tailwindcss'], tailwind ? versions['esbuild-plugin-tailwindcss'] : undefined)
        assert.equal(Boolean(files['src/globals/global.css']), tailwind)
        assert.equal(Boolean(files['src/style.css']), tailwind)
        if (tailwind) {
          assert.match(settings ?? '', /settings.plugins = \[\.\.\.\(settings.plugins \?\? \[\]\), tailwindPlugin\(\)\]/)
          assert.match(files['src/globals/global.css'] ?? '', /@import "tailwindcss" source\("\.\.\/"\)/)
          assert.match(files['src/style.css'] ?? '', /@layer base/)
        }
        assert.deepEqual(result, projectFeatures({ language, framework, tailwind }))
      })
    }
  }
}
