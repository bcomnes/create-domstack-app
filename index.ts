import { execFileSync, spawn } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { basename, dirname, resolve } from 'node:path'
import { configureDefaults } from './defaults.ts'
import { dependencyVersion } from './dependencies.ts'
import { projectDeployment } from './deployment.ts'
import { projectFeatures } from './template.ts'
import type { Features } from './template.ts'

export const defaultTargetDirectory = 'domstack-app'
export const domstackVersion = dependencyVersion('@domstack/static')

export interface CreateAppOptions extends Partial<Features> {
  targetDirectory: string
  install?: boolean
  eject?: boolean
  packageManager?: PackageManager
}

export interface CreateAppResult {
  directory: string
  packageName: string
  packageManager: PackageManager
  installed: boolean
  ejected: boolean
}

export interface CliOptions extends Partial<Features> {
  yes: boolean
  targetDirectory: string
  install: boolean
  help: boolean
  version: boolean
}

export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun'

const starterFiles = {
  '.gitignore': `node_modules
public
.DS_Store
`,
  'src/page.md': `---
title: Welcome to DOMStack
---

# Welcome to DOMStack

Edit \`src/page.md\` to get started.
`,
  'src/style.css': `:root {
  color-scheme: light dark;
  font-family: system-ui, sans-serif;
  line-height: 1.5;
}

body {
  margin: 0 auto;
  max-width: 48rem;
  padding: 4rem 1.5rem;
}
`,
}

export function parseArguments (arguments_: string[]): CliOptions {
  const positionalArguments: string[] = []
  let install = true
  let help = false
  let version = false
  let yes = false
  const features: Partial<Features> = {}

  for (const [index, argument] of arguments_.entries()) {
    if (['--language', '--framework', '--deploy'].includes(arguments_[index - 1] ?? '')) continue
    if (argument === '--deploy') {
      const value = arguments_[index + 1]
      if (value !== 'none' && value !== 'github-pages' && value !== 'neocities') throw new Error('--deploy must be none, github-pages, or neocities.')
      features.deploy = value
      continue
    }
    if (argument === '--language') {
      const value = arguments_[index + 1]
      if (value !== 'ts' && value !== 'js') throw new Error('--language must be ts or js.')
      features.language = value
      continue
    }
    if (argument === '--framework') {
      const value = arguments_[index + 1]
      if (value !== 'none' && value !== 'preact' && value !== 'react') throw new Error('--framework must be none, preact, or react.')
      features.framework = value
      continue
    }
    if (argument === '--tailwind' || argument === '--no-tailwind') {
      features.tailwind = argument === '--tailwind'
      continue
    }
    if (argument === '--yes' || argument === '-y') {
      yes = true
      continue
    }
    if (argument === '--') continue
    if (argument === '--no-install') {
      install = false
      continue
    }
    if (argument === '--help' || argument === '-h') {
      help = true
      continue
    }
    if (argument === '--version' || argument === '-v') {
      version = true
      continue
    }
    if (argument.startsWith('-')) {
      throw new Error(`Unknown option: ${argument}`)
    }
    positionalArguments.push(argument)
  }

  if (positionalArguments.length > 1) {
    throw new Error('Only one target directory may be specified.')
  }

  return {
    ...features,
    yes,
    targetDirectory: positionalArguments[0] ?? defaultTargetDirectory,
    install,
    help,
    version,
  }
}

export function detectPackageManager (
  userAgent = process.env['npm_config_user_agent'] ?? ''
): PackageManager {
  if (userAgent.startsWith('pnpm/')) return 'pnpm'
  if (userAgent.startsWith('yarn/')) return 'yarn'
  if (userAgent.startsWith('bun/')) return 'bun'
  return 'npm'
}

