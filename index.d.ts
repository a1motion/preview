interface App {
  init(): Promise<void>;
  version: string;
}

interface Window {
  App: App;
}

declare var App: App;

declare module "postcss-preset-env";
declare module "postcss-flexbugs-fixes";

// eslint-disable-next-line quotes
type SentryType = typeof import("@sentry/browser");
declare let Sentry: SentryType;