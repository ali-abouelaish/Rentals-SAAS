# Sign the agency's team in to this website from Harbor Ops: instructions for an AI coding agent

> **For the person at the agency:** give this whole file to your AI coding agent (Claude Code, Cursor, Copilot, etc.) with this instruction: *"Follow docs/website-sign-in-agent-guide.md so our team can open this website from Harbor Ops already signed in."* You'll need to be a Harbor Ops admin. Partway through, the agent gives you a **Sign-in URL** to enter in Harbor Ops and asks you for the **website secret** (it starts with `hos_`).

---

## Your task

Add a **sign-in handler** to this website. It's one endpoint that receives a signed token from Harbor Ops, checks it, and signs that person in. Agency staff then click the website's card on their Harbor Ops dashboard and arrive signed in. They don't need a login page, a password or a sign-up.

Everything the website already does must keep working exactly as before. That includes public pages, any existing login, and any existing user accounts. Harbor Ops sign-in is an **additional** way in for agency staff.

Work through the steps in order. Stop and ask the human when a step says so. Never guess the secret. Never weaken or skip a check to make a test pass.

---

## How it works

1. A staff member clicks the website's card on their Harbor Ops dashboard.
2. Harbor Ops checks they're signed in to Harbor. It then makes their browser send a form `POST` to this website's **Sign-in URL** with one field, `harbor_token`.
3. Your handler verifies the token, finds or creates the person's account, starts a session, and redirects them to the page that was pinned.

