import path from "path";
import fs from "fs";
import chokidar from "chokidar";
import globby from "globby";
import express from "express";
import nunjuck from "nunjucks";
import {
  readFiles,
  transformJavascript,
  joinFiles,
  fileExists,
  transformCSS,
} from "./build";

export function debounce<T extends (...params: any[]) => void>(
  cb: T,
  wait = 20
) {
  let h: NodeJS.Timeout;
  const callable = (...args: any) => {
    clearTimeout(h);
    h = setTimeout(() => cb(...args), wait);
  };

  return <T>(<any>callable);
}

class SSEClient {
  location: string;
  res: express.Response;
  constructor(req: express.Request, res: express.Response) {
    this.location = (req.query.location as string).slice(1);
    if (this.location === ``) {
      this.location = `index`;
    }

    this.res = res;
  }
  update(location?: string) {
    if (!location || this.location === location) {
      this.res.write(`event: update\ndata: ""\n\n`);
    }
  }
}
const clients = new Set<SSEClient>();
const updateAllClients = (location?: string) => {
  clients.forEach((client) => {
    client.update(location);
  });
};

const globalJavascriptAssets: string[] = [];
const pages: string[] = [];

const cwd = path.join(__dirname, `..`, `src`);
const buildDir = path.join(__dirname, `..`, `build`);

const vender = async () => {
  let files = await globby(`vender/**/*.js`, { cwd });
  files = await readFiles(files);
  const bundled = files.reduce(joinFiles, ``);
  const output = await transformJavascript(bundled, `vender.js`, true, false);
  await fs.promises.writeFile(path.join(buildDir, `vender.js`), output);
  if (!globalJavascriptAssets.includes(`vender.js`)) {
    globalJavascriptAssets.push(`vender.js`);
  }
};

const appJS = async () => {
  let files = (await globby(`app/**/*.ts`, { cwd })).sort((a, b) =>
    a.localeCompare(b)
  );
  files = await readFiles(files);
  files = files.map(
    (file) => `!(function(App){${file}})(window.App = window.App || {});`
  );
  const bundled = files.reduce(joinFiles, ``);
  const output = await transformJavascript(bundled, `app.js`, true, false);
  await fs.promises.writeFile(path.join(buildDir, `app.js`), output);
  if (!globalJavascriptAssets.includes(`app.js`)) {
    globalJavascriptAssets.push(`app.js`);
  }
};

const appCSS = async () => {
  const output = await transformCSS(path.join(cwd, `app/app.scss`), true);
  await fs.promises.writeFile(path.join(buildDir, `app.css`), output);
};

function generateNormalScriptTag(fileName: string) {
  return `<script src="/${fileName}" defer></script>`;
}

function generateStyleSheetTag(fileName: string) {
  return `<link rel="stylesheet" type="text/css" href="/${fileName}">`;
}

nunjuck.configure({ noCache: true });

const page = (file: string) =>
  debounce(async () => {
    const { dir: pageDir, name: pageName } = path.parse(file);
    if (!pages.includes(pageName)) {
      pages.push(pageName);
    }

    let data = {};
    if (await fileExists(path.join(pageDir, `data.json`))) {
      data = require(path.join(pageDir, `data.json`));
    }

    let output = nunjuck.render(file, data);
    output = output.replace(
      /<\/body>/g,
      `${globalJavascriptAssets
        .map(generateNormalScriptTag)
        .map((a, i) => `  ${i === 0 ? `` : `  `}${a}`)
        .join(`\n`)}\n  </body>`
    );
    if (await fileExists(path.join(pageDir, `${pageName}.ts`))) {
      output = output.replace(
        /<\/body>/g,
        `  ${generateNormalScriptTag(`${pageName}.js`)}\n  </body>`
      );
    }

    output = output.replace(
      /<\/head>/g,
      `  ${generateStyleSheetTag(`app.css`)}\n  </head>`
    );

    if (await fileExists(path.join(pageDir, `${pageName}.scss`))) {
      output = output.replace(
        /<\/head>/g,
        `  ${generateStyleSheetTag(`${pageName}.css`)}\n  </head>`
      );
    }

    await fs.promises.writeFile(
      path.join(buildDir, `${pageName}.html`),
      output
    );
    updateAllClients(pageName);
  }, 250);

const pageJS = (file: string) =>
  debounce(async () => {
    const { dir: pageDir, name: pageName } = path.parse(file);
    const pageJavascriptCode = await fs.promises.readFile(
      path.join(pageDir, `${pageName}.ts`),
      { encoding: `utf-8` }
    );
    const code = await transformJavascript(
      pageJavascriptCode,
      `${pageName}.js`,
      true,
      false
    );
    await fs.promises.writeFile(path.join(buildDir, `${pageName}.js`), code);
    updateAllClients(pageName);
  }, 250);

