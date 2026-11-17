import { createInterface } from 'node:readline/promises'
import { styleText } from 'node:util'
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

  console.log(styleText('cyan', `\n                                                            +##.
.:.                                                         ###
####.                                    :+                 ###
:#####.    .:+.   .:  :.  ::      :+.   +##.   :+.     .+:  ###.:.
 :#####+ :#####+ :##+########: .+#####.#####. +####. .+#### ######:
.##: ###.###:###.+###+######## +##:###..###. :#####+ #####+ ###:###:
.##: ###.##+ :##. ### +##..### ### .#+  ###   #:.##+ ###..  ###.##:
.##: ###.##+ :##. ### +##. ### +######: ###   #::##+ ###    #####+
.##: ###.##+ :##. ### +##..### .###:##+ ###   #####+ ###    ######.
:### ###.###.:##. ### +##..###  +#: ##+ ### .+##:##+ ###+.  ###.##+
.######+ ####### .### ###: ###:.######: ###+.#######:+####+.### ####
  :##+.   :##+.   +#+ .##. :##. :##+.   :##: .##++#+  :###. +#: .##:`))

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

    async function confirm (question: string, fallback: boolean): Promise<boolean> {
      const defaultLabel = fallback ? 'yes' : 'no'
      const answerHint = `[${fallback ? `${styleText('bold', 'Y')}/n` : `y/${styleText('bold', 'N')}`}]`
      const prompt = `\n${styleText(['bold', 'cyan'], question)} ${answerHint} ${styleText('dim', `(default: ${defaultLabel})`)}\n${styleText('cyan', '› ')}`
      while (true) {
        const answer = (await rl.question(prompt, { signal: controller.signal })).trim().toLowerCase()
        if (!answer) return fallback
        if (answer === 'y' || answer === 'yes') return true
        if (answer === 'n' || answer === 'no') return false
        console.log(styleText('yellow', `Enter y or n (default: ${defaultLabel}).`))
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
    const tailwind = options.tailwind ?? await confirm('Set up Tailwind CSS?', defaults.tailwind)
    const deploy = options.deploy ?? await choose('Deployment', [
      { value: 'none', label: 'None' },
      { value: 'github-pages', label: 'GitHub Pages' },
      { value: 'neocities', label: 'Neocities' },
      { value: 'wix', label: 'Wix' },
      { value: 'cloudflare', label: 'Cloudflare' },
      { value: 'vercel', label: 'Vercel' },
      { value: 'netlify', label: 'Netlify' },
    ], defaults.deploy)
    return { language, framework, tailwind, deploy }
  } catch (error) {
    if (controller.signal.aborted) throw new Error('Setup cancelled; no files were created.')
    throw error
  } finally {
    rl.close()
  }
}
