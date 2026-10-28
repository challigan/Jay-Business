// Run with: node tests/placeholders.test.js
// Fails on leftover template text in the shipped pages. Plain Node, no dependencies.
var fs = require("fs");
var path = require("path");

var root = path.join(__dirname, "..");
var pages = ["index.html", "quote.html", "contact.html"];
var otherFiles = ["js/pricing.js", "js/quote.js", "js/distance.js", "js/contact.js", "js/site.js", "css/styles.css"];

var failures = [];
var notes = [];

function read(file) { return fs.readFileSync(path.join(root, file), "utf8"); }

// Visible text: drop scripts, styles, comments, inline SVG and tags, then decode a few entities.
function visibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ");
}

function check(file, text, label, re) {
  var m = text.match(re);
  if (m) failures.push(file + ": " + label + " (found \"" + m[0] + "\")");
}

pages.forEach(function (file) {
  var html = read(file);
  var text = visibleText(html);
  check(file, html, "old placeholder business name", /Your Business Name/);
  check(file, html, "lorem ipsum", /lorem/i);
  check(file, html, "TODO marker", /\bTODO\b/);
  check(file, html, "[in area] placeholder", /\[in area\]/i);
  check(file, html, "empty link href=\"#\"", /href="#"/);
  check(file, text, "square-bracket placeholder in visible text", /\[[^\]]{0,60}\]?/);

  // Allowed placeholders: listed so nobody forgets them
  var ex = (html.match(/example\.com/g) || []).length;
  var tel = (html.match(/0191 000 0000|\+441910000000/g) || []).length;
  var dom = (html.match(/jays-cleaning\.example/g) || []).length;
  notes.push(file + ": example.com x" + ex + ", 0191 000 0000 / +441910000000 x" + tel + ", jays-cleaning.example x" + dom);
});

otherFiles.forEach(function (file) {
  var src = read(file);
  check(file, src, "old placeholder business name", /Your Business Name/);
  check(file, src, "lorem ipsum", /lorem/i);
  check(file, src, "TODO marker", /\bTODO\b/);
});

console.log("Placeholders still to replace before going live (allowed):");
notes.forEach(function (n) { console.log("  - " + n); });

if (failures.length) {
  console.log("\n✗ " + failures.length + " problem(s):");
  failures.forEach(function (f) { console.log("  " + f); });
  process.exit(1);
}
console.log("\n✓ No template placeholders in the shipped pages");
