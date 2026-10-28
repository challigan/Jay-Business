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
  var situationField = document.getElementById("situation-field");
  var buildingPostcode = document.getElementById("building-postcode");

  var TOPIC_LABELS = {
    quote: "About a quote or site visit",
    documents: "Insurance & documents",
    resident: "I’m a resident",
    other: "Something else"
  };
  var TOPIC_PREFILL = {
    documents: "Please send your current public liability certificate, a sample risk assessment and method statement, and your COSHH sheets.\n\nBuilding address or postcode:\nMy role:",
    resident: "Building name and address:\nWhat’s happened (missed clean, spillage, something else):"
  };

  function currentTopic() {
    var checked = form.querySelector('input[name="topic"]:checked');
    return checked ? checked.value : "";
  }

  function isTemplate(text) {
    return Object.keys(TOPIC_PREFILL).some(function (k) { return TOPIC_PREFILL[k] === text; });
  }

  // Show the "current situation" question only where it helps, and fill a
  // topic template into the message, but never over something already typed.
  function applyTopic() {
    var topic = currentTopic();
    situationField.hidden = topic === "documents" || topic === "resident";
    if (!message.value.trim() || isTemplate(message.value)) {
      message.value = TOPIC_PREFILL[topic] || "";
    }
    message.rows = message.value ? 12 : 8;
  }

  function selectTopic(value) {
    var radio = form.querySelector('input[name="topic"][value="' + value + '"]');
    if (radio) radio.checked = true;
  }

  // Pre-fill from a quote passed in the URL (?quote=...), or a topic (?topic=...)
  var params = new URLSearchParams(window.location.search);
  var quote = params.get("quote");
  var topicParam = params.get("topic");
  if (quote) {
    message.value = quote;
    document.getElementById("quote-banner").hidden = false;
    topicParam = "quote";
    var pc = /^Postcode:\s*(.+)$/m.exec(quote);
    if (pc && buildingPostcode && !buildingPostcode.value) buildingPostcode.value = pc[1].trim();
  }
  if (topicParam && TOPIC_LABELS[topicParam]) selectTopic(topicParam);
  applyTopic();

  form.addEventListener("change", function (e) {
    if (e.target.name === "topic") applyTopic();
  });

  // In-page links that set the topic (e.g. "Request our insurance documents")
  Array.prototype.forEach.call(document.querySelectorAll("[data-set-topic]"), function (link) {
    link.addEventListener("click", function (e) {
      e.preventDefault();
      selectTopic(link.getAttribute("data-set-topic"));
      applyTopic();
      refresh();
      form.scrollIntoView({ block: "start" });
      var checked = form.querySelector('input[name="topic"]:checked');
      if (checked) checked.focus({ preventScroll: true });
    });
  });

  var required = ["name", "email", "message"];
  var submit = form.querySelector("button[type=submit]");

  function errorsFor() {
    var errs = {};
    if (!form.elements.name.value.trim()) errs.name = "Enter your name.";
    var email = form.elements.email.value.trim();
    if (!email) errs.email = "Enter your email address.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = "Enter a valid email address.";
    if (!message.value.trim() || isTemplate(message.value)) errs.message = "Enter a message.";
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

  // Extra details, in the order they appear in the email
  function extraLines(data) {
    var topic = currentTopic();
    var lines = [];
    if (topic) lines.push("Topic: " + TOPIC_LABELS[topic]);
    if (data.get("role")) lines.push("Role: " + data.get("role"));
    if (data.get("building")) lines.push("Building: " + data.get("building"));
    if (data.get("building-postcode")) lines.push("Postcode: " + data.get("building-postcode"));
    if (!situationField.hidden && data.get("situation")) lines.push("Situation: " + data.get("situation"));
    return lines;
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    required.forEach(function (k) { touched[k] = true; });
    if (Object.keys(refresh()).length) return;

    var data = new FormData(form);
    if (situationField.hidden) data.delete("situation");
    var topic = currentTopic();
    var subject = "Cleaning enquiry" + (topic ? ": " + TOPIC_LABELS[topic] : "");

    if (CONTACT_CONFIG.mode === "mailto") {
      var details = extraLines(data);
      var body = "Name: " + data.get("name") + "\nEmail: " + data.get("email") +
        (data.get("phone") ? "\nPhone: " + data.get("phone") : "") +
        (details.length ? "\n" + details.join("\n") : "") +
        "\n\n" + data.get("message");
      window.location.href = "mailto:" + CONTACT_CONFIG.email +
        "?subject=" + encodeURIComponent(subject) +
        "&body=" + encodeURIComponent(body);
      status.textContent = "Your email app should open with your message ready to send.";
      return;
    }

    if (topic) data.set("topic", TOPIC_LABELS[topic]);
    data.set(CONTACT_CONFIG.mode === "formspree" ? "_subject" : "subject", subject);

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
        applyTopic();
        status.textContent = "Thanks, your enquiry has arrived. Jay will reply within one working day.";
      })
      .catch(function () {
        status.textContent = "Sorry, something went wrong. Please email us at " + CONTACT_CONFIG.email + ".";
      })
      .then(refresh);
  });

  refresh();
});