The POST arrives **cross-site** (from Harbor's domain). It carries no CSRF token of yours, and none of your cookies you can rely on. The signed token is the authentication.

---

## The contract (read this first)

| | |
|---|---|
| **Request** | `POST <Sign-in URL>`, `Content-Type: application/x-www-form-urlencoded`, one field: `harbor_token`. Never accept the token from a query string or a `GET`. |
| **Token** | A standard JWT (RFC 7519) in compact form `header.payload.signature`, signed with **HS256**. |
| **Key** | The website secret's UTF-8 bytes, **exactly as shown in Harbor Ops**, including the `hos_` prefix. Don't base64-decode it. |
| **Lifetime** | 60 seconds. Each token must be accepted **once only**. |
| **Success** | `303 See Other` to `return_to` if it's on this website, otherwise to `/`. |
| **Failure** | `403` with a plain message: *"This sign-in link has expired. Open the website again from Harbor Ops."* Use the same message for every failure, and never show a stack trace. |

### Claims in the token

| Claim | Example | Meaning |
|---|---|---|
| `iss` | `harbor-ops` | Always `harbor-ops`. |
| `aud` | `https://www.youragency.co.uk` | The origin (scheme + host + port) of the Sign-in URL. |
| `sub` | `8f14e45f-…` | The person's Harbor user id. Stable, even if their email changes. |
| `email` | `jane@youragency.co.uk` | Their email, lowercased. Harbor confirms it with its auth server on every sign-in. |
| `name` | `Jane Smith` | Display name. **May be `null`.** |
| `role` | `agent` | Their Harbor role, e.g. `admin` or `agent`. |
| `is_admin` | `false` | `true` for the agency's Harbor admins. |
| `agency_id` | `b5b00020-…` | The agency's Harbor id. |
| `return_to` | `https://www.youragency.co.uk/staff` | The page that was pinned in Harbor. |
| `iat` / `exp` | `1761300000` / `1761300060` | Issued at / expires, in Unix seconds. |
| `jti` | `0b6c2a8e-…` | Unique per sign-in. |

### Checks: reject unless every one passes

1. The token has three parts, and the header's `alg` is exactly `HS256`. Reject `none` and every other algorithm.
2. The signature equals HMAC-SHA256 of `header.payload` under the secret. Compare in constant time.
3. `iss` is `harbor-ops`.
4. `aud` is this website's origin. Take the origin from configuration, **not** from the request's `Host` header.
5. `exp` hasn't passed. Allow up to 30 seconds for clock differences.
6. `sub`, `email` and `jti` are present.
7. The `jti` hasn't been seen before. Record each accepted `jti` for at least 5 minutes, in a store shared by every server instance.

---

## Step 1: Work out what kind of website this is

Inspect the repository and identify:

1. **The stack:** WordPress, Next.js, Express, Laravel, plain PHP, Django, Flask, a static site, or a hosted builder.
2. **Existing auth:** does the site already have user accounts and a login (WordPress users, Laravel auth, Django auth, a users table)? How are sessions kept? Is there a framework CSRF protection the new route must be exempted from?
3. **Hosting:** one server, or several instances or serverless? This decides where the used-`jti` list lives.

**Then ask the human what signed-in staff should get.** Don't invent privileges. Ask:

- Which pages or features should be for signed-in staff only?
- Should Harbor admins (`is_admin: true`) get more than other staff? If so, what?
- If the site has accounts: what role should a first-time person get? Default: the site's lowest role that still covers what staff need, never an administrator or superuser role.

Choose **one** path:

| What you found | Path |
|---|---|
| WordPress | **Path A: WordPress** |
| Node.js (Express, Next.js) | **Path B: Node.js** |
| PHP (plain PHP, Laravel) | **Path C: PHP** |
| Python (Django, Flask) | **Path D: Python** |
| Another server stack (Rails, .NET, Go…) | Implement **the contract** with that stack's standard JWT library: `HS256` only, plus issuer, audience, 30 s leeway and the `jti` check. |
| The site already uses an external identity provider (Auth0, Clerk, Cognito, Auth.js) | **Stop.** Report how that provider could start a session server-side for a verified user. Agree an approach with the human before writing code. |
| Static site with no server code, or a hosted builder (Wix, Squarespace, Webflow, Shopify) | **Stop.** Tell the human this can't be done securely without server code: the token must be checked where the browser can't interfere. They need a developer-hosted site, or a server function in front of the protected pages. |

Report the stack, the existing auth, the privileges the human chose and your chosen path **before writing code**.

## Step 2: Choose the Sign-in URL and get the secret

1. **Choose the Sign-in URL.**
   - **WordPress:** `https://<site>/wp-admin/admin-post.php?action=harbor_sign_in`
   - **Everything else:** `https://<site>/harbor-sign-in` (choose another path if that one is taken).

   It **must** use `https` and the exact host the live site serves without redirecting. Check with `curl -sI https://<site>/`. If `youragency.co.uk` redirects to `www.youragency.co.uk`, use the `www` one. A redirect turns the POST into a GET and drops the token.

2. **Ask the human to set it up in Harbor Ops**, with these instructions:
   > In Harbor Ops, go to **Dashboard → Useful Resources → Manage links**. Add this website, or edit its link if it's already there. Set **URL** to the page your team should land on (on the same host as below). Tick **Sign my team in to this website**, paste this Sign-in URL: `<the URL>`, and click **Save**. In the dialog that opens, click **Show secret** and give me the secret. It starts with `hos_`.

   If Harbor says *"Website sign-in isn't available"*, the human must contact Harbor Ops support. You can't fix that from the website.

3. **Store the configuration** in environment variables:
   - `HARBOR_SIGN_IN_SECRET`: the secret.
   - `HARBOR_SIGN_IN_AUDIENCE`: the Sign-in URL's origin, e.g. `https://www.youragency.co.uk`, with no path and no trailing slash.

   On WordPress, use the `HARBOR_SIGN_IN_SECRET` constant in `wp-config.php` instead. The plugin works out the audience itself.

   Add both names to `.env.example` or the equivalent, **with no values**.

4. **Treat the secret like a database password.** Anyone who has it can sign in to this website as anyone.
   - Never commit it.
   - Never give it a client-exposed prefix (`NEXT_PUBLIC_`, `VITE_`, `PUBLIC_`, `REACT_APP_`).
   - Never log it.
   - Never put it in page source.

5. **Tell the human** they must set the same variables in the production hosting environment.

## Step 3: Implement it

### Rules for every path

- **Only the handler route is exempt from CSRF protection.** The signed token replaces the CSRF check there. Don't exempt anything else.
- **Rotate the session id** on sign-in to prevent session fixation.
- **Session cookie:** `HttpOnly`, `Secure` and `SameSite=Lax`. Not `Strict`: a Strict cookie isn't sent on the redirect after a cross-site POST, so the person would look signed out. Not `None` either.
- **Session length:** no longer than the site's normal login, ideally a day or less. When someone leaves the agency, Harbor stops new sign-ins at once, but a session the site already issued lasts until it expires.
- **Accounts** (sites with user accounts):
  - Match the person by a stored Harbor `sub` first, then by `email`.
  - Create missing accounts with the role agreed in Step 1, and an unusable random password.
  - **Never change an existing account's role automatically**, and never auto-create administrators.
- **No accounts?** Store `{ id: sub, email, name, isAdmin: is_admin }` in the session. Gate the staff-only pages and features from Step 1 with one small helper, e.g. `requireStaff()`.
- **Redirect** with `303` to `return_to` only when its origin equals `HARBOR_SIGN_IN_AUDIENCE`. Otherwise redirect to `/`.
- **Logging:** log why a sign-in failed (bad signature, expired, replayed…) on the server only. Never log the token or the secret.

### Path A: WordPress

Create a must-use plugin at `wp-content/mu-plugins/harbor-sign-in.php`, so a theme change can't remove it and nobody can deactivate it by accident. Ask the human to add `define('HARBOR_SIGN_IN_SECRET', 'hos_…');` to `wp-config.php`, above the *"That's all, stop editing!"* line.

Set the two role constants to what the human chose in Step 1. People whose email already has a WordPress account keep that account's role.

```php
<?php
/**
 * Plugin Name: Harbor Ops sign-in
 * Description: Signs your team in when they open this website from their Harbor Ops dashboard.
 */

// WordPress role for someone signing in from Harbor for the first time.
// An existing WordPress account with the same email keeps its own role.
const HARBOR_ADMIN_ROLE = 'editor'; // Harbor Ops admins
const HARBOR_STAFF_ROLE = 'author'; // everyone else

add_action('admin_post_nopriv_harbor_sign_in', 'harbor_sign_in');
add_action('admin_post_harbor_sign_in', 'harbor_sign_in');

function harbor_sign_in() {
    $claims = harbor_verify_token(wp_unslash($_POST['harbor_token'] ?? ''));
    if (!$claims) {
        wp_die('This sign-in link has expired. Open the website again from Harbor Ops.', 'Sign-in failed', ['response' => 403]);
    }

    $user = get_user_by('email', $claims['email']);
    if (!$user) {
        $user_id = wp_insert_user([
            'user_login'   => 'harbor-' . substr($claims['sub'], 0, 8),
            'user_email'   => $claims['email'],
            'display_name' => $claims['name'] ?: $claims['email'],
            'user_pass'    => wp_generate_password(32),
            'role'         => $claims['is_admin'] ? HARBOR_ADMIN_ROLE : HARBOR_STAFF_ROLE,
        ]);
        if (is_wp_error($user_id)) {
            wp_die(esc_html($user_id->get_error_message()), 'Sign-in failed', ['response' => 500]);
        }
        $user = get_user_by('id', $user_id);
    }

    wp_set_current_user($user->ID);
    wp_set_auth_cookie($user->ID);
    wp_safe_redirect(wp_validate_redirect($claims['return_to'] ?? '', home_url('/')), 303);
    exit;
}

function harbor_verify_token($token) {
    $parts = explode('.', $token);
    if (count($parts) !== 3 || !defined('HARBOR_SIGN_IN_SECRET')) return null;
    [$header, $payload, $signature] = $parts;

    $expected = harbor_b64url_encode(hash_hmac('sha256', "$header.$payload", HARBOR_SIGN_IN_SECRET, true));
    if (!hash_equals($expected, $signature)) return null;
    if ((json_decode(harbor_b64url_decode($header), true)['alg'] ?? '') !== 'HS256') return null;

    $claims = json_decode(harbor_b64url_decode($payload), true);
    $site = wp_parse_url(site_url());
    $origin = $site['scheme'] . '://' . $site['host'] . (isset($site['port']) ? ':' . $site['port'] : '');
    if (!is_array($claims)
        || ($claims['iss'] ?? '') !== 'harbor-ops'
        || ($claims['aud'] ?? '') !== $origin
        || ($claims['exp'] ?? 0) < time() - 30
        || empty($claims['email']) || empty($claims['sub']) || empty($claims['jti'])) {
        return null;
    }

    // Each token works once.
    $used = 'harbor_jti_' . md5($claims['jti']);
    if (get_transient($used)) return null;
    set_transient($used, 1, 5 * MINUTE_IN_SECONDS);

    return $claims;
}

function harbor_b64url_encode($bytes) { return rtrim(strtr(base64_encode($bytes), '+/', '-_'), '='); }
function harbor_b64url_decode($text) { return base64_decode(strtr($text, '-_', '+/')); }
```

WordPress notes:

- **The audience is `site_url()`'s origin.** The Sign-in URL's host must match **Settings → General → WordPress Address** exactly, including `www`.
- **Security plugins:** if one blocks `/wp-admin/` for signed-out visitors (e.g. a "hide login" plugin), allow `admin-post.php` there. If you can't, hook the same function to `init` on a custom path instead.
- **Page caching:** make sure caching and CDN plugins never cache `admin-post.php` POSTs. By default they don't.
- **Transients** are shared through the database, so the replay check works on multi-server hosting too. If the site uses a non-persistent object cache per server, keep the default database transients.

### Path B: Node.js (Express or Next.js)

One server-only module that verifies tokens. It needs no dependencies:

```ts
// lib/harbor-sign-in.ts — server only
import { createHmac, timingSafeEqual } from "node:crypto";

export type HarborClaims = {
  iss: string;
  aud: string;
  sub: string;
  email: string;
  name: string | null;
  role: string;
  is_admin: boolean;
  agency_id: string;
  return_to?: string;
  iat: number;
  exp: number;
  jti: string;
};

export const SIGN_IN_FAILED = "This sign-in link has expired. Open the website again from Harbor Ops.";

// jti -> expiry (ms). In-memory only works on ONE long-running server: on
// serverless or several instances, use Redis/KV or a database table instead.
const usedTokens = new Map<string, number>();

function decodeJson(part: string): Record<string, unknown> | null {
  try {
    return JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

export function verifyHarborToken(token: unknown): HarborClaims | null {
  const secret = process.env.HARBOR_SIGN_IN_SECRET;
  const audience = process.env.HARBOR_SIGN_IN_AUDIENCE;
  if (!secret || !audience || typeof token !== "string") return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;

  const expected = createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return null;
  }

  const h = decodeJson(header);
  const c = decodeJson(payload);
  if (!h || !c || h.alg !== "HS256") return null;

  const now = Math.floor(Date.now() / 1000);
  if (c.iss !== "harbor-ops" || c.aud !== audience) return null;
  if (typeof c.exp !== "number" || c.exp + 30 < now) return null;
  if (typeof c.sub !== "string" || !c.sub || typeof c.email !== "string" || !c.email) return null;
  if (typeof c.jti !== "string" || !c.jti) return null;

  // Each token works once.
  for (const [jti, until] of usedTokens) if (until < Date.now()) usedTokens.delete(jti);
  if (usedTokens.has(c.jti)) return null;
  usedTokens.set(c.jti, Date.now() + 5 * 60_000);

  return c as unknown as HarborClaims;
}

/** A path on this website to send the person to; anything off-site becomes "/". */
export function safeReturnTo(returnTo: unknown): string {
  const origin = process.env.HARBOR_SIGN_IN_AUDIENCE!;
  try {
    const url = new URL(typeof returnTo === "string" ? returnTo : "/", origin);
    return url.origin === origin ? url.pathname + url.search + url.hash : "/";
  } catch {
    return "/";
  }
}
```

**Express** (`npm install express-session`, or use the site's existing session middleware):

```ts
import express from "express";
import session from "express-session";
import { SIGN_IN_FAILED, safeReturnTo, verifyHarborToken } from "./lib/harbor-sign-in";

declare module "express-session" {
  interface SessionData {
    staff?: { id: string; email: string; name: string | null; isAdmin: boolean };
  }
}

// In the site's existing Express app:
app.use(session({
  secret: process.env.SESSION_SECRET!,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, secure: true, sameSite: "lax", maxAge: 12 * 60 * 60 * 1000 },
}));

// If the app uses csurf or similar, register this route BEFORE that middleware.
app.post("/harbor-sign-in", express.urlencoded({ extended: false }), (req, res) => {
  const claims = verifyHarborToken(req.body?.harbor_token);
  if (!claims) return res.status(403).send(SIGN_IN_FAILED);

  req.session.regenerate((err) => {
    if (err) return res.status(500).send("Sign-in failed. Please try again.");
    // Sites with accounts: look up / create the user here (see "Rules for every path").
    req.session.staff = { id: claims.sub, email: claims.email, name: claims.name, isAdmin: claims.is_admin };
    res.redirect(303, safeReturnTo(claims.return_to));
  });
});
```

**Next.js App Router** (`npm install iron-session`, unless the site already has its own session handling). Route handlers have no built-in CSRF check, so no exemption is needed. The session options go in their own module, because a `route.ts` file may only export handlers and route config:

```ts
// lib/staff-session.ts — server only
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";

export type StaffSession = { staff?: { id: string; email: string; name: string | null; isAdmin: boolean } };

export async function getStaffSession() {
  return getIronSession<StaffSession>(await cookies(), {
    password: process.env.SESSION_SECRET!, // 32+ random characters, server-only
    cookieName: "staff_session",
    ttl: 12 * 60 * 60, // iron-session defaults to HttpOnly, Secure, SameSite=Lax
  });
}
```

```ts
// app/harbor-sign-in/route.ts
import { NextResponse } from "next/server";
import { SIGN_IN_FAILED, safeReturnTo, verifyHarborToken } from "@/lib/harbor-sign-in";
import { getStaffSession } from "@/lib/staff-session";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const form = await req.formData();
  const claims = verifyHarborToken(form.get("harbor_token"));
  if (!claims) return new NextResponse(SIGN_IN_FAILED, { status: 403 });

  const session = await getStaffSession();
  session.staff = { id: claims.sub, email: claims.email, name: claims.name, isAdmin: claims.is_admin };
  await session.save();

  return NextResponse.redirect(new URL(safeReturnTo(claims.return_to), process.env.HARBOR_SIGN_IN_AUDIENCE!), 303);
}
```

Read it with `(await getStaffSession()).staff` wherever staff-only pages or features need it. Use it in server components and route handlers, never in client code. On Vercel or any serverless host, replace the in-memory `usedTokens` map with a shared store, e.g. Redis/KV `SET jti 1 NX EX 300`, or a unique-keyed database row.

### Path C: PHP (plain PHP or Laravel)

Shared verifier. It takes a `$claimJti` callback, so the used-token store can be whatever the site has:

```php
<?php
// harbor_sign_in.php — server only
const HARBOR_SIGN_IN_FAILED = 'This sign-in link has expired. Open the website again from Harbor Ops.';

/** @param callable(string):bool $claimJti returns false if this jti was already used */
function harbor_verify_token(string $token, callable $claimJti): ?array {
    $secret = getenv('HARBOR_SIGN_IN_SECRET');
    $audience = getenv('HARBOR_SIGN_IN_AUDIENCE');
    $parts = explode('.', $token);
    if (!$secret || !$audience || count($parts) !== 3) return null;
    [$header, $payload, $signature] = $parts;

    $b64 = fn($bytes) => rtrim(strtr(base64_encode($bytes), '+/', '-_'), '=');
    $unb64 = fn($text) => base64_decode(strtr($text, '-_', '+/'));

    if (!hash_equals($b64(hash_hmac('sha256', "$header.$payload", $secret, true)), $signature)) return null;
    if ((json_decode($unb64($header), true)['alg'] ?? '') !== 'HS256') return null;

    $c = json_decode($unb64($payload), true);
    if (!is_array($c)
        || ($c['iss'] ?? '') !== 'harbor-ops'
        || ($c['aud'] ?? '') !== $audience
        || ($c['exp'] ?? 0) + 30 < time()
        || empty($c['sub']) || empty($c['email']) || empty($c['jti'])) {
        return null;
    }
    return $claimJti($c['jti']) ? $c : null; // each token works once
}

/** A path on this website to send the person to; anything off-site becomes "/". */
function harbor_safe_return_to($returnTo): string {
    $audience = getenv('HARBOR_SIGN_IN_AUDIENCE');
    $u = parse_url(is_string($returnTo) ? $returnTo : '');
    if (!$u || empty($u['host'])) return '/';
    $origin = ($u['scheme'] ?? '') . '://' . $u['host'] . (isset($u['port']) ? ':' . $u['port'] : '');
    if ($origin !== $audience) return '/';
    return ($u['path'] ?? '/') . (isset($u['query']) ? '?' . $u['query'] : '');
}
```

**Plain PHP** handler, e.g. `public/harbor-sign-in.php` or a route in the site's front controller. It needs a table `harbor_used_tokens (jti VARCHAR(64) PRIMARY KEY, expires_at INT NOT NULL)`:

```php
<?php
require __DIR__ . '/../harbor_sign_in.php';

session_set_cookie_params(['lifetime' => 0, 'path' => '/', 'secure' => true, 'httponly' => true, 'samesite' => 'Lax']);
session_start();

$db = get_pdo(); // the site's PDO connection, with PDO::ERRMODE_EXCEPTION
$claims = harbor_verify_token((string) ($_POST['harbor_token'] ?? ''), function (string $jti) use ($db): bool {
    $db->prepare('DELETE FROM harbor_used_tokens WHERE expires_at < ?')->execute([time()]);
    try {
        $db->prepare('INSERT INTO harbor_used_tokens (jti, expires_at) VALUES (?, ?)')->execute([$jti, time() + 300]);
        return true;
    } catch (PDOException $e) {
        return false; // duplicate key: already used
    }
});

if (!$claims) {
    http_response_code(403);
    exit(HARBOR_SIGN_IN_FAILED);
}

session_regenerate_id(true);
$_SESSION['staff'] = ['id' => $claims['sub'], 'email' => $claims['email'], 'name' => $claims['name'], 'is_admin' => $claims['is_admin']];
header('Location: ' . harbor_safe_return_to($claims['return_to'] ?? '/'), true, 303);
exit;
```

**Laravel:** load the verifier, e.g. through `composer.json` `autoload.files`, and add:

```php
// routes/web.php
Route::post('/harbor-sign-in', function (Illuminate\Http\Request $request) {
    $claims = harbor_verify_token(
        (string) $request->input('harbor_token'),
        fn (string $jti) => Cache::add("harbor_jti:$jti", 1, 300), // false if already used
    );
    abort_unless($claims, 403, HARBOR_SIGN_IN_FAILED);

    $user = App\Models\User::where('email', $claims['email'])->first()
        ?? App\Models\User::create([
            'name' => $claims['name'] ?: $claims['email'],
            'email' => $claims['email'],
            'password' => Hash::make(Str::random(40)),
            // role: as agreed in Step 1; never an admin role automatically
        ]);

    Auth::login($user);
    $request->session()->regenerate();
    return redirect(harbor_safe_return_to($claims['return_to'] ?? '/'), 303);
});
```

- **CSRF exemption:** on Laravel 11+, add `'harbor-sign-in'` to `$middleware->validateCsrfTokens(except: [...])` in `bootstrap/app.php`. On Laravel 10 and older, add it to `$except` in `app/Http/Middleware/VerifyCsrfToken.php`.
- **Cache store:** `Cache::add` must use a store shared by every server, such as `redis`, `database` or `memcached`. Don't use `array`, or `file` across several servers.
- **Cookies:** set `SESSION_SECURE_COOKIE=true` and `SESSION_SAME_SITE=lax`.

### Path D: Python (Django or Flask)

Use PyJWT (`pip install PyJWT`). It performs the signature, algorithm, issuer, audience and expiry checks itself.

```python
# harbor_sign_in.py — server only
import os
from typing import Callable, Optional
from urllib.parse import urlsplit

import jwt  # PyJWT

SIGN_IN_FAILED = "This sign-in link has expired. Open the website again from Harbor Ops."


def verify_harbor_token(token: str, claim_jti: Callable[[str], bool]) -> Optional[dict]:
    """claim_jti returns False if this jti was already used."""
    try:
        claims = jwt.decode(
            token,
            os.environ["HARBOR_SIGN_IN_SECRET"],
            algorithms=["HS256"],
            audience=os.environ["HARBOR_SIGN_IN_AUDIENCE"],
            issuer="harbor-ops",
            leeway=30,
            options={"require": ["exp", "iat", "iss", "aud", "sub", "jti"]},
        )
    except (jwt.InvalidTokenError, KeyError):
        return None
    if not claims.get("email") or not claim_jti(claims["jti"]):
        return None
    return claims


def safe_return_to(return_to) -> str:
    """A path on this website to send the person to; anything off-site becomes "/"."""
    audience = os.environ["HARBOR_SIGN_IN_AUDIENCE"]
    u = urlsplit(return_to if isinstance(return_to, str) else "")
    if f"{u.scheme}://{u.netloc}" != audience:
        return "/"
    return (u.path or "/") + (f"?{u.query}" if u.query else "")
```

**Django** (the route goes in `urls.py` as `path("harbor-sign-in", harbor_sign_in)`):

```python
from django.contrib.auth import get_user_model, login
from django.core.cache import cache
from django.http import HttpResponse, HttpResponseForbidden
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from .harbor_sign_in import SIGN_IN_FAILED, safe_return_to, verify_harbor_token


@csrf_exempt  # the signed token replaces the CSRF check on this one view
@require_POST
def harbor_sign_in(request):
    claims = verify_harbor_token(
        request.POST.get("harbor_token", ""),
        lambda jti: cache.add(f"harbor_jti:{jti}", 1, 300),  # False if already used
    )
    if not claims:
        return HttpResponseForbidden(SIGN_IN_FAILED)

    User = get_user_model()
    user = User.objects.filter(email__iexact=claims["email"]).first()
    if user is None:
        # Role/permissions as agreed in Step 1; never is_staff or is_superuser automatically.
        user = User.objects.create_user(username=f"harbor-{claims['sub'][:8]}", email=claims["email"], password=None)
    login(request, user)  # also rotates the session key

    return HttpResponse(status=303, headers={"Location": safe_return_to(claims.get("return_to"))})
```

- **Cache:** `cache.add` needs a cache shared by every process, e.g. Redis, Memcached or the database cache. The default `LocMemCache` is per process.
- **Cookies:** in settings, set `SESSION_COOKIE_SECURE = True`. Leave `SESSION_COOKIE_SAMESITE` at its default, `"Lax"`.

**Flask:** call `verify_harbor_token` the same way in a `POST` route. Exempt that route only from Flask-WTF's `CSRFProtect` with `@csrf.exempt`. Then `session.clear()`, set `session["staff"] = {...}` and `return redirect(safe_return_to(...), code=303)`. Set `SESSION_COOKIE_SECURE=True` and `SESSION_COOKIE_SAMESITE="Lax"`.

---

## Step 4: Test it

Test locally first, with a **throwaway** secret. Never use the real one in a script, a shell history or a test file.

1. **Set local values.**
   - Non-WordPress: `HARBOR_SIGN_IN_SECRET=hos_local_test_only` and `HARBOR_SIGN_IN_AUDIENCE=http://localhost:<port>`.
   - WordPress: use the local `site_url()` origin as the audience.
2. **Mint a test token.** This does exactly what Harbor Ops does. It needs Node 18+ and no packages:
   ```bash
   export HARBOR_SIGN_IN_SECRET=hos_local_test_only HARBOR_SIGN_IN_AUDIENCE=http://localhost:3000
   TOKEN=$(node -e '
   const c = require("crypto"), s = process.env.HARBOR_SIGN_IN_SECRET, aud = process.env.HARBOR_SIGN_IN_AUDIENCE;
   const now = Math.floor(Date.now() / 1000), exp = now + Number(process.env.EXP_OFFSET || 60);
   const b = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
   const h = b({ alg: "HS256", typ: "JWT" });
   const p = b({ iss: "harbor-ops", aud, sub: "00000000-0000-4000-8000-000000000001", email: "agent-test@example.com",
     name: "Agent Test", role: "agent", is_admin: false, agency_id: "00000000-0000-4000-8000-000000000002",
     return_to: aud + "/", iat: now, exp, jti: c.randomUUID() });
   console.log(h + "." + p + "." + c.createHmac("sha256", s).update(h + "." + p).digest("base64url"));')
   ```
3. **Happy path:** `curl -si -X POST "<local Sign-in URL>" --data-urlencode "harbor_token=$TOKEN"`. Expect:
   - `303`, with a `Location` on the site
   - a session cookie with `HttpOnly` and `SameSite=Lax` (and `Secure` in production)
   Then open a staff-only page with that cookie and confirm the person is signed in with the agreed privileges.
4. **Every one of these must return `403` and set no session:**
   - **Replay:** the same `$TOKEN` sent a second time.
   - **Tampered:** `$TOKEN` with the last character of the signature changed.
   - **Expired:** mint with `EXP_OFFSET=-120`.
   - **Wrong audience:** mint with a different `HARBOR_SIGN_IN_AUDIENCE`.
   - **Wrong secret:** mint with a different `HARBOR_SIGN_IN_SECRET`.
   - **`alg: none`:** a token whose header is `{"alg":"none","typ":"JWT"}` and whose signature is empty.
   - **No token:** a POST with no `harbor_token`.
   - **GET:** a `GET` of the Sign-in URL must not sign anyone in.
5. **Nothing else changed:** public pages, any existing login, and the site's other forms behave exactly as before. CSRF protection is still on for every other route.
6. **Production, end to end.** After the human deploys with the real values, ask them to click the website's card on their Harbor Ops dashboard. They should land on the pinned page, signed in. If the site has different privileges for admins, ask a non-admin colleague to try too.
7. **Clean up:** delete the `agent-test@example.com` account if one was created. Remove the throwaway secret from any local env file.

## Step 5: Acceptance checklist

Report each item to the human as done or not done:

- [ ] The Sign-in URL is `https`, on the exact live host (no redirect), and entered in Harbor Ops.
- [ ] The secret lives only in `HARBOR_SIGN_IN_SECRET` (or the `wp-config.php` constant). It isn't committed, logged, or in any client bundle or page.
- [ ] All seven checks in the contract are enforced, and every failing case in Step 4 returns `403`.
- [ ] Used `jti`s are stored somewhere shared by every server instance for at least 5 minutes.
- [ ] Only the handler route is exempt from CSRF. The session id is rotated, and the cookie is `HttpOnly`, `Secure` and `SameSite=Lax`.
- [ ] New accounts get the role agreed in Step 1. Existing accounts keep their role, and no admin is created automatically.
- [ ] `return_to` is followed only when it's on this website.
- [ ] Existing site behaviour is unchanged, and the production click-through from Harbor Ops worked.

## Step 6: Hand over to the human

Tell the human, in plain language:

1. **What changed:** which files, the Sign-in URL, and what signed-in staff can now see or do.
2. **Production setup:** set `HARBOR_SIGN_IN_SECRET` and `HARBOR_SIGN_IN_AUDIENCE` (or the `wp-config.php` constant) in the live hosting environment, then deploy.
3. **If the secret is ever exposed, or a developer who had it leaves:** in Harbor Ops, click the key icon next to the link, then **Replace secret**. Update `HARBOR_SIGN_IN_SECRET` and redeploy. The website rejects sign-ins until it has the new secret.
4. **When someone leaves the agency:** removing them in Harbor Ops stops new sign-ins straight away. A session the site already gave them lasts until it expires. If that matters, also delete or sign out their account on the website (WordPress: **Users → edit the user → Sessions → Log Out Everywhere**, or delete the user).
5. **If sign-in stops working:**
   - *"expired" every time:* the secret was replaced in Harbor, the site moved between `www` and non-`www`, or the server clock is wrong.
   - *Signed out right after landing:* something changed the session cookie to `SameSite=Strict`.
