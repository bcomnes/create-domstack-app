import { readFileSync } from 'node:fs'

const manifest = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  dependencies: Record<string, string>
  devDependencies: Record<string, string>
}

export function dependencyVersion (name: string): string {
  const version = manifest.dependencies[name] ?? manifest.devDependencies[name]
  if (!version) throw new Error(`Missing generator dependency: ${name}`)
  return version
}
