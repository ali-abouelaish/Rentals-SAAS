# Connect this website to Harbor Ops Leads: instructions for an AI coding agent

> **For the person at the agency:** give this whole file to your AI coding agent (Claude Code, Cursor, Copilot, etc.) with this instruction: *"Follow docs/website-leads-agent-guide.md to send our website enquiries to Harbor Ops."* Before you start, connect the website in Harbor Ops (**Leads → Settings → Connect a website**) and have the key (it starts with `hopk_`) ready to give the agent. The agent will ask you for it.

---

## Your task

Make every enquiry submitted through this website's forms also get sent to Harbor Ops. There it becomes a lead on the agency's Leads page. The website's existing behaviour must keep working exactly as before: the visitor sees the same confirmation, and any existing email notifications are still sent. Harbor Ops is an **additional** destination.

Work through the steps in order. Stop and ask the human when a step says so. Never guess a key or an endpoint.

---

## The contract (read this first)

| | |
|---|---|
| **Endpoint** | `POST https://harborops.co.uk/api/public/leads`. If the human gives you a different endpoint copied from Harbor Ops, use theirs. Never use an agency subdomain such as `acme.harborops.co.uk`. |
| **Auth** | Header `Authorization: Bearer <key>`. The key starts with `hopk_`. |
| **Body** | JSON object, `Content-Type: application/json`, max 64 KB. |
| **Required** | A valid `email` **or** a valid `phone` (7–15 digits). Everything else is optional. |
| **Success** | `201` = lead created. `200` with `"status":"duplicate"` = already received. Treat both as success. |
| **Test mode** | Add `"test": true`. Harbor checks the enquiry and replies `200` with `"status":"valid"`, but saves nothing. |

### Fields to send

| JSON field | What to put in it | Notes |
|---|---|---|
| `name` | Visitor's full name | If the form has separate first/last name fields, send `first_name` and `last_name` instead. |
| `email` | Visitor's email | |
| `phone` | Visitor's phone, as typed | Spaces, `+`, brackets and dashes are fine. |
| `message` | The visitor's message | Max 5,000 characters. |
| `page_url` | Full `https://` URL of the page the form was on | |
| `external_id` | A unique id for **this submission** | Use the form plugin's entry id if there is one, otherwise generate a UUID at submission time. Reuse the same id on retries so Harbor never stores a duplicate. Max 200 characters. |
| `property_ref` | The agency's own reference for the property/room, if the page is about one | Send this when the form is on a property page. |
| `property` | The property's address or title, if known | Shown as the lead's "Property address". |
| `listing_id` | Harbor's listing id | Send this **only** if the site gets its listings from Harbor's listings API (`GET /api/public/scraped-listings`). In that case it's the listing's `id`, and it links the lead to the exact room. |
| `form_name` | Which form was used, e.g. "Viewing request" | Optional. |
| *any other field* | Budget, move-in date, occupation, etc. | Send it under a readable key (`budget`, `move_in_date`). Harbor adds it to the lead's message as `Budget: …`, so nothing is lost. |

**Never send:**
- file uploads
- captcha/recaptcha/turnstile tokens
- CSRF tokens or nonces
- passwords
- the visitor's IP address

### Responses

| Status | Meaning | What your code should do |
|---|---|---|
| `201` | Created. May include `"warnings": [...]` | Success. Log any warnings. |
| `200` `"duplicate"` | Already received | Success. |
| `400` | Bad body, or no valid email/phone | Don't retry. Log `error` and `message`. |
| `401` | Key missing, wrong or disconnected | Don't retry. Log loudly; the agency needs a new key. |
| `403` | Wrong kind of key, or the feature is switched off | Don't retry. Log loudly. |
| `413` / `415` | Body too big / wrong content type | Don't retry. Fix the code. |
| `429` | Rate limited | Retry after the `Retry-After` header (seconds). |
| `5xx` or network error | Temporary problem | Retry up to 3 times with backoff (e.g. 1 s, 4 s, 10 s), using the **same** `external_id`. |

The limits are 60 requests/minute and 1,000/day per key, which is far above what a website needs.

---

## Step 1: Work out what kind of website this is

Inspect the repository and identify:
1. **The stack:** for example Next.js, Nuxt, Astro, plain Node/Express, PHP/Laravel, WordPress theme or plugin, Django, Rails, or a static site with no server.
2. **Every enquiry form:** contact, property enquiry, viewing request, valuation request, call-back. For each, note where it is defined and how it is submitted: to your own server code, to a form plugin, to a third-party form service (Formspree, Netlify Forms, HubSpot…), or by email only.

Then choose **one** path:

