# Best Electric Website

## Setup

[Node](https://nodejs.org/) (use [nvm](https://github.com/nvm-sh/nvm) for managing versions) and [Yarn](https://yarnpkg.com/) are required to build this project.

### Install Dependencies

```shell
yarn
```

### Building

```
yarn build [--production]
```

Passing the production will minify the output and apply some other optimizations. See [below](#how-building-works) for how this works.

## Project Layout

The majority of the project lies in the `src/` directory.

### `src/pages/[pageName]/`

This should should exist for every page of the website.

#### `src/pages/[pageName]/[pageName].njk`

This is the base for that particular page, it should include the following at the beginning.

```njk
{% extends "../../templates/base.njk" %}
```

#### `src/pages/[pageName]/[pageName].ts`

Optional TypeScript module that will only be executed on that page. Tf any page shares any code, it should be moved to the `App` namespace.

#### `src/pages/[pageName]/[pageName].scss`

Any addition css to be loaded on that page.

### `src/pages/templates/`

Collection of Nunjuck templates, macro and utils for building pages and components.

### `src/pages/app/`

The core of the app.

Each module should be prefixed with a number to ensure that they are loaded in the correct order.

## Development

Start the development server, then open `localhost:3000` in your browser. Any changes you make will be automatically reflected on the page without having to reload.

```shell
yarn dev
```

## How Building Works

- First the bundler searches for all files in the `src/vender/` folder.
  - With all of the files, are combined into one giant file, with some extra code to ensure they don't collide with each other.
  - Them the file to passed to [babel](https://babeljs.io/) where it processed twice, once for a legacy build and again for a modern build.

    - The code is written in [TypeScript](https://www.typescriptlang.org/) and includes a syntax that most browsers don't support. To accommodate, we transpile every file into a state that all browsers support with polyfills added for dumb browsers like IE.
    - The modern bundle is just an optimized version of the source code with the type system stripped out.

- Secondly the bundler does the same for all files in the `src/app/` folder as it the `src/vender/` folder.

  - The app bundle also has the output file annotated to indicate where each section of the file originated from.

- Thirdly, we gather all of the pages for the site in `src/pages/`

  - Each page is ran through the [nunjucks](https://mozilla.github.io/nunjucks/) compiler
  - If a TypeScript file exists for that page, we also transpile the file as we did above, but we keep it separate from everything else.
  - With the `app`, `vender` and optional page script, we inject the resulting scripts into the bottom of the `<body>` tag.
    - This makes use of the `nomodule` and `type="module"` attributes to serve the correct bundle to the correct browsers.
    - Older browsers like IE, don't support the `type` attribute to be anything other than `application/javascript`, so it will load the corresponding script with the `nomodule` attribute.
    - New browsers allow the `type="module"` and recognize script tags with the `nomodule` as being for legacy browser so they don't load them.

  The development server also works like this but watches for changes in any of the files above. The server then will rebuild the files needed and send the updates to your browser.