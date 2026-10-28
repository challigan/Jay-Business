![Jay’s Cleaning](images/art/logo.png)

# Jay’s Cleaning: communal cleaning quote site

A static website for Jay’s Cleaning, a communal-area cleaning business in Jarrow, South Tyneside. It cleans stairwells, hallways, landings, entrances and lifts in blocks of flats for managing agents, RTM and RMC directors, freeholders, landlords and residents’ associations. Visitors answer six questions about their building and get an instant estimated quote. **All prices are mock figures.**

Plain HTML, CSS and JavaScript (classic `<script>` tags). There's no backend, no build step and no npm dependencies.

## Running it

- **Locally:** open `index.html` in a browser. Everything works from `file://`, including the postcode lookup. Without an internet connection the Google Fonts fall back to system fonts and the quote still works (travel is shown as "to be confirmed").
- **Hosting:** upload the folder to any static host. On Netlify, `netlify.toml` publishes the repo root; no build command is needed.

## Files

```
index.html              home page (11 sections)
quote.html              instant quote form and live result
contact.html            enquiry form (prefilled from ?quote= or ?topic=)
favicon.svg             favicon (SVG)
css/styles.css          all styles; design tokens on :root
js/pricing.js           ALL prices (single PRICING object)
js/quote.js             calculateQuote() (pure, tested) + quote page wiring
js/distance.js          postcodes.io lookup + Haversine distance
js/contact.js           contact form + CONTACT_CONFIG form-service hook
js/site.js              header, menu, mobile CTA bar, footer year, price figures, reveal
images/photos/          stock photos (see credits below)
images/art/             original artwork: logo, icons, spot illustrations, map, OG image
tests/quote.test.js     calculator tests
tests/placeholders.test.js  checks for leftover template text
```

Notes on the artwork:

- `images/art/icons.svg` is the icon sprite. A copy is pasted at the top of each page's `<body>`; if you edit the file, paste it into the three pages again.
- `images/art/areas-map.svg` and `images/art/visit-report.svg` are pasted inline in `index.html` (so their text stays live and accessible). The header and footer logo mark is inlined from `logo-mark.svg` / `logo-mark-ondeep.svg`.
- `logo.svg` / `logo.png` are the full lockup for email, documents and this README. `og-image.png` (1200×630) is the social sharing image; `og-image.svg` is a photo-free vector version of it.

## Changing prices

All prices live in **`js/pricing.js`**. Edit a number, save and reload. Nothing else needs changing:

| Setting | What it controls |
| --- | --- |
| `baseCharge` | Flat charge per visit |
| `floorRates.hard` / `floorRates.carpet` | Price per floor |
| `perLift` | Price per lift |
| `perFlat` | Price per flat |
| `travel.freeMiles` / `travel.perMileBeyond` | Free travel radius and charge per extra mile |
| `frequencies.*.discount` | Discount per frequency (`0.10` = 10% off) |
| `frequencies.*.visitsPerYear` | Used for the monthly estimate (`null` = one-off) |
| `baseLocation` | Coordinates that travel is measured from (the NE32 outcode centre) |

No price, discount or mileage figure is written into the HTML. Every figure on the site is generated from `PRICING` at runtime:

- **Quote page:** the frequency options ("Weekly (10% off)"), the "Save 10%" and "Best value" tags, the per-frequency prices, the "How we price" rate card and the result.
- **Home page:** elements marked `data-price="…"` are filled by `js/site.js` (`freeMiles`, `perMile`, `disc-weekly`, `typical-1` etc.). Each one holds figure-free fallback text. Sentences that only make sense with numbers are marked `data-needs-pricing hidden` and appear only when the prices load; their figure-free twin is marked `data-pricing-fallback`.
- The **"What a typical block costs"** panel (How it works section) runs the real calculator on three example blocks within the free radius. It updates when you change `pricing.js`.

## How the quote works

1. Subtotal = base + floors × rate + lifts × rate + flats × rate + travel.
2. The frequency discount is applied to the subtotal.
3. The result is rounded to the penny. The monthly estimate is weekly × 52 / 12, fortnightly × 26 / 12, or monthly × 1. One-off cleans have no monthly figure.

