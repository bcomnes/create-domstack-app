#!/usr/bin/env node

import { readFileSync } from 'node:fs'
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
  --no-install  Create the project without installing dependencies
  -h, --help    Show this help
  -v, --version Show the installed version
`

try {
  const options = parseArguments(process.argv.slice(2))

  if (options.help) {
    console.log(usage)
  } else if (options.version) {
    const packageJson = JSON.parse(
      readFileSync(new URL('./package.json', import.meta.url), 'utf8')
    )
    console.log(packageJson.version)
  } else {
    const packageManager = detectPackageManager()
    console.log(`Creating a DOMStack app in ${options.targetDirectory}...`)

    const result = createApp({
      targetDirectory: options.targetDirectory,
      install: options.install,
      packageManager,
    })

    console.log(`\nCreated ${result.packageName} in ${result.directory}.`)
    if (!result.installed) {
      console.log(`Run ${packageManager} install to install dependencies.`)
    }
    console.log(`Run ${packageManagerRunCommand(packageManager)} to get started.`)
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`create-domstack-app: ${message}`)
  process.exitCode = 1
}
