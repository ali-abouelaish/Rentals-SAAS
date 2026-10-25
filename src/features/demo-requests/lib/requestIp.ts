/**
 * The visitor's IP, for rate limiting a public form.
 *
 * X-Forwarded-For grows to the right as each proxy appends who it heard from, so a client can put
 * anything it likes on the left. Read it from the right instead, skipping our own hops (nginx on the
 * same box, Next's own entry), so the first public address found is the one nginx actually saw.
 * Then X-Real-IP, if the proxy sets it.
 */
const PRIVATE = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|::1$|::ffff:127\.|f[cd][0-9a-f]{2}:|fe80:)/i;

export function requestIp(h: Pick<Headers, "get">): string {
  const chain = (h.get("x-forwarded-for") ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  for (let i = chain.length - 1; i >= 0; i--) {
    if (!PRIVATE.test(chain[i])) return chain[i];
  }
  const real = h.get("x-real-ip")?.trim();
  if (real) return real;
  return chain[0] ?? "unknown";
}
