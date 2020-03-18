import path from "path";
import { execSync } from "child_process";
import crypto from "crypto";
import globby from "globby";
import fs from "fs";
import { transformAsync } from "@babel/core";
import Terser from "terser";
import ora from "ora";
import nunjuck from "nunjucks";
import postcss from "postcss";
import postcssPresetEnv from "postcss-preset-env";
import postcssFlexbugsFixes from "postcss-flexbugs-fixes";
import cssnano from "cssnano";
import sass from "node-sass";
import prettier from "prettier";

const VERSION = execSync(`git rev-parse --short HEAD`)
  .toString()
  .trim();

const cwd = path.join(__dirname, `..`, `src`);
const buildDir = path.join(__dirname, `..`, `build`);

/**
 * This function is used as the `[].reduce` handler, it will take an
 * array of javascript files and concat them, but wrapping them in a
 * IIFE (Immediately Invoked Function Expression) so that there isn't any conflicts.
 */
export function joinFiles(code: string, mod: string): string {
  return `${code}\n!(function(){${mod}})();`;
}

console.log();
const spinner = ora(`Loading`).start();

/**
 * The babel options used to pass to `@babel/preset-env`,
 * based on if its a modern browser or not.
 */
const babelEnvOptions = {
  modern: {
    targets: {
      esmodules: true,
    },
  },
  old: {
    targets: `>0.2%, ie >= 9`,
  },
};

/**
 * Transform a file through babel. This will remove any Typescript
 * specific syntax. If the `modern` flag is also present it
 * will backport any modern ECMA sugar syntax
 * to a version all browsers can understand.
 */
export async function babel(code: string, fileName: string, modern?: boolean) {
  const a = await transformAsync(code, {
    filename: fileName.replace(/\.js$/, `.ts`),
    presets: [
      [`@babel/preset-env`, babelEnvOptions[modern ? `modern` : `old`]],
      `@babel/preset-typescript`,
    ],
  });
  return a!.code!;
}

/**
 * This minifies the code when in production, small build
 * sizes mean the page will load faster, and reduce the
 * amount of bandwidth required to tranfer the site.
 */
function minify(code: string, modern?: boolean) {
  return Terser.minify(code, {
    parse: {
      ecma: 8,
    },
    compress: {
      ecma: modern ? 2015 : 5,
    },
    output: {
      ecma: modern ? 2015 : 5,
      comments: `some`,
    },
    module: modern,
  }).code!;
}

/**
 * Will read an array of files from the file system
 * and optional mark them with a comment.
 * @param files Array of file paths
 * @param withFileNameComment Should we include the file name in a comment?
 */
export function readFiles(
  files: string[],
  withFileNameComment: boolean = true
) {
  return Promise.all(
    files
      .map((file) => path.join(cwd, file))
      .map((file) =>
        fs.promises
          .readFile(file, { encoding: `utf-8` })
          .then((code) =>
            withFileNameComment
              ? `// file: ${path.relative(cwd, file)}\n${code}`
              : code
          )
      )
  );
}

/**
 * Transform some Javascript with some options set,
 * this is just a conditional wrapper around the babel and minify function.
 */
export async function transformJavascript(
  code: string,
  fileName: string,
  unpublished: boolean,
  modern: boolean
) {
  spinner.info(
    `[build] [tranform] [${modern ? `modern` : `legacy`}] ${fileName}`
  );
  let output = await babel(code, fileName, modern);
  if (!unpublished) {
    output = minify(output);
  }

  spinner.succeed(
    `[build] [tranform] [${modern ? `modern` : `legacy`}] ${fileName}`
  );
  return output;
}

/**
 * Transform SCSS into a acceptable css format. This runs the
 * file through the `scss` compiler. Then it runs the resulting
 * css through `postcss` which will pollfill our css to work with
 * all browser and their different browser prefixes.
 *
 * If we are in production, indicated by the `unpublished` flag, then
 * we also the css through `cssnano` which will minify the css ouput.
 */
export async function transformCSS(
  fileName: string,
  unpublished: boolean
): Promise<string> {
  return new Promise((resolve, reject) => {
    spinner.info(`[build] [tranform] [css] ${fileName}`);
    sass.render(
      {
        file: fileName,
        outputStyle: `expanded`,
      },
      (err, result) => {
        if (err) {
          reject(err);
        } else {
          postcss(
            [
              postcssFlexbugsFixes(),
              postcssPresetEnv({
                autoprefixer: {
                  flexbox: `no-2009`,
                },
                stage: 2,
                browsers: babelEnvOptions.old.targets,
              }),
              !unpublished &&
                cssnano({
                  preset: `default`,
                }),
            ].filter(Boolean)
          )
            .process(result.css, {
              from: fileName,
            })
            .then((r) => r.css)
            .then(resolve);
        }
      }
    );
  });
}

