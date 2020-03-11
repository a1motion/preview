interface App {
  init(): Promise<void>;
}

interface Window {
  App: App;
}

declare var App: App;

declare module "postcss-preset-env";
