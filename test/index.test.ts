import { ejectFeatures } from '@domstack/static/lib/cli/eject-features.js'
import type { Css, Framework, Language } from '../src/template.ts'
import assert from 'node:assert/strict'
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import {
  createApp,
  defaultTargetDirectory,
  domstackVersion,
  detectPackageManager,
  packageManagerRunCommand,
  parseArguments,
} from '../src/index.ts'

function temporaryDirectory (): string {
  return mkdtempSync(join(tmpdir(), 'create-domstack-app-'))
}

test('creates a DOMStack project without installing dependencies', async (t) => {
  const parentDirectory = temporaryDirectory()
  t.after(() => rmSync(parentDirectory, { recursive: true, force: true }))

  const targetDirectory = join(parentDirectory, 'My Site')
  const result = await createApp({
    targetDirectory,
    install: false,
    packageManager: 'npm',
  })

  const packageJson = JSON.parse(
    readFileSync(join(targetDirectory, 'package.json'), 'utf8')
  )

  assert.equal(result.packageName, 'my-site')
  assert.equal(result.installed, false)
  assert.equal(result.ejected, false)
  assert.equal(packageJson.name, 'my-site')
  assert.equal(packageJson.private, true)
  assert.equal(packageJson.devDependencies['@domstack/static'], domstackVersion)
  assert.equal(packageJson.scripts.start, 'domstack --watch')
  assert.equal(packageJson.scripts.preview, 'domstack --serve')
  assert.equal(packageJson.dependencies['mine.css'], ejectFeatures({ language: 'ts', framework: 'none', css: 'mine', module: true }).dependencies['mine.css'])
  assert.match(readFileSync(join(targetDirectory, 'README.md'), 'utf8'), /--css mine --yes/)
  assert.equal(packageJson.scripts.dev, undefined)
  assert.equal(packageJson.scripts['production-preview'], undefined)
  assert.match(
    readFileSync(join(targetDirectory, 'src/page.md'), 'utf8'),
    /Welcome to DOMStack/
  )
  assert.match(
    readFileSync(join(targetDirectory, 'README.md'), 'utf8'),
    /^# my-site/m
  )
})

test('normalizes a dot-prefixed target name', async (t) => {
  const parentDirectory = temporaryDirectory()
  t.after(() => rmSync(parentDirectory, { recursive: true, force: true }))

  const targetDirectory = join(parentDirectory, '.preview-app')
  const result = await createApp({ targetDirectory, install: false })

  assert.equal(result.packageName, 'preview-app')
})

test('validates the package name before creating a directory', async (t) => {
  const parentDirectory = temporaryDirectory()
  t.after(() => rmSync(parentDirectory, { recursive: true, force: true }))

  const targetDirectory = join(parentDirectory, '!!!')
  await assert.rejects(
    createApp({ targetDirectory, install: false }),
    /Cannot derive a valid package name/
  )
  assert.equal(existsSync(targetDirectory), false)
})

test('refuses to write into a non-empty directory', async (t) => {
  const targetDirectory = temporaryDirectory()
  t.after(() => rmSync(targetDirectory, { recursive: true, force: true }))
  writeFileSync(join(targetDirectory, 'existing.txt'), 'keep me')

  await assert.rejects(
    createApp({ targetDirectory, install: false }),
    /target directory is not empty/
  )
  assert.equal(readFileSync(join(targetDirectory, 'existing.txt'), 'utf8'), 'keep me')
})

test('parses CLI arguments', () => {
  assert.deepEqual(parseArguments([]), {
    yes: false,
    targetDirectory: defaultTargetDirectory,
    install: true,
    help: false,
    version: false,
  })
  assert.deepEqual(parseArguments(['website', '--no-install']), {
    yes: false,
    targetDirectory: 'website',
    install: false,
    help: false,
    version: false,
  })
  assert.equal(parseArguments(['--help']).help, true)
  assert.equal(parseArguments(['-v']).version, true)
  assert.throws(() => parseArguments(['--wat']), /Unknown option/)
  for (const args of [['--language'], ['--language', 'js'], ['--typescript', 'vanilla', '--language', 'ts']]) {
    assert.throws(() => parseArguments(args), /Unknown option: --language/)
  }
  assert.throws(() => parseArguments(['one', 'two']), /Only one target directory/)
})

