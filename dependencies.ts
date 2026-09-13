import { readFileSync } from 'node:fs'

const manifest = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  devDependencies: Record<string, string>
}

export function dependencyVersion (name: string): string {
  const version = manifest.devDependencies[name]
  if (!version) throw new Error(`Missing generator devDependency: ${name}`)
  return version
}
