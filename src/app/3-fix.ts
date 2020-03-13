App.init().then(() => {
  if (location.hostname === `webpages.uncc.edu`) {
    $(`a[href^="/"]`).each(function fixHrefs() {
      const link = $(this);
      const oldHref = link.attr(`href`);
      const newHref = oldHref === `/` ? `./index.html` : `.${oldHref}.html`;
      link.attr(`href`, newHref);
    });
  }
});
