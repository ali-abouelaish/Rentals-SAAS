# Harbor Ops Website Leads API

Send enquiries from your website's forms straight into your agency's **Leads** page in Harbor Ops. Each enquiry arrives within a second, with a "Website" badge, and it can be linked to the room it was about.

---

## Quick start

1. In Harbor Ops, go to **Leads → Settings → Website enquiries** and click **Connect a website**. Copy the key, which starts with `hopk_`. It is shown once only.
2. Send each enquiry to Harbor when your form is submitted:

   ```bash
   curl -X POST "https://harborops.co.uk/api/public/leads" \
     -H "Authorization: Bearer hopk_your_key" \
     -H "Content-Type: application/json" \
     -d '{"name":"Jane Doe","email":"jane@example.com","phone":"07700 900123","message":"Is the double room still available?","external_id":"enquiry-1001"}'
   ```
3. A `201` response means the lead is on the Leads page.

Add `"test": true` to check everything is wired up without creating a lead.

---

## Endpoint

```
POST https://harborops.co.uk/api/public/leads
```

- **Domain:** always use the main domain, never an agency subdomain. The key alone decides which agency a lead belongs to.
- **Encryption:** HTTPS only.

## Authentication

Every website connected in Harbor Ops gets its own key. A website key can **only add leads**: it can't read anything.

| Where the key goes | Example | Use when |
|---|---|---|
| `Authorization` header | `Authorization: Bearer hopk_…` | You control the server code (preferred) |
| `x-api-key` header | `x-api-key: hopk_…` | Your tool can't send an Authorization header |
| `key` query parameter | `…/api/public/leads?key=hopk_…` | Form plugins and builders that can only take a URL |

- **Header beats URL:** if both are sent, the header is used.
- **Only website keys go in URLs:** a key from *Settings → API Keys* can read data, so it is refused in a URL with `403 key_not_allowed_in_url`. Treat that key as exposed and revoke it.
- **Rotating a key:** in Harbor Ops, click **Disconnect** on the website (requests with the old key immediately get `401`), then **Connect a website** again and paste the new key into your site.

---

## Request body

