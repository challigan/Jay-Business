/*
 * Contact form.
 *
 * FORM SERVICE HOOK: choose how enquiries are sent by editing CONTACT_CONFIG.
 *   mode: "mailto"    - opens the visitor's email app (works anywhere, no setup)
 *   mode: "netlify"   - Netlify Forms (only when hosted on Netlify; the form
 *                       in contact.html already carries data-netlify="true")
 *   mode: "formspree" - posts to a Formspree endpoint, e.g.
 *                       "https://formspree.io/f/your-id"
 */
var CONTACT_CONFIG = {
  mode: "mailto",
  email: "hello@example.com",
  formspreeEndpoint: ""
};

document.addEventListener("DOMContentLoaded", function () {
  var form = document.getElementById("contact-form");
  if (!form) return;

  var status = document.getElementById("form-status");
  var message = document.getElementById("message");

  // Pre-fill from a quote passed in the URL (?quote=...)
  var quote = new URLSearchParams(window.location.search).get("quote");
  if (quote) {
    message.value = quote;
    document.getElementById("quote-banner").hidden = false;
  }

  var required = ["name", "email", "message"];
  var submit = form.querySelector("button[type=submit]");

  function errorsFor() {
    var errs = {};
    if (!form.elements.name.value.trim()) errs.name = "Enter your name.";
    var email = form.elements.email.value.trim();
    if (!email) errs.email = "Enter your email address.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = "Enter a valid email address.";
    if (!message.value.trim()) errs.message = "Enter a message.";
    return errs;
  }

  var touched = {};
  function refresh() {
    var errs = errorsFor();
    required.forEach(function (key) {
      var show = touched[key] && errs[key];
      document.getElementById("err-" + key).textContent = show ? errs[key] : "";
      form.elements[key].setAttribute("aria-invalid", show ? "true" : "false");
    });
    submit.disabled = Object.keys(errs).length > 0;
    return errs;
  }

  form.addEventListener("input", refresh);
  form.addEventListener("focusout", function (e) {
    if (required.indexOf(e.target.name) !== -1) { touched[e.target.name] = true; refresh(); }
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    required.forEach(function (k) { touched[k] = true; });
    if (Object.keys(refresh()).length) return;

    var data = new FormData(form);

    if (CONTACT_CONFIG.mode === "mailto") {
      var body = "Name: " + data.get("name") + "\nEmail: " + data.get("email") +
        (data.get("phone") ? "\nPhone: " + data.get("phone") : "") +
        "\n\n" + data.get("message");
      window.location.href = "mailto:" + CONTACT_CONFIG.email +
        "?subject=" + encodeURIComponent("Cleaning enquiry") +
        "&body=" + encodeURIComponent(body);
      status.textContent = "Your email app should open with your message ready to send.";
      return;
    }

    var request = CONTACT_CONFIG.mode === "netlify"
      ? fetch("/", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams(data).toString()
        })
      : fetch(CONTACT_CONFIG.formspreeEndpoint, {
          method: "POST",
          headers: { Accept: "application/json" },
          body: data
        });

    submit.disabled = true;
    request
      .then(function (res) {
        if (!res.ok) throw new Error(res.status);
        form.reset();
        status.textContent = "Thanks – we've received your enquiry and will be in touch soon.";
      })
      .catch(function () {
        status.textContent = "Sorry, something went wrong. Please email us at " + CONTACT_CONFIG.email + ".";
      })
      .then(refresh);
  });

  refresh();
});
