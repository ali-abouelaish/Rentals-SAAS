const hits = new Map<string, { count: number; windowStart: number }>();

export function rateLimitCheck(key: string, windowMs: number, max: number): {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
} {
  const now = Date.now();
  const record = hits.get(key);
  if (!record || now - record.windowStart >= windowMs) {
    hits.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: max - 1, retryAfterSec: 0 };
  }
  if (record.count >= max) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.ceil((windowMs - (now - record.windowStart)) / 1000),
    };
  }
  record.count += 1;
  return { allowed: true, remaining: max - record.count, retryAfterSec: 0 };
}

export function clientIpFromHeaders(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}
