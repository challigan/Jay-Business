/*
 * Site-wide presentation behaviour (all pages). Classic script, no dependencies.
 * - Header shadow after scrolling
 * - Mobile menu (disclosure, Esc to close)
 * - Mobile CTA bar (index and contact)
 * - Footer year
 * - Fills [data-price] figures from js/pricing.js when it is loaded
 * - Gentle reveal-on-scroll for section headers, cards and art
 * Every feature checks that what it needs exists, so a missing element or
 * script never breaks the page.
 */
(function () {
  "use strict";

  var doc = document;
  var root = doc.documentElement;
  var hasIO = "IntersectionObserver" in window;
  var reduceMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  function each(selector, fn) {
    Array.prototype.forEach.call(doc.querySelectorAll(selector), fn);
  }

  /* ---------- Header: .is-scrolled ---------- */
  var header = doc.querySelector(".site-header");
  if (header) {
    var onScroll = function () {
      header.classList.toggle("is-scrolled", (window.pageYOffset || root.scrollTop) > 8);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* ---------- Menu ---------- */
  var toggle = doc.querySelector(".menu-toggle");
  var menu = doc.getElementById("site-menu");
  if (header && toggle && menu) {
    var isOpen = function () { return toggle.getAttribute("aria-expanded") === "true"; };
    var setOpen = function (open, returnFocus) {
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      header.classList.toggle("menu-open", open);
      root.classList.toggle("menu-lock", open);
      if (!open && returnFocus) toggle.focus();
    };
    toggle.addEventListener("click", function () { setOpen(!isOpen()); });
    doc.addEventListener("keydown", function (e) {
      if ((e.key === "Escape" || e.key === "Esc") && isOpen()) setOpen(false, true);
    });
    menu.addEventListener("click", function (e) {
      if (e.target.closest && e.target.closest("a")) setOpen(false);
    });
    if (window.matchMedia) {
      var wide = window.matchMedia("(min-width: 64rem)");
      var onWide = function () { if (wide.matches && isOpen()) setOpen(false); };
      if (wide.addEventListener) wide.addEventListener("change", onWide);
      else if (wide.addListener) wide.addListener(onWide);
    }
  }

  /* ---------- Footer year ---------- */
  each("[data-year]", function (el) { el.textContent = String(new Date().getFullYear()); });

  /* ---------- Pricing figures ---------- */
  var P = window.PRICING;
  if (P && P.travel && P.frequencies) {
    var fmt = typeof window.formatGBP === "function"
      ? window.formatGBP
      : function (pence) { return "£" + (pence / 100).toFixed(2); };
    var pence = function (pounds) { return Math.round(pounds * 100); };

    var values = {
      freeMiles: String(P.travel.freeMiles),
      perMile: fmt(pence(P.travel.perMileBeyond))
    };
    Object.keys(P.frequencies).forEach(function (key) {
      values["disc-" + key] = Math.round((P.frequencies[key].discount || 0) * 100) + "%";
    });

    // "What a typical block costs": computed by the real calculator, within the free radius.
    var typicalOk = false;
    if (typeof window.calculateQuote === "function") {
      try {
        [
          { hardFloors: 3, carpetFloors: 0, lifts: 0, flats: 6, frequency: "weekly" },
          { hardFloors: 4, carpetFloors: 0, lifts: 1, flats: 12, frequency: "fortnightly" },
          { hardFloors: 0, carpetFloors: 1, lifts: 0, flats: 2, frequency: "monthly" }
        ].forEach(function (inputs, i) {
          inputs.distanceMiles = 0;
          var q = window.calculateQuote(inputs, P);
          values["typical-" + (i + 1)] = fmt(q.total);
          if (q.monthly != null) values["typical-" + (i + 1) + "-month"] = fmt(q.monthly);
        });
        typicalOk = true;
      } catch (err) {
        typicalOk = false;
      }
    }

    each("[data-price]", function (el) {
      var v = values[el.getAttribute("data-price")];
      if (v != null) el.textContent = v;
    });
    each("[data-needs-pricing]", function (el) {
      if (el.hasAttribute("data-needs-calc") && !typicalOk) return;
      el.hidden = false;
    });
    each("[data-pricing-fallback]", function (el) { el.hidden = true; });
  }

  /* ---------- Mobile CTA bar ---------- */
  var bar = doc.querySelector(".cta-bar");
  if (bar) {
    var showBar = function (show) {
      bar.classList.toggle("is-visible", show);
      doc.body.classList.toggle("has-cta-bar", show);
    };
    var targets = [doc.querySelector(".hero-actions"), doc.querySelector(".site-footer")].filter(Boolean);
    if (hasIO && targets.length) {
      var inView = [];
      var barIO = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          inView[targets.indexOf(entry.target)] = entry.isIntersecting;
        });
        showBar(!inView.some(Boolean));
      });
      targets.forEach(function (t) { barIO.observe(t); });
    } else {
      showBar(true);
    }
  }

  /* ---------- Reveal ---------- */
  var revealEls = doc.querySelectorAll("[data-reveal]");
  if (revealEls.length) {
    if (hasIO && !reduceMotion) {
      var revealIO = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            revealIO.unobserve(entry.target);
          }
        });
      }, { rootMargin: "0px 0px -6% 0px", threshold: 0.05 });
      Array.prototype.forEach.call(revealEls, function (el) { revealIO.observe(el); });
    } else {
      Array.prototype.forEach.call(revealEls, function (el) { el.classList.add("is-visible"); });
    }
  }
})();
