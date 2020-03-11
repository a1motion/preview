function handler(e: any) {
  const { target } = e;
  const { value } = target;
  setTimeout(() => {
    /**
     * If the input is empty we remove the label,
     * as the placeholder will be displayed inside.
     *
     * If it's not empty we activate the label.
     */
    if (value.length === 0) {
      $(target)
        .parent()
        .removeClass(`active`);
    } else {
      $(target)
        .parent()
        .addClass(`active`);
    }
  }, 100);
}

App.init().then(() => {
  /**
   * Bind to the input events for all custom inputs and textareas.
   * Whenever the contents of these change we have to toggle the `active` class on the parent.
   * This will cause the floating label to either activate or deactivate.
   */
  $(`body`).on(`input`, `label.input-field input`, handler);
  $(`body`).on(`input propertychange`, `label.input-field textarea`, handler);
});
