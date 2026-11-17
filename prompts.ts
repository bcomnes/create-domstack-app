import { createInterface } from 'node:readline/promises'
import type { CliOptions } from './index.ts'
import type { Features } from './template.ts'

export async function chooseFeatures (options: CliOptions): Promise<Features> {
  const defaults: Features = { language: 'ts', framework: 'none', tailwind: false, deploy: 'none' }
  if (options.yes || !process.stdin.isTTY || !process.stdout.isTTY) {
    return {
      language: options.language ?? defaults.language,
      framework: options.framework ?? defaults.framework,
      tailwind: options.tailwind ?? defaults.tailwind,
      deploy: options.deploy ?? defaults.deploy,
    }
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const controller = new AbortController()
  rl.on('SIGINT', () => controller.abort())
  try {
    async function choose<const T extends string> (question: string, values: T[], fallback: T): Promise<T> {
      while (true) {
        const answer = (await rl.question(question, { signal: controller.signal })).trim().toLowerCase()
        if (!answer) return fallback
        const value = values.find((value, index) => value === answer || String(index + 1) === answer)
        if (value) return value
        console.log(`Choose ${values.join(', ')} or a listed number.`)
      }
    }

    async function confirm (question: string, fallback: boolean): Promise<boolean> {
      const defaultLabel = fallback ? 'yes' : 'no'
      while (true) {
        const answer = (await rl.question(`${question} [${fallback ? 'Y/n' : 'y/N'}] (default: ${defaultLabel}): `, { signal: controller.signal })).trim().toLowerCase()
        if (!answer) return fallback
        if (answer === 'y' || answer === 'yes') return true
        if (answer === 'n' || answer === 'no') return false
        console.log(`Enter y or n (default: ${defaultLabel}).`)
      }
    }

    const language = options.language ?? await choose('Language: 1) TypeScript  2) JavaScript [1]: ', ['ts', 'js'], 'ts')
    const framework = options.framework ?? await choose('JSX/TSX: 1) None  2) Preact (recommended)  3) React [1]: ', ['none', 'preact', 'react'], 'none')
    const tailwind = options.tailwind ?? await confirm('Set up Tailwind CSS?', defaults.tailwind)
    const deploy = options.deploy ?? await choose('Deployment: 1) None  2) GitHub Pages  3) Neocities  4) Wix  5) Cloudflare  6) Vercel  7) Netlify [1]: ', ['none', 'github-pages', 'neocities', 'wix', 'cloudflare', 'vercel', 'netlify'], 'none')
    return { language, framework, tailwind, deploy }
  } catch (error) {
    if (controller.signal.aborted) throw new Error('Setup cancelled; no files were created.')
    throw error
  } finally {
    rl.close()
  }
}
