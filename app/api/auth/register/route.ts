import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { ApprovalStatus, UserRole } from "@prisma/client";
import { db } from "@/lib/db";
import { publishEvent } from "@/lib/realtime";
import { checkRateLimit, getClientIp, toRateLimitHeaders } from "@/lib/rate-limit";
import { registerSchema } from "@/lib/validators";

export async function POST(request: NextRequest) {
  const ipAddress = getClientIp(request);
  const limitResult = checkRateLimit({
    key: `auth:register:${ipAddress}`,
    limit: 5,
    windowMs: 10 * 60_000,
  });

  if (!limitResult.ok) {
    return NextResponse.json(
      { message: "Too many registration attempts. Please try again later." },
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
    return NextResponse.json(
      { message: "Invalid registration data" },
      { status: 400, headers: rateLimitHeaders },
    );
  }

  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]?.message ?? "Invalid registration data";
    return NextResponse.json(
      {
        message: firstIssue,
        errors: parsed.error.flatten().fieldErrors,
      },
      { status: 400, headers: rateLimitHeaders },
    );
  }

  const email = parsed.data.email.trim().toLowerCase();
  let existingUser: Awaited<ReturnType<typeof db.user.findUnique>>;
  try {
    existingUser = await db.user.findUnique({ where: { email } });
  } catch {
    return NextResponse.json(
      { message: "Registration service is temporarily unavailable." },
      { status: 503, headers: rateLimitHeaders },
    );
  }

  if (existingUser) {
    return NextResponse.json(
      { message: "Email already registered" },
      { status: 409, headers: rateLimitHeaders },
    );
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const approvalStatus =
    parsed.data.role === "DELIVERY_BOY"
      ? "PENDING"
      : "APPROVED";

  let created:
    | {
        id: string;
        email: string | null;
        role: UserRole;
        approvalStatus: ApprovalStatus;
      }
    | null = null;
  try {
    created = await db.user.create({
      data: {
        email,
        username: email,
        passwordHash,
        role: parsed.data.role,
        approvalStatus,
      },
      select: {
        id: true,
        email: true,
        role: true,
        approvalStatus: true,
      },
    });
  } catch {
    return NextResponse.json(
      { message: "Registration service is temporarily unavailable." },
      { status: 503, headers: rateLimitHeaders },
    );
  }

  const message =
    created.role === "DELIVERY_BOY"
      ? "Registration submitted. Wait for agent approval before login."
      : "Registration successful. You can now log in.";

  publishEvent({ type: "user.created", entityId: created.id });

  return NextResponse.json(
    {
      message,
      user: created,
    },
    { status: 201, headers: rateLimitHeaders },
  );
}