| What you found | Path |
|---|---|
| The forms submit to server code you can edit (API route, server action, controller, PHP handler, WordPress hooks) | **Path A: server-side** (preferred) |
| WordPress with a form plugin (Contact Form 7, Gravity Forms, WPForms, Elementor Pro) | **Path B: WordPress hook** |
| Static site, no server code at all | **Path C: direct form post** |
| Forms are handled by a third-party service you can't change, or by the agency's property-software provider | **Stop.** Tell the human that whoever runs that service must add a webhook to the endpoint above, and give them this file. |

Report your findings (stack, forms found, chosen path) to the human before writing code.

## Step 2: Get the key and store it safely

1. **Ask the human for the key.** It starts with `hopk_` and is shown once in Harbor Ops when they click **Connect a website**. If they no longer have it, they can connect the website again to get a new one. Never invent one.
2. **Store it in an environment variable** called `HARBOR_LEADS_KEY` (WordPress: a constant in `wp-config.php`). Add it to `.env.example` or equivalent, **with no value**.
3. **Keep it out of the repository and out of any browser bundle.** Never give it a client-exposed prefix (`NEXT_PUBLIC_`, `VITE_`, `PUBLIC_`, `REACT_APP_`). The only exception is Path C, where it appears in the page by design.
4. **Tell the human** they must also set `HARBOR_LEADS_KEY` in the production hosting environment.

## Step 3: Implement it

### Path A: server-side (any framework)

Write **one** reusable function, `sendLeadToHarbor(enquiry)`, and call it from every enquiry form's submit handler.

Rules:
- **Order:** call it **after** the form's own validation passes, alongside the existing behaviour (email notification, database save).
- **Never fail the visitor's submission because of Harbor.** Catch every error, log it, and return the visitor the normal success response.
- **Timeout** each request at 10 seconds.
- **Retries:** only on network errors, `429` and `5xx` (see the table above), always with the same `external_id`. If the platform makes in-request retries impractical (e.g. short serverless limits), one attempt plus logging is acceptable.
- **Logging:** log status codes and Harbor's `error`/`message`, but never the visitor's personal details or the key.

**TypeScript / Node 18+ (Next.js route handler or server action, Express, etc.)**

```ts
// lib/harbor.ts — server only
import { randomUUID } from "node:crypto";

const HARBOR_ENDPOINT = "https://harborops.co.uk/api/public/leads";

export type Enquiry = {
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  message?: string;
  pageUrl?: string;
  propertyRef?: string;
  property?: string;
  listingId?: string;
  formName?: string;
  submissionId?: string; // pass your own id if the form has one
  extra?: Record<string, string>; // budget, move_in_date, …
};

export async function sendLeadToHarbor(enquiry: Enquiry): Promise<void> {
  const key = process.env.HARBOR_LEADS_KEY;
  if (!key) {
    console.error("[harbor] HARBOR_LEADS_KEY is not set; lead not sent");
    return;
  }

  const body = JSON.stringify({
    name: enquiry.name,
    first_name: enquiry.firstName,
    last_name: enquiry.lastName,
    email: enquiry.email,
    phone: enquiry.phone,
    message: enquiry.message,
    page_url: enquiry.pageUrl,
    property_ref: enquiry.propertyRef,
    property: enquiry.property,
    listing_id: enquiry.listingId,
    form_name: enquiry.formName,
    external_id: enquiry.submissionId ?? randomUUID(), // generated once, reused on retries
    ...enquiry.extra,
  });

  const delays = [0, 1000, 4000, 10000];
  for (let attempt = 0; attempt < delays.length; attempt++) {
    if (delays[attempt]) await new Promise((r) => setTimeout(r, delays[attempt]));
    try {
      const res = await fetch(HARBOR_ENDPOINT, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body,
        signal: AbortSignal.timeout(10_000),
      });
      if (res.status === 201 || res.status === 200) return;
      const detail = await res.json().catch(() => ({}));
      if (res.status !== 429 && res.status < 500) {
        console.error("[harbor] lead rejected", res.status, detail.error, detail.message);
        return; // 4xx: retrying won't help
      }
      const retryAfter = Number(res.headers.get("retry-after"));
      if (res.status === 429 && retryAfter > 0 && attempt + 1 < delays.length) {
        delays[attempt + 1] = Math.max(delays[attempt + 1], retryAfter * 1000);
      }
      console.warn("[harbor] temporary failure, will retry", res.status);
    } catch (err) {
      console.warn("[harbor] network error, will retry", (err as Error).name);
    }
  }
  console.error("[harbor] lead not delivered after retries");
}
```

Call it from the submit handler, e.g. `await sendLeadToHarbor({ name, email, phone, message, pageUrl, propertyRef })`. If waiting for it would delay the visitor's response, run it after responding, using the platform's background mechanism (e.g. `waitUntil` / `after()` on serverless).

**PHP (plain PHP or Laravel)**