/**
 * Build out and bundle the vender folder.
 *
 * In the unpublished format, this will also prettify the output.
 */
export async function vender(unpublished: boolean, modern: boolean) {
  spinner.info(`[build] [${modern ? `modern` : `legacy`}] [vender] starting`);
  let files = await globby(`vender/**/*.js`, { cwd });
  files = await readFiles(files);
  const bundled = files.reduce(
    joinFiles,
    `// https://github.com/a1motion/preview`
  );
  const output = await transformJavascript(
    bundled,
    `vender.js`,
    unpublished,
    modern
  );

  let filename = `vender-${crypto
    .createHash(`sha1`)
    .update(output)
    .digest(`hex`)
    .slice(0, 8)}.js`;
  filename = path.join(buildDir, filename);

  await fs.promises.writeFile(
    filename,
    unpublished ? prettier.format(output, { parser: `babel` }) : output
  );
  spinner.succeed(`[build] [${modern ? `modern` : `legacy`}] [vender] done`);
  return filename;
}

/**
 * Build out and bundle the app folder.
 *
 * In the unpublished format, this will also prettify the output.
 */
export async function app(unpublished: boolean, modern: boolean) {
  spinner.info(`[build] [${modern ? `modern` : `legacy`}] [app] starting`);
  let files = (await globby(`app/**/*.ts`, { cwd })).sort((a, b) =>
    a.localeCompare(b)
  );
  files = await readFiles(files);
  /**
   * Wrap each file in a IIFE with the `App`
   * paramater that gets or creates the global `App` object.
   */
  files = files.map(
    (file) => `!(function(App){${file}})(window.App = window.App || {});`
  );
  /**
   * Bundle each of the app files into a single file, adding a comment header.
   */
  const bundled = files
    .reduce((a, b) => `${a}\n${b}`, `// https://github.com/a1motion/preview`)
    .replace(`%VERSION%`, VERSION);

  /**
   * Transform the bundled javascript with babel
   * and minify if we're in production mod.
   */
  const output = await transformJavascript(
    bundled,
    `app.js`,
    unpublished,
    modern
  );

  let filename = `app-${crypto
    .createHash(`sha1`)
    .update(output)
    .digest(`hex`)
    .slice(0, 8)}.js`;
  filename = path.join(buildDir, filename);

  await fs.promises.writeFile(
    filename,
    unpublished ? prettier.format(output, { parser: `babel` }) : output
  );
  spinner.succeed(`[build] [${modern ? `modern` : `legacy`}] [app] done`);
  return filename;
}

/**
 * Build out the app scss file.
 */
export async function appCss(unpublished: boolean) {
  spinner.info(`[build] [css] [app] starting`);
  /**
   * We run our app.scss file through the scss
   * compiler and add a comment header to the result.
   */
  const output =
    `/* https://github.com/a1motion/preview */\n` +
    (await transformCSS(path.join(cwd, `app/app.scss`), unpublished));
  let filename = `app-${crypto
    .createHash(`sha1`)
    .update(output)
    .digest(`hex`)
    .slice(0, 8)}.css`;
  filename = path.join(buildDir, filename);

  await fs.promises.writeFile(
    filename,
    unpublished ? prettier.format(output, { parser: `css` }) : output
  );
  spinner.succeed(`[build] [css] [app] done`);
  return filename;
}

export async function build(unpublished: boolean, modern: boolean) {
  spinner.info(`[build] [${modern ? `modern` : `legacy`}] starting`);
  const venderFileName = await vender(unpublished, modern);
  const appFileName = await app(unpublished, modern);
  spinner.succeed(`[build] [${modern ? `modern` : `legacy`}] done`);
  return { venderFileName, appFileName };
}

export function generateNormalScriptTag(fileName: string) {
  return `<script src="https://cdn.a1motion.com/preview/${path.relative(
    buildDir,
    fileName
  )}" defer></script>`;
}

export function generateOldScriptTag(fileName: string) {
  return `<script src="https://cdn.a1motion.com/preview/${path.relative(
    buildDir,
    fileName
  )}" nomodule="" defer></script>`;
}

export function generateModernScriptTag(fileName: string) {
  return `<script src="https://cdn.a1motion.com/preview/${path.relative(
    buildDir,
    fileName
  )}" type="module" defer></script>`;
}

export function generateStyleSheetTag(fileName: string) {
  return `<link rel="stylesheet" type="text/css" href="https://cdn.a1motion.com/preview/${path.relative(
    buildDir,
    fileName
  )}">`;
}

export const fileExists = async (path: string) =>
  !!(await fs.promises.stat(path).catch(() => false));

type ThenArg<T> = T extends PromiseLike<infer U> ? U : T;

