import { ejectFeatures } from '@domstack/static/lib/cli/eject-features.js'
import { dependencyVersion } from './dependencies.ts'
import type { Deployment } from './deployment.ts'

export type Language = 'ts' | 'js'
export type Css = 'mine' | 'tailwind' | 'none'
export type Framework = 'none' | 'preact' | 'react'

export interface Features {
  language: Language
  framework: Framework
  css: Css
  deploy: Deployment
}

export function projectFeatures (features: Omit<Features, 'deploy' | 'css'> & { css?: Css }): {
  files: Record<string, string>
  dependencies: Record<string, string>
  devDependencies: Record<string, string>
  scripts: Record<string, string>
} {
  const { language, framework } = features
  const css = resolveCss(features)
  const tailwind = css === 'tailwind'
  const integration = ejectFeatures({ language, framework, css, module: true })
  const files: Record<string, string> = Object.fromEntries(
    Object.entries(integration.files).map(([path, content]) => [`src/${path}`, content])
  )
  const dependencies = integration.dependencies
  const devDependencies: Record<string, string> = {
    ...integration.devDependencies,
    'npm-run-all2': dependencyVersion('npm-run-all2'),
    eslint: dependencyVersion('eslint'),
    neostandard: dependencyVersion('neostandard'),
  }
  const scripts: Record<string, string> = {
    test: 'run-s test:*',
    'test:eslint': 'eslint .',
    'test:node': 'node --test',
  }
  files['eslint.config.js'] = `import { globalIgnores } from 'eslint/config'
import { neostandard, resolveIgnoresFromGitignore } from 'neostandard'

export default [
  globalIgnores(resolveIgnoresFromGitignore()),
  ...neostandard({
    ts: ${language === 'ts' || framework !== 'none'},
${language === 'js' && framework !== 'none' ? "    // Track component references in JSX with TypeScript's parser.\n    filesTs: ['**/*.jsx'],\n" : ''}    env: ['browser'],
  }),
]
`

  if (language === 'ts') {
    devDependencies['typescript'] = dependencyVersion('typescript')
    devDependencies['@typescript/native'] = dependencyVersion('@typescript/native')
    devDependencies['@types/node'] = dependencyVersion('@types/node')
    scripts['test:typecheck'] = 'tsc --noEmit'
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

  if (tailwind) {
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
    const buttonClasses = tailwind ? " className='rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700'" : ''
    const mount = framework === 'preact'
      ? 'render(<Counter />, container)'
      : 'createRoot(container).render(<Counter />)'
    files[`src/interactive/client.${extension}`] = `/// <reference lib="dom" />
${imports}

function Counter () {
  const [count, setCount] = useState(0)

  return (
    <button type='button'${buttonClasses} onClick={() => setCount(value => value + 1)}>
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

export function resolveCss ({ css }: { css?: Css }): Css {
  if (css !== undefined && !['mine', 'tailwind', 'none'].includes(css)) {
    throw new Error('--css must be mine, tailwind, or none.')
  }
  return css ?? 'mine'
}