```php
function send_lead_to_harbor(array $lead): void {
    $key = getenv('HARBOR_LEADS_KEY');
    if (!$key) { error_log('[harbor] HARBOR_LEADS_KEY is not set'); return; }

    $lead['external_id'] = $lead['external_id'] ?? bin2hex(random_bytes(16));
    $body = json_encode(array_filter($lead, fn($v) => $v !== null && $v !== ''));

    foreach ([0, 1, 4, 10] as $delay) {
        if ($delay) sleep($delay);
        $ch = curl_init('https://harborops.co.uk/api/public/leads');
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 10,
            CURLOPT_HTTPHEADER => ["Authorization: Bearer $key", 'Content-Type: application/json'],
            CURLOPT_POSTFIELDS => $body,
        ]);
        $response = curl_exec($ch);
        $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($status === 201 || $status === 200) return;
        if ($status >= 400 && $status < 500 && $status !== 429) {
            error_log("[harbor] lead rejected ($status): $response");
            return;
        }
    }
    error_log('[harbor] lead not delivered after retries');
}

// In the form handler, after validation:
send_lead_to_harbor([
    'name'     => $_POST['name'] ?? '',
    'email'    => $_POST['email'] ?? '',
    'phone'    => $_POST['phone'] ?? '',
    'message'  => $_POST['message'] ?? '',
    'page_url' => $_SERVER['HTTP_REFERER'] ?? '',
]);
```

**Python (Django, Flask, FastAPI)**

```python
import os, time, uuid, logging, requests

def send_lead_to_harbor(lead: dict) -> None:
    key = os.environ.get("HARBOR_LEADS_KEY")
    if not key:
        logging.error("[harbor] HARBOR_LEADS_KEY is not set"); return
    lead = {k: v for k, v in lead.items() if v not in (None, "")}
    lead.setdefault("external_id", str(uuid.uuid4()))
    for delay in (0, 1, 4, 10):
        time.sleep(delay)
        try:
            r = requests.post(
                "https://harborops.co.uk/api/public/leads",
                json=lead, timeout=10,
                headers={"Authorization": f"Bearer {key}"},
            )
        except requests.RequestException as e:
            logging.warning("[harbor] network error: %s", type(e).__name__); continue
        if r.status_code in (200, 201): return
        if 400 <= r.status_code < 500 and r.status_code != 429:
            logging.error("[harbor] lead rejected %s: %s", r.status_code, r.text); return
    logging.error("[harbor] lead not delivered after retries")
```

### Path B: WordPress hook

Create a must-use plugin at `wp-content/mu-plugins/harbor-leads.php`, so a theme change can't remove it. Ask the human to add `define('HARBOR_LEADS_KEY', 'hopk_…');` to `wp-config.php`.

```php
<?php
/**
 * Plugin Name: Harbor Ops Leads
 * Description: Sends website form enquiries to Harbor Ops.
 */

function harbor_send_lead(array $lead): void {
    if (!defined('HARBOR_LEADS_KEY') || !HARBOR_LEADS_KEY) return;
    $lead = array_filter($lead, fn($v) => $v !== null && $v !== '');
    $lead['page_url'] = $lead['page_url'] ?? wp_get_referer();
    $response = wp_remote_post('https://harborops.co.uk/api/public/leads', [
        'timeout' => 10,
        'headers' => [
            'Authorization' => 'Bearer ' . HARBOR_LEADS_KEY,
            'Content-Type'  => 'application/json',
        ],
        'body' => wp_json_encode($lead),
    ]);
    $status = is_wp_error($response) ? 0 : wp_remote_retrieve_response_code($response);
    if ($status !== 201 && $status !== 200) {
        error_log('[harbor] lead not delivered, status ' . $status);
    }
}
```

Then add the hook for **the plugin this site uses** (only that one). Map the plugin's field names to Harbor's fields by reading the actual form definitions in the site, not by assuming. Unknown extra fields can be passed through as-is.

