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

/**
 * Returns a function, that, as long as it continues to be invoked, will not
 * be triggered. The function will be called after it stops being called for
 * N milliseconds.
 */
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

/**
 * The core of the auto-updating functionality of the `dev` program.
 *
 * This class wraps a incoming request from express.
 * It will, when notified by the dev server, indicate to the client that it needs
 * to refresh.
 */
class SSEClient {
  location: string;
  res: express.Response;
  constructor(req: express.Request, res: express.Response) {
    /**
     * Mark the client and keep its location in memory.
     */
    this.location = (req.query.location as string).slice(1);
    if (this.location === ``) {
      this.location = `index`;
    }

    this.res = res;
  }
  /**
   * If location is provided and this client has
   * the same location, then we indicate to the client to refresh.
   * This is used when a page specific asset is updated.
   *
   * If no location is provided then we just force the client to refresh,
   * this is used when a global asset is updated.
   */
  update(location?: string) {
    if (!location || this.location === location) {
      this.res.write(`event: update\ndata: ""\n\n`);
    }
  }
}
/**
 * Keep all of the clients in a set.
 */
const clients = new Set<SSEClient>();
/**
 * This function simpily calls the `SSEClient.prototype.update`
 * function on all of the connected clients.
 */
const updateAllClients = (location?: string) => {
  clients.forEach((client) => {
    client.update(location);
  });
};

/**
 * A list of global javascript assets.
 * This is mostly a constant with the values: ['app.js', 'vender.js'],
 * but exists for extendable if ever needed in the future.
 */
const globalJavascriptAssets: string[] = [];
/**
 * This is a list of all known pages.
 */
const pages: string[] = [];

const cwd = path.join(__dirname, `..`, `src`);
const buildDir = path.join(__dirname, `..`, `build`);

/**
 * Build out `vender.js`
 */
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

/**
 * Build out `app.js`
 */
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

/**
 * Build out `app.css`
 */
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

/**
 * This function is sent to the client.
 *
 * It establishes a connect to the responding server,
 * and waits for the `update` event to occur.
 * When it recieves that event, it refreshes the page.
 *
 * * This function isn't actually sent to the client.
 * * Instead we read the source of the function and sent its
 * * string represenation instead.
 * * See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/toString
 */
function liveReloadable() {
  const source = new EventSource(
    // eslint-disable-next-line quotes
    "/_sse?location=" + encodeURIComponent(location.pathname)
  );
  // eslint-disable-next-line quotes, prefer-arrow-callback
  source.addEventListener("update", function update() {
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

  /**
   * This is a collection of page builders.
   *
   * In an effort to import proformance,
   * we don't need to rebuild each page every time the page is saved.
   * (I have a habit of spamming the save button when saving a file.)
   *
   * So each page has it own debounced builder function that forces a wait time of `250ms`.
   */
  const pageHolders: { [key: string]: any } = {};

  /**
   * This watchs all of the page templates, and notifies us when any of them is updated.
   *
   * This also triggers an update on the initial run for each page.
   *
   * When a page is updated, if create a page builder for it, if it doesn't have one yet.
   * Then we excute the page builder.
   */
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

  /**
   * Whenever a template is added or changed,
   * it's unclear (for now), what pages use that template,
   * so we just execute all of the page builders we have so far.
   */
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

  /**
   * The following two sections are the same as above for the page templates,
   * however these are for the page javascript and page css files.
   */

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

  /**
   * Start an `express` server.
   * This is a small HTTP server for node.js
   */
  const app = express();
  /**
   * Whenever we get a request, we look at the url and see if its a page we have.
   * If we have that page will go read the page off the disk, and add a short script to the end.
   * This script, which is defined above as `liveReloadable`, connects to this server, and waits for
   * instructions to refresh the page.
   */
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
  /**
   * This is a simple middleware that is build into `express`,
   * it will just serve the client any file in the given directory,
   * in this instance we serve the `./build` directory.
   */
  app.use(express.static(buildDir));

  /**
   * This is where all of the live reloadable stuff starts.
   *
   * Whenever a page is served to the client. The client will
   * connect back to this server using Server-Sent Events.
   *
   */
  app.get(`/_sse`, (req, res) => {
    /**
     * Wrap the client in a SEEClient class.
     */
    const client = new SSEClient(req, res);
    /**
     * Set the headers for this request.
     */
    res.status(200).set({
      Connection: `keep-alive`,
      "Content-Type": `text/event-stream`,
    });
    /**
     * Flush (aka write) the headers to the client.
     * This is required for SSE to work properly.
     */
    res.flushHeaders();
    /**
     * Add this client to our set of connected clients.
     */
    clients.add(client);
    /**
     * Whenever the client disconnects, for any reason,
     * we remove them from our set of clients.
     */
    res.on(`finish`, () => {
      clients.delete(client);
    });
  });

  app.listen(3000);
}

main();
