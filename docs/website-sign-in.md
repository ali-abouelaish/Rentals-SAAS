# Harbor Ops Website Sign-in

Let an agency's team open the agency website from their Harbor Ops dashboard **already signed in**. The website doesn't need its own login page, passwords or password resets: Harbor vouches for who each person is, and the website starts its own session for them.

---

## How it works

1. An agency admin pins the website under **Dashboard → Useful Resources → Manage links** and ticks **Sign my team in to this website**, entering the website's **Sign-in URL**.
2. A team member clicks the card. Harbor checks they're signed in to Harbor, then makes their browser send a form `POST` to the Sign-in URL with one field, `harbor_token`.
3. The website verifies the token with its **website secret**, starts a session for that person, and redirects them to the page that was pinned.

Using an AI coding agent on the website? Give it [website-sign-in-agent-guide.md](website-sign-in-agent-guide.md), which has step-by-step instructions and tested handlers for WordPress, Node.js, PHP and Python.

The token is valid for 60 seconds and should be accepted once only. It travels in the request body, not the URL, so it never appears in browser history, access logs or `Referer` headers.

---

## Quick start

1. In Harbor Ops, open **Manage links**, edit the link, tick **Sign my team in to this website**, and enter the Sign-in URL your handler will live at (see the examples below).
2. Click the **key** icon next to the link, then **Show secret**. The secret starts with `hos_`.
3. Store the secret in the website's server config (environment variable, `wp-config.php`, …). **Never** put it in the page, a JavaScript bundle or a public repository.
4. Add the sign-in handler. The same dialog has ready-to-paste code for WordPress and Node.js.
5. Click the card on the dashboard. You should land on the website signed in.

---

## The request

```
POST <your Sign-in URL>
Content-Type: application/x-www-form-urlencoded

harbor_token=<JWT>
```

`harbor_token` is a standard JSON Web Token ([RFC 7519](https://www.rfc-editor.org/rfc/rfc7519)) signed with **HS256**. The HMAC key is the website secret's UTF-8 bytes, exactly as shown in Harbor (including the `hos_` prefix). Any JWT library can verify it.

### Claims

| Claim | Example | Meaning |
|---|---|---|
| `iss` | `harbor-ops` | Always `harbor-ops`. |
| `aud` | `https://www.youragency.co.uk` | The origin (scheme + host + port) of the Sign-in URL. Check it's your own. |
| `sub` | `8f14e45f-…` | The person's Harbor user id. It stays the same if they change their email, so prefer it for matching accounts you created. |
| `email` | `jane@youragency.co.uk` | Their sign-in email, lowercased. Harbor confirms it with its auth server on every sign-in. |
| `name` | `Jane Smith` | Display name. May be `null`. |
| `role` | `agent` | Their Harbor role, e.g. `admin` or `agent`. |
| `is_admin` | `false` | `true` for agency admins. The simplest way to decide who gets extra privileges. |
| `agency_id` | `b5b00020-…` | The agency's Harbor id. |
| `return_to` | `https://www.youragency.co.uk/staff` | The page the admin pinned. Redirect here after sign-in, but only if it's on your own website. |
| `iat` / `exp` | `1761300000` / `1761300060` | Issued at / expires, in Unix seconds. `exp` is 60 seconds after `iat`. |
| `jti` | `0b6c2a8e-…` | Unique per sign-in. |

## What the website must check

Reject the request (HTTP 403) unless **all** of these hold:

1. The signature is valid, and the header's `alg` is `HS256`. Never accept `none` or any other algorithm.
2. `iss` is `harbor-ops`.
3. `aud` is your website's origin.
4. `exp` hasn't passed. Allowing up to 30 seconds for clock differences is fine.
5. `jti` hasn't been seen before. Remember each accepted `jti` for at least 5 minutes.

Then:

- Find or create the person's account. On first sign-in, give them a role that matches `is_admin` or `role`. Don't change an existing account's role automatically.
- Start a session the way your website normally does. Use a `SameSite=Lax` cookie: a `Strict` cookie isn't sent on the redirect after a sign-in that arrives from Harbor, so the person would look signed out until their next click.
- Redirect with `303 See Other` to `return_to` if it's on your website, otherwise to your home page.

---

## WordPress

Harbor's dialog provides a complete must-use plugin. It needs no other plugins.

- **Config:** `define('HARBOR_SIGN_IN_SECRET', 'hos_…');` in `wp-config.php`.
- **File:** `wp-content/mu-plugins/harbor-sign-in.php`.
- **Sign-in URL:** `https://YOUR-SITE/wp-admin/admin-post.php?action=harbor_sign_in`

The plugin matches people to WordPress users by email and creates missing users with the roles set at the top of the file: `editor` for Harbor admins and `author` for everyone else. It never creates WordPress administrators. It stores used `jti`s as transients.

Some security plugins block `/wp-admin/` for signed-out visitors. If yours does, allow `admin-post.php`, or have the handler run on a custom path from an `init` hook.

## Node.js (Express)

```js
claims = jwt.verify(req.body.harbor_token, process.env.HARBOR_SIGN_IN_SECRET, {
  algorithms: ["HS256"],
  issuer: "harbor-ops",
  audience: "https://www.youragency.co.uk",
  clockTolerance: 30,
});
```

The full route, with replay protection, session and redirect, is in Harbor's dialog. Its in-memory replay list only works on a single server. Use Redis or your database if you run more than one.

---

## Secrets

- Each pinned website has its own secret, so one website can never accept tokens meant for another.
- **Show secret** can be used any time: Harbor doesn't store the secret, it recalculates it.
- **Replace secret** issues a new secret immediately. The website rejects every sign-in until the new secret is in its config. Do this if the secret has been exposed, or if a developer who had it has left.
- Anyone with the secret can sign in to the website as anyone, so treat it like a database password.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| "This sign-in link has expired" on every attempt | Wrong secret (or it was replaced), `aud` doesn't match because the site is configured as `https://youragency.co.uk` but the Sign-in URL uses `www.`, or the server clock is more than 30 seconds out. |
| Signed in on the handler but signed out on the landing page | The session cookie is `SameSite=Strict`. Use `Lax`. |
| Lands on the home page instead of the pinned page | `return_to` is on a different host from the website (for example apex vs `www`), so the handler correctly refused to redirect there. Pin the exact address. |
| Harbor shows "Website sign-in isn't available" | Harbor's server is missing its signing key. Contact Harbor Ops support. |
