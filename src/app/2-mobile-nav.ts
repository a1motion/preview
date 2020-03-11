App.init().then(() => {
  const hamburger = $(`.hamburger`);
  /**
   * Whenever we click on the handler,
   * we toggle its own state and the state of the sidebar container.
   */
  hamburger.on(`click`, () => {
    hamburger.toggleClass(`is-active`);
    $(`.mobile-nav`).toggleClass(`is-active`);
  });
});
