import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import {
  createAuthSession,
  getSessionCookieName,
  getSessionCookieOptions,
} from "@/lib/auth";
import { db } from "@/lib/db";
import { checkRateLimit, getClientIp, toRateLimitHeaders } from "@/lib/rate-limit";
import { loginSchema } from "@/lib/validators";

export async function POST(request: NextRequest) {
  const ipAddress = getClientIp(request);
  const limitResult = checkRateLimit({
    key: `auth:login:${ipAddress}`,
    limit: 10,
    windowMs: 60_000,
  });

  if (!limitResult.ok) {
    return NextResponse.json(
      { message: "Too many login attempts. Please try again shortly." },
      {
        status: 429,
        headers: {
          ...toRateLimitHeaders(limitResult),
          "Retry-After": String(limitResult.retryAfterSeconds),
        },
      },
    );
  }

  const rateLimitHeaders = toRateLimitHeaders(limitResult);
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ message: "Invalid credentials" }, { status: 400, headers: rateLimitHeaders });
  }

  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid credentials" }, { status: 400, headers: rateLimitHeaders });
  }

  const { identifier, password } = parsed.data;
  const normalizedIdentifier = identifier.trim().toLowerCase();

  let user: Awaited<ReturnType<typeof db.user.findFirst>>;
  try {
    user = await db.user.findFirst({
      where: {
        OR: [{ email: normalizedIdentifier }, { username: normalizedIdentifier }],
      },
    });
  } catch {
    return NextResponse.json(
      { message: "Authentication service is temporarily unavailable." },
      { status: 503, headers: rateLimitHeaders },
    );
  }

  if (!user) {
    return NextResponse.json({ message: "Invalid credentials" }, { status: 401, headers: rateLimitHeaders });
  }

  if (user.role === "DELIVERY_BOY" && user.approvalStatus !== "APPROVED") {
    const approvalMessage =
      user.approvalStatus === "REJECTED"
        ? "Delivery boy registration was rejected by agent"
        : "Delivery boy account is pending approval";
    return NextResponse.json({ message: approvalMessage }, { status: 403, headers: rateLimitHeaders });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ message: "Invalid credentials" }, { status: 401, headers: rateLimitHeaders });
  }

  let session: Awaited<ReturnType<typeof createAuthSession>>;
  try {
    session = await createAuthSession({
      userId: user.id,
      ipAddress,
      userAgent: request.headers.get("user-agent"),
    });
  } catch {
    return NextResponse.json(
      { message: "Authentication service is temporarily unavailable." },
      { status: 503, headers: rateLimitHeaders },
    );
  }

  const response = NextResponse.json(
    {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        approvalStatus: user.approvalStatus,
      },
    },
    { headers: rateLimitHeaders },
  );

  response.cookies.set(getSessionCookieName(), session.token, getSessionCookieOptions());

  return response;
}
