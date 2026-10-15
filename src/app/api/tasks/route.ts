import { NextRequest, NextResponse } from "next/server";
import { listDbTasksByUser } from "@/lib/server/db";
import { createTaskForUser, type TaskCreateInput } from "@/lib/server/taskWrites";
import { crossOriginRefused, getBotUserIfAuthorized, getCurrentUserFromCookies, originIsTrusted } from "@/lib/server/auth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const user = (await getBotUserIfAuthorized(request)) ?? (await getCurrentUserFromCookies());
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ tasks: await listDbTasksByUser(user.id) });
  } catch (error) {
    // El detalle va al log del servidor: el mensaje de `pg` trae SQL y columnas.
    console.warn("[tasks]", error);
    return NextResponse.json(
      { ok: false, error: "Failed to list tasks" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  if (!originIsTrusted()) return crossOriginRefused();
  try {
    const user = (await getBotUserIfAuthorized(request)) ?? (await getCurrentUserFromCookies());
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as TaskCreateInput;
    const result = await createTaskForUser(user.id, body);
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: "toDo and dueDateNextStep (YYYY-MM-DD) are required" },
        { status: 400 }
      );
    }
    const rowId = result.rowId;

    return NextResponse.json({ ok: true, rowId });
  } catch (error) {
    // El detalle va al log del servidor: el mensaje de `pg` trae SQL y columnas.
    console.warn("[tasks]", error);
    return NextResponse.json(
      { ok: false, error: "Failed to add task" },
      { status: 500 }
    );
  }
}
