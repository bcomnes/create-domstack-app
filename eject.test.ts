import assert from 'node:assert/strict'
import childProcess from 'node:child_process'
import { EventEmitter } from 'node:events'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { syncBuiltinESMExports } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { createApp } from './index.ts'
import type { PackageManager } from './index.ts'
import type { Language } from './template.ts'

const managers: PackageManager[] = ['npm', 'pnpm', 'yarn', 'bun']
const languages: Language[] = ['ts', 'js']

for (const packageManager of managers) {
  for (const language of languages) {
    test(`ejects ${language} with ${packageManager} non-interactively without replacing upstream code`, async (t) => {
      const directory = mkdtempSync(join(tmpdir(), 'domstack-eject-'))
      t.after(() => rmSync(directory, { recursive: true, force: true }))
      const calls: string[][] = []
      const install = t.mock.method(childProcess, 'execFileSync', (command: string, args: string[], options: { cwd: string }) => {
        assert.equal(command, packageManager)
        assert.equal(options.cwd, directory)
        calls.push(args)
      })
      const spawn = t.mock.method(childProcess, 'spawn', (command: string, args: string[], options: { cwd: string, stdio: string[] }) => {
        assert.equal(command, packageManager)
        assert.equal(options.cwd, directory)
        assert.deepEqual(options.stdio, ['ignore', 'inherit', 'inherit'])
        const prefix = packageManager === 'npm' ? ['exec', '--'] : packageManager === 'bun' ? ['x'] : ['exec']
        assert.deepEqual(args, [...prefix, 'domstack', '--eject', '--language', language, '--yes'])
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
      const resultPromise = createApp({ targetDirectory: directory, packageManager, language, tailwind: true })
      assert.ok(resultPromise instanceof Promise)
      const result = await resultPromise
      assert.equal(result.ejected, true)
      assert.equal(result.installed, true)
      assert.deepEqual(calls, packageManager === 'yarn' ? [[], []] : [['install'], ['install']])
      assert.equal(readFileSync(join(directory, `src/layouts/root.layout.${language}`), 'utf8'), 'upstream layout')
      assert.equal(readFileSync(join(directory, `src/globals/global.client.${language}`), 'utf8'), 'upstream client')
      assert.equal(readFileSync(join(directory, 'src/globals/global.css'), 'utf8'), '@import "tailwindcss" source("../");\n')
      assert.equal(existsSync(join(directory, `src/layouts/root.layout.${language === 'ts' ? 'js' : 'ts'}`)), false)
    })
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
