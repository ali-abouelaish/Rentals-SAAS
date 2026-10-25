/**
 * Copy-and-paste sign-in handlers for an agency's website, shown in the
 * Website sign-in dialog. They verify exactly what src/lib/site-sign-in/token.ts
 * signs; docs/website-sign-in.md is the full spec. The WordPress plugin is
 * duplicated in docs/website-sign-in-agent-guide.md (Path A): change both.
 *
 * The secret is never baked in: each snippet reads it from the site's own
 * config, so pasting one into a ticket or a chat doesn't leak it.
 */

const EXAMPLE_ORIGIN = "https://www.youragency.co.uk";

export const WORDPRESS_SIGN_IN_PATH = "/wp-admin/admin-post.php?action=harbor_sign_in";

export function buildSiteSignInSnippets({ callbackUrl }: { callbackUrl: string | null }) {
  let origin = EXAMPLE_ORIGIN;
  let path = "/harbor-sign-in";
  try {
    if (callbackUrl) {
      const u = new URL(callbackUrl);
      origin = u.origin;
      if (u.pathname !== "/") path = u.pathname;
    }
  } catch {
    // Not a URL yet — fall back to the example.
  }

  const wordpressConfig = `define('HARBOR_SIGN_IN_SECRET', 'paste the secret from Harbor here');`;

  const wordpressPlugin = `<?php
/**
 * Plugin Name: Harbor sign-in
 * Description: Signs your team in when they open this website from their Harbor dashboard.
 *
 * 1. Add to wp-config.php:
 *    ${wordpressConfig}
 * 2. Save this file as wp-content/mu-plugins/harbor-sign-in.php
 * 3. In Harbor, set the link's Sign-in URL to:
 *    https://YOUR-SITE${WORDPRESS_SIGN_IN_PATH}
 */

// WordPress role for someone signing in from Harbor for the first time.
// An existing WordPress account with the same email keeps its own role.
const HARBOR_ADMIN_ROLE = 'editor'; // Harbor admins
const HARBOR_STAFF_ROLE = 'author'; // everyone else

add_action('admin_post_nopriv_harbor_sign_in', 'harbor_sign_in');
add_action('admin_post_harbor_sign_in', 'harbor_sign_in');

function harbor_sign_in() {
    $claims = harbor_verify_token(wp_unslash($_POST['harbor_token'] ?? ''));
    if (!$claims) {
        wp_die('This sign-in link has expired. Open the website again from Harbor.', 'Sign-in failed', ['response' => 403]);
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
`;

  const node = `// npm install express express-session jsonwebtoken
// Sign-in URL to give Harbor: ${origin}${path}
import express from "express";
import session from "express-session";
import jwt from "jsonwebtoken";

const SITE_ORIGIN = "${origin}";
const usedTokens = new Map(); // jti -> expiry. Use Redis or your DB if you run more than one server.

const app = express();
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, secure: true, sameSite: "lax" }, // not "strict": the sign-in arrives from Harbor
}));

app.post("${path}", express.urlencoded({ extended: false }), (req, res) => {
  let claims;
  try {
    claims = jwt.verify(req.body.harbor_token, process.env.HARBOR_SIGN_IN_SECRET, {
      algorithms: ["HS256"],
      issuer: "harbor-ops",
      audience: SITE_ORIGIN,
      clockTolerance: 30,
    });
  } catch {
    return res.status(403).send("This sign-in link has expired. Open the website again from Harbor.");
  }

  // Each token works once.
  const now = Date.now();
  for (const [jti, until] of usedTokens) if (until < now) usedTokens.delete(jti);
  if (usedTokens.has(claims.jti)) return res.status(403).send("This sign-in link has already been used.");
  usedTokens.set(claims.jti, now + 5 * 60_000);

  req.session.regenerate((err) => {
    if (err) return res.status(500).send("Sign-in failed. Please try again.");
    req.session.user = { id: claims.sub, email: claims.email, name: claims.name, isAdmin: claims.is_admin };
    const to = new URL(claims.return_to || "/", SITE_ORIGIN);
    res.redirect(303, to.origin === SITE_ORIGIN ? to.pathname + to.search : "/");
  });
});`;

  const claims = `{
  "iss": "harbor-ops",
  "aud": "${origin}",
  "sub": "8f14e45f-…",            // Harbor user id — stable, use it to match accounts
  "email": "jane@youragency.co.uk",
  "name": "Jane Smith",
  "role": "agent",                // admin, agent, …
  "is_admin": false,
  "agency_id": "b5b00020-…",
  "return_to": "${origin}/",      // the link's address in Harbor
  "iat": 1761300000,
  "exp": 1761300060,              // 60 seconds after iat
  "jti": "0b6c2a8e-…"             // unique per sign-in
}`;

  return { wordpressConfig, wordpressPlugin, node, claims, origin };
}
