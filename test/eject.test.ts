import assert from 'node:assert/strict'
import childProcess from 'node:child_process'
import { EventEmitter } from 'node:events'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { syncBuiltinESMExports } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { createApp } from '../src/index.ts'
import type { PackageManager } from '../src/index.ts'
import { ejectFeatures } from '@domstack/static/lib/cli/eject-features.js'
import type { Css, Language } from '../src/template.ts'

const managers: PackageManager[] = ['npm', 'pnpm', 'yarn', 'bun']
const languages: Language[] = ['ts', 'js']

for (const packageManager of managers) {
  for (const language of languages) {
    for (const css of ['mine', 'tailwind', 'none'] satisfies Css[]) {
      test(`ejects ${language}/${css} with ${packageManager} non-interactively without replacing upstream code`, async (t) => {
        const directory = mkdtempSync(join(tmpdir(), 'domstack-eject-'))
        t.after(() => rmSync(directory, { recursive: true, force: true }))
        const calls: string[][] = []
        const install = t.mock.method(childProcess, 'execFileSync', (command: string, args: string[], options: { cwd: string }) => {
          assert.equal(options.cwd, directory)
          assert.equal(command, packageManager)
          calls.push(args)
        })
        const spawn = t.mock.method(childProcess, 'spawn', (command: string, args: string[], options: { cwd: string, stdio: string[] }) => {
          assert.equal(command, packageManager)
          assert.equal(options.cwd, directory)
          assert.deepEqual(options.stdio, ['ignore', 'inherit', 'inherit'])
          const prefix = packageManager === 'npm' ? ['exec', '--'] : packageManager === 'bun' ? ['x'] : ['exec']
          assert.deepEqual(args, [...prefix, 'domstack', 'eject', '--language', language, '--framework', 'preact', '--css', css, '--yes'])
          const integration = ejectFeatures({ language, framework: 'preact', css, module: true })
          for (const [path, contents] of Object.entries(integration.files)) {
            assert.equal(readFileSync(join(directory, 'src', path), 'utf8'), contents)
          }
          mkdirSync(join(directory, 'src/layouts'), { recursive: true })
          mkdirSync(join(directory, 'src/globals'), { recursive: true })
          writeFileSync(join(directory, `src/layouts/root.layout.${language}`), 'upstream layout')
          writeFileSync(join(directory, `src/globals/global.client.${language}`), 'upstream client')
          writeFileSync(join(directory, 'src/globals/global.css'), 'upstream CSS')
          const child = new EventEmitter()
          process.nextTick(() => child.emit('close', 0, null))
          return child
        })
        syncBuiltinESMExports()
        t.after(() => { install.mock.restore(); spawn.mock.restore(); syncBuiltinESMExports() })
        const resultPromise = createApp({ targetDirectory: directory, packageManager, language, framework: 'preact', css })
        assert.ok(resultPromise instanceof Promise)
        const result = await resultPromise
        assert.equal(result.ejected, true)
        assert.equal(result.installed, true)
        assert.deepEqual(calls, packageManager === 'yarn' ? [[], []] : [['install'], ['install']])
        assert.equal(readFileSync(join(directory, `src/layouts/root.layout.${language}`), 'utf8'), 'upstream layout')
        assert.equal(readFileSync(join(directory, `src/globals/global.client.${language}`), 'utf8'), 'upstream client')
        assert.equal(readFileSync(join(directory, 'src/globals/global.css'), 'utf8'), 'upstream CSS')
        assert.equal(existsSync(join(directory, `src/layouts/root.layout.${language === 'ts' ? 'js' : 'ts'}`)), false)
      })
    }
  }
}

for (const failure of ['code', 'signal', 'error']) {
  test(`rejects eject ${failure} failures without a second install`, async (t) => {
    const directory = mkdtempSync(join(tmpdir(), 'domstack-eject-failure-'))
    t.after(() => rmSync(directory, { recursive: true, force: true }))
    const install = t.mock.method(childProcess, 'execFileSync', () => {})
    const spawn = t.mock.method(childProcess, 'spawn', () => {
      const child = new EventEmitter()
      process.nextTick(() => {
        if (failure === 'error') child.emit('error', new Error('spawn failed'))
        else child.emit('close', failure === 'code' ? 1 : null, failure === 'signal' ? 'SIGTERM' : null)
      })
      return child
    })
    syncBuiltinESMExports()
    t.after(() => { install.mock.restore(); spawn.mock.restore(); syncBuiltinESMExports() })
    await assert.rejects(createApp({ targetDirectory: directory }), failure === 'error' ? /spawn failed/ : failure === 'code' ? /code 1/ : /signal SIGTERM/)
    assert.equal(install.mock.callCount(), 1)
  })
}
