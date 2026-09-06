"use client";

import Link from "next/link";
import { Wordmark } from "@/components/SignInScreen";
import { cn } from "@/lib/cn";
import { AuthUser } from "@/lib/types";

type AppShellProps = {
  user: AuthUser;
  view: "today" | "board";
  onViewChange: (view: "today" | "board") => void;
  onLogout: () => void;
  onOpenPalette: () => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  children: React.ReactNode;
};

export function AppShell({
  user,
  view,
  onViewChange,
  onLogout,
  onOpenPalette,
  theme,
  onToggleTheme,
  children
}: AppShellProps) {
  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-3 px-5 py-3 sm:px-7">
          <Wordmark />

          <nav className="flex rounded-field border border-line bg-sunken p-0.5" aria-label="Vista">
            <ViewTab active={view === "today"} onClick={() => onViewChange("today")}>
              Hoy
            </ViewTab>
            <ViewTab active={view === "board"} onClick={() => onViewChange("board")}>
              Tablero
            </ViewTab>
          </nav>

          <button
            type="button"
            onClick={onOpenPalette}
            className="ml-auto hidden items-center gap-2 rounded-field border border-line bg-sunken px-3 py-1.5 text-[13px] text-ink-3 transition-colors hover:border-line-2 hover:text-ink-2 sm:flex"
          >
            Buscar
            <kbd className="rounded border border-line bg-surface px-1.5 py-px font-sans text-[11px] font-semibold text-ink-3">
              ⌘K
            </kbd>
          </button>

          <div className="ml-auto flex items-center gap-1.5 sm:ml-0">
            <IconButton
              label={theme === "dark" ? "Modo claro" : "Modo oscuro"}
              onClick={onToggleTheme}
            >
              {theme === "dark" ? "☀" : "☾"}
            </IconButton>
            {user.isAdmin && (
              <Link
                href="/admin"
                className="rounded-field border border-line px-2.5 py-1.5 text-[13px] text-ink-2 transition-colors hover:border-line-2 hover:text-ink"
              >
                Usuarios
              </Link>
            )}
            <button
              type="button"
              onClick={onLogout}
              title={user.email}
              className="rounded-field border border-line px-2.5 py-1.5 text-[13px] text-ink-2 transition-colors hover:border-line-2 hover:text-ink"
            >
              Salir
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-5 py-6 sm:px-7">{children}</main>
    </div>
  );
}

function ViewTab({
  active,
  onClick,
  children
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "rounded-[6px] px-3 py-1 text-[13px] font-semibold transition-colors",
        active ? "bg-surface text-ink shadow-card" : "text-ink-3 hover:text-ink-2"
      )}
    >
      {children}
    </button>
  );
}

function IconButton({
  label,
  onClick,
  children
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="grid h-[31px] w-[31px] place-items-center rounded-field border border-line text-ink-3 transition-colors hover:border-line-2 hover:text-ink"
    >
      {children}
    </button>
  );
}
