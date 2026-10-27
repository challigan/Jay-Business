/*
 * PRICING CONFIG
 * ---------------------------------------------------------------
 * Every price used by the quote calculator lives here.
 * Edit the numbers below and reload the page - no other changes needed.
 * All money values are in GBP (pounds), per visit.
 * ---------------------------------------------------------------
 */
var PRICING = {
  // Flat charge added to every visit
  baseCharge: 20,

  // Price per floor, by floor type
  floorRates: {
    hard: 15,
    carpet: 12
  },

  // Price per lift
  perLift: 10,

  // Price per flat in the building
  perFlat: 0.5,

  // Travel: free up to `freeMiles` from the base, then `perMileBeyond` per mile
  travel: {
    freeMiles: 5,
    perMileBeyond: 1
  },

  // Discount applied to the subtotal, by cleaning frequency (0.10 = 10% off)
  // visitsPerYear is used to estimate the monthly cost (null = one-off)
  frequencies: {
    weekly:      { label: "Weekly",      discount: 0.10, visitsPerYear: 52 },
    fortnightly: { label: "Fortnightly", discount: 0.05, visitsPerYear: 26 },
    monthly:     { label: "Monthly",     discount: 0,    visitsPerYear: 12 },
    oneoff:      { label: "One-off",     discount: 0,    visitsPerYear: null }
  },

  // Base location used for travel distance (Jarrow, NE32 outcode centre)
  baseLocation: {
    name: "Jarrow (NE32)",
    latitude: 54.9674,
    longitude: -1.4844
  }
};

if (typeof module !== "undefined") module.exports = PRICING;
