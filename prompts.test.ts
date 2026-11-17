import assert from 'node:assert/strict'
import { syncBuiltinESMExports } from 'node:module'
import { stripVTControlCharacters } from 'node:util'
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
      questions.push(stripVTControlCharacters(question))
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
  assert.deepEqual(await chooseFeatures({ ...parseArguments(['--language', 'js', '--framework', 'preact']), tailwind: false }), {
    language: 'js', framework: 'preact', tailwind: false, deploy: 'neocities',
  })
  assert.equal(questions.length, 2)
  assert.ok(questions.every(question => question.includes('\nDeployment\n')))
  assert.equal(closed, 2)
  answers = ['4']
  assert.equal((await chooseFeatures({ ...parseArguments(['--language', 'ts', '--framework', 'none']), tailwind: false })).deploy, 'wix')
  answers = ['5']
  assert.equal((await chooseFeatures({ ...parseArguments(['--language', 'ts', '--framework', 'none']), tailwind: false })).deploy, 'cloudflare')
  answers = ['6']
  assert.equal((await chooseFeatures({ ...parseArguments(['--language', 'ts', '--framework', 'none']), tailwind: false })).deploy, 'vercel')
  answers = ['7']
  assert.equal((await chooseFeatures({ ...parseArguments(['--language', 'ts', '--framework', 'none']), tailwind: false })).deploy, 'netlify')
})

test('boolean prompts accept case-insensitive yes/no, default on Enter, and reject numbers', async (t) => {
  t.after(tty(true))
  let answers: string[] = []
  const questions: string[] = []
  const mock = t.mock.method(readline, 'createInterface', () => ({
    on () {},
    async question (question: string) {
      questions.push(stripVTControlCharacters(question))
      const answer = answers.shift()
      assert.notEqual(answer, undefined, 'unexpected question')
      return answer
    },
    close () {},
  }))
  const messages = t.mock.method(console, 'log', () => {})
  syncBuiltinESMExports()
  t.after(() => { mock.mock.restore(); syncBuiltinESMExports() })
  const options = parseArguments(['--language', 'ts', '--framework', 'none', '--deploy', 'none'])
  for (const answer of ['y', 'Y', 'yes', 'YES', ' y ']) {
    answers = [answer]
    assert.equal((await chooseFeatures(options)).tailwind, true)
  }
  for (const answer of ['n', 'N', 'no', 'NO', '', '  ']) {
    answers = [answer]
    assert.equal((await chooseFeatures(options)).tailwind, false)
  }
  answers = ['1', '2', 'maybe', 'Y']
  assert.equal((await chooseFeatures(options)).tailwind, true)
  assert.equal(messages.mock.calls.filter(call => stripVTControlCharacters(String(call.arguments[0])).startsWith('Enter y or n')).length, 3)
  assert.ok(questions.every(question => question.includes('[y/N] (default: no)')))
  assert.deepEqual(answers, [])
})
