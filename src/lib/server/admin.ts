import { DbUser } from "@/lib/server/db";

/**
 * Who counts as an admin.
 *
 * `ADMIN_EMAILS` (comma-separated) when it is set, otherwise the owner account
 * alone. Deliberately a list of addresses in the environment rather than a flag
 * on the users table: a row anyone can be granted is a row that can be granted
 * by mistake, and there is exactly one admin today.
 */
export function adminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS || process.env.DEFAULT_OWNER_EMAIL || "";
  return raw
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminUser(user: Pick<DbUser, "email"> | null | undefined): boolean {
  if (!user?.email) return false;
  const allowed = adminEmails();
  if (allowed.length === 0) return false;
  return allowed.includes(user.email.trim().toLowerCase());
}
