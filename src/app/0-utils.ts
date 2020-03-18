//some default pre init
const Countly = (window.Countly = window.Countly || {});
Countly.q = Countly.q || [];

//provide countly initialization parameters
// eslint-disable-next-line @typescript-eslint/camelcase
Countly.app_key = `ce6a756722f2bdae8612c3213d4404927b69ba3b`;
Countly.url = `https://t.a1motion.com`;

Countly.q.push([`track_sessions`]);
Countly.q.push([`track_pageview`]);
Countly.q.push([`track_clicks`]);
Countly.q.push([`track_scrolls`]);
Countly.q.push([`track_errors`]);
Countly.q.push([`track_links`]);
Countly.q.push([`track_forms`]);
Countly.q.push([`collect_from_forms`]);

//load countly script asynchronously
(function a() {
  const cly = document.createElement(`script`);
  cly.type = `text/javascript`;
  cly.async = true;
  //enter url of script here
  cly.src = `https://t.a1motion.com/sdk/web/countly.min.js`;
  cly.onload = function b() {
    Countly.init();
  };

  // eslint-disable-next-line prefer-destructuring
  const s = document.getElementsByTagName(`script`)[0];
  s.parentNode!.insertBefore(cly, s);
})();

App.version = `%VERSION%`;

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

App.init().then(() => {
  Sentry.init({
    dsn: `https://2b095212a1944dc8a8eaffe2af9f7a47@sentry.a1motion.com/4`,
  });
});