Distance is the straight-line (Haversine) distance from Jarrow to the postcode, using the free [postcodes.io](https://postcodes.io) API. The lookup starts as soon as the visitor leaves the postcode field, and its result is cached. If the postcode can't be found or the API is down, the visitor still gets a price, clearly marked "travel to be confirmed".

The worked example from the original spec (6 hard floors, 1 lift, 20 flats, 8 miles, weekly) gives **£119.70 per visit**, about £518.70 a month.

Each result has a reference code such as `JC-6H-0C-1L-20F-W` (hard floors, carpeted floors, lifts, flats, frequency initial). It is included in the message that "Request this quote" puts into the contact form.

## Contact form

The enquiry form is set up in `js/contact.js` → `CONTACT_CONFIG`:

- `mode: "mailto"` (default): opens the visitor's email app with the message filled in. Set `email` to the real address.
- `mode: "netlify"`: uses Netlify Forms. This only works when the site is hosted on Netlify. The form already has `data-netlify="true"` and a honeypot field.
- `mode: "formspree"`: posts to a Formspree endpoint. Set `formspreeEndpoint`.

The topic, role, building, building postcode and situation are added to the email when filled in, and the subject reads "Cleaning enquiry: <topic>". Links can preselect a topic: `contact.html?topic=documents` (insurance and documents) or `contact.html?topic=resident` (report a missed clean).

## Before going live, confirm these claims

The site makes service promises that only Jay can confirm. Check each one; if it isn't true, change or remove the wording in the file and section named.

- [ ] **Public liability insurance.** "Are you insured? Yes" (`index.html` FAQ), "Public liability insurance: current certificate emailed on request, and the renewal sent before it expires" (`index.html` paperwork section), and the insurance mentions on `contact.html`. Once confirmed you can add the limit, insurer and expiry, e.g. "£X million cover with [insurer], renewed every [month]" to the paperwork register.
- [ ] **Employers’ liability.** Not mentioned yet. If Jay employs anyone, add a row to the paperwork register: "Employers’ liability insurance: £X million, certificate on request".
- [ ] **Basic DBS check.** Not mentioned. Add it only if Jay holds one, as a row in the paperwork register: "Basic DBS check: [name], certificate dated [month year]". Otherwise leave it out.
- [ ] **Jay cleans every building himself**, and the cover plan: visits rearranged within two working days if Jay is ill or on holiday (`index.html` Meet Jay and FAQ).
- [ ] **Replies within one working day** (hero, paperwork register, footer, contact page, quote result).
- [ ] **Free return visit within two working days, with a photo**, if something on the checklist is missed (`index.html` Meet Jay and FAQ).
- [ ] **Photo report by email after every visit**, the **signed visit sheet on the noticeboard**, and the **first report arriving the same day** (hero chip, trust strip, How it works step 4, Visit records section, FAQ).
- [ ] **Same-day issue flagging**: "we tell you straight away" (Visit records section).
- [ ] **Keys and fobs**: key register, coded tags with no address, never copied, returned on request, same-day notice if one is lost (`index.html` paperwork and FAQ). Mention loss-of-keys cover only if the insurance policy actually includes it.
- [ ] **Terms**: rolling agreement with no fixed term, one month’s written notice, price reviewed no more than once a year with a month’s notice (`index.html` paperwork "Simple terms" and FAQ).
- [ ] **One itemised invoice per building per month** (Who we work with, paperwork).
- [ ] **Risk assessment & method statement (RAMS) and COSHH safety data sheets** available before the first clean (Who we work with, How it works, paperwork, FAQ).
- [ ] **Free site visit, or a phone video instead** (How it works step 2, quote result "What happens next", contact page tip).
- [ ] **Work-at-height limit of two metres** ("Not included" panel in What we clean).
- [ ] **Every checklist line, the extras and the exclusions** in What we clean, and the dry-mop note for freezing or wet weather.
- [ ] **Products and equipment**: "Jay brings all his own equipment and products, with colour-coded microfibre cloths and mops that are washed and reused" (Meet Jay, FAQ).
- [ ] **Areas list** (`index.html` Areas section and footer). Prune "North of the river" or any other area Jay doesn't want to cover.
- [ ] **Hours**: Monday to Friday, 8am to 5pm (footer, contact page).
- [ ] **Privacy wording**, including "this site sets no tracking cookies" (`contact.html#privacy`). Keep it true if you add analytics.
- [ ] **Trading name or company number** for the footer. When confirmed, add this inside the footer's bottom paragraph on all three pages: `<span>Jay’s Cleaning is a trading name of OWNER’S FULL NAME.</span>` (or the company name and number).
- [ ] **All prices** in `js/pricing.js`, including the "typical block" examples they produce. The current figures are mock values.

## Placeholders to replace

- Phone **0191 000 0000** (`tel:+441910000000`): header, menu, hero, CTA bars, footer, contact page, quote result, JSON-LD in `index.html`.
- Email **hello@example.com**: footer, menu, contact page, the "email us directly" link in the paperwork section, JSON-LD, and `CONTACT_CONFIG.email` in `js/contact.js`.
- Domain **jays-cleaning.example**: `<link rel="canonical">`, `og:url`, `og:image` and `twitter:image` on all three pages.
- Once real, add `url`, `logo` and `sameAs` to the LocalBusiness JSON-LD in `index.html`. Don't add `aggregateRating` or `review` unless they come from real, verifiable reviews.

`node tests/placeholders.test.js` lists how many of these remain in each page.

## Do not add until they are real

- Testimonials. When you have them: show the person's role, area and month/year, quote them word for word, and get written permission.
- Star ratings, review widgets or review counts.
- Client names or logos.
- Accreditation badges (SafeContractor, CHAS, Constructionline and so on).
- Years in business, numbers of buildings or other counts.
- Eco or "green product" claims.

## Photo credits

All photos are free stock under the [Unsplash Licence](https://unsplash.com/license) (free for commercial use; credit not required but given here). None are Unsplash+ images. They were downloaded, cropped and recompressed into `images/photos/` (nothing is hotlinked). `images/photos/CREDITS.md` has the same list.

**These are placeholders: replace them with Jay’s own photos** (with the building owner’s permission, and no faces or flat numbers). Never caption stock photos as "our work".

| Files | Used for | Photographer | Photo page | Licence |
| --- | --- | --- | --- | --- |
| `hero-stairwell-800.jpg`, `hero-stairwell-1400.jpg`, `hero-stairwell-wide-800.jpg`, `hero-stairwell-wide-1400.jpg` | Home hero; OG image | Jacqueline Brandwayn | https://unsplash.com/photos/zPzEyqIryxw | Unsplash Licence |
| `stairwell-flight-640.jpg`, `stairwell-flight-1200.jpg` | Stairwells card | Julia Taubitz | https://unsplash.com/photos/9olLAM-OIQ8 | Unsplash Licence |
| `block-exterior-800.jpg`, `block-exterior-1600.jpg`, `block-exterior-43-800.jpg`, `block-exterior-43-1200.jpg` | Who we work with photo band | Anna Krylova | https://unsplash.com/photos/NCRojDC7RGk | Unsplash Licence |
| `landing-corridor-640.jpg`, `landing-corridor-1200.jpg` | Landings card | Scarbor Siu | https://unsplash.com/photos/VorUfhMXNgs | Unsplash Licence |
| `entrance-lobby-640.jpg`, `entrance-lobby-1200.jpg` | Hallways & entrances card; contact page | Marcus Lenk | https://unsplash.com/photos/369jfkVbZ4k | Unsplash Licence |
| `lift-interior-640.jpg`, `lift-interior-1200.jpg` | Lifts card | Julia Taubitz | https://unsplash.com/photos/Y7COqhqKdjk | Unsplash Licence |
| `handrail-detail-640.jpg`, `handrail-detail-1200.jpg` | Meet Jay (decorative) | H&CO | https://unsplash.com/photos/RDZ1MrGXgvM | Unsplash Licence |

**Artwork:** everything in `images/art/` and `favicon.svg` is original artwork made for this site.

If you change the hero photo, regenerate `images/art/og-image.png` (1200×630) so the sharing image matches.

## Tests

```
node tests/quote.test.js && node tests/placeholders.test.js
```

- `quote.test.js` checks the worked example (£119.70, 11970 pence, £518.70 a month), the typical-block examples, the free-travel radius, mixed floors, config changes and postcode validation.
- `placeholders.test.js` fails on the old template business name, lorem ipsum text, to-do markers, "[in area]", `href="#"`, or any `[` placeholder in the visible text of the pages. It lists, but allows, the `example.com`, `0191 000 0000` and `jays-cleaning.example` placeholders.

There is also a browser check (Playwright, phone-sized viewport) kept outside the repo. Run it from the repo root with `SP=<scratch dir> node <path to>/e2e.js`. It checks the worked example (£119.70 / £518.70), free travel for NE32 3DT, the "travel to be confirmed" note when the postcode API fails, the bad-postcode error, the mixed-floors error, the contact form prefill, and that the home page has no horizontal scroll at 375px.

## Accessibility and behaviour notes

- Every input has a visible label; hints and errors are linked with `aria-describedby`. Radios, selects and FAQ items are native elements.
- Visible 3px focus ring; colours meet WCAG AA. Animations respect `prefers-reduced-motion`.
- The pages read in full with JavaScript turned off: the menu shows as a plain list, figures fall back to wording without numbers, and the forms are still visible.
