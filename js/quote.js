/*
 * Quote calculation and form logic.
 * calculateQuote() is pure (no DOM) so it can be tested with Node.
 */

function toPence(pounds) {
  return Math.round(pounds * 100 + Number.EPSILON * 100);
}

function formatGBP(pence) {
  return "£" + (pence / 100).toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/*
 * inputs: {
 *   hardFloors, carpetFloors, lifts, flats,
 *   frequency: key of pricing.frequencies,
 *   distanceMiles: number, or null if unknown (travel to be confirmed)
 * }
 * All amounts returned are in pence to avoid floating-point drift.
 */
function calculateQuote(inputs, pricing) {
  var freq = pricing.frequencies[inputs.frequency];
  if (!freq) throw new Error("Unknown frequency: " + inputs.frequency);

  var lines = [];
  function add(label, detail, pounds) {
    lines.push({ label: label, detail: detail, pence: toPence(pounds) });
  }

  add("Base charge", "", pricing.baseCharge);
  if (inputs.hardFloors > 0) {
    add("Hard floors", inputs.hardFloors + " × " + formatGBP(toPence(pricing.floorRates.hard)),
      inputs.hardFloors * pricing.floorRates.hard);
  }
  if (inputs.carpetFloors > 0) {
    add("Carpeted floors", inputs.carpetFloors + " × " + formatGBP(toPence(pricing.floorRates.carpet)),
      inputs.carpetFloors * pricing.floorRates.carpet);
  }
  add("Lifts", inputs.lifts + " × " + formatGBP(toPence(pricing.perLift)),
    inputs.lifts * pricing.perLift);
  add("Flats", inputs.flats + " × " + formatGBP(toPence(pricing.perFlat)),
    inputs.flats * pricing.perFlat);

  var travelTbc = inputs.distanceMiles == null;
  if (travelTbc) {
    lines.push({ label: "Travel", detail: "to be confirmed", pence: 0, tbc: true });
  } else {
    var chargeableMiles = Math.max(0, inputs.distanceMiles - pricing.travel.freeMiles);
    var detail = inputs.distanceMiles.toFixed(1) + " miles" +
      (chargeableMiles > 0
        ? " (" + chargeableMiles.toFixed(1) + " beyond " + pricing.travel.freeMiles + " free)"
        : " (within " + pricing.travel.freeMiles + " free miles)");
    add("Travel", detail, chargeableMiles * pricing.travel.perMileBeyond);
  }

  var subtotal = lines.reduce(function (sum, l) { return sum + l.pence; }, 0);
  var discount = Math.round(subtotal * freq.discount);
  var total = subtotal - discount;
  var monthly = freq.visitsPerYear ? Math.round((total * freq.visitsPerYear) / 12) : null;

  return {
    lines: lines,
    subtotal: subtotal,
    discountRate: freq.discount,
    discount: discount,
    total: total,
    monthly: monthly,
    frequencyLabel: freq.label,
    travelTbc: travelTbc
  };
}

if (typeof module !== "undefined") {
  module.exports = { calculateQuote: calculateQuote, formatGBP: formatGBP };
}

/* ---------------- Page wiring (quote.html only) ---------------- */
if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", function () {
    var form = document.getElementById("quote-form");
    if (!form) return;

    var el = function (id) { return document.getElementById(id); };
    var fields = {
      postcode: el("postcode"),
      floors: el("floors"),
      hardFloors: el("hard-floors"),
      carpetFloors: el("carpet-floors"),
      lifts: el("lifts"),
      flats: el("flats"),
      frequency: el("frequency")
    };
    var mixGroup = el("mix-group");
    var submitBtn = el("calculate");
    var resultBox = el("quote-result");
    var touched = {};
    var lookups = {};          // normalised postcode -> { promise, result, retry }
    var lastQuote = null;      // { values, quote, lookup }
    var busy = false;
    var carpetTouched = false;
    var reduceMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    var BASE_NAME = "Jarrow";
    var FREQ_KEYS = Object.keys(PRICING.frequencies);
    var STEP_NAMES = { 1: "Postcode", 2: "Floors", 3: "Floor type", 4: "Lifts", 5: "Flats", 6: "How often" };
    var FREQ_GUIDE = {
      weekly: "Blocks with a lift or 12+ flats",
      fortnightly: "Around 6 to 12 flats",
      monthly: "Small conversions and quiet blocks",
      oneoff: "Handovers, move-ins or a deep reset"
    };
    var LOOKUP_MSG = {
      not_found: "We couldn’t find that postcode, so travel is to be confirmed.",
      network: "We couldn’t check the distance right now, so travel is to be confirmed.",
      invalid: "That postcode doesn’t look right, so travel is to be confirmed."
    };
    var money = function (pounds) { return formatGBP(toPence(pounds)); };
    var pct = function (rate) { return Math.round(rate * 100) + "%"; };
    var svgIcon = function (id) {
      return '<svg class="i" aria-hidden="true" focusable="false"><use href="#i-' + id + '"/></svg>';
    };

    /* ----- Content generated from PRICING ----- */
    FREQ_KEYS.forEach(function (key) {
      var f = PRICING.frequencies[key];
      var opt = document.createElement("option");
      opt.value = key;
      opt.textContent = f.label + (f.discount ? " (" + pct(f.discount) + " off)" : "");
      fields.frequency.appendChild(opt);
    });
    el("free-miles").textContent = PRICING.travel.freeMiles;

    // Rate card ("How we price")
    var rateCard = el("rate-card");
    if (rateCard) {
      var rates = {
        base: money(PRICING.baseCharge) + " per visit",
        hard: money(PRICING.floorRates.hard) + " per floor",
        carpet: money(PRICING.floorRates.carpet) + " per floor",
        lift: money(PRICING.perLift) + " each",
        flat: money(PRICING.perFlat) + " each",
        mile: money(PRICING.travel.perMileBeyond),
        discounts: FREQ_KEYS.filter(function (k) { return PRICING.frequencies[k].discount > 0; })
          .map(function (k) { return PRICING.frequencies[k].label.toLowerCase() + " " + pct(PRICING.frequencies[k].discount) + " off"; })
          .join(" and ") || "same price every visit"
      };
      Array.prototype.forEach.call(rateCard.querySelectorAll("[data-rate]"), function (node) {
        node.textContent = rates[node.getAttribute("data-rate")];
      });
      rateCard.hidden = false;
      if (el("rate-nojs")) el("rate-nojs").hidden = true;
    }

    // Frequency helper cards
    var bestKey = null;
    FREQ_KEYS.forEach(function (k) {
      var d = PRICING.frequencies[k].discount;
      if (d > 0 && (bestKey === null || d > PRICING.frequencies[bestKey].discount)) bestKey = k;
    });
    var freqCards = {};
    var freqWrap = el("freq-cards");
    if (freqWrap) {
      FREQ_KEYS.forEach(function (k) {
        var f = PRICING.frequencies[k];
        var b = document.createElement("button");
        b.type = "button";
        b.className = "freq-card";
        b.setAttribute("data-freq", k);
        b.setAttribute("aria-pressed", "false");
        var html = '<span class="fc-label"></span>';
        if (f.discount > 0 || k === bestKey) {
          html += '<span class="fc-tags">' +
            (f.discount > 0 ? '<span class="fc-save">Save ' + pct(f.discount) + "</span>" : "") +
            (k === bestKey ? '<span class="fc-best">Best value</span>' : "") + "</span>";
        }
        if (FREQ_GUIDE[k]) html += '<span class="fc-guide">' + FREQ_GUIDE[k] + "</span>";
        html += '<span class="fc-price" hidden></span>';
        b.innerHTML = html;
        b.querySelector(".fc-label").textContent = f.label;
        freqWrap.appendChild(b);
        freqCards[k] = b;
      });
      el("freq-help").hidden = false;
      freqWrap.addEventListener("click", function (e) {
        var card = e.target.closest(".freq-card");
        if (!card) return;
        fields.frequency.value = card.getAttribute("data-freq");
        fields.frequency.dispatchEvent(new Event("change", { bubbles: true }));
      });
    }

    /* ----- Helpers ----- */
    function floorType() {
      var checked = form.querySelector('input[name="floor-type"]:checked');
      return checked ? checked.value : null;
    }

    function intValue(input) {
      var v = input.value.trim();
      if (v === "" || !/^\d+$/.test(v)) return NaN;
      return parseInt(v, 10);
    }

    // Returns { errors: {field: message}, values }
    function validate() {
      var errors = {};
      var values = {};

      if (!fields.postcode.value.trim()) errors.postcode = "Enter the building’s postcode.";
      else if (!Distance.isValidPostcode(fields.postcode.value)) errors.postcode = "Enter a valid UK postcode, e.g. NE32 3DT.";
      values.postcode = Distance.normalisePostcode(fields.postcode.value);

      var floors = intValue(fields.floors);
      if (!(floors >= 1)) errors.floors = "Enter at least 1 floor (whole number).";
      values.floors = floors;

      var type = floorType();
      if (!type) errors.floorType = "Choose a floor type.";
      if (type === "hard") { values.hardFloors = floors; values.carpetFloors = 0; }
      if (type === "carpet") { values.hardFloors = 0; values.carpetFloors = floors; }
      if (type === "mix") {
        var h = intValue(fields.hardFloors);
        var c = intValue(fields.carpetFloors);
        if (!(h >= 0) || !(c >= 0)) errors.mix = "Enter how many floors of each type (0 or more).";
        else if (floors >= 1 && h + c !== floors) errors.mix = "Hard + carpeted floors must add up to " + floors + ".";
        values.hardFloors = h; values.carpetFloors = c;
      }

      var lifts = intValue(fields.lifts);
      if (!(lifts >= 0)) errors.lifts = "Enter 0 or more lifts (whole number).";
      values.lifts = lifts;

      var flats = intValue(fields.flats);
      if (!(flats >= 1)) errors.flats = "Enter at least 1 flat (whole number).";
      values.flats = flats;

      if (!PRICING.frequencies[fields.frequency.value]) errors.frequency = "Choose how often you’d like cleaning.";
      values.frequency = fields.frequency.value;

      return { errors: errors, values: values };
    }

    function stepDone(errors) {
      return {
        1: !errors.postcode,
        2: !errors.floors,
        3: !errors.floorType && !errors.mix,
        4: !errors.lifts,
        5: !errors.flats,
        6: !errors.frequency
      };
    }

    var errorTargets = {
      postcode: [fields.postcode],
      floors: [fields.floors],
      floorType: [],
      mix: [fields.hardFloors, fields.carpetFloors],
      lifts: [fields.lifts],
      flats: [fields.flats],
      frequency: [fields.frequency]
    };

    function showErrors(errors) {
      Object.keys(errorTargets).forEach(function (key) {
        var msgEl = el("err-" + key);
        var show = touched[key] && errors[key];
        var text = show ? errors[key] : "";
        if (msgEl.textContent !== text) msgEl.textContent = text;
        errorTargets[key].forEach(function (input) {
          input.setAttribute("aria-invalid", show ? "true" : "false");
        });
      });
    }

    /* ----- Postcode lookup (background, cached) ----- */
    function getLookup(pc) {
      var entry = lookups[pc];
      if (entry && !entry.retry) return entry.promise;
      entry = lookups[pc] = { result: null, retry: false };
      entry.promise = Distance.lookupMilesFromBase(pc, PRICING.baseLocation).then(function (res) {
        var lookup = {
          postcode: pc,
          miles: res.ok ? res.miles : null,
          reason: res.ok ? null : res.reason,
          message: res.ok ? "" : (LOOKUP_MSG[res.reason] || LOOKUP_MSG.network),
          district: res.ok ? res.district : null,
          ward: res.ok ? res.ward : null
        };
        entry.result = lookup;
        entry.retry = !res.ok && res.reason === "network"; // try again next time
        return lookup;
      });
      return entry.promise;
    }

    function resolvedLookup(pc) {
      var entry = lookups[pc];
      return entry && entry.result ? entry.result : null;
    }

    function travelPence(miles) {
      var q = calculateQuote({ hardFloors: 0, carpetFloors: 0, lifts: 0, flats: 0, frequency: FREQ_KEYS[0], distanceMiles: miles }, PRICING);
      var line = q.lines.filter(function (l) { return l.label === "Travel"; })[0];
      return line ? line.pence : 0;
    }

    var statusEl = el("postcode-status");
    function setStatus(kind, text) {
      statusEl.className = "pc-status" + (kind ? " is-" + kind : "");
      statusEl.textContent = "";
      if (!text) return;
      var icon = { ok: "check", warn: "alert" }[kind];
      if (icon) statusEl.insertAdjacentHTML("beforeend", svgIcon(icon));
      var span = document.createElement("span");
      span.textContent = text;
      statusEl.appendChild(span);
    }

    function showLookupStatus(l) {
      if (l.miles == null) {
        var lead = l.reason === "not_found" ? LOOKUP_MSG.not_found : LOOKUP_MSG.network;
        setStatus("warn", lead + " You’ll still get a price.");
        return;
      }
      var place = [];
      if (l.ward) place.push(l.ward);
      if (l.district && l.district !== l.ward) place.push(l.district);
      var where = place.length ? place.join(", ") : l.postcode;
      var miles = l.miles.toFixed(1) + " miles";
      var charge = travelPence(l.miles);
      setStatus("ok", charge > 0
        ? where + " · " + miles + ": travel " + formatGBP(charge) + " (first " + PRICING.travel.freeMiles + " miles free)"
        : where + " · " + miles + " from " + BASE_NAME + ": no travel charge");
    }

    // Starts (or reuses) the lookup for the postcode in the field. Returns a promise or null.
    function checkPostcode() {
      if (!Distance.isValidPostcode(fields.postcode.value)) { setStatus("", ""); return null; }
      var pc = Distance.normalisePostcode(fields.postcode.value);
      var known = resolvedLookup(pc);
      var entry = lookups[pc];
      if (known && !(entry && entry.retry)) {
        showLookupStatus(known);
        return entry.promise;
      }
      setStatus("pending", "Checking postcode…");
      var p = getLookup(pc);
      p.then(function (l) {
        if (Distance.normalisePostcode(fields.postcode.value) !== pc) return;
        showLookupStatus(l);
        refresh();
      });
      return p;
    }

    /* ----- Steppers ----- */
    var steppers = Array.prototype.map.call(form.querySelectorAll(".stepper"), function (wrap) {
      return {
        input: wrap.querySelector("input"),
        minus: wrap.querySelector('[data-delta="-1"]'),
        unit: wrap.querySelector(".unit")
      };
    });

    function updateSteppers() {
      steppers.forEach(function (s) {
        var min = parseInt(s.input.getAttribute("data-min") || "0", 10);
        var v = intValue(s.input);
        s.minus.setAttribute("aria-disabled", !(v > min) ? "true" : "false");
        if (s.unit) s.unit.textContent = v === 1 ? s.unit.getAttribute("data-one") : s.unit.getAttribute("data-many");
      });
    }

    form.addEventListener("click", function (e) {
      var btn = e.target.closest(".step-btn");
      if (!btn) return;
      var input = el(btn.getAttribute("data-for"));
      var delta = parseInt(btn.getAttribute("data-delta"), 10);
      var min = parseInt(input.getAttribute("data-min") || "0", 10);
      var cur = intValue(input);
      var next = isNaN(cur) ? (delta > 0 ? Math.max(min, 1) : min) : Math.max(min, cur + delta);
      input.value = String(next);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    /* ----- Mix panel ----- */
    function autoFillCarpet() {
      if (carpetTouched || floorType() !== "mix") return;
      var floors = intValue(fields.floors);
      var h = intValue(fields.hardFloors);
      if (floors >= 1 && h >= 0 && h <= floors) fields.carpetFloors.value = String(floors - h);
    }

    var mixCount = el("mix-count");
    function updateMixCount(values) {
      if (floorType() !== "mix" || !(values.floors >= 1)) { mixCount.textContent = ""; return; }
      var h = intValue(fields.hardFloors), c = intValue(fields.carpetFloors);
      var assigned = (h >= 0 ? h : 0) + (c >= 0 ? c : 0);
      var total = values.floors;
      var text;
      if (assigned === total && h >= 0 && c >= 0) text = "✓ " + assigned + " of " + total + " floors assigned";
      else if (assigned < total) text = assigned + " of " + total + " floors assigned, " + (total - assigned) + " left";
      else text = assigned + " of " + total + " floors assigned, " + (assigned - total) + " too many";
      if (mixCount.textContent !== text) mixCount.textContent = text;
      mixCount.classList.toggle("is-ok", text.charAt(0) === "✓");
    }

    /* ----- Step circles, hint, frequency cards ----- */
    var stepRows = {};
    Array.prototype.forEach.call(form.querySelectorAll("[data-step]"), function (row) {
      stepRows[row.getAttribute("data-step")] = row;
    });
    var calcHint = el("calc-hint");

    function updateSteps(errors) {
      var done = stepDone(errors);
      var missing = [];
      Object.keys(stepRows).forEach(function (n) {
        stepRows[n].classList.toggle("is-done", done[n]);
        if (!done[n]) missing.push(n + " " + STEP_NAMES[n]);
      });
      var text = missing.length ? "Still needed: " + missing.join(", ") : "All set: press Calculate quote.";
      if (calcHint.textContent !== text) calcHint.textContent = text;
      return done;
    }

    function knownMiles(pc) {
      var l = resolvedLookup(pc);
      return l && l.miles != null ? l.miles : 0;
    }

    function updateFreqCards(v) {
      var others = Object.keys(v.errors).filter(function (k) { return k !== "frequency"; });
      FREQ_KEYS.forEach(function (k) {
        var card = freqCards[k];
        if (!card) return;
        card.setAttribute("aria-pressed", fields.frequency.value === k ? "true" : "false");
        var priceEl = card.querySelector(".fc-price");
        if (others.length) { priceEl.hidden = true; priceEl.textContent = ""; return; }
        var q = calculateQuote({
          hardFloors: v.values.hardFloors, carpetFloors: v.values.carpetFloors,
          lifts: v.values.lifts, flats: v.values.flats, frequency: k,
          distanceMiles: knownMiles(v.values.postcode)
        }, PRICING);
        var per;
        if (q.monthly == null) per = "one visit";
        else if (PRICING.frequencies[k].visitsPerYear === 12) per = formatGBP(q.monthly) + "/mo";
        else per = "≈ " + formatGBP(q.monthly) + "/mo";
        priceEl.textContent = "";
        var main = document.createElement("span");
        main.textContent = formatGBP(q.total);
        var sub = document.createElement("span");
        sub.className = "fc-month";
        sub.textContent = per;
        priceEl.appendChild(main);
        priceEl.appendChild(sub);
        priceEl.hidden = false;
      });
    }

    /* ----- Price bar (below 56rem) ----- */
    var priceBar = el("price-bar");
    var firstInput = { 1: "postcode", 2: "floors", 3: "ft-hard", 4: "lifts", 5: "flats", 6: "frequency" };

    function updatePriceBar(v, done) {
      if (!priceBar) return;
      var amount = el("pb-amount"), sub = el("pb-sub"), action = el("pb-action");
      if (lastQuote) {
        var q = lastQuote.quote;
        amount.innerHTML = "";
        amount.appendChild(document.createTextNode(formatGBP(q.total) + " "));
        var small = document.createElement("small");
        small.textContent = "per visit";
        amount.appendChild(small);
        sub.textContent = q.monthly != null ? "≈ " + formatGBP(q.monthly) + " a month" : "One-off clean";
        action.textContent = "View quote ↓";
        priceBar.setAttribute("href", "#quote-result");
        return;
      }
      var answered = Object.keys(done).filter(function (n) { return done[n]; }).length;
      amount.textContent = "£—";
      sub.textContent = answered + " of 6 answered";
      var firstMissing = Object.keys(done).filter(function (n) { return !done[n]; })[0];
      if (firstMissing) {
        var target = firstInput[firstMissing];
        if (firstMissing === "3" && floorType() === "mix") target = "hard-floors";
        action.textContent = "Finish questions ↑";
        priceBar.setAttribute("href", "#" + target);
      } else {
        action.textContent = "Ready to calculate ↑";
        priceBar.setAttribute("href", "#calculate");
      }
    }

    if (priceBar) {
      priceBar.addEventListener("click", function (e) {
        var id = (priceBar.getAttribute("href") || "").slice(1);
        var target = el(id);
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
        try { target.focus({ preventScroll: true }); } catch (err) { target.focus(); }
      });

      if ("IntersectionObserver" in window) {
        var seen = { calc: false, result: false };
        var showBar = function () {
          var hide = seen.calc || (seen.result && !resultBox.hidden);
          priceBar.classList.toggle("is-visible", !hide);
          document.body.classList.toggle("has-price-bar", !hide);
        };
        var barIO = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            seen[entry.target === submitBtn ? "calc" : "result"] = entry.isIntersecting;
          });
          showBar();
        });
        barIO.observe(submitBtn);
        barIO.observe(resultBox);
        resultBox._showBar = showBar;
      } else {
        priceBar.classList.add("is-visible");
        document.body.classList.add("has-price-bar");
      }
    }

    /* ----- Refresh on every change ----- */
    function refresh() {
      mixGroup.hidden = floorType() !== "mix";
      var v = validate();
      showErrors(v.errors);
      var valid = Object.keys(v.errors).length === 0;
      submitBtn.disabled = busy || !valid;
      updateSteppers();
      updateMixCount(v.values);
      var done = updateSteps(v.errors);
      updateFreqCards(v);

      // Live update once a quote exists and the distance for this postcode is known
      if (lastQuote) {
        var lookup = valid ? resolvedLookup(v.values.postcode) : null;
        if (lookup) render(v.values, lookup);
        else {
          resultBox.classList.add("stale");
          el("stale-note").hidden = false;
        }
      }
      updatePriceBar(v, done);
      return v;
    }

    function markTouched(key) { touched[key] = true; }

    var fieldToKey = {
      "postcode": "postcode", "floors": "floors", "hard-floors": "mix",
      "carpet-floors": "mix", "lifts": "lifts", "flats": "flats", "frequency": "frequency"
    };

    form.addEventListener("input", function (e) {
      if (e.target.name === "floor-type") markTouched("floorType");
      if (e.target === fields.carpetFloors) carpetTouched = true;
      if (e.target === fields.hardFloors || e.target === fields.floors) autoFillCarpet();
      if (e.target === fields.postcode) {
        var pc = Distance.normalisePostcode(fields.postcode.value);
        var known = Distance.isValidPostcode(pc) ? resolvedLookup(pc) : null;
        if (known && !lookups[pc].retry) showLookupStatus(known);
        else setStatus("", "");
      }
      refresh();
    });
    form.addEventListener("change", function (e) {
      if (e.target.name === "floor-type") {
        markTouched("floorType");
        autoFillCarpet();
      }
      if (fieldToKey[e.target.id]) markTouched(fieldToKey[e.target.id]);
      refresh();
    });
    form.addEventListener("focusout", function (e) {
      if (e.target === fields.postcode) checkPostcode();
      if (fieldToKey[e.target.id]) { markTouched(fieldToKey[e.target.id]); refresh(); }
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (busy) return;
      Object.keys(errorTargets).forEach(markTouched);
      var v = refresh();
      if (Object.keys(v.errors).length) return;

      busy = true;
      submitBtn.disabled = true;
      submitBtn.textContent = "Calculating…";
      var pending = checkPostcode() || getLookup(v.values.postcode);
      pending.then(function (lookup) {
        busy = false;
        submitBtn.textContent = "Calculate quote";
        var now = refresh();
        var useNow = !Object.keys(now.errors).length && now.values.postcode === lookup.postcode;
        render(useNow ? now.values : v.values, lookup);
        updatePriceBar(now, stepDone(now.errors));
        resultBox.focus();
      });
    });

    /* ----- Result ----- */
    var breakdown = el("breakdown");
    if (breakdown && window.matchMedia && window.matchMedia("(max-width: 29.99rem)").matches) {
      breakdown.open = false;
    }

    var statusTimer = null;
    function announce(text) {
      clearTimeout(statusTimer);
      statusTimer = setTimeout(function () { el("price-status").textContent = text; }, 800);
    }

    function reference(values) {
      return "JC-" + values.hardFloors + "H-" + values.carpetFloors + "C-" + values.lifts + "L-" +
        values.flats + "F-" + values.frequency.charAt(0).toUpperCase();
    }

    function esc(s) {
      return String(s).replace(/[&<>"']/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
      });
    }

    function row(cls, label, detail, amount) {
      return "<tr" + (cls ? " class='" + cls + "'" : "") + "><th scope='row'><span class='lbl'><span class='lt'>" + esc(label) +
        (detail ? " <span class='detail'>" + esc(detail) + "</span>" : "") +
        "</span></span></th><td>" + esc(amount) + "</td></tr>";
    }

    function render(values, lookup) {
      var q = calculateQuote({
        hardFloors: values.hardFloors,
        carpetFloors: values.carpetFloors,
        lifts: values.lifts,
        flats: values.flats,
        frequency: values.frequency,
        distanceMiles: lookup.miles
      }, PRICING);
      var prevTotal = lastQuote ? lastQuote.quote.total : null;
      lastQuote = { values: values, quote: q, lookup: lookup };
      var freq = PRICING.frequencies[values.frequency];

      var rows = q.lines.filter(function (l) {
        return !/^0 ×/.test(l.detail); // hide rows with a zero count (e.g. no lifts)
      }).map(function (l) {
        var amount = l.tbc ? "TBC" : (l.label === "Travel" && l.pence === 0 ? "Free" : formatGBP(l.pence));
        return row("", l.label, l.detail, amount);
      }).join("");
      rows += row("subtotal", "Subtotal", "", formatGBP(q.subtotal));
      if (q.discount > 0) {
        rows += row("saving", q.frequencyLabel + " saving (" + pct(q.discountRate) + ")", "", "−" + formatGBP(q.discount));
      }
      rows += row("final", "Price per visit", "", formatGBP(q.total));
      el("result-rows").innerHTML = rows;

      var ref = reference(values);
      el("result-ref").textContent = "Estimate · Ref " + ref;

      el("result-total").textContent = formatGBP(q.total);
      if (q.monthly != null) {
        var how = freq.visitsPerYear === 12
          ? "one visit a month"
          : freq.visitsPerYear + " " + q.frequencyLabel.toLowerCase() + " visits ÷ 12";
        var monthly = el("result-monthly");
        monthly.textContent = "≈ " + formatGBP(q.monthly) + " a month ";
        var howEl = document.createElement("span");
        howEl.className = "how";
        howEl.textContent = "(" + how + ")";
        monthly.appendChild(howEl);
        el("result-per-flat").textContent = "About " + formatGBP(Math.round(q.monthly / values.flats)) + " per flat per month";
        el("result-per-flat").hidden = false;
      } else {
        el("result-monthly").textContent = "One-off clean, no monthly cost";
        el("result-per-flat").hidden = true;
      }

      var travelNote = el("travel-note");
      travelNote.hidden = !q.travelTbc;
      travelNote.textContent = q.travelTbc ? lookup.message + " Your price excludes travel for now." : "";

      el("request-quote").href = "contact.html?quote=" + encodeURIComponent(summary(values, q, ref));
      resultBox.hidden = false;
      el("result-placeholder").hidden = true;
      resultBox.classList.remove("stale");
      el("stale-note").hidden = true;
      if (resultBox._showBar) resultBox._showBar();

      if (prevTotal !== q.total) {
        announce("Estimated " + formatGBP(q.total) + " per visit");
        if (prevTotal !== null && !reduceMotion) {
          var wrap = el("result-total-wrap");
          wrap.classList.remove("flash");
          void wrap.offsetWidth;
          wrap.classList.add("flash");
        }
      }
    }

    function summary(values, q, ref) {
      var floorsText = values.hardFloors && values.carpetFloors
        ? values.hardFloors + " hard, " + values.carpetFloors + " carpeted"
        : (values.hardFloors ? values.hardFloors + " hard" : values.carpetFloors + " carpeted");
      return [
        "Hello, I’d like to request this quote:",
        "",
        "Postcode: " + values.postcode,
        "Floors: " + floorsText,
        "Lifts: " + values.lifts,
        "Flats: " + values.flats,
        "Frequency: " + q.frequencyLabel,
        "Estimated price: " + formatGBP(q.total) + " per visit" +
          (q.travelTbc ? " (travel charge to be confirmed)" : ""),
        q.monthly != null ? "Estimated monthly: " + formatGBP(q.monthly) : "",
        "Reference: " + ref
      ].filter(function (s, i) { return s !== "" || i === 1; }).join("\n");
    }

    /* ----- ?postcode= from the home page form ----- */
    var fromUrl = new URLSearchParams(window.location.search).get("postcode");
    if (fromUrl) {
      fields.postcode.value = Distance.normalisePostcode(fromUrl);
      markTouched("postcode");
      checkPostcode();
      refresh();
      fields.floors.focus();
    } else {
      refresh();
    }
  });
}
