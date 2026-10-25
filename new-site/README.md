# Harbor Ops website

The marketing website for harborops.co.uk. It is a static site: plain HTML, CSS and JavaScript, with no build
step, no server code, no database, no cookies and no tracking. Upload the folder to any web host and it works.

October 2026

## What's in the folder

| Path | What it is |
| --- | --- |
| `index.html` | The home page |
| `login.html`, `signup.html` | New designs for sign-in and the demo request ("the front door"). Not connected to the Harbor app yet: see *Before launch* |
| `privacy.html`, `terms.html`, `cookies.html` | Legal pages with placeholder text, to be replaced |
| `404.html` | Page not found |
| `css/site.css`, `js/site.js` | Home page styles and animation |
| `css/auth.css`, `js/auth.js` | Sign-in and demo request pages |
| `css/legal.css` | Legal pages |
| `assets/brand/` | Logos, icons and the image shown when a link is shared |
| `assets/street/` | Harbor Street: the townhouses, skies and mist of the opening |
| `assets/outro/` | The evening street at the end of the home page |
| `assets/ai/` | Photos |
| `assets/door/` | The brass fittings on the sign-in and demo pages |
| `robots.txt`, `sitemap.xml` | For search engines |
| `hosting/nginx.conf` | Example web-server settings |

## View it on your computer

Open a terminal in this folder and run:

```
python3 -m http.server 8080
```

Then go to http://localhost:8080. Use a local server like this rather than double-clicking `index.html`: browsers
block part of the opening animation on files opened directly.

## Publish it

Upload everything in this folder to the web root of the host. Most static hosts work (Netlify, Cloudflare Pages,
Vercel, S3, nginx, Apache). The settings that matter:

- **Pages (`.html`)** should not be cached (`Cache-Control: no-cache`), so changes show at once.
- **Images, styles and scripts** can be cached. The HTML links them with a `?v=` version, so a replaced file shows
  as soon as its `?v=` value is changed.
- **Missing pages** should show `404.html`. Most hosts do this automatically.
- **Short addresses** such as `/login` for `login.html` are optional.

`hosting/nginx.conf` sets all of this for nginx.

## Before launch

1. **Sign in and Request a demo.** The site's buttons open `login.html` and `signup.html`, which are not connected to
   the Harbor app. Choose one:
   - **Connect them.** The field names already match the app's current forms: `email`, `password`, `stay_signed_in` for sign-in;
     `first_name`, `last_name`, `email`, `company`, `portfolio_size`, `goal`, `terms` for the demo request. Remove
     `data-preview` from each form, keep the app's own submit logic, and call `HarborDoor.openDoor()` or
     `HarborDoor.postCard()` when a submission succeeds. The note at the top of `js/auth.js` explains this.
   - **Or point the buttons at the app's pages** (`https://www.harborops.co.uk/login` and `/signup`) until they are
     connected.

   Until then, the two pages say plainly that they aren't connected and link to the app's working pages.
   "Forgot password?" opens the app's current reset page.
2. **Legal pages.** Replace the placeholder text in `privacy.html`, `terms.html` and `cookies.html`. The details still
   needed are highlighted in [brackets]. Then remove `<meta name="robots" content="noindex">` from those pages.
3. **Phone number.** The footer and terms page show +44 794776870, as supplied. UK mobile numbers have 10 digits
   after +44, so please check it. Email: info@harborops.co.uk.
4. **Domain.** The canonical address, share image, `robots.txt` and `sitemap.xml` all assume
   https://www.harborops.co.uk/. The Harbor app currently serves that whole domain, so decide with your developers
   where each one lives (for example, the site on www and the app on its own subdomain).

## Making changes

- **Text** is in the HTML files. Two-tone headlines use `<span class="t1">` for the dark part and
  `<span class="t2">` for the grey part.
- **Images:** replace the file with one of the same name and size. Then change its `?v=` value wherever the HTML links it.
- **Styles or scripts:** after editing `css/site.css` or `js/site.js`, change their `?v=` values in `index.html`.
- **Animation:** on computers, the opening plays as you scroll. On phones and tablets it plays once by itself and
  nothing is tied to scrolling, so the page stays smooth. Visitors whose device asks for reduced motion get a still
  version. All of this is in `js/site.js`.

## Built with

- **Fonts:** Urbanist and Lora, from Google Fonts (free, SIL Open Font License). The brand font, Samsung Sharp Sans,
  can't be licensed for websites, so Urbanist stands in for it. A licence for Sharp Type's retail Sharp Sans would
  allow a switch later.
- **Animation:** GSAP 3.15 with ScrollTrigger, and Lenis 1.3.26 for smooth scrolling on computers. Both load from the
  jsDelivr CDN. GSAP is free to use commercially, and Lenis is MIT-licensed.
- **Images:** made for Harbor Ops. The photos and the Harbor Street townhouses are AI-generated; the skies, mist and
  door fittings are our own 3D renders. No stock photos or video are used.
