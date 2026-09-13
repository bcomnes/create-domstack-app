import assert from 'node:assert/strict'
import { syncBuiltinESMExports } from 'node:module'
import readline from 'node:readline/promises'
import test from 'node:test'
import { parseArguments } from './index.ts'
import { chooseFeatures } from './prompts.ts'

function tty (value: boolean): () => void {
  const input = Object.getOwnPropertyDescriptor(process.stdin, 'isTTY')
  const output = Object.getOwnPropertyDescriptor(process.stdout, 'isTTY')
  Object.defineProperty(process.stdin, 'isTTY', { configurable: true, value })
  Object.defineProperty(process.stdout, 'isTTY', { configurable: true, value })
  return () => {
    if (input) Object.defineProperty(process.stdin, 'isTTY', input)
    else Reflect.deleteProperty(process.stdin, 'isTTY')
    if (output) Object.defineProperty(process.stdout, 'isTTY', output)
    else Reflect.deleteProperty(process.stdout, 'isTTY')
  }
}

const defaults = { language: 'ts', framework: 'none', tailwind: false, deploy: 'none' }

test('non-interactive input uses defaults and preserves explicit choices', async (t) => {
  t.after(tty(false))
  assert.deepEqual(await chooseFeatures(parseArguments([])), defaults)
  assert.deepEqual(await chooseFeatures(parseArguments(['--language', 'js', '--framework', 'react', '--tailwind', '--deploy', 'neocities'])), {
    language: 'js', framework: 'react', tailwind: true, deploy: 'neocities',
  })
})

test('--yes skips questions even in a terminal', async (t) => {
  t.after(tty(true))
  const mock = t.mock.method(readline, 'createInterface', () => { throw new Error('Unexpected prompt') })
  syncBuiltinESMExports()
  t.after(() => { mock.mock.restore(); syncBuiltinESMExports() })
  assert.deepEqual(await chooseFeatures(parseArguments(['--yes'])), defaults)
  assert.equal((await chooseFeatures(parseArguments(['--yes', '--deploy', 'github-pages']))).deploy, 'github-pages')
})

test('interactive defaults, numbered choices, retry, and explicit-flag skipping', async (t) => {
  t.after(tty(true))
  let answers = ['', '', '', '']
  const questions: string[] = []
  let closed = 0
  const mock = t.mock.method(readline, 'createInterface', () => ({
    on () {},
    async question (question: string) {
      questions.push(question)
      const answer = answers.shift()
      assert.notEqual(answer, undefined, 'unexpected question')
      return answer
    },
    close () { closed++ },
  }))
  syncBuiltinESMExports()
  t.after(() => { mock.mock.restore(); syncBuiltinESMExports() })
  assert.deepEqual(await chooseFeatures(parseArguments([])), defaults)
  assert.equal(questions.length, 4)
  assert.match(questions[3] ?? '', /Deployment/)
  answers = ['invalid', '3']
  questions.length = 0
  assert.deepEqual(await chooseFeatures(parseArguments(['--language', 'js', '--framework', 'preact', '--no-tailwind'])), {
    language: 'js', framework: 'preact', tailwind: false, deploy: 'neocities',
  })
  assert.equal(questions.length, 2)
  assert.ok(questions.every(question => question.startsWith('Deployment:')))
  assert.equal(closed, 2)
})
