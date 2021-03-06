function validateEmail(email: string) {
  const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(String(email).toLowerCase());
}

function checkForm() {
  let hasError = false;
  /**
   * Get the element of the name input.
   */
  const nameElement = $("#contact-form input#name");
  /**
   * Get the containing form-item for the name input,
   * i.e. the element with the class `form-item` that contains the name input.
   */
  const nameParent = nameElement.parent().parent();
  /**
   * Convert whatevers in the name input into a string.
   */
  const name = "" + nameElement.val();
  /**
   * Get the element where we will place errors for name.
   */
  const nameErrorElement = nameParent.find(".form-error");
  if (!name || name.length === 0) {
    nameParent.addClass("has-error");
    nameErrorElement.text("Full name is required.");
    nameElement.attr("aria-invalid", "true");
    hasError = true;
  } else {
    nameElement.removeAttr("aria-invalid");
    nameParent.removeClass("has-error");
  }

  /**
   * Get the element of the email input.
   */
  const emailElement = $("#contact-form input#email");
  /**
   * Get the containing form-item for the email input,
   * i.e. the element with the class `form-item` that contains the email input.
   */
  const emailParent = emailElement.parent().parent();
  /**
   * Convert whatevers in the email input into a string.
   */
  const email = "" + emailElement.val();
  /**
   * Get the element where we will place errors for email.
   */
  const emailErrorElement = emailParent.find(".form-error");
  /**
   * If the user didn't input an email, notify them
   */
  if (!email || email.length === 0) {
    emailParent.addClass("has-error");
    emailErrorElement.text("An email is required.");
    emailElement.attr("aria-invalid", "true");
    hasError = true;
    /**
     * If the user didn't input a valid email, notify them
     */
  } else if (!validateEmail(email)) {
    emailParent.addClass("has-error");
    emailErrorElement.text("An valid email is required.");
    emailElement.attr("aria-invalid", "true");
    hasError = true;
  } else {
    emailElement.removeAttr("aria-invalid");
    emailParent.removeClass("has-error");
  }

  /**
   * Get the element of the message textarea.
   */
  const messageElement = $("#contact-form textarea#message");
  /**
   * Get the containing form-item for the message textarea,
   * i.e. the element with the class `form-item` that contains the message textarea.
   */
  const messageParent = messageElement.parent().parent();
  /**
   * Convert whatevers in the message textarea into a string.
   */
  const message = "" + messageElement.val();
  /**
   * Get the element where we will place errors for message.
   */
  const messageErrorElement = messageParent.find(".form-error");
  if (!message || message.length === 0) {
    messageParent.addClass("has-error");
    messageErrorElement.text("An message is required.");
    messageElement.attr("aria-invalid", "true");
    hasError = true;
  } else {
    messageElement.removeAttr("aria-invalid");
    messageParent.removeClass("has-error");
  }

  if (hasError) {
    return false;
  }

  const type = $("#type").val();

  return { name, email, message, type };
}

App.init().then(() => {
  const form = $("#contact-form");
  form.on("submit", async (e) => {
    e.preventDefault();
    const results = checkForm();
    if (!results) {
      return;
    }

    await fetch("https://tlt4idowxd.execute-api.us-east-1.amazonaws.com/", {
      method: "post",
      body: JSON.stringify(results),
      headers: {
        "Content-Type": "application/json",
      },
    });

    $("#contact-form").replaceWith(
      "<h2>Thanks for contacting us!</h2><h3>We will get back to you as soon as possible.</h3>"
    );

    console.log(results);
  });
  //@ts-ignore
  $("#type").selectmenu({
    width: false,
    open(event: any) {
      $(event.target)
        .parent()
        .addClass("open");
    },
    close(event: any) {
      $(event.target)
        .parent()
        .removeClass("open");
    },
  });
});
