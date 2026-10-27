// Run with: node tests/quote.test.js
var assert = require("assert");
var PRICING = require("../js/pricing.js");
var Distance = require("../js/distance.js");
var calc = require("../js/quote.js");

function clone(o) { return JSON.parse(JSON.stringify(o)); }

var tests = {
  "worked example: 6 hard floors, 1 lift, 20 flats, 8 miles, weekly = £119.70": function () {
    var q = calc.calculateQuote({ hardFloors: 6, carpetFloors: 0, lifts: 1, flats: 20, frequency: "weekly", distanceMiles: 8 }, PRICING);
    assert.strictEqual(q.subtotal, 13300);
    assert.strictEqual(q.total, 11970);
    assert.strictEqual(calc.formatGBP(q.total), "£119.70");
    assert.strictEqual(q.monthly, Math.round(11970 * 52 / 12));
  },
  "within 5 miles adds no travel charge": function () {
    var q = calc.calculateQuote({ hardFloors: 1, carpetFloors: 0, lifts: 0, flats: 1, frequency: "monthly", distanceMiles: 4.9 }, PRICING);
    var travel = q.lines.filter(function (l) { return l.label === "Travel"; })[0];
    assert.strictEqual(travel.pence, 0);
  },
  "changing pricing config changes the quote": function () {
    var p = clone(PRICING);
    p.floorRates.hard = 20;
    var q = calc.calculateQuote({ hardFloors: 6, carpetFloors: 0, lifts: 1, flats: 20, frequency: "weekly", distanceMiles: 8 }, p);
    assert.strictEqual(q.total, Math.round(16300 * 0.9));
  },
  "mixed floors and fortnightly discount": function () {
    var q = calc.calculateQuote({ hardFloors: 2, carpetFloors: 3, lifts: 0, flats: 10, frequency: "fortnightly", distanceMiles: 0 }, PRICING);
    // 20 + 30 + 36 + 0 + 5 = 91, less 5% = 86.45
    assert.strictEqual(q.total, 8645);
  },
  "unknown distance flags travel as TBC": function () {
    var q = calc.calculateQuote({ hardFloors: 1, carpetFloors: 0, lifts: 0, flats: 1, frequency: "oneoff", distanceMiles: null }, PRICING);
    assert.strictEqual(q.travelTbc, true);
    assert.strictEqual(q.monthly, null);
    assert.strictEqual(q.total, 3550);
  },
  "postcode validation": function () {
    ["NE32 3DT", "ne323dt", "SW1A 1AA", "M1 1AE", "GIR 0AA"].forEach(function (p) {
      assert.ok(Distance.isValidPostcode(p), p);
    });
    ["", "NE32", "12345", "NE32 3D", "QQ1 1AA"].forEach(function (p) {
      assert.ok(!Distance.isValidPostcode(p), p);
    });
  },
  "haversine: Jarrow to Newcastle centre is ~5-6 miles": function () {
    var d = Distance.haversineMiles(PRICING.baseLocation.latitude, PRICING.baseLocation.longitude, 54.9738, -1.6132);
    assert.ok(d > 4.5 && d < 6, d);
  }
};

var failed = 0;
Object.keys(tests).forEach(function (name) {
  try { tests[name](); console.log("✓ " + name); }
  catch (e) { failed++; console.log("✗ " + name + "\n  " + e.message); }
});
process.exit(failed ? 1 : 0);
