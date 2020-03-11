interface App {
  init(): Promise<void>;
  version: string;
}

interface Window {
  App: App;
}

declare var App: App;

declare module "postcss-preset-env";
