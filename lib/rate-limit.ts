import { NextRequest } from "next/server";

type RateBucket = {
  count: number;
  resetAt: number;
};

type RateLimitConfig = {
  key: string;
  limit: number;
  windowMs: number;
};

export type RateLimitResult = {
  ok: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
};

const buckets = new Map<string, RateBucket>();
const MAX_BUCKET_COUNT = 10_000;

function purgeExpiredBuckets(nowMs: number) {
  for (const [bucketKey, bucket] of buckets) {
    if (bucket.resetAt <= nowMs) {
      buckets.delete(bucketKey);
    }
  }
}

export function getClientIp(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();
    if (firstIp) {
      return firstIp;
    }
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) {
    return realIp;
  }

  return "unknown";
}

export function checkRateLimit(config: RateLimitConfig): RateLimitResult {
  const nowMs = Date.now();

  if (buckets.size > MAX_BUCKET_COUNT) {
    purgeExpiredBuckets(nowMs);
  }

  const existing = buckets.get(config.key);
  if (!existing || existing.resetAt <= nowMs) {
    const resetAt = nowMs + config.windowMs;
    buckets.set(config.key, { count: 1, resetAt });

    return {
      ok: true,
      limit: config.limit,
      remaining: Math.max(0, config.limit - 1),
      resetAt,
      retryAfterSeconds: Math.max(1, Math.ceil(config.windowMs / 1000)),
    };
  }

  existing.count += 1;

  const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - nowMs) / 1000));
  const remaining = Math.max(0, config.limit - existing.count);
  const ok = existing.count <= config.limit;

  return {
    ok,
    limit: config.limit,
    remaining,
    resetAt: existing.resetAt,
    retryAfterSeconds,
  };
}

export function toRateLimitHeaders(result: RateLimitResult) {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.floor(result.resetAt / 1000)),
  };
}
