import { NextRequest, NextResponse } from "next/server";
import { deleteDbTaskForUser } from "@/lib/server/db";
import { patchTaskForUser, type TaskPatch } from "@/lib/server/taskWrites";
import { crossOriginRefused, getBotUserIfAuthorized, getCurrentUserFromCookies, originIsTrusted } from "@/lib/server/auth";

export const runtime = "nodejs";

export async function DELETE(
  request: NextRequest,
  context: { params: { id: string } }
) {
  if (!originIsTrusted()) return crossOriginRefused();
  try {
    const user = (await getBotUserIfAuthorized(request)) ?? (await getCurrentUserFromCookies());
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const id = Number(context.params.id);
    if (!Number.isInteger(id)) {
      return NextResponse.json({ ok: false, error: "Invalid task id" }, { status: 400 });
    }

    const deleted = await deleteDbTaskForUser(id, user.id);
    if (!deleted) {
      return NextResponse.json({ ok: false, error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    // El detalle va al log del servidor: el mensaje de `pg` trae SQL y columnas.
    console.warn("[tasks/[id]]", error);
    return NextResponse.json(
      { ok: false, error: "Failed to delete task" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: { id: string } }
) {
  if (!originIsTrusted()) return crossOriginRefused();
  try {
    const user = (await getBotUserIfAuthorized(request)) ?? (await getCurrentUserFromCookies());
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const id = Number(context.params.id);
    if (!Number.isInteger(id)) {
      return NextResponse.json({ ok: false, error: "Invalid task id" }, { status: 400 });
    }

    const body = (await request.json()) as {
      patch?: TaskPatch;
    };

    const patch = body.patch || {};

    // Un cuerpo sin `patch` reconocible se rechaza en vez de responder ok
    // habiendo cambiado nada. Esta API ya tuvo una vez el bug de afirmar
    // escrituras que nunca ocurrieron, y un 200 sobre un no-op es justo esa
    // forma: quien llama se lo cree y nadie se entera hasta que falta el dato.
    // Ningún cliente legítimo manda vacío — tasks-mcp y la web lo comprueban
    // antes de enviar.
    if (Object.keys(patch).length === 0) {
      return NextResponse.json(
        { ok: false, error: "missing_patch" },
        { status: 400 }
      );
    }

    const result = await patchTaskForUser(user.id, id, patch);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    // El detalle va al log del servidor: el mensaje de `pg` trae SQL y columnas.
    console.warn("[tasks/[id]]", error);
    return NextResponse.json(
      { ok: false, error: "Failed to update task" },
      { status: 500 }
    );
  }
}
