import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { createApp, parseArguments } from '../src/index.ts'
import { dependencyVersion } from '../src/dependencies.ts'
import type { Framework, TypeScriptConfig } from '../src/template.ts'

const choices: TypeScriptConfig[] = ['none', 'vanilla', '@voxpelli/tsconfig']

test('parses TypeScript configuration choices and rejects the removed language flag', () => {
  for (const typescript of choices) {
    assert.equal(parseArguments(['--typescript', typescript]).typescript, typescript)
  }
  for (const value of [undefined, '', 'true', 'false', 'voxpelli', '--yes']) {
    assert.throws(() => parseArguments(['--typescript', ...(value === undefined ? [] : [value])]), /--typescript must be/)
  }
  for (const language of ['js', 'ts']) {
    assert.throws(() => parseArguments(['--language', language]), /Unknown option: --language/)
  }
})

for (const typescript of choices) {
  for (const framework of ['none', 'preact', 'react'] satisfies Framework[]) {
    test(`scaffolds ${typescript}/${framework} with matching language and manual eject instructions`, async (t) => {
      const parent = mkdtempSync(join(tmpdir(), 'domstack-typescript-'))
      t.after(() => rmSync(parent, { recursive: true, force: true }))
      const directory = join(parent, 'site')
      await createApp({ targetDirectory: directory, install: false, typescript, framework, css: 'tailwind', deploy: 'github-pages' })
      const language = typescript === 'none' ? 'js' : 'ts'
      const manifest = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'))
      const readme = readFileSync(join(directory, 'README.md'), 'utf8')
      assert.equal(manifest.devDependencies['@voxpelli/tsconfig'], typescript === '@voxpelli/tsconfig' ? dependencyVersion('@voxpelli/tsconfig') : undefined)
      assert.equal(Boolean(manifest.scripts['test:typecheck']), typescript !== 'none')
      assert.equal(existsSync(join(directory, 'tsconfig.json')), typescript !== 'none')
      assert.ok(existsSync(join(directory, `src/globals/global.vars.${language}`)))
      assert.ok(existsSync(join(directory, `src/globals/esbuild.settings.${language}`)))
      assert.ok(readme.includes(`domstack eject --language ${language} --framework ${framework} --css tailwind --yes`))
      assert.equal(readme.includes('TypeScript extends `@voxpelli/tsconfig/base-node-bare.json`'), typescript === '@voxpelli/tsconfig')
      if (framework !== 'none') {
        assert.ok(existsSync(join(directory, `src/interactive/client.${language === 'ts' ? 'tsx' : 'jsx'}`)))
      }
    })
  }
}

test('invalid programmatic TypeScript selections leave targets untouched', async (t) => {
  const parent = mkdtempSync(join(tmpdir(), 'domstack-typescript-invalid-'))
  t.after(() => rmSync(parent, { recursive: true, force: true }))
  const targetDirectory = join(parent, 'site')
  await assert.rejects(createApp({
    targetDirectory,
    install: false,
    // @ts-expect-error Invalid untyped API input.
    typescript: true,
  }), /--typescript must be/)

  assert.equal(existsSync(targetDirectory), false)
})
