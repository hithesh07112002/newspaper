import { createHash, randomBytes } from "crypto";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import type { ApprovalStatus, UserRole } from "@/lib/types";

const SESSION_COOKIE = "smartledger_session";
const DEFAULT_SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const MIN_SESSION_TTL_SECONDS = 60 * 60;
const MAX_SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

type AuthUser = {
  userId: string;
  username: string;
  role: UserRole;
  email?: string;
  approvalStatus?: ApprovalStatus;
};

type CreateAuthSessionInput = {
  userId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
};

function getEffectiveSessionTtlSeconds() {
  const raw = Number(process.env.SESSION_TTL_SECONDS ?? DEFAULT_SESSION_TTL_SECONDS);
  if (!Number.isFinite(raw)) {
    return DEFAULT_SESSION_TTL_SECONDS;
  }

  const rounded = Math.floor(raw);
  return Math.min(MAX_SESSION_TTL_SECONDS, Math.max(MIN_SESSION_TTL_SECONDS, rounded));
}

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function getSessionCookieName() {
  return SESSION_COOKIE;
}

export function getSessionTtlSeconds() {
  return getEffectiveSessionTtlSeconds();
}

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: getEffectiveSessionTtlSeconds(),
  };
}

export async function createAuthSession(input: CreateAuthSessionInput) {
  const token = randomBytes(48).toString("base64url");
  const expiresAt = new Date(Date.now() + getEffectiveSessionTtlSeconds() * 1000);

  await db.session.create({
    data: {
      tokenHash: hashSessionToken(token),
      userId: input.userId,
      expiresAt,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    },
  });

  return { token, expiresAt };
}

export async function revokeAuthSession(token: string) {
  await db.session.updateMany({
    where: {
      tokenHash: hashSessionToken(token),
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });
}

export async function revokeAuthSessionFromRequest(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    return;
  }

  await revokeAuthSession(token);
}

export async function getAuthUserFromRequest(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    return null;
  }

  let session:
    | {
        expiresAt: Date;
        revokedAt: Date | null;
        user: {
          id: string;
          username: string;
          email: string | null;
          role: UserRole;
          approvalStatus: ApprovalStatus;
        };
      }
    | null = null;

  try {
    session = await db.session.findUnique({
      where: {
        tokenHash: hashSessionToken(token),
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            role: true,
            approvalStatus: true,
          },
        },
      },
    });
  } catch {
    return null;
  }

  if (!session) {
    return null;
  }

  if (session.revokedAt || session.expiresAt <= new Date()) {
    return null;
  }

  if (
    session.user.role === "DELIVERY_BOY" &&
    session.user.approvalStatus !== "APPROVED"
  ) {
    await revokeAuthSession(token);
    return null;
  }

  const user: AuthUser = {
    userId: session.user.id,
    username: session.user.username,
    role: session.user.role,
    email: session.user.email ?? undefined,
    approvalStatus: session.user.approvalStatus,
  };

  return user;
}

export async function requireRole(
  request: NextRequest,
  allowedRoles?: UserRole[],
) {
  const user = await getAuthUserFromRequest(request);
  if (!user) {
    return { ok: false as const, status: 401, message: "Unauthorized" };
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return { ok: false as const, status: 403, message: "Forbidden" };
  }

  return { ok: true as const, user };
}
