/*
 * Postcode lookup (postcodes.io) and Haversine distance.
 */
var Distance = (function () {
  var UK_POSTCODE = /^(GIR ?0AA|[A-PR-UWYZ][A-HK-Y]?\d[A-Z\d]? ?\d[ABD-HJLNP-UW-Z]{2})$/i;

  function normalisePostcode(value) {
    var compact = String(value || "").toUpperCase().replace(/\s+/g, "");
    if (compact.length < 5) return compact;
    return compact.slice(0, -3) + " " + compact.slice(-3);
  }

  function isValidPostcode(value) {
    return UK_POSTCODE.test(normalisePostcode(value));
  }

  function toRadians(deg) {
    return (deg * Math.PI) / 180;
  }

  // Straight-line distance in miles between two lat/lng points
  function haversineMiles(lat1, lon1, lat2, lon2) {
    var EARTH_RADIUS_MILES = 3958.8;
    var dLat = toRadians(lat2 - lat1);
    var dLon = toRadians(lon2 - lon1);
    var a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return EARTH_RADIUS_MILES * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  /*
   * Resolves to { ok: true, miles, postcode } or
   * { ok: false, reason: "invalid" | "not_found" | "network" }.
   * Never rejects, so callers can always fall back to a quote without travel.
   */
  function lookupMilesFromBase(postcode, base) {
    var clean = normalisePostcode(postcode);
    if (!isValidPostcode(clean)) {
      return Promise.resolve({ ok: false, reason: "invalid" });
    }
    var url = "https://api.postcodes.io/postcodes/" + encodeURIComponent(clean.replace(" ", ""));
    return fetch(url)
      .then(function (res) {
        if (res.status === 404) return { ok: false, reason: "not_found" };
        if (!res.ok) return { ok: false, reason: "network" };
        return res.json().then(function (body) {
          var r = body && body.result;
          if (!r || r.latitude == null || r.longitude == null) {
            return { ok: false, reason: "not_found" };
          }
          return {
            ok: true,
            postcode: r.postcode,
            miles: haversineMiles(base.latitude, base.longitude, r.latitude, r.longitude)
          };
        });
      })
      .catch(function () {
        return { ok: false, reason: "network" };
      });
  }

  return {
    normalisePostcode: normalisePostcode,
    isValidPostcode: isValidPostcode,
    haversineMiles: haversineMiles,
    lookupMilesFromBase: lookupMilesFromBase
  };
})();

if (typeof module !== "undefined") module.exports = Distance;
