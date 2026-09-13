import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const upstreamArgument = process.argv[2]
if (!upstreamArgument) throw new Error('Usage: npm run smoke:local -- /path/to/domstack (with its development dependencies installed)')
const upstream = resolve(upstreamArgument)
const root = import.meta.dirname
const npm = process.env['npm_execpath']
if (!npm) throw new Error('Run this smoke check with npm run smoke:local.')
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
  // Build only a disposable upstream copy; never emit into the upstream checkout.
  const copy = join(temporary, 'upstream')
  mkdirSync(copy)
  for (const path of ['bin.js', 'index.js', 'types.ts', 'types', 'lib', 'package.json', 'tsconfig.json', 'declaration.tsconfig.json']) {
    cpSync(join(upstream, path), join(copy, path), { recursive: true })
  }
  symlinkSync(join(upstream, 'node_modules'), join(copy, 'node_modules'), 'dir')
  run(['run', 'build:declaration'], copy)
  const upstreamTarball = pack(copy)
  run(['run', 'build'], root)
  const generatorTarball = pack(root)
  const consumer = join(temporary, 'consumer')
  mkdirSync(consumer)
  writeFileSync(join(consumer, 'package.json'), '{"private":true,"type":"module"}\n')
  run(['install', '--ignore-scripts', '--no-audit', '--no-fund', generatorTarball], consumer)
  const generator = join(consumer, 'node_modules/@domstack/create-app')
  const manifest = JSON.parse(readFileSync(join(generator, 'package.json'), 'utf8'))
  const range = manifest.devDependencies['@domstack/static']
  assert.ok(!range.startsWith('file:'))
  for (const path of ['index.js', 'index.d.ts', 'template.js', 'template.d.ts', 'deployment.js', 'deployment.d.ts', 'defaults.js', 'dependencies.js', 'prompts.js']) {
    assert.ok(existsSync(join(generator, path)), `missing packed ${path}`)
  }

  writeFileSync(join(consumer, 'api.ts'), `import { createApp } from '@domstack/create-app'
import type { CreateAppResult } from '@domstack/create-app'

const result: Promise<CreateAppResult> = createApp({
  targetDirectory: 'site', language: 'ts', framework: 'preact', tailwind: true,
  deploy: 'github-pages', install: false,
})
void result
`)
  execFileSync(process.execPath, [join(root, 'node_modules/typescript/bin/tsc'), '--noEmit', '--strict', '--module', 'nodenext', '--target', 'es2024', 'api.ts'], {
    cwd: consumer, stdio: 'inherit', timeout: 120_000,
  })

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
  const env = { ...process.env, PATH: `${bin}:${process.env['PATH'] ?? ''}`, npm_config_user_agent: 'npm/11' }
  const cases = [
    { language: 'ts', framework: 'none', tailwind: false, deploy: 'none' },
    { language: 'js', framework: 'none', tailwind: false, deploy: 'none' },
    { language: 'ts', framework: 'preact', tailwind: true, deploy: 'github-pages' },
    { language: 'js', framework: 'react', tailwind: true, deploy: 'github-pages' },
    { language: 'ts', framework: 'react', tailwind: true, deploy: 'neocities' },
    { language: 'js', framework: 'preact', tailwind: true, deploy: 'neocities' },
  ]
  for (const features of cases) {
    const { language, framework, tailwind, deploy } = features
    const directory = join(temporary, `${language}-${framework}-${deploy}`)
    console.log(`\nSmoke: ${JSON.stringify(features)}`)
    execFileSync(process.execPath, [join(generator, 'bin.js'), directory, '--yes', '--language', language, '--framework', framework, tailwind ? '--tailwind' : '--no-tailwind', '--deploy', deploy], {
      cwd: consumer, env, stdio: 'inherit', timeout: 120_000,
    })
    const generatedManifest = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'))
    assert.equal(generatedManifest.devDependencies['@domstack/static'], range)
    const layout = readFileSync(join(directory, `src/layouts/root.layout.${language}`), 'utf8')
    assert.ok(layout.includes('defaultRootLayout'))
    assert.ok(existsSync(join(directory, `src/globals/global.client.${language}`)))
    assert.ok(!existsSync(join(directory, `src/layouts/root.layout.${language === 'ts' ? 'js' : 'ts'}`)))
    if (tailwind) assert.equal(readFileSync(join(directory, 'src/globals/global.css'), 'utf8'), '@import "tailwindcss" source("../");\n')
    run(['run', 'build'], directory)
    assert.match(readFileSync(join(directory, 'public/index.html'), 'utf8'), /Welcome to DOMStack/)
    if (framework !== 'none') {
      const html = readFileSync(join(directory, 'public/interactive/index.html'), 'utf8')
      assert.match(html, /counter-root/)
      const stylesheet = /href="(\/[^" ]+\.css)"/.exec(html)?.[1]
      assert.ok(stylesheet)
      assert.match(readFileSync(join(directory, 'public', stylesheet), 'utf8'), /\.bg-blue-600/)
    }
    if (language === 'ts') run(['run', 'typecheck'], directory)
    if (deploy === 'github-pages') {
      run(['run', 'build'], directory, { ...process.env, DOMSTACK_BASE_PATH: '/example-repo/' })
      const html = readFileSync(join(directory, 'public/interactive/index.html'), 'utf8')
      assert.match(html, /src="\/example-repo\//)
      assert.match(html, /href="\/example-repo\//)
      assert.match(html, /href="\.\.\/"/)
      assert.doesNotMatch(html, /\/example-repo\/\//)
    }
  }
  console.log('\nPacked generator and local upstream integration passed (6 projects).')
} finally {
  run(['run', 'clean'], root)
  rmSync(temporary, { recursive: true, force: true })
}
