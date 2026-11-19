import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { stripVTControlCharacters } from 'node:util'
import test from 'node:test'
import { domstackBanner } from '@domstack/static/lib/cli/banner.js'

function run (...args: string[]): string {
  return stripVTControlCharacters(execFileSync(process.execPath, [
    ...process.execArgv,
    new URL('../src/bin.ts', import.meta.url).pathname,
    ...args,
  ], { encoding: 'utf8', timeout: 10000 }))
}

test('help starts with the shared DOMStack banner', () => {
  const help = run('--help')
  assert.ok(help.startsWith(`${domstackBanner}\n\nCreate a new DOMStack app.`))
  assert.equal(help.split(domstackBanner).length, 2)
  assert.match(help, /Usage:/)
  assert.match(help, /--css mine\|tailwind\|none/)
  assert.match(help, /--typescript none\|vanilla\|@voxpelli\/tsconfig/)
  assert.doesNotMatch(help, /--tailwind/)
  assert.doesNotMatch(help, /--language/)
})

test('version output remains machine-readable without a banner', () => {
  const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  assert.equal(run('--version'), `${manifest.version}\n`)
})

test('no-install output includes the exact eject choices without CSS restoration', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'domstack-bin-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const output = run(join(directory, 'site'), '--yes', '--no-install', '--typescript', 'none', '--framework', 'react', '--css', 'tailwind')
  assert.match(output, /domstack eject --language js --framework react --css tailwind --yes/)
  assert.doesNotMatch(output, /restore/)
})

test('CLI selects the shared TypeScript preset without a language flag', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'domstack-bin-typescript-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const target = join(directory, 'site')
  const output = run(target, '--yes', '--no-install', '--typescript', '@voxpelli/tsconfig')
  const config = JSON.parse(readFileSync(join(target, 'tsconfig.json'), 'utf8'))
  assert.equal(config.extends, '@voxpelli/tsconfig/base-node-bare.json')
  assert.match(output, /domstack eject --language ts --framework none --css mine --yes/)
})
