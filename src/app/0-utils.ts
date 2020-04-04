App.version = "%VERSION%";

function domLoaded() {
  return (
    //@ts-ignore
    document.readyState === "complete" && document.readyState !== "loading"
  );
}

/**
 * Return a promise that will resolve when the page is loaded.
 */
App.init = function init() {
  return new Promise((resolve) => {
    if (domLoaded()) {
      resolve();
    } else {
      document.addEventListener("DOMContentLoaded", () => resolve());
    }
  });
};

App.init().then(() => {
  Sentry.init({
    dsn: "https://2b095212a1944dc8a8eaffe2af9f7a47@sentry.a1motion.com/4",
    release: App.version,
    environment: "staging",
  });
});