| Content type | Notes |
|---|---|
| `application/json` | One JSON object per enquiry, or an array holding exactly one object (Zapier's "wrap in array" option). |
| `application/x-www-form-urlencoded` | A normal HTML form post. |
| `multipart/form-data` | Accepted, but file uploads are ignored; a `files_ignored` warning is returned. |
| `text/plain` | Accepted if the body is JSON (e.g. `navigator.sendBeacon`). |

The body can be at most **64 KB**.

### Fields

Field names are matched case-insensitively, with punctuation ignored. So `Email`, `your-email`, `email_address` and `yourEmail` all count as `email`.

| Field | Also recognised as | Notes |
|---|---|---|
| `name` | `full_name`, `your-name`, `contact_name`, `customer_name`, … | Or send `first_name` + `last_name` (also `fname`/`lname`, `surname`) and they're joined. If no name is sent, the lead is named "Website enquiry". |
| `email` | `your-email`, `email_address`, `mail`, … | **An email or a phone is required.** |
| `phone` | `telephone`, `tel`, `mobile`, `phone_number`, `contact_number`, … | Must have 7–15 digits; spaces, `+`, brackets and dashes are fine. |
| `message` | `your-message`, `comments`, `enquiry`, `inquiry`, `details`, `notes`, `question` | Up to 5,000 characters. |
| `listing_id` | | A Harbor listing id, the `id` from `GET /api/public/scraped-listings`. Links the lead to that room. Ids from another agency are ignored. |
| `property_ref` | `ref`, `reference`, `property_id`, `listing_ref` | Your own reference. Harbor links the lead to a listing only if exactly one listing matches it. |
| `property` | `property_address`, `property_title`, `listing_title` | The property the enquiry is about, shown as the lead's "Property address". |
| `page_url` | `url`, `referrer`, `page` | The http(s) address of the page the form is on. Shown as "View page on website". |
| `external_id` | `submission_id`, `entry_id`, `lead_id`, `enquiry_id` | **Strongly recommended.** Your own id for the submission; it makes retries safe (see [Duplicates](#duplicates)). Never use a bare `id`. |
| `form_name` | `form`, `form_title` | Shown at the top of the lead's message. |

**Everything else is kept.** Any other field is added to the lead's message as a `Label: value` line, such as `Budget: £900 pcm` or `Move in date: 2026-11-01`. The limits are 100 fields and 1,000 characters per field. The visitor's own address or postcode is kept this way too, because "Property address" means the property they're asking about.

**Dropped automatically:**
- keys starting with `_`
- keys containing `captcha`, `turnstile`, `nonce`, `token`, `secret`, `password` or `csrf`
- plugin plumbing: `action`, `submit`, `form_id`, `post_id`, `user_agent`, `remote_ip`, `powered_by`, `key`, `api_key`

### Control fields

| Field | Effect |
|---|---|
| `test` or `_test` | `true`, `1`, `yes` or `on` turns on test mode. Nothing is saved; the response shows exactly what would have been stored. |
| `_gotcha` or `_honeypot` | Spam trap. Hide it from people and leave it empty. If a bot fills it in, the request is answered as if it succeeded and then thrown away. |
| `_redirect` or `_next` | HTML form posts only: where to send the visitor afterwards. It must be on the same website as the page with the form; relative paths such as `/thank-you` work. |

### Form builders

These payload shapes are unwrapped automatically, so you don't need to restructure them:

- **Webflow:** form fields inside `data` (v1) or `payload.data` (v2). The envelope's `name` is taken as the form name, not the visitor's name.
- **Wix:** label/value arrays such as `data.submissions: [{ "label": "Email", "value": "…" }]`.
- **Elementor Pro:** both the simple format (field labels as keys) and "advanced data" (`fields[email][value]`).
- **Zapier:** a one-element array.

In general, if the top level has no email or phone field, Harbor looks inside `data`, `fields`, `payload`, `submission`, `entry`, `formData` or `values`, up to two levels deep.

---

## Responses

Every response is JSON, except for plain HTML form posts (see below).

| Status | Body | Meaning |
|---|---|---|
| `201` | `{"status":"created","id":"<uuid>","warnings":[…]}` | Lead created. `warnings` appears only if something was adjusted. |
| `200` | `{"status":"duplicate","id":"<uuid>"}` | Already received; nothing new was created. `id` is the existing lead. Treat it as success. |
| `200` | `{"status":"valid","test":true,"lead":{…},"warnings":[…]}` | Test mode: nothing saved. |
| `200` | `{"status":"ignored"}` | The spam trap was filled in. |
| `400` | `{"error":"invalid_body","message":"…"}` | The body is empty, isn't valid JSON, or isn't one object. |
| `400` | `{"error":"validation_failed","message":"…","fields":{"email":"…","phone":"…"}}` | No valid email and no valid phone. |
| `401` | `{"error":"unauthorized","message":"…"}` | Missing, wrong or disconnected key. |
| `403` | `{"error":"insufficient_scope",…}` | The key isn't a website key. |
| `403` | `{"error":"key_not_allowed_in_url",…}` | A read-capable key was put in the URL. Revoke it. |
| `403` | `{"error":"feature_disabled",…}` / `{"error":"account_inactive",…}` | Website capture is switched off for the agency, or the account isn't active. |
| `413` | `{"error":"payload_too_large",…}` | Over 64 KB. File uploads aren't supported. |
| `415` | `{"error":"unsupported_media_type",…}` | Use one of the content types above. |
| `429` | `{"error":"rate_limited","retry_after":30}` + `Retry-After` header | Too many requests; wait and retry. |
| `500` | `{"error":"server_error",…}` | Our fault. Retry with the same `external_id`. |

**Warnings.** A warning means the lead was still created, with something adjusted:

| Warning | What happened |
|---|---|
| `name_missing` | No name was sent; the lead was named "Website enquiry". |
| `email_invalid`, `phone_invalid` | The value wasn't valid, so it was kept in the message, as long as the other contact field was valid. |
| `page_url_invalid`, `listing_id_invalid` | The value wasn't valid and was kept in the message. |
| `listing_not_found` | `listing_id` didn't belong to the agency. |
| `message_truncated`, `fields_truncated` | Over-long text or too many fields were cut. |
| `files_ignored` | File uploads were dropped. |

**HTML form posts.** A browser submitting a plain HTML form is shown a result instead of JSON:
- **Success:** a `303` redirect to your `_redirect` page, or a simple "Thank you" page if there isn't one.
- **Error:** a simple page explaining what went wrong, with a link back to your page.

---

## Duplicates

The same enquiry is only ever stored once.

- **With `external_id`:** the lead is identified by your id, per connected website. Retrying a request with the same `external_id` returns `200 duplicate`, however long afterwards.
- **Without it:** Harbor fingerprints what the visitor sent (email, phone, message, listing/ref, page) for the current day (UTC).
  - Identical submissions that day, such as a double click or a plugin retry, become one lead.
  - The same words sent again on a later day create a new lead.

## Limits

| Limit | Value |
|---|---|
| Requests per key per minute | 60 |
| Requests per key from one IP address per minute | 10 |
| Requests per key per day | 1,000 |

Going over any limit returns `429` with a `Retry-After` header. Contact Harbor Ops support if you need more.

## CORS and calling from the browser

- **Supported:** cross-origin requests are allowed (`Access-Control-Allow-Origin: *`, preflight supported), so `fetch()` from a web page works.
- **Prefer server-side:** a key used in the browser is visible in your page's source. A website key can only add leads, so the risk is limited to junk enquiries, and the rate limits and spam trap help. If a key is abused, disconnect the website and connect it again.

---

## Recipes

### Server-side JavaScript (Node 18+)

```js
const res = await fetch("https://harborops.co.uk/api/public/leads", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.HARBOR_LEADS_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    name: enquiry.name,
    email: enquiry.email,
    phone: enquiry.phone,
    message: enquiry.message,
    page_url: enquiry.pageUrl,
    listing_id: enquiry.harborListingId, // optional
    external_id: enquiry.id,
  }),
});
if (res.status !== 201 && res.status !== 200) {
  console.error("Harbor lead failed", res.status, await res.text());
}
```

### PHP

```php
<?php
$ch = curl_init("https://harborops.co.uk/api/public/leads");
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 10,
    CURLOPT_HTTPHEADER => [
        "Authorization: Bearer " . getenv("HARBOR_LEADS_KEY"),
        "Content-Type: application/json",
    ],
    CURLOPT_POSTFIELDS => json_encode([
        "name" => $_POST["name"] ?? "",
        "email" => $_POST["email"] ?? "",
        "phone" => $_POST["phone"] ?? "",
        "message" => $_POST["message"] ?? "",
        "page_url" => $_SERVER["HTTP_REFERER"] ?? "",
    ]),
]);
$response = curl_exec($ch);
$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);
```

### Plain HTML form (no server code)

```html
<form action="https://harborops.co.uk/api/public/leads?key=hopk_your_key" method="POST">
  <label>Name <input name="name" required></label>
  <label>Email <input name="email" type="email"></label>
  <label>Phone <input name="phone" type="tel"></label>
  <label>Message <textarea name="message"></textarea></label>
  <input type="hidden" name="property_ref" value="R12">
  <!-- spam trap: hidden from people, leave empty -->
  <input type="text" name="_gotcha" tabindex="-1" autocomplete="off" style="display:none">
  <input type="hidden" name="_redirect" value="/thank-you">
  <button type="submit">Send enquiry</button>
</form>
```

### No-code tools

Menu names vary between versions; the setting you're looking for is always a **webhook URL** or **HTTP request**. Paste the webhook URL from Harbor, which already includes `?key=`.

| Tool | Where | Notes |
|---|---|---|
| **Elementor Pro** | Form widget → Actions After Submit → **Webhook** | Simple or advanced data both work. |
| **Contact Form 7** | Install a webhook add-on | CF7's `your-name`, `your-email`, `your-message` names are recognised. |
| **WPForms / Gravity Forms** | Their Webhooks add-on | Map fields to keys named `name`, `email`, `phone`, `message`. These add-ons can also send `Authorization: Bearer …` instead of using the URL key. |
| **Webflow** | Site settings → webhooks → trigger **Form submission** | |
| **Wix** | Automations: trigger "form submitted", action **Send HTTP request** (POST, JSON) | |
| **Zapier** | **Webhooks by Zapier → POST** | Map the form's fields under Data. |
| **Make** | **HTTP → Make a request** | Method POST, body type JSON or form. |

Whatever the tool, send one test submission first with a field `test` = `true`, then a real one.

---

## Troubleshooting

| Symptom | Check |
|---|---|
| `401 unauthorized` | Is the key copied exactly, and is the website still connected? |
| `403 feature_disabled` | Website capture is off for the agency; contact Harbor Ops support. |
| `400 validation_failed` | Your email/phone field names may not be recognised; rename them to `email` / `phone`. Use test mode to see what Harbor reads. |
| Enquiries stopped arriving | Leads → Settings shows **Last request** for each website. An old date means your site has stopped sending. |
| Leads arrive without a room | Send `listing_id`, the Harbor listing id from the listings API, for an exact link. |
