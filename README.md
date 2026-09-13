# @domstack/create-app

[![npm version](https://img.shields.io/npm/v/@domstack/create-app.svg)](https://www.npmjs.com/package/@domstack/create-app)
[![Actions Status](https://github.com/bcomnes/create-domstack-app/workflows/tests/badge.svg)](https://github.com/bcomnes/create-domstack-app/actions)
[![neostandard JavaScript style](https://img.shields.io/badge/code_style-neostandard-7fffff?style=flat&labelColor=ff80ff)](https://github.com/neostandard/neostandard)

Create a new [DOMStack](https://github.com/bcomnes/domstack) app.

## Usage

```sh
npm create @domstack/app@latest my-app
```

The npm `create` convention maps `@domstack/app` to this package, `@domstack/create-app`.
The command creates the project and installs its dependencies.

To create the files without installing dependencies:

```sh
npm create @domstack/app@latest my-app -- --no-install
```

Then start the development server:

```sh
cd my-app
npm run dev
```

## Generated project

```text
my-app/
├── src/
│   ├── page.md
│   └── style.css
├── .gitignore
├── package.json
└── README.md
```

The generated scripts are:

- `npm run dev` starts DOMStack in watch mode.
- `npm run build` builds the site into `public/`.
- `npm run preview` serves the production build.

The generated project currently follows the `beta` release of `@domstack/static`.

## Other package managers

```sh
pnpm create @domstack/app@latest my-app
yarn create @domstack/app my-app
bun create @domstack/app@latest my-app
```

## Programmatic API

```js
import { createApp } from '@domstack/create-app'

createApp({
  targetDirectory: 'my-app',
  install: false,
})
```

## License

MIT
