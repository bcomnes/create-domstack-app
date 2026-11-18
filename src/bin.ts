#!/usr/bin/env node

import { readFileSync } from 'node:fs'
import { styleText } from 'node:util'
import { domstackBanner } from '@domstack/static/lib/cli/banner.js'
import { chooseFeatures } from './prompts.ts'
import {
  createApp,
  detectPackageManager,
  packageManagerRunCommand,
  parseArguments,
} from './index.ts'

const usage = `Create a new DOMStack app.

Usage:
  npm create @domstack/app@latest [directory] [options]

Options:
  --language ts|js              Source language (default: ts)
  --framework none|preact|react  Browser JSX runtime (default: none)
  --css mine|tailwind|none      CSS integration (default: mine)
  --tailwind                   Alias for --css tailwind
  --deploy none|github-pages|neocities|wix|cloudflare|vercel|netlify  Deployment workflow (default: none)
  -y, --yes                    Skip prompts and use defaults
  --no-install  Create the project without installing dependencies
  -h, --help    Show this help
  -v, --version Show the installed version
`

try {
  const options = parseArguments(process.argv.slice(2))

  if (options.help) {
    console.log(`${styleText('cyan', domstackBanner)}\n\n${usage}`)
  } else if (options.version) {
    const packageJson = JSON.parse(
      readFileSync(new URL('../package.json', import.meta.url), 'utf8')
    )
    console.log(packageJson.version)
  } else {
    const features = await chooseFeatures(options)
    const packageManager = detectPackageManager()
    console.log(`Creating a DOMStack app in ${options.targetDirectory}...`)

    const result = await createApp({
      ...features,
      targetDirectory: options.targetDirectory,
      install: options.install,
      packageManager,
    })

    console.log(`\nCreated ${result.packageName} in ${result.directory}.`)
    console.log(`Change into ${result.directory} first.`)
    if (!result.installed) {
      console.log(`Run ${packageManager} install to install dependencies.`)
      console.log(`Then run the local domstack eject --language ${features.language} --framework ${features.framework} --css ${features.css} --yes command to eject the customizable defaults.`)
      console.log(`Run ${packageManager} install again to install the added dependencies.`)
    }
    console.log(`Run ${packageManagerRunCommand(packageManager)} to get started.`)
    console.log('\nRead the DOMStack docs: https://domstack.net')
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`create-domstack-app: ${message}`)
  process.exitCode = 1
}
