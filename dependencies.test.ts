import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { dependencyVersion } from './dependencies.ts'
import { domstackVersion } from './index.ts'

test('reads exact declared ranges, not installed versions', () => {
  const { devDependencies } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))
  for (const [name, range] of Object.entries(devDependencies)) {
    assert.equal(dependencyVersion(name), range)
  }
  assert.equal(domstackVersion, devDependencies['@domstack/static'])
})

test('fails clearly for an undeclared dependency', () => {
  assert.throws(() => dependencyVersion('missing-starter-dependency'), /Missing generator devDependency/)
})