const pageCSS = (file: string) =>
  debounce(async () => {
    const { dir: pageDir, name: pageName } = path.parse(file);
    const output = await transformCSS(
      path.join(pageDir, `${pageName}.scss`),
      true
    );
    await fs.promises.writeFile(path.join(buildDir, `${pageName}.css`), output);
    updateAllClients(pageName);
  }, 250);

function liveReloadable() {
  const source = new EventSource(
    `/_sse?location=${encodeURIComponent(location.pathname)}`
  );
  source.addEventListener(`update`, () => {
    document.location.reload();
  });
}

async function main() {
  await fs.promises.rmdir(buildDir, { recursive: true });
  await fs.promises.mkdir(buildDir, { recursive: true });
  await vender();
  await appJS();
  await appCSS();

  chokidar
    .watch(`app/**/*.ts`, {
      cwd,
      ignoreInitial: true,
    })
    .on(`add`, async () => {
      await appJS();
      updateAllClients();
    })
    .on(`change`, async () => {
      await appJS();
      updateAllClients();
    });
  chokidar
    .watch(`vender/**/*.js`, {
      cwd,
      ignoreInitial: true,
    })
    .on(`add`, async () => {
      await vender();
      updateAllClients();
    })
    .on(`change`, async () => {
      await vender();
      updateAllClients();
    });
  chokidar
    .watch(`app/**/*.scss`, {
      cwd,
      ignoreInitial: true,
    })
    .on(`add`, async () => {
      await appCSS();
      updateAllClients();
    })
    .on(`change`, async () => {
      await appCSS();
      updateAllClients();
    });

  const pageHolders: { [key: string]: any } = {};

  chokidar
    .watch(`pages/*/*.njk`, {
      cwd,
    })
    .on(`add`, async (file) => {
      const { name: pageName } = path.parse(file);
      if (!pageHolders[pageName]) {
        pageHolders[pageName] = page(path.join(cwd, file));
      }

      pageHolders[pageName]();
    })
    .on(`change`, async (file) => {
      const { name: pageName } = path.parse(file);
      if (!pageHolders[pageName]) {
        pageHolders[pageName] = page(path.join(cwd, file));
      }

      pageHolders[pageName]();
    });

  chokidar
    .watch(`templates/*.njk`, { cwd, ignoreInitial: true })
    .on(`add`, () => {
      for (const handler of Object.values(pageHolders)) {
        handler();
      }
    })
    .on(`change`, () => {
      for (const handler of Object.values(pageHolders)) {
        handler();
      }
    });

  const pageJSHolders: { [key: string]: any } = {};
  chokidar
    .watch(`pages/*/*.ts`, {
      cwd,
    })
    .on(`add`, async (file) => {
      const { name: pageName } = path.parse(file);
      if (!pageJSHolders[pageName]) {
        pageJSHolders[pageName] = pageJS(path.join(cwd, file));
      }

      pageJSHolders[pageName]();
    })
    .on(`change`, async (file) => {
      const { name: pageName } = path.parse(file);
      if (!pageJSHolders[pageName]) {
        pageJSHolders[pageName] = pageJS(path.join(cwd, file));
      }

      pageJSHolders[pageName]();
    });
  const pageCSSHolders: { [key: string]: any } = {};
  chokidar
    .watch(`pages/*/*.scss`, {
      cwd,
    })
    .on(`add`, async (file) => {
      const { name: pageName } = path.parse(file);
      if (!pageCSSHolders[pageName]) {
        pageCSSHolders[pageName] = pageCSS(path.join(cwd, file));
      }

      pageCSSHolders[pageName]();
    })
    .on(`change`, async (file) => {
      const { name: pageName } = path.parse(file);
      if (!pageCSSHolders[pageName]) {
        pageCSSHolders[pageName] = pageCSS(path.join(cwd, file));
      }

      pageCSSHolders[pageName]();
    });
  const app = express();
  app.get(`*`, async (req, res, next) => {
    const url = req.url === `/` ? `index` : req.url.slice(1);
    if (pages.includes(url)) {
      let page = await fs.promises.readFile(
        path.join(buildDir, `${url}.html`),
        `utf-8`
      );
      page = page.replace(
        /<\/body>/g,
        `<script>(${liveReloadable.toString()})()</script></body>`
      );
      return res.type(`html`).send(page);
    }

    return next();
  });
  app.use(express.static(buildDir));
  app.get(`/_sse`, (req, res) => {
    const client = new SSEClient(req, res);
    res.status(200).set({
      Connection: `keep-alive`,
      "Content-Type": `text/event-stream`,
    });
    res.flushHeaders();
    clients.add(client);
    res.on(`finish`, () => {
      clients.delete(client);
    });
  });

  app.listen(3000);
}

main();
