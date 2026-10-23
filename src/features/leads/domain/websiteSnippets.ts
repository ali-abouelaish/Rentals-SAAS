/**
 * Ready-to-paste examples for connecting a website, shown once, right after
 * it is connected — the only moment the key exists in plaintext. Pure, so the
 * dialog builds them client-side from the key it was just handed.
 */

export type WebsiteSnippets = {
  endpoint: string;
  /** The endpoint with the key embedded, for tools that can't set headers. */
  webhookUrl: string;
  curl: string;
  nodeFetch: string;
  php: string;
  htmlForm: string;
};

export function buildWebsiteSnippets({ baseUrl, key }: { baseUrl: string; key: string }): WebsiteSnippets {
  const endpoint = `${baseUrl.replace(/\/$/, "")}/api/public/leads`;
  const webhookUrl = `${endpoint}?key=${encodeURIComponent(key)}`;

  const curl = `curl -X POST "${endpoint}" \\
  -H "Authorization: Bearer ${key}" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Jane Doe","email":"jane@example.com","phone":"07700 900123","message":"Is the double room still available?","page_url":"https://your-site.co.uk/rooms/12","external_id":"enquiry-1001","test":true}'`;

  const nodeFetch = `// Server-side (Node 18+). Keep the key in an environment variable:
// HARBOR_LEADS_KEY=${key}
const res = await fetch("${endpoint}", {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${process.env.HARBOR_LEADS_KEY}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    name: enquiry.name,
    email: enquiry.email,
    phone: enquiry.phone,
    message: enquiry.message,
    page_url: enquiry.pageUrl,
    external_id: enquiry.id, // your own id for the submission — retries won't duplicate it
  }),
});
// 201 = created, 200 = duplicate (already received), 4xx = see the JSON "error"`;

  const php = `<?php
// In your form handler, after validating the submission.
// Keep the key out of your code: HARBOR_LEADS_KEY=${key}
$ch = curl_init("${endpoint}");
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
curl_close($ch);`;

  const htmlForm = `<form action="${webhookUrl}" method="POST">
  <label>Name <input name="name" required></label>
  <label>Email <input name="email" type="email"></label>
  <label>Phone <input name="phone" type="tel"></label>
  <label>Message <textarea name="message"></textarea></label>

  <!-- Optional: which room this page is about -->
  <input type="hidden" name="property_ref" value="R12">

  <!-- Spam trap: hidden from people, filled in by bots. Leave it empty. -->
  <input type="text" name="_gotcha" tabindex="-1" autocomplete="off" style="display:none">

  <!-- Where to send the visitor afterwards: a page on this same website -->
  <input type="hidden" name="_redirect" value="/thank-you">

  <button type="submit">Send enquiry</button>
</form>`;

  return { endpoint, webhookUrl, curl, nodeFetch, php, htmlForm };
}