```php
// Contact Form 7 (fires after validation, before CF7 sends its email)
add_action('wpcf7_before_send_mail', function ($form) {
    $sub = WPCF7_Submission::get_instance();
    if (!$sub) return;
    $d = $sub->get_posted_data();
    harbor_send_lead([
        'name'      => $d['your-name'] ?? '',
        'email'     => $d['your-email'] ?? '',
        'phone'     => $d['your-phone'] ?? ($d['tel'] ?? ''),
        'message'   => $d['your-message'] ?? '',
        'form_name' => $form->title(),
        'page_url'  => $sub->get_meta('url'),
    ]);
});

// Gravity Forms: replace the field ids ('1', '2'…) with this form's real ids
add_action('gform_after_submission', function ($entry, $form) {
    harbor_send_lead([
        'name'        => rgar($entry, '1'),
        'email'       => rgar($entry, '2'),
        'phone'       => rgar($entry, '3'),
        'message'     => rgar($entry, '4'),
        'form_name'   => $form['title'],
        'page_url'    => $entry['source_url'] ?? '',
        'external_id' => 'gf-' . $entry['id'],
    ]);
}, 10, 2);

// WPForms: fields are keyed by id, each with a 'name' (label) and 'value'
add_action('wpforms_process_complete', function ($fields, $entry, $form_data, $entry_id) {
    $lead = ['form_name' => $form_data['settings']['form_title'] ?? ''];
    if ($entry_id) $lead['external_id'] = 'wpf-' . $entry_id;
    foreach ($fields as $f) $lead[$f['name']] = $f['value']; // labels like "Email" are recognised
    harbor_send_lead($lead);
}, 10, 4);

// Elementor Pro forms
add_action('elementor_pro/forms/new_record', function ($record, $handler) {
    $lead = ['form_name' => $record->get_form_settings('form_name')];
    foreach ($record->get('fields') as $id => $field) $lead[$id] = $field['value'];
    harbor_send_lead($lead);
}, 10, 2);
```

Harbor recognises common field names automatically (`your-name`, `Email`, `tel`, `mobile`, `comments`, `enquiry`…). Map explicitly anyway where the form uses unusual names.

### Path C: static site (no server)

Only use this if there is truly no server code. The key will be visible in the page source. This is acceptable because the key can only add leads, but tell the human.

Change each enquiry form's opening tag so it posts straight to Harbor. Add a hidden spam trap and a redirect:

```html
<form action="https://harborops.co.uk/api/public/leads?key=hopk_THE_KEY" method="POST">
  <!-- keep the existing fields, but make sure they are named name, email, phone, message -->
  <input type="hidden" name="page_url" value="">
  <input type="text" name="_gotcha" tabindex="-1" autocomplete="off" style="display:none">
  <input type="hidden" name="_redirect" value="/thank-you">
  …
</form>
<script>document.querySelectorAll('input[name="page_url"]').forEach(i => i.value = location.href);</script>
```

- **`_redirect`:** must be a page on the same website (a relative path is best). After sending, the visitor is redirected there. Create the page if it doesn't exist.
- **`_gotcha`:** must stay empty and hidden. Bots fill it in, and Harbor then silently discards the submission.
- **Losing the old handler:** if the form previously posted somewhere else (e.g. an email service), this replaces it. Ask the human whether they still need that, and if so, use that service's webhook instead.

---

## Step 4: Test it

1. **Test mode first.** Send one request with `"test": true`, or a test form field `test` = `true` on Path C. Expect `200` with `"status":"valid"`. The response's `lead` object shows exactly what Harbor would store; check the fields landed where you expected. Example:
   ```bash
   curl -s -X POST "https://harborops.co.uk/api/public/leads" \
     -H "Authorization: Bearer $HARBOR_LEADS_KEY" -H "Content-Type: application/json" \
     -d '{"name":"Agent Test","email":"agent-test@example.com","message":"Integration test","test":true}'
   ```
2. **One real submission through the actual website form.** Expect `201`. Ask the human to confirm it appeared on their Harbor Ops **Leads** page with a **Website** badge, then to delete it.
3. **Duplicate check (Paths A/B).** Re-send the same payload with the same `external_id`. Expect `200` `"duplicate"`.
4. **Failure check.** Temporarily use a wrong key in a local environment. Confirm the visitor still gets the normal success experience and the error is logged. Then restore the real key.
5. **Never load-test the endpoint** or send more than a handful of test requests.

## Step 5: Acceptance checklist

Report each item to the human as done or not done:

- [ ] Every enquiry form found in Step 1 sends to Harbor (or the human agreed which ones to skip).
- [ ] The key lives only in `HARBOR_LEADS_KEY` (or the `wp-config.php` constant); it's not committed and not in a client bundle (Path C excepted).
- [ ] Existing form behaviour (confirmation, emails, any database save) is unchanged.
- [ ] A Harbor failure never breaks or slows down the visitor's submission noticeably.
- [ ] `external_id` is sent and reused on retries; 4xx responses are not retried.
- [ ] No files, captcha tokens, CSRF tokens or passwords are sent.
- [ ] Test mode returned `200 valid`, and one real submission appeared in Harbor Ops.

## Step 6: Hand over to the human

Tell the human, in plain language:
1. **What changed:** which files, and which forms now send to Harbor.
2. **Production setup:** they must set `HARBOR_LEADS_KEY` in the live hosting environment and deploy.
3. **When enquiries stop arriving:** Harbor Ops → Leads → Settings shows **Last request** for the website. If a key is ever exposed, they click **Disconnect** and **Connect a website** again, then update `HARBOR_LEADS_KEY`.
4. **Privacy notice:** enquiries are now also passed to Harbor Ops, their lettings software provider. They may want to mention this in the website's privacy notice.
