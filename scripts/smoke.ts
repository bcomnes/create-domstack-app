import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'

const upstreamArgument = process.argv[2]
if (!upstreamArgument) throw new Error('Usage: npm run smoke:registry or npm run smoke:local -- /path/to/domstack (with its development dependencies installed)')
const registry = upstreamArgument === '--registry'
const root = resolve(import.meta.dirname, '..')
const npm = process.env['npm_execpath']
if (!npm) throw new Error('Run this smoke check with npm run smoke:local or npm run smoke:registry.')
const temporary = mkdtempSync(join(tmpdir(), 'domstack-packed-smoke-'))

function run (args: string[], cwd: string, env = process.env): void {
  execFileSync(process.execPath, [npm as string, ...args], { cwd, env, stdio: 'inherit', timeout: 120_000 })
}

function pack (cwd: string): string {
  const output = execFileSync(process.execPath, [npm as string, 'pack', '--ignore-scripts', '--json', '--pack-destination', temporary], {
    cwd, encoding: 'utf8', timeout: 120_000,
  })
  return join(temporary, JSON.parse(output)[0].filename)
}

try {
  let upstreamTarball: string | undefined
  if (!registry) {
    const upstream = resolve(upstreamArgument)
    // Build only a disposable upstream copy; never emit into the upstream checkout.
    const copy = join(temporary, 'upstream')
    mkdirSync(copy)
    for (const path of ['bin.js', 'index.js', 'types.ts', 'types', 'lib', 'eject-deps/package.json', 'package.json', 'tsconfig.json', 'declaration.tsconfig.json']) {
      cpSync(join(upstream, path), join(copy, path), {
        recursive: true,
        filter: source => !/\.d\.ts(?:\.map)?$/.test(source) || source.startsWith(join(upstream, 'types') + sep) || source.endsWith('-types.d.ts'),
      })
    }
    symlinkSync(join(upstream, 'node_modules'), join(copy, 'node_modules'), 'dir')
    run(['run', 'build:declaration'], copy)
    upstreamTarball = pack(copy)
  }
  run(['run', 'build'], root)
  const generatorTarball = pack(root)
  const consumer = join(temporary, 'consumer')
  mkdirSync(consumer)
  writeFileSync(join(consumer, 'package.json'), '{"private":true,"type":"module"}\n')
  run(['install', '--ignore-scripts', '--no-audit', '--no-fund', generatorTarball, ...(upstreamTarball ? [upstreamTarball] : [])], consumer)
  const generator = join(consumer, 'node_modules/@domstack/create-app')
  const manifest = JSON.parse(readFileSync(join(generator, 'package.json'), 'utf8'))
  const range = manifest.dependencies['@domstack/static']
  assert.ok(!range.startsWith('file:'))
  for (const path of ['bin.js', 'index.js', 'index.d.ts', 'template.js', 'template.d.ts', 'deployment.js', 'deployment.d.ts', 'wix-agents.js', 'wix-agents.d.ts', 'dependencies.js', 'prompts.js']) {
    assert.ok(existsSync(join(generator, 'dist', path)), `missing packed dist/${path}`)
  }
  assert.ok(existsSync(join(generator, 'src/index.ts')), 'missing declaration-map source')
  assert.ok(!existsSync(join(generator, 'test')), 'tests should not be published')
  assert.ok(!existsSync(join(generator, 'scripts')), 'development scripts should not be published')

  writeFileSync(join(consumer, 'api.ts'), `import { createApp } from '@domstack/create-app'
import type { CreateAppResult } from '@domstack/create-app'

const result: Promise<CreateAppResult> = createApp({
  targetDirectory: 'site', language: 'ts', framework: 'preact', css: 'tailwind',
  deploy: 'github-pages', install: false,
})
void result
`)
  const compilerPackage = join(root, 'node_modules/typescript')
  const compilerManifest = JSON.parse(readFileSync(join(compilerPackage, 'package.json'), 'utf8'))
  const compilerBin = compilerManifest.bin.tsc ?? compilerManifest.bin.tsc6
  assert.ok(compilerBin, 'TypeScript must provide a tsc or tsc6 executable')
  execFileSync(process.execPath, [join(compilerPackage, compilerBin), '--noEmit', '--strict', '--module', 'nodenext', '--target', 'es2024', 'api.ts'], {
    cwd: consumer, stdio: 'inherit', timeout: 120_000,
  })

  const env: NodeJS.ProcessEnv = { ...process.env, npm_config_user_agent: 'npm/11' }
  if (!registry) {
    // Override only the install command in this test environment, preserving the
    // generated registry range while installing the unpublished local tarball.
    const bin = join(temporary, 'bin')
    mkdirSync(bin)
    const wrapper = join(bin, 'npm')
    writeFileSync(wrapper, `#!${process.execPath}
const { spawnSync } = require('node:child_process')
const args = process.argv.slice(2)
if (args[0] === 'install') args.push('--no-save', '--no-audit', '--no-fund', ${JSON.stringify(upstreamTarball)})
const result = spawnSync(${JSON.stringify(process.execPath)}, [${JSON.stringify(npm)}, ...args], { stdio: 'inherit', env: process.env })
if (result.error) throw result.error
process.exit(result.status ?? 1)
`)
    chmodSync(wrapper, 0o755)
    env['PATH'] = `${bin}:${process.env['PATH'] ?? ''}`
  }
  const cases = [
    { language: 'ts', framework: 'preact', css: 'none', deploy: 'none' },
    { language: 'js', framework: 'react', css: 'none', deploy: 'none' },
    { language: 'ts', framework: 'none', css: 'mine', deploy: 'none' },
    { language: 'js', framework: 'none', css: 'mine', deploy: 'none' },
    { language: 'ts', framework: 'preact', css: 'tailwind', deploy: 'github-pages' },
    { language: 'js', framework: 'react', css: 'tailwind', deploy: 'github-pages' },
    { language: 'ts', framework: 'react', css: 'tailwind', deploy: 'neocities' },
    { language: 'js', framework: 'preact', css: 'tailwind', deploy: 'neocities' },
    { language: 'ts', framework: 'none', css: 'mine', deploy: 'wix' },
    { language: 'js', framework: 'none', css: 'mine', deploy: 'wix' },
    { language: 'ts', framework: 'none', css: 'mine', deploy: 'cloudflare' },
    { language: 'js', framework: 'none', css: 'mine', deploy: 'cloudflare' },
    { language: 'ts', framework: 'none', css: 'mine', deploy: 'vercel' },
    { language: 'js', framework: 'none', css: 'mine', deploy: 'vercel' },
    { language: 'ts', framework: 'none', css: 'mine', deploy: 'netlify' },
    { language: 'js', framework: 'none', css: 'mine', deploy: 'netlify' },
  ]
  for (const features of cases) {
    const { language, framework, css, deploy } = features
    const directory = join(temporary, `${language}-${framework}-${css}-${deploy}`)
    console.log(`\nSmoke: ${JSON.stringify(features)}`)
    execFileSync(process.execPath, [join(generator, manifest.bin['create-domstack-app']), directory, '--yes', '--language', language, '--framework', framework, '--css', css, '--deploy', deploy], {
      cwd: consumer, env, stdio: 'inherit', timeout: 120_000,
    })
    const generatedManifest = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'))
    assert.equal(generatedManifest.devDependencies['@domstack/static'], range)
    if (registry) {
      const installed = JSON.parse(readFileSync(join(directory, 'node_modules/@domstack/static/package.json'), 'utf8'))
      console.log(`Installed @domstack/static: ${installed.version}`)
      const lock = JSON.parse(readFileSync(join(directory, 'package-lock.json'), 'utf8'))
      assert.match(lock.packages['node_modules/@domstack/static'].resolved, /^https:\/\/registry\.npmjs\.org\//)
    }
    const layout = readFileSync(join(directory, `src/layouts/root.layout.${language}`), 'utf8')
    assert.ok(layout.includes('defaultRootLayout'))
    assert.ok(existsSync(join(directory, `src/globals/global.client.${language}`)))
    assert.ok(!existsSync(join(directory, `src/layouts/root.layout.${language === 'ts' ? 'js' : 'ts'}`)))
    if (css === 'tailwind') assert.equal(readFileSync(join(directory, 'src/globals/global.css'), 'utf8'), '@import "tailwindcss" source("../");\n')
    run(['run', 'build'], directory)
    assert.match(readFileSync(join(directory, 'public/index.html'), 'utf8'), /Welcome to DOMStack/)
    if (framework !== 'none') {
      const html = readFileSync(join(directory, 'public/interactive/index.html'), 'utf8')
      assert.match(html, /counter-root/)
      const stylesheet = /href="(\/[^" ]+\.css)"/.exec(html)?.[1]
      assert.ok(stylesheet)
      if (css === 'tailwind') assert.match(readFileSync(join(directory, 'public', stylesheet), 'utf8'), /\.bg-blue-600/)
    }
    run(['test'], directory)
    if (deploy === 'github-pages') {
      run(['run', 'build'], directory, { ...process.env, DOMSTACK_BASE_PATH: '/example-repo/' })
      const html = readFileSync(join(directory, 'public/interactive/index.html'), 'utf8')
      assert.match(html, /src="\/example-repo\//)
      assert.match(html, /href="\/example-repo\//)
      assert.match(html, /href="\.\.\/"/)
      assert.doesNotMatch(html, /\/example-repo\/\//)
    }
  }
  console.log(`\nPacked generator and ${registry ? 'registry' : 'local upstream'} integration passed (${cases.length} projects).`)
} finally {
  run(['run', 'clean'], root)
  rmSync(temporary, { recursive: true, force: true })
}
