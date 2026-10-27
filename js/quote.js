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
    var lastLookup = null; // { postcode, miles|null, message }
    var lastQuote = null;

    // Build frequency options and pricing text from the config
    Object.keys(PRICING.frequencies).forEach(function (key) {
      var f = PRICING.frequencies[key];
      var opt = document.createElement("option");
      opt.value = key;
      opt.textContent = f.label + (f.discount ? " (" + Math.round(f.discount * 100) + "% off)" : "");
      fields.frequency.appendChild(opt);
    });
    el("free-miles").textContent = PRICING.travel.freeMiles;

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

      if (!fields.postcode.value.trim()) errors.postcode = "Enter the building's postcode.";
      else if (!Distance.isValidPostcode(fields.postcode.value)) errors.postcode = "Enter a valid UK postcode, e.g. NE32 3DT.";
      values.postcode = Distance.normalisePostcode(fields.postcode.value);

      var floors = intValue(fields.floors);
      if (!(floors >= 1)) errors.floors = "Enter at least 1 floor (whole number).";

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

      if (!PRICING.frequencies[fields.frequency.value]) errors.frequency = "Choose how often you'd like cleaning.";
      values.frequency = fields.frequency.value;

      return { errors: errors, values: values };
    }

    var errorTargets = {
      postcode: fields.postcode,
      floors: fields.floors,
      floorType: null,
      mix: null,
      lifts: fields.lifts,
      flats: fields.flats,
      frequency: fields.frequency
    };

    function showErrors(errors) {
      Object.keys(errorTargets).forEach(function (key) {
        var msgEl = el("err-" + key);
        var show = touched[key] && errors[key];
        msgEl.textContent = show ? errors[key] : "";
        var input = errorTargets[key];
        if (input) input.setAttribute("aria-invalid", show ? "true" : "false");
      });
    }

    function refresh() {
      mixGroup.hidden = floorType() !== "mix";
      var v = validate();
      showErrors(v.errors);
      var valid = Object.keys(v.errors).length === 0;
      submitBtn.disabled = !valid;

      // Live update once a quote exists and the postcode hasn't changed
      if (valid && lastLookup && lastLookup.postcode === v.values.postcode) {
        render(v.values, lastLookup);
      } else if (lastQuote) {
        resultBox.classList.add("stale");
        el("stale-note").hidden = false;
      }
      return v;
    }

    function markTouched(key) { touched[key] = true; }

    var fieldToKey = {
      "postcode": "postcode", "floors": "floors", "hard-floors": "mix",
      "carpet-floors": "mix", "lifts": "lifts", "flats": "flats", "frequency": "frequency"
    };

    form.addEventListener("input", function (e) {
      if (e.target.name === "floor-type") markTouched("floorType");
      refresh();
    });
    form.addEventListener("change", function (e) {
      if (e.target.name === "floor-type") markTouched("floorType");
      if (fieldToKey[e.target.id]) markTouched(fieldToKey[e.target.id]);
      refresh();
    });
    form.addEventListener("focusout", function (e) {
      if (fieldToKey[e.target.id]) { markTouched(fieldToKey[e.target.id]); refresh(); }
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      Object.keys(errorTargets).forEach(markTouched);
      var v = refresh();
      if (Object.keys(v.errors).length) return;

      submitBtn.disabled = true;
      submitBtn.textContent = "Calculating…";
      Distance.lookupMilesFromBase(v.values.postcode, PRICING.baseLocation).then(function (res) {
        var messages = {
          not_found: "We couldn't find that postcode, so travel is to be confirmed.",
          network: "We couldn't check the distance right now, so travel is to be confirmed.",
          invalid: "That postcode doesn't look right, so travel is to be confirmed."
        };
        lastLookup = {
          postcode: v.values.postcode,
          miles: res.ok ? res.miles : null,
          message: res.ok ? "" : messages[res.reason]
        };
        submitBtn.textContent = "Calculate quote";
        refresh();
        render(v.values, lastLookup);
        resultBox.focus();
      });
    });

    function render(values, lookup) {
      var q = calculateQuote({
        hardFloors: values.hardFloors,
        carpetFloors: values.carpetFloors,
        lifts: values.lifts,
        flats: values.flats,
        frequency: values.frequency,
        distanceMiles: lookup.miles
      }, PRICING);
      lastQuote = { values: values, quote: q };

      var rows = q.lines.map(function (l) {
        return "<tr><th scope='row'>" + l.label +
          (l.detail ? "<span class='detail'>" + l.detail + "</span>" : "") +
          "</th><td>" + (l.tbc ? "TBC" : formatGBP(l.pence)) + "</td></tr>";
      }).join("");

      el("result-rows").innerHTML = rows +
        "<tr class='subtotal'><th scope='row'>Subtotal</th><td>" + formatGBP(q.subtotal) + "</td></tr>" +
        "<tr><th scope='row'>" + q.frequencyLabel + " discount<span class='detail'>" +
        Math.round(q.discountRate * 100) + "% off</span></th><td>" +
        (q.discount ? "−" + formatGBP(q.discount) : formatGBP(0)) + "</td></tr>";

      el("result-total").textContent = formatGBP(q.total);
      el("result-monthly").textContent = q.monthly != null
        ? "Approx. " + formatGBP(q.monthly) + " per month (" + q.frequencyLabel.toLowerCase() + ")"
        : "One-off clean – no monthly cost";

      var travelNote = el("travel-note");
      travelNote.hidden = !q.travelTbc;
      travelNote.textContent = q.travelTbc ? lookup.message + " Your quote excludes travel." : "";

      el("request-quote").href = "contact.html?quote=" + encodeURIComponent(summary(values, q));
      resultBox.hidden = false;
      el("result-placeholder").hidden = true;
      resultBox.classList.remove("stale");
      el("stale-note").hidden = true;
    }

    function summary(values, q) {
      var floorsText = values.hardFloors && values.carpetFloors
        ? values.hardFloors + " hard, " + values.carpetFloors + " carpeted"
        : (values.hardFloors ? values.hardFloors + " hard" : values.carpetFloors + " carpeted");
      return [
        "Hello, I'd like to request this quote:",
        "",
        "Postcode: " + values.postcode,
        "Floors: " + floorsText,
        "Lifts: " + values.lifts,
        "Flats: " + values.flats,
        "Frequency: " + q.frequencyLabel,
        "Estimated price: " + formatGBP(q.total) + " per visit" +
          (q.travelTbc ? " (travel charge to be confirmed)" : ""),
        q.monthly != null ? "Estimated monthly: " + formatGBP(q.monthly) : ""
      ].filter(function (s, i) { return s !== "" || i === 1; }).join("\n");
    }

    refresh();
  });
}