test('detects the invoking package manager', () => {
  assert.equal(detectPackageManager('npm/11.0.0 node/v24.0.0'), 'npm')
  assert.equal(detectPackageManager('pnpm/10.0.0 npm/? node/v24.0.0'), 'pnpm')
  assert.equal(detectPackageManager('yarn/1.22.0 npm/? node/v24.0.0'), 'yarn')
  assert.equal(detectPackageManager('bun/1.2.0 npm/? node/v24.0.0'), 'bun')
})

test('formats development commands for each package manager', () => {
  assert.equal(packageManagerRunCommand('npm'), 'npm start')
  assert.equal(packageManagerRunCommand('pnpm'), 'pnpm start')
  assert.equal(packageManagerRunCommand('yarn'), 'yarn start')
  assert.equal(packageManagerRunCommand('bun'), 'bun run start')
})

test('parses CSS choices and rejects missing or invalid values', () => {
  for (const css of ['mine', 'tailwind', 'none']) {
    assert.equal(parseArguments(['--css', css]).css, css)
  }
  for (const value of [undefined, 'invalid', '--yes']) {
    assert.throws(() => parseArguments(['--css', ...(value ? [value] : [])]), /--css must be/)
  }
  assert.equal(parseArguments([]).css, undefined)
})

test('rejects the removed --tailwind option', () => {
  for (const args of [
    ['--tailwind'],
    ['--tailwind', '--css', 'tailwind'],
    ['--css', 'tailwind', '--tailwind'],
  ]) {
    assert.throws(() => parseArguments(args), /Unknown option: --tailwind/)
  }
})

test('rejects invalid programmatic CSS before creating the project', async (t) => {
  const parent = temporaryDirectory()
  t.after(() => rmSync(parent, { recursive: true, force: true }))
  const targetDirectory = join(parent, 'site')
  await assert.rejects(createApp({
    targetDirectory,
    install: false,
    // @ts-expect-error Validate untyped consumers before any files are written.
    css: 'invalid',
  }), /--css must be mine, tailwind, or none\./)
  assert.equal(existsSync(targetDirectory), false)
})

for (const language of ['ts', 'js'] satisfies Language[]) {
  for (const framework of ['none', 'preact', 'react'] satisfies Framework[]) {
    for (const css of ['mine', 'tailwind', 'none'] satisfies Css[]) {
      test(`no-install scaffolds upstream ${language}/${framework}/${css} integration and exact manual instructions`, async (t) => {
        const parent = temporaryDirectory()
        t.after(() => rmSync(parent, { recursive: true, force: true }))
        const targetDirectory = join(parent, 'site')
        await createApp({ targetDirectory, install: false, typescript: language === 'js' ? 'none' : 'vanilla', framework, css })
        const integration = ejectFeatures({ language, framework, css, module: true })
        for (const [path, contents] of Object.entries(integration.files)) {
          assert.equal(readFileSync(join(targetDirectory, 'src', path), 'utf8'), contents)
        }
        const manifest = JSON.parse(readFileSync(join(targetDirectory, 'package.json'), 'utf8'))
        assert.deepEqual(manifest.dependencies, integration.dependencies)
        for (const [name, range] of Object.entries(integration.devDependencies)) {
          assert.equal(manifest.devDependencies[name], range)
        }
        const readme = readFileSync(join(targetDirectory, 'README.md'), 'utf8')
        assert.ok(readme.includes(`npx domstack eject --language ${language} --framework ${framework} --css ${css} --yes`))
        assert.doesNotMatch(readme, /restore/)
        assert.equal(existsSync(join(targetDirectory, `src/layouts/root.layout.${language}`)), false)
      })
    }
  }
}
