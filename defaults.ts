import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { projectFeatures } from './template.ts'

/** Restore the selected styling after upstream eject writes its default CSS. */
export function configureDefaults (
  directory: string,
  language: 'ts' | 'js',
  tailwind: boolean
): void {
  if (!tailwind) return

  const { files } = projectFeatures({ language, framework: 'none', tailwind })
  const stylesheet = files['src/globals/global.css']
  if (stylesheet === undefined) {
    throw new Error('Tailwind project features must provide src/globals/global.css.')
  }
  writeFileSync(resolve(directory, 'src/globals/global.css'), stylesheet)
}