/**
 * Build out each of the pages in our project,
 * and each of their own dependecies.
 */
async function pages(
  unpublished: boolean,
  assets: {
    oldBuild: ThenArg<ReturnType<typeof build>>;
    modernBuild: ThenArg<ReturnType<typeof build>>;
    css: ThenArg<ReturnType<typeof appCss>>;
  }
) {
  spinner.info(`[build] [pages] starting`);
  const files = (await globby(`pages/*/*.njk`, { cwd })).map((file) =>
    path.join(cwd, file)
  );
  for (const file of files) {
    const { dir: pageDir, name: pageName } = path.parse(file);
    spinner.info(`[build] [pages] [${pageName}] starting`);
    let data = {};
    if (await fileExists(path.join(pageDir, `data.json`))) {
      data = require(path.join(pageDir, `data.json`));
    }

    let output = nunjuck.render(file, data);

    let pageJavascript;
    if (await fileExists(path.join(pageDir, `${pageName}.ts`))) {
      spinner.info(`[build] [pages] [${pageName}] [js] starting`);
      const pageJavascriptCode =
        `// https://github.com/a1motion/preview\n` +
        (await fs.promises.readFile(path.join(pageDir, `${pageName}.ts`), {
          encoding: `utf-8`,
        }));
      const builds = await Promise.all([
        transformJavascript(
          pageJavascriptCode,
          `${pageName}.js`,
          unpublished,
          false
        ),
        transformJavascript(
          pageJavascriptCode,
          `${pageName}.js`,
          unpublished,
          true
        ),
      ]);
      pageJavascript = await Promise.all(
        builds.map(async (code) => {
          let filename = `${pageName}-${crypto
            .createHash(`sha1`)
            .update(code)
            .digest(`hex`)
            .slice(0, 8)}.js`;
          filename = path.join(buildDir, filename);
          await fs.promises.writeFile(
            filename,
            unpublished ? prettier.format(code, { parser: `babel` }) : code
          );
          return filename;
        })
      );
      spinner.succeed(`[build] [pages] [${pageName}] [js] done`);
    }

    let pageCss;
    if (await fileExists(path.join(pageDir, `${pageName}.scss`))) {
      spinner.info(`[build] [pages] [${pageName}] [css] starting`);
      const output =
        `/* https://github.com/a1motion/preview */\n` +
        (await transformCSS(
          path.join(pageDir, `${pageName}.scss`),
          unpublished
        ));
      let filename = `${pageName}-${crypto
        .createHash(`sha1`)
        .update(output)
        .digest(`hex`)
        .slice(0, 8)}.css`;
      filename = path.join(buildDir, filename);

      await fs.promises.writeFile(
        filename,
        unpublished ? prettier.format(output, { parser: `css` }) : output
      );
      spinner.succeed(`[build] [pages] [${pageName}] [css] done`);
      pageCss = filename;
    }

    const scripts = [
      generateOldScriptTag(assets.oldBuild.venderFileName),
      generateOldScriptTag(assets.oldBuild.appFileName),
      generateModernScriptTag(assets.modernBuild.venderFileName),
      generateModernScriptTag(assets.modernBuild.appFileName),
    ];

    if (pageJavascript) {
      if (pageJavascript[0] === pageJavascript[1]) {
        scripts.push(generateNormalScriptTag(pageJavascript[0]));
      } else {
        scripts.push(generateOldScriptTag(pageJavascript[0]));
        scripts.push(generateModernScriptTag(pageJavascript[1]));
      }
    }

    output = output.replace(
      /<\/body>/g,
      `${scripts
        .map((a, i) => `  ${i === 0 ? `` : `  `}${a}`)
        .join(`\n`)}\n  </body>`
    );
    output = output.replace(
      /<\/head>/g,
      `  ${generateStyleSheetTag(assets.css)}\n  </head>`
    );
    if (pageCss) {
      output = output.replace(
        /<\/head>/g,
        `  ${generateStyleSheetTag(pageCss)}\n  </head>`
      );
    }

    await fs.promises.writeFile(
      path.join(buildDir, `${pageName}.html`),
      unpublished ? prettier.format(output, { parser: `html` }) : output
    );
    spinner.succeed(`[build] [pages] [${pageName}] done`);
  }

  spinner.succeed(`[build] [pages] done`);
}

async function main(unpublished: boolean) {
  await fs.promises.rmdir(buildDir, { recursive: true });
  await fs.promises.mkdir(buildDir, { recursive: true });
  const [oldBuild, modernBuild] = await Promise.all([
    build(unpublished, false),
    build(unpublished, true),
  ]);
  const css = await appCss(unpublished);
  await pages(unpublished, { oldBuild, modernBuild, css });
  spinner.stop();
  console.log();
}

if (require.main === module) {
  main(!process.argv.includes(`--production`));
}
