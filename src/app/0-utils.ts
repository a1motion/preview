function domLoaded() {
  return (
    //@ts-ignore
    document.readyState === `complete` && document.readyState !== `loading`
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
      document.addEventListener(`DOMContentLoaded`, () => resolve());
    }
  });
};
