import { ejectFeatures } from '@domstack/static/lib/cli/eject-features.js'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { projectFeatures, resolveTypeScript } from '../src/template.ts'
import type { Css, Framework, Language, TypeScriptConfig } from '../src/template.ts'

const versions = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).devDependencies

const typescriptConfigs: TypeScriptConfig[] = ['none', 'vanilla', '@voxpelli/tsconfig']
const frameworks: Framework[] = ['none', 'preact', 'react']

for (const typescript of typescriptConfigs) {
  const language = typescript === 'none' ? 'js' : 'ts'
  for (const framework of frameworks) {
    for (const css of ['mine', 'tailwind', 'none'] satisfies Css[]) {
      test(`${typescript}/${framework}/css=${css}`, () => {
        const tailwind = css === 'tailwind'
        const integration = ejectFeatures({ language, framework, css, module: true })
        const result = projectFeatures({ typescript, framework, css })
        const { files, dependencies, devDependencies, scripts } = result
        assert.equal(scripts['test'], 'run-s test:*')
        assert.equal(scripts['test:eslint'], 'eslint .')
        assert.equal(scripts['test:node'], 'node --test')
        for (const name of ['npm-run-all2', 'eslint', 'neostandard']) {
          assert.equal(devDependencies[name], versions[name])
        }
        assert.match(files['eslint.config.js'] ?? '', /resolveIgnoresFromGitignore/)
        assert.equal(Boolean(files['tsconfig.json']), language === 'ts')
        assert.equal(scripts['test:typecheck'], language === 'ts' ? 'tsc --noEmit' : undefined)
        assert.equal(devDependencies['@voxpelli/tsconfig'], typescript === '@voxpelli/tsconfig' ? versions['@voxpelli/tsconfig'] : undefined)
        if (language === 'ts') {
          const config = JSON.parse(files['tsconfig.json'] ?? '')
          assert.equal(config.extends, typescript === '@voxpelli/tsconfig' ? '@voxpelli/tsconfig/base-node-bare.json' : undefined)
          assert.deepEqual(config.include, ['src'])
          assert.equal(config.compilerOptions.strict, true)
          assert.equal(config.compilerOptions.noEmit, true)
          assert.equal(config.compilerOptions.allowJs, true)
          assert.equal(config.compilerOptions.checkJs, false)
          assert.equal(config.compilerOptions.target, 'ES2024')
          assert.equal(config.compilerOptions.module, 'ESNext')
          assert.equal(config.compilerOptions.moduleResolution, 'bundler')
          assert.equal(config.compilerOptions.allowImportingTsExtensions, true)
          assert.equal(config.compilerOptions.resolveJsonModule, true)
          assert.equal(config.compilerOptions.esModuleInterop, true)
          assert.equal(config.compilerOptions.isolatedModules, true)
          assert.equal(config.compilerOptions.verbatimModuleSyntax, true)
          assert.equal(config.compilerOptions.skipLibCheck, true)
          assert.deepEqual(config.compilerOptions.types, ['node'])
          assert.deepEqual(config.compilerOptions.lib, ['ES2024', 'DOM', 'DOM.Iterable'])
          assert.deepEqual(config.exclude, ['node_modules', 'public'])
          // Leave the preset's extra checks inherited, rather than weakening them.
          for (const option of [
            'exactOptionalPropertyTypes',
            'noFallthroughCasesInSwitch',
            'noImplicitOverride',
            'noPropertyAccessFromIndexSignature',
            'noUncheckedIndexedAccess',
            'forceConsistentCasingInFileNames',
            'noUnusedLocals',
            'noUnusedParameters',
          ]) {
            assert.equal(Object.hasOwn(config.compilerOptions, option), false)
          }
          assert.equal(config.compilerOptions.jsx, framework === 'none' ? undefined : 'react-jsx')
          assert.equal(config.compilerOptions.jsxImportSource, framework === 'none' ? undefined : framework)
          assert.equal(devDependencies['typescript'], versions['typescript'])
          assert.equal(devDependencies['@typescript/native'], versions['@typescript/native'])
          assert.equal(devDependencies['@types/node'], versions['@types/node'])
        } else {
          for (const name of ['typescript', '@typescript/native', '@types/node', '@types/react', '@types/react-dom']) {
            assert.equal(devDependencies[name], undefined)
          }
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
        assert.deepEqual(result, projectFeatures({ typescript, framework, css }))
      })
    }
  }
}

test('TypeScript defaults to vanilla', () => {
  assert.deepEqual(resolveTypeScript({}), { language: 'ts', typescript: 'vanilla' })
  assert.deepEqual(
    projectFeatures({ framework: 'none' }),
    projectFeatures({ typescript: 'vanilla', framework: 'none' })
  )
})

for (const typescript of typescriptConfigs) {
  const language: Language = typescript === 'none' ? 'js' : 'ts'
  test(`derives ${language} from ${typescript}`, () => {
    assert.deepEqual(resolveTypeScript({ typescript }), { language, typescript })
  })
}

test('rejects invalid TypeScript selections at runtime', () => {
  for (const typescript of ['invalid', '', null, false, 0]) {
    const error = /--typescript must be none, vanilla, or @voxpelli\/tsconfig\./
    // @ts-expect-error Validate untyped consumers at runtime.
    assert.throws(() => resolveTypeScript({ typescript }), error)
    // @ts-expect-error Validate untyped consumers at runtime.
    assert.throws(() => projectFeatures({ typescript, framework: 'none' }), error)
  }
})

test('unknown language properties cannot override the TypeScript mode', () => {
  for (const typescript of typescriptConfigs) {
    for (const language of ['ts', 'js', 'invalid']) {
      // @ts-expect-error Language is not a public option; untyped consumers have it ignored.
      assert.deepEqual(resolveTypeScript({ typescript, language }), resolveTypeScript({ typescript }))
      assert.deepEqual(
        // @ts-expect-error Language is not a public option; untyped consumers have it ignored.
        projectFeatures({ typescript, language, framework: 'preact' }),
        projectFeatures({ typescript, framework: 'preact' })
      )
    }
  }
  // @ts-expect-error An unknown language property does not change the vanilla default.
  assert.deepEqual(resolveTypeScript({ language: 'js' }), { language: 'ts', typescript: 'vanilla' })
  assert.deepEqual(
    // @ts-expect-error An unknown language property does not change the vanilla default.
    projectFeatures({ language: 'js', framework: 'preact' }),
    projectFeatures({ typescript: 'vanilla', framework: 'preact' })
  )
})

test('omitted CSS defaults to the mine integration', () => {
  assert.deepEqual(
    projectFeatures({ typescript: 'vanilla', framework: 'preact' }),
    projectFeatures({ typescript: 'vanilla', framework: 'preact', css: 'mine' })
  )
})

test('rejects invalid CSS at runtime', () => {
  assert.throws(() => projectFeatures({
    typescript: 'vanilla',
    framework: 'none',
    // @ts-expect-error Validate untyped consumers at runtime.
    css: 'invalid',
  }), /--css must be mine, tailwind, or none\./)
})
