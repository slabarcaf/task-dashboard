import { NextRequest, NextResponse } from "next/server";
import { crossOriginRefused, getBotUserIfAuthorized, getCurrentUserFromCookies, originIsTrusted } from "@/lib/server/auth";
import {
  DbUser,
  PreferencePatch,
  getUserPreferencesByUserId,
  normalizeTimeOfDay,
  saveUserPreferencesByUserId
} from "@/lib/server/db";

export const runtime = "nodejs";

/**
 * Preferences for one person: categories, language, timezone, brief times.
 *
 * Reachable two ways, exactly like /api/tasks — a browser session, or the bot's
 * bearer token plus the chat id it is acting for. That is the point of moving
 * these out of the bot's SQLite: one store, one shape, two doors to it. Unlike
 * /api/admin, there is nothing here a service should not hold on a user's
 * behalf; the bot legitimately needs to know when to send someone their brief.
 */
async function resolveUser(request: NextRequest): Promise<DbUser | null> {
  return (await getCurrentUserFromCookies()) || (await getBotUserIfAuthorized(request));
}

export async function GET(request: NextRequest) {
  try {
    const user = await resolveUser(request);
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    return NextResponse.json(await getUserPreferencesByUserId(user.id));
  } catch (error) {
    // El detalle va al log del servidor: el mensaje de `pg` trae SQL y columnas.
    console.warn("[preferences]", error);
    return NextResponse.json(
      { ok: false, error: "Failed to load preferences" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  if (!originIsTrusted()) return crossOriginRefused();
  try {
    const user = await resolveUser(request);
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const patch: PreferencePatch = {};

    // Only fields actually present are written; see saveUserPreferencesByUserId
    // for why a partial write must not blank what the caller did not send.
    if (Array.isArray(body.tipoOptions)) {
      patch.tipoOptions = body.tipoOptions.map((value) => String(value || "").trim()).filter(Boolean);
      if (patch.tipoOptions.length === 0) {
        return NextResponse.json(
          { ok: false, error: "At least one task type is required" },
          { status: 400 }
        );
      }
    }
    if (typeof body.language === "string") {
      const language = body.language.trim().toLowerCase();
      if (language !== "es" && language !== "en") {
        return NextResponse.json({ ok: false, error: "Unsupported language" }, { status: 400 });
      }
      patch.language = language;
    }
    if (typeof body.timezone === "string" && body.timezone.trim()) {
      const timezone = body.timezone.trim();
      // Reject a zone this runtime cannot resolve rather than storing a string
      // that will throw later, inside a cron, at 7am, where nobody is watching.
      try {
        new Intl.DateTimeFormat("en-US", { timeZone: timezone });
      } catch {
        return NextResponse.json({ ok: false, error: "Unknown timezone" }, { status: 400 });
      }
      patch.timezone = timezone;
    }
    for (const field of ["briefMorning", "briefEvening"] as const) {
      if (typeof body[field] !== "string") continue;
      const time = normalizeTimeOfDay(body[field] as string);
      if (time === null) {
        return NextResponse.json(
          { ok: false, error: `${field} must be HH:MM, or "" to turn the brief off` },
          { status: 400 }
        );
      }
      patch[field] = time;
    }
    if (body.categoryKeywords && typeof body.categoryKeywords === "object") {
      patch.categoryKeywords = body.categoryKeywords as Record<string, string[]>;
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ ok: false, error: "Nothing to update" }, { status: 400 });
    }

    return NextResponse.json(await saveUserPreferencesByUserId(user.id, patch));
  } catch (error) {
    // El detalle va al log del servidor: el mensaje de `pg` trae SQL y columnas.
    console.warn("[preferences]", error);
    return NextResponse.json(
      { ok: false, error: "Failed to save preferences" },
      { status: 500 }
    );
  }
}
