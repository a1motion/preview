interface App {
  init(): Promise<void>;
  version: string;
}

interface Window {
  App: App;
  Countly: any;
}

declare var App: App;

declare module "postcss-preset-env";
