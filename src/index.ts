import { execFileSync, spawn } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { basename, dirname, resolve } from 'node:path'
import { dependencyVersion } from './dependencies.ts'
import { projectDeployment } from './deployment.ts'
import { projectFeatures, resolveCss, resolveTypeScript } from './template.ts'
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
    if (['--typescript', '--framework', '--css', '--deploy'].includes(arguments_[index - 1] ?? '')) continue
    if (argument === '--deploy') {
      const value = arguments_[index + 1]
      if (value !== 'none' && value !== 'github-pages' && value !== 'neocities' && value !== 'wix' && value !== 'cloudflare' && value !== 'vercel' && value !== 'netlify') throw new Error('--deploy must be none, github-pages, neocities, wix, cloudflare, vercel, or netlify.')
      features.deploy = value
      continue
    }
    if (argument === '--typescript') {
      const value = arguments_[index + 1]
      if (value !== 'none' && value !== 'vanilla' && value !== '@voxpelli/tsconfig') throw new Error('--typescript must be none, vanilla, or @voxpelli/tsconfig.')
      features.typescript = value
      continue
    }
    if (argument === '--framework') {
      const value = arguments_[index + 1]
      if (value !== 'none' && value !== 'preact' && value !== 'react') throw new Error('--framework must be none, preact, or react.')
      features.framework = value
      continue
    }
    if (argument === '--css') {
      const value = arguments_[index + 1]
      if (value !== 'mine' && value !== 'tailwind' && value !== 'none') throw new Error('--css must be mine, tailwind, or none.')
      features.css = value
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

  resolveTypeScript(features)

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

  const packageManager = options.packageManager ?? detectPackageManager()
  const install = options.install ?? true
  const eject = options.eject ?? true
  const { language, typescript } = resolveTypeScript(options)
  const features: Features = {
    typescript,
    framework: options.framework ?? 'none',
    css: resolveCss(options),
    deploy: options.deploy ?? 'none',
  }
  const template = projectFeatures(features)
  const deployment = projectDeployment(features.deploy, language, packageName)

  assertEmptyDirectory(directory)
  mkdirSync(directory, { recursive: true })

  const packageJson = {
    name: packageName,
    version: '0.0.0',
    private: true,
    type: 'module',
    scripts: {
      start: 'domstack --watch',
      build: 'domstack',
      preview: 'domstack --serve',
      ...template.scripts,
      ...deployment.scripts,
    },
    dependencies: template.dependencies,
    devDependencies: {
      ...template.devDependencies,
      ...deployment.devDependencies,
      '@domstack/static': domstackVersion,
    },
    ...(deployment.engines ? { engines: deployment.engines } : {}),
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
      await ejectDefaults(directory, packageManager, features)
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
  if (packageManager === 'yarn') return 'yarn start'
  if (packageManager === 'pnpm') return 'pnpm start'
  return `${packageManager} ${packageManager === 'npm' ? '' : 'run '}start`
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
  features: Features
): Promise<void> {
  const { language } = resolveTypeScript(features)
  const flags = ['eject', '--language', language, '--framework', features.framework, '--css', features.css, '--yes']
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
  const { language } = resolveTypeScript(features)
  return `# ${packageName}

A static site built with [DOMStack](https://github.com/bcomnes/domstack).

## Development

\`\`\`sh
npm start
\`\`\`

## Tests

\`\`\`sh
npm test
\`\`\`

Runs ESLint, Node tests${language === 'ts' ? ', and TypeScript checks' : ''}.
Add individual checks as \`test:*\` scripts to include them in \`npm test\`.${features.typescript === '@voxpelli/tsconfig' ? '\n\nTypeScript extends `@voxpelli/tsconfig/node26.json`, with DOMStack-specific browser, bundler, and no-emit settings in `tsconfig.json`.' : ''}

## Production preview

\`\`\`sh
npm run preview
\`\`\`

Builds and serves production output without watching for changes.

## Production build

\`\`\`sh
npm run build
\`\`\`

The generated site is written to \`public/\`.
With default setup, \`src/layouts/\` and \`src/globals/\` contain customizable DOMStack defaults.
If setup used \`--no-install\`, run \`npm install\`, \`npx domstack eject --language ${language} --framework ${features.framework} --css ${features.css} --yes\`, and \`npm install\` to eject them and install their dependencies.
Eject checks existing integration settings before writing; run it before customizing the generated defaults.
This setup requires a DOMStack release supporting \`domstack eject --language ts|js --framework none|preact|react --css mine|tailwind|none --yes\`.
`
}
