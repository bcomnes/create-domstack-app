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
} from './index.ts'

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
  assert.equal(packageJson.scripts.dev, 'domstack --watch')
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
  assert.throws(() => parseArguments(['one', 'two']), /Only one target directory/)
})

test('detects the invoking package manager', () => {
  assert.equal(detectPackageManager('npm/11.0.0 node/v24.0.0'), 'npm')
  assert.equal(detectPackageManager('pnpm/10.0.0 npm/? node/v24.0.0'), 'pnpm')
  assert.equal(detectPackageManager('yarn/1.22.0 npm/? node/v24.0.0'), 'yarn')
  assert.equal(detectPackageManager('bun/1.2.0 npm/? node/v24.0.0'), 'bun')
})

test('formats development commands for each package manager', () => {
  assert.equal(packageManagerRunCommand('npm'), 'npm run dev')
  assert.equal(packageManagerRunCommand('pnpm'), 'pnpm dev')
  assert.equal(packageManagerRunCommand('yarn'), 'yarn dev')
  assert.equal(packageManagerRunCommand('bun'), 'bun run dev')
})
