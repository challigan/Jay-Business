# Communal Cleaning Quote Site (prototype)

A static website for a communal-area cleaning business in Jarrow. Visitors answer six questions about their building and get an instant estimated quote. All prices are mock figures.

Plain HTML, CSS and JavaScript. There's no backend and no build step.

## Running it

- **Locally:** open `index.html` in a browser. Everything works from `file://`, including the postcode lookup.
- **Hosting:** upload the folder to any static host, such as GitHub Pages, Netlify, Vercel or Cloudflare Pages. No build command is needed, and the publish directory is the repo root.

## Changing prices

All prices live in **`js/pricing.js`**. Edit a number, save, and reload. Nothing else needs changing:

| Setting | What it controls |
| --- | --- |
| `baseCharge` | Flat charge per visit |
| `floorRates.hard` / `floorRates.carpet` | Price per floor |
| `perLift` | Price per lift |
| `perFlat` | Price per flat |
| `travel.freeMiles` / `travel.perMileBeyond` | Free travel radius and charge per extra mile |
| `frequencies.*.discount` | Discount per frequency (`0.10` = 10% off) |
| `baseLocation` | Coordinates that travel is measured from (currently the NE32 outcode centre) |

The frequency dropdown labels, such as "Weekly (10% off)", are generated from this file, so they stay in step automatically.

## How the quote works

1. Subtotal = base + floors × rate + lifts × rate + flats × rate + travel.
2. The frequency discount is applied to the subtotal.
3. The result is rounded to the penny. The monthly estimate is weekly × 52 / 12, fortnightly × 26 / 12, or monthly × 1. One-off cleans have no monthly figure.

Distance is the straight-line (Haversine) distance from Jarrow to the postcode, using the free [postcodes.io](https://postcodes.io) API. If the postcode can't be found or the API is down, the visitor still gets a quote, marked "travel charge to be confirmed".

## Contact form

The enquiry form is set up in `js/contact.js` → `CONTACT_CONFIG`:

- `mode: "mailto"` (default): opens the visitor's email app with the message filled in. Set `email` to the real address.
- `mode: "netlify"`: uses Netlify Forms. This only works when the site is hosted on Netlify. The form already has `data-netlify="true"`.
- `mode: "formspree"`: posts to a Formspree endpoint. Set `formspreeEndpoint`.

On the quote page, "Request this quote" opens the contact page with the quote details already in the message.

## Placeholders to replace

- "Your Business Name" in the header and footer of each HTML page
- Phone, email, area and hours on `contact.html`
- `CONTACT_CONFIG.email` in `js/contact.js`

## Tests

```
node tests/quote.test.js
```

These check the spec's worked example (£119.70), the free-travel radius, mixed floors, config changes and postcode validation.

## Files

```
index.html, quote.html, contact.html
css/styles.css
js/pricing.js    price config
js/quote.js      form logic and calculation
js/distance.js   postcode lookup and Haversine distance
js/contact.js    contact form and form-service hook
tests/quote.test.js
```
