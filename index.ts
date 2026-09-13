import { execFileSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { basename, dirname, resolve } from 'node:path'

export const defaultTargetDirectory = 'domstack-app'
export const domstackVersion = 'beta'

export interface CreateAppOptions {
  targetDirectory: string
  install?: boolean
  packageManager?: PackageManager
}

export interface CreateAppResult {
  directory: string
  packageName: string
  packageManager: PackageManager
  installed: boolean
}

export interface CliOptions {
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

  for (const argument of arguments_) {
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

export function createApp (options: CreateAppOptions): CreateAppResult {
  const targetDirectory = options.targetDirectory.trim()
  if (!targetDirectory) throw new Error('The target directory cannot be empty.')

  const directory = resolve(targetDirectory)
  const packageName = packageNameFromDirectory(directory)

  assertEmptyDirectory(directory)
  mkdirSync(directory, { recursive: true })
  const packageManager = options.packageManager ?? detectPackageManager()
  const install = options.install ?? true

  const packageJson = {
    name: packageName,
    version: '0.0.0',
    private: true,
    type: 'module',
    scripts: {
      dev: 'domstack --watch',
      build: 'domstack',
      preview: 'domstack --serve',
    },
    devDependencies: {
      '@domstack/static': domstackVersion,
    },
  }

  writeProjectFile(
    directory,
    'package.json',
    `${JSON.stringify(packageJson, null, 2)}\n`
  )

  for (const [relativePath, contents] of Object.entries(starterFiles)) {
    writeProjectFile(directory, relativePath, contents)
  }

  writeProjectFile(directory, 'README.md', projectReadme(packageName))

  if (install) installDependencies(directory, packageManager)

  return {
    directory,
    packageName,
    packageManager,
    installed: install,
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

function projectReadme (packageName: string): string {
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
`
}
