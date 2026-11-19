import assert from 'node:assert/strict'
import { syncBuiltinESMExports } from 'node:module'
import { stripVTControlCharacters } from 'node:util'
import readline from 'node:readline/promises'
import test from 'node:test'
import { parseArguments } from '../src/index.ts'
import { chooseFeatures } from '../src/prompts.ts'
import { domstackBanner } from '@domstack/static/lib/cli/banner.js'

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

const defaults = { language: 'ts', framework: 'none', css: 'mine', deploy: 'none' }

test('non-interactive input uses defaults and preserves explicit choices', async (t) => {
  t.after(tty(false))
  assert.deepEqual(await chooseFeatures(parseArguments([])), defaults)
  assert.deepEqual(await chooseFeatures(parseArguments(['--language', 'js', '--framework', 'react', '--css', 'tailwind', '--deploy', 'neocities'])), {
    language: 'js', framework: 'react', css: 'tailwind', deploy: 'neocities',
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
  const messages = t.mock.method(console, 'log', () => {})
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
  assert.equal(stripVTControlCharacters(String(messages.mock.calls[0]?.arguments[0])), `\n${domstackBanner}`)
  assert.equal(questions.length, 4)
  assert.match(questions[3] ?? '', /Deployment/)
  answers = ['invalid', '3']
  questions.length = 0
  assert.deepEqual(await chooseFeatures(parseArguments(['--language', 'js', '--framework', 'preact', '--css', 'mine'])), {
    language: 'js', framework: 'preact', css: 'mine', deploy: 'neocities',
  })
  assert.equal(questions.length, 2)
  assert.ok(questions.every(question => question.includes('\nDeployment\n')))
  assert.equal(closed, 2)
  answers = ['4']
  assert.equal((await chooseFeatures(parseArguments(['--language', 'ts', '--framework', 'none', '--css', 'mine']))).deploy, 'wix')
  answers = ['5']
  assert.equal((await chooseFeatures(parseArguments(['--language', 'ts', '--framework', 'none', '--css', 'mine']))).deploy, 'cloudflare')
  answers = ['6']
  assert.equal((await chooseFeatures(parseArguments(['--language', 'ts', '--framework', 'none', '--css', 'mine']))).deploy, 'vercel')
  answers = ['7']
  assert.equal((await chooseFeatures(parseArguments(['--language', 'ts', '--framework', 'none', '--css', 'mine']))).deploy, 'netlify')
})

test('CSS prompt accepts names and numbers, defaults to mine, and retries invalid input', async (t) => {
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
  for (const [answer, css] of [['', 'mine'], ['1', 'mine'], ['mine.css', 'mine'], ['2', 'tailwind'], ['TAILWIND', 'tailwind'], ['3', 'none'], ['none', 'none']]) {
    answers = [answer!]
    assert.equal((await chooseFeatures(options)).css, css)
  }
  answers = ['invalid', '4', 'tailwind']
  assert.equal((await chooseFeatures(options)).css, 'tailwind')
  assert.equal(messages.mock.calls.filter(call => stripVTControlCharacters(String(call.arguments[0])).startsWith('Choose a number')).length, 2)
  assert.ok(questions.every(question => question.includes('default: mine.css')))
  assert.deepEqual(answers, [])
})