export async function createApp (
  options: CreateAppOptions
): Promise<CreateAppResult> {
  const targetDirectory = options.targetDirectory.trim()
  if (!targetDirectory) throw new Error('The target directory cannot be empty.')

  const directory = resolve(targetDirectory)
  const packageName = packageNameFromDirectory(directory)

  assertEmptyDirectory(directory)
  mkdirSync(directory, { recursive: true })
  const packageManager = options.packageManager ?? detectPackageManager()
  const install = options.install ?? true
  const eject = options.eject ?? true
  const features: Features = {
    language: options.language ?? 'ts',
    framework: options.framework ?? 'none',
    tailwind: options.tailwind ?? false,
    deploy: options.deploy ?? 'none',
  }
  const template = projectFeatures(features)
  const deployment = projectDeployment(features.deploy, features.language)

  const packageJson = {
    name: packageName,
    version: '0.0.0',
    private: true,
    type: 'module',
    scripts: {
      dev: 'domstack --watch',
      build: 'domstack',
      preview: 'domstack --serve',
      ...template.scripts,
    },
    dependencies: template.dependencies,
    devDependencies: {
      ...template.devDependencies,
      '@domstack/static': domstackVersion,
    },
  }

  writeProjectFile(
    directory,
    'package.json',
    `${JSON.stringify(packageJson, null, 2)}\n`
  )

  for (const [relativePath, contents] of Object.entries({ ...starterFiles, ...template.files, ...deployment.files })) {
    writeProjectFile(directory, relativePath, contents)
  }

  writeProjectFile(directory, 'README.md', projectReadme(packageName, features) + deployment.readme)

  if (install) {
    installDependencies(directory, packageManager)
    if (eject) {
      await ejectDefaults(directory, packageManager, features.language)
      configureDefaults(directory, features.language, features.tailwind)
      installDependencies(directory, packageManager)
    }
  }

  return {
    directory,
    packageName,
    packageManager,
    installed: install,
    ejected: install && eject,
  }
}

export function packageManagerRunCommand (packageManager: PackageManager): string {
  if (packageManager === 'yarn') return 'yarn dev'
  if (packageManager === 'pnpm') return 'pnpm dev'
  return `${packageManager} run dev`
}

function assertEmptyDirectory (directory: string): void {
  if (!existsSync(directory)) return
  if (!statSync(directory).isDirectory()) {
    throw new Error(`The target path is not a directory: ${directory}`)
  }

  const entries = readdirSync(directory)
  if (entries.length > 0) {
    throw new Error(`The target directory is not empty: ${directory}`)
  }
}

function packageNameFromDirectory (directory: string): string {
  const packageName = basename(directory)
    .trim()
    .toLowerCase()
    .replace(/^[._]+/, '')
    .replace(/\s+/g, '-')
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(packageName)) {
    throw new Error(`Cannot derive a valid package name from: ${basename(directory)}`)
  }
  return packageName
}

function writeProjectFile (
  directory: string,
  relativePath: string,
  contents: string
): void {
  const path = resolve(directory, relativePath)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, contents, { flag: 'wx' })
}

function installDependencies (
  directory: string,
  packageManager: PackageManager
): void {
  const arguments_ = packageManager === 'yarn' ? [] : ['install']
  execFileSync(packageManager, arguments_, {
    cwd: directory,
    stdio: 'inherit',
  })
}

async function ejectDefaults (
  directory: string,
  packageManager: PackageManager,
  language: Features['language']
): Promise<void> {
  const flags = ['--eject', '--language', language, '--yes']
  const argumentsByPackageManager = {
    npm: ['exec', '--', 'domstack', ...flags],
    pnpm: ['exec', 'domstack', ...flags],
    yarn: ['exec', 'domstack', ...flags],
    bun: ['x', 'domstack', ...flags],
  }

  const child = spawn(
    packageManager,
    argumentsByPackageManager[packageManager],
    {
      cwd: directory,
      stdio: ['ignore', 'inherit', 'inherit'],
    }
  )

  await new Promise<void>((resolve, reject) => {
    child.once('error', reject)
    child.once('close', (code, signal) => {
      if (code === 0) {
        resolve()
        return
      }

      const result = signal === null ? `code ${code}` : `signal ${signal}`
      reject(new Error(`DOMStack eject exited with ${result}.`))
    })
  })
}

function projectReadme (packageName: string, features: Features): string {
  return `# ${packageName}

A static site built with [DOMStack](https://github.com/bcomnes/domstack).

## Development

\`\`\`sh
npm run dev
\`\`\`

## Production build

\`\`\`sh
npm run build
\`\`\`

The generated site is written to \`public/\`.
With default setup, \`src/layouts/\` and \`src/globals/\` contain customizable DOMStack defaults.
If setup used \`--no-install\`, run \`npm install\`, \`npx domstack --eject --language ${features.language} --yes\`, and \`npm install\` to eject them and install their dependencies.
${features.tailwind ? 'Eject replaces `src/globals/global.css`; after manual eject, restore its contents to `@import "tailwindcss" source("../");` before building.\n' : ''}Only eject into a fresh project: eject overwrites the default layout, stylesheet, and client files.
This setup requires a DOMStack release supporting \`--eject --language ts|js --yes\`.
`
}
