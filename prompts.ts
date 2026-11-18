import { createInterface } from 'node:readline/promises'
import { styleText } from 'node:util'
import { domstackBanner } from '@domstack/static/lib/cli/banner.js'
import type { CliOptions } from './index.ts'
import { resolveCss } from './template.ts'
import type { Features } from './template.ts'

export async function chooseFeatures (options: CliOptions): Promise<Features> {
  const cssChoice = options.css !== undefined || options.tailwind !== undefined ? resolveCss(options) : undefined
  const defaults: Features = { language: 'ts', framework: 'none', css: 'mine', deploy: 'none' }
  if (options.yes || !process.stdin.isTTY || !process.stdout.isTTY) {
    return {
      language: options.language ?? defaults.language,
      framework: options.framework ?? defaults.framework,
      css: cssChoice ?? defaults.css,
      deploy: options.deploy ?? defaults.deploy,
    }
  }

  console.log(styleText('cyan', `\n${domstackBanner}`))

  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const controller = new AbortController()
  rl.on('SIGINT', () => controller.abort())
  try {
    async function choose<const T extends string> (
      title: string,
      choices: { value: T, label: string, hint?: string }[],
      fallback: T
    ): Promise<T> {
      const defaultLabel = choices.find(choice => choice.value === fallback)!.label
      const rows = choices.map((choice, index) => {
        const label = choice.value === fallback ? styleText('bold', choice.label) : choice.label
        const hint = choice.value === fallback ? 'default' : choice.hint
        return `  ${styleText('cyan', `${index + 1})`)} ${label}${hint ? styleText('dim', ` (${hint})`) : ''}`
      })
      const question = `\n${styleText(['bold', 'cyan'], title)}\n${rows.join('\n')}\n${styleText('dim', `Enter a number or name (default: ${defaultLabel})`)}\n${styleText('cyan', '› ')}`
      while (true) {
        const answer = (await rl.question(question, { signal: controller.signal })).trim().toLowerCase()
        if (!answer) return fallback
        const choice = choices.find((choice, index) => choice.value === answer || choice.label.toLowerCase() === answer || String(index + 1) === answer)
        if (choice) return choice.value
        console.log(styleText('yellow', `Choose a number from 1 to ${choices.length}, or a listed name.`))
      }
    }

    const language = options.language ?? await choose('Source language', [
      { value: 'ts', label: 'TypeScript' },
      { value: 'js', label: 'JavaScript' },
    ], defaults.language)
    const framework = options.framework ?? await choose('Browser JSX runtime', [
      { value: 'none', label: 'None' },
      { value: 'preact', label: 'Preact', hint: 'recommended when using JSX' },
      { value: 'react', label: 'React' },
    ], defaults.framework)
    const css = cssChoice ?? await choose('CSS', [
      { value: 'mine', label: 'mine.css' },
      { value: 'tailwind', label: 'Tailwind CSS' },
      { value: 'none', label: 'None' },
    ], defaults.css)
    const deploy = options.deploy ?? await choose('Deployment', [
      { value: 'none', label: 'None' },
      { value: 'github-pages', label: 'GitHub Pages' },
      { value: 'neocities', label: 'Neocities' },
      { value: 'wix', label: 'Wix' },
      { value: 'cloudflare', label: 'Cloudflare' },
      { value: 'vercel', label: 'Vercel' },
      { value: 'netlify', label: 'Netlify' },
    ], defaults.deploy)
    return { language, framework, css, deploy }
  } catch (error) {
    if (controller.signal.aborted) throw new Error('Setup cancelled; no files were created.')
    throw error
  } finally {
    rl.close()
  }
}
