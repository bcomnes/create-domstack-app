import { dependencyVersion } from './dependencies.ts'
import type { Deployment } from './deployment.ts'

export type Language = 'ts' | 'js'
export type Framework = 'none' | 'preact' | 'react'

export interface Features {
  language: Language
  framework: Framework
  tailwind: boolean
  deploy: Deployment
}

export function projectFeatures (features: Omit<Features, 'deploy'>): {
  files: Record<string, string>
  dependencies: Record<string, string>
  devDependencies: Record<string, string>
  scripts: Record<string, string>
} {
  const { language, framework, tailwind } = features
  const files: Record<string, string> = {}
  const dependencies: Record<string, string> = {}
  const devDependencies: Record<string, string> = {}
  const scripts: Record<string, string> = {}

  if (language === 'ts') {
    devDependencies['typescript'] = dependencyVersion('typescript')
    devDependencies['@types/node'] = dependencyVersion('@types/node')
    scripts['typecheck'] = 'tsc --noEmit'
    files['tsconfig.json'] = `${JSON.stringify({
      compilerOptions: {
        target: 'ES2024',
        module: 'ESNext',
        moduleResolution: 'bundler',
        lib: ['ES2024', 'DOM', 'DOM.Iterable'],
        types: ['node'],
        strict: true,
        noEmit: true,
        allowJs: true,
        checkJs: false,
        allowImportingTsExtensions: true,
        resolveJsonModule: true,
        esModuleInterop: true,
        isolatedModules: true,
        verbatimModuleSyntax: true,
        skipLibCheck: true,
        ...(framework === 'none'
? {}
: {
          jsx: 'react-jsx',
          jsxImportSource: framework,
        }),
      },
      include: ['src'],
      exclude: ['node_modules', 'public'],
    }, null, 2)}\n`
  }

  if (framework === 'preact') {
    dependencies['preact'] = dependencyVersion('preact')
  } else if (framework === 'react') {
    dependencies['react'] = dependencyVersion('react')
    dependencies['react-dom'] = dependencyVersion('react-dom')
    if (language === 'ts') {
      devDependencies['@types/react'] = dependencyVersion('@types/react')
      devDependencies['@types/react-dom'] = dependencyVersion('@types/react-dom')
    }
  }

  if (tailwind) {
    devDependencies['esbuild-plugin-tailwindcss'] = dependencyVersion('esbuild-plugin-tailwindcss')
    files['src/globals/global.css'] = `@import "tailwindcss" source("../");
`
    // Keep starter styles in a layer so utilities can override them.
    files['src/style.css'] = `@layer base {
  :root {
    font-family: system-ui, sans-serif;
    line-height: 1.5;
  }

  body {
    margin: 0 auto;
    max-width: 48rem;
    padding: 4rem 1.5rem;
  }
}
`
  }

  if (framework !== 'none' || tailwind) {
    const typeImport = language === 'ts'
      ? "import type { BuildOptions } from '@domstack/static/types.js'\n"
      : "/** @import { BuildOptions } from '@domstack/static/types.js' */\n"
    const pluginImport = tailwind ? "import tailwindPlugin from 'esbuild-plugin-tailwindcss'\n" : ''
    const annotation = language === 'js' ? '/** @param {BuildOptions} settings */\n' : ''
    const parameter = language === 'ts' ? 'settings: BuildOptions' : 'settings'
    const returnType = language === 'ts' ? ': BuildOptions' : ''
    const jsxSettings = framework === 'none'
      ? ''
      : `  settings.jsx = 'automatic'
  settings.jsxImportSource = '${framework}'
`
    const pluginSettings = tailwind
      ? `  settings.plugins = [...(settings.plugins ?? []), tailwindPlugin()]
`
      : ''
    files[`src/globals/esbuild.settings.${language}`] = `${typeImport}${pluginImport}
${annotation}export default function esbuildSettingsOverride (${parameter})${returnType} {
${jsxSettings}${pluginSettings}  return settings
}
`
  }

  if (framework !== 'none') {
    const name = framework === 'preact' ? 'Preact' : 'React'
    const extension = language === 'ts' ? 'tsx' : 'jsx'
    files['src/interactive/page.html'] = `<h1>${name} counter</h1>
<p>Edit <code>src/interactive/client.${extension}</code> to get started.</p>
<div id="counter-root"></div>
<noscript>Enable JavaScript to try the counter.</noscript>
<p><a href="../">Back home</a></p>
`
    const imports = framework === 'preact'
      ? "import { render } from 'preact'\nimport { useState } from 'preact/hooks'"
      : "import { useState } from 'react'\nimport { createRoot } from 'react-dom/client'"
    const buttonClasses = tailwind ? ' className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"' : ''
    const mount = framework === 'preact'
      ? 'render(<Counter />, container)'
      : 'createRoot(container).render(<Counter />)'
    files[`src/interactive/client.${extension}`] = `${imports}

function Counter () {
  const [count, setCount] = useState(0)

  return (
    <button type="button"${buttonClasses} onClick={() => setCount(value => value + 1)}>
      Count: {count}
    </button>
  )
}

const container = document.getElementById('counter-root')
if (container) {
  ${mount}
}
`
  }

  return { files, dependencies, devDependencies, scripts }
}
