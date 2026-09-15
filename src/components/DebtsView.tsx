"use client";

import { FormEvent, useMemo, useState } from "react";
import { EmptyState, TaskSection } from "@/components/TaskSection";
import { cn } from "@/lib/cn";
import { formatShortDate } from "@/lib/date";
import { money } from "@/lib/i18n/format";
import { useLanguage, useT } from "@/lib/i18n/provider";
import { Debt } from "@/lib/api";

type DebtsViewProps = {
  debts: Debt[];
  isLoading: boolean;
  pendingIds: Record<number, boolean>;
  onAdd: (input: {
    name: string;
    amount: number;
    currency: string;
    direction: "Debo yo" | "Me deben";
    reason: string;
  }) => Promise<void> | void;
  onToggleStatus: (debt: Debt) => void;
  onDelete: (debt: Debt) => void;
};

/**
 * Quién te debe y a quién le debes.
 *
 * Se separa por dirección y no por estado, porque la pregunta real al abrir esto
 * es "¿a quién tengo que cobrarle?" — no "¿qué pasó este mes?". Lo pagado se va
 * abajo, junto, y no se mezcla con lo vivo.
 */
export function DebtsView({
  debts,
  isLoading,
  pendingIds,
  onAdd,
  onToggleStatus,
  onDelete
}: DebtsViewProps) {
  const t = useT();
  const language = useLanguage();
  const open = debts.filter((debt) => debt.status !== "Pagado");
  const paid = debts.filter((debt) => debt.status === "Pagado");
  const theyOwe = open.filter((debt) => debt.direction === "Me deben");
  const iOwe = open.filter((debt) => debt.direction === "Debo yo");

  // Un total por moneda: sumar CLP con USD daría un número que no significa nada.
  const totals = useMemo(() => {
    const acc: Record<string, { owed: number; owing: number }> = {};
    for (const debt of open) {
      const bucket = (acc[debt.currency] ||= { owed: 0, owing: 0 });
      if (debt.direction === "Me deben") bucket.owed += debt.amount;
      else bucket.owing += debt.amount;
    }
    return acc;
  }, [open]);

  if (isLoading) {
    return <p className="py-12 text-center text-sm text-ink-3">{t.debts.loading}</p>;
  }

  return (
    <div>
      <DebtForm onAdd={onAdd} />

      {open.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-3">
          {Object.entries(totals).map(([currency, { owed, owing }]) => (
            <div
              key={currency}
              className="flex-1 rounded-panel border border-line bg-surface px-4 py-3 shadow-card"
            >
              <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">
                {currency}
              </div>
              {/* Solo el lado que tiene algo: un "Te deben 0 CLP" ocupa el
                  mismo espacio que un dato y no dice nada. */}
              <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1">
                {owed > 0 && (
                  <span className="num text-sm text-ink-2">
                    {t.debts.owedTo} <b className="text-ok">{money(owed, currency, language)}</b>
                  </span>
                )}
                {owing > 0 && (
                  <span className="num text-sm text-ink-2">
                    {t.debts.owing} <b className="text-late">{money(owing, currency, language)}</b>
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {debts.length === 0 ? (
        <EmptyState
          icon="🧾"
          title={t.debts.emptyTitle}
          hint={t.debts.emptyHint}
        />
      ) : (
        <>
          {theyOwe.length > 0 && (
            <TaskSection title={t.debts.theyOwe} count={theyOwe.length}>
              {theyOwe.map((debt) => (
                <DebtRow
                  key={debt.id}
                  debt={debt}
                  pending={Boolean(pendingIds[debt.id])}
                  onToggleStatus={onToggleStatus}
                  onDelete={onDelete}
                />
              ))}
            </TaskSection>
          )}
          {iOwe.length > 0 && (
            <TaskSection title={t.debts.youOwe} count={iOwe.length} tone="late">
              {iOwe.map((debt) => (
                <DebtRow
                  key={debt.id}
                  debt={debt}
                  pending={Boolean(pendingIds[debt.id])}
                  onToggleStatus={onToggleStatus}
                  onDelete={onDelete}
                />
              ))}
            </TaskSection>
          )}
          {paid.length > 0 && (
            <TaskSection title={t.debts.settled} count={paid.length}>
              {paid.map((debt) => (
                <DebtRow
                  key={debt.id}
                  debt={debt}
                  pending={Boolean(pendingIds[debt.id])}
                  onToggleStatus={onToggleStatus}
                  onDelete={onDelete}
                />
              ))}
            </TaskSection>
          )}
        </>
      )}
    </div>
  );
}

function DebtRow({
  debt,
  pending,
  onToggleStatus,
  onDelete
}: {
  debt: Debt;
  pending: boolean;
  onToggleStatus: (debt: Debt) => void;
  onDelete: (debt: Debt) => void;
}) {
  const t = useT();
  const language = useLanguage();
  const isPaid = debt.status === "Pagado";
  return (
    <article
      className={cn(
        "group relative flex flex-col gap-2 rounded-panel border border-line bg-surface px-3.5 py-2 shadow-card transition-[border-color,transform] duration-150",
        "hover:-translate-y-px hover:border-line-2 focus-within:border-line-2",
        "sm:flex-row sm:items-center",
        !isPaid && debt.direction === "Debo yo" && "border-l-[3px] border-l-late",
        !isPaid && debt.direction === "Me deben" && "border-l-[3px] border-l-ok",
        pending && "pointer-events-none opacity-60"
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <button
          type="button"
          role="checkbox"
          aria-checked={isPaid}
          aria-label={isPaid ? t.debts.markPending : t.debts.markPaid}
          onClick={() => onToggleStatus(debt)}
          className={cn(
            "h-[18px] w-[18px] flex-none rounded-full border-[1.7px] transition-colors",
            isPaid ? "border-ok bg-ok" : "border-line-2 bg-surface group-hover:border-ok"
          )}
        />
        <div className="flex min-w-0 flex-1 items-baseline gap-2">
          <span
            className={cn(
              "min-w-0 break-words text-[14.5px] font-medium sm:truncate",
              isPaid ? "text-ink-3 line-through" : "text-ink"
            )}
          >
            {debt.name}
          </span>
          {debt.reason && (
            <span className="hidden min-w-0 flex-none truncate text-[12.5px] text-ink-3 lg:block lg:max-w-[34%]">
              · {debt.reason}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-none items-center gap-3 pl-[30px] sm:pl-0 sm:pr-[62px]">
        <span
          className={cn(
            "num text-[14px] font-semibold",
            isPaid ? "text-ink-3" : debt.direction === "Me deben" ? "text-ok" : "text-late"
          )}
        >
          {money(debt.amount, debt.currency, language)}
        </span>
        <span className="num text-[11.5px] text-ink-3">
          {formatShortDate(debt.createdAt.slice(0, 10), language)}
        </span>
      </div>

      <div className="absolute right-1.5 top-1.5 flex gap-0.5 rounded-field border border-line bg-surface opacity-0 shadow-card transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
        <button
          type="button"
          title={t.debts.delete}
          aria-label={t.debts.delete}
          onClick={() => onDelete(debt)}
          className="grid h-[29px] w-[29px] place-items-center rounded-field text-[15px] leading-none text-ink-2 transition-colors hover:bg-raised hover:text-ink"
        >
          🗑
        </button>
      </div>
    </article>
  );
}

function DebtForm({ onAdd }: { onAdd: DebtsViewProps["onAdd"] }) {
  const t = useT();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [direction, setDirection] = useState<"Me deben" | "Debo yo">("Me deben");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const value = Number(amount.replace(",", "."));
    if (!name.trim() || !Number.isFinite(value) || value <= 0 || busy) return;
    setBusy(true);
    try {
      await onAdd({ name: name.trim(), amount: value, currency, direction, reason: reason.trim() });
      setName("");
      setAmount("");
      setReason("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="mb-6 flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-panel border border-line bg-surface px-3 py-2 shadow-card focus-within:border-brand/50 sm:gap-2 sm:py-2.5"
    >
      <div className="flex flex-none rounded-field border border-line bg-sunken p-0.5">
        {(["Me deben", "Debo yo"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setDirection(option)}
            className={cn(
              "rounded-[6px] px-2.5 py-1 text-[12.5px] font-semibold transition-colors",
              direction === option ? "bg-surface text-ink shadow-card" : "text-ink-3 hover:text-ink-2"
            )}
          >
            {/* El valor guardado sigue siendo "Me deben" / "Debo yo": va a
                Postgres y lo lee el bot. Acá solo cambia lo que se lee. */}
            {option === "Me deben" ? t.debts.directionTheyOwe : t.debts.directionIOwe}
          </button>
        ))}
      </div>
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder={t.debts.whoPlaceholder}
        aria-label={t.debts.whoLabel}
        className="min-w-[7rem] flex-1 bg-transparent text-[14.5px] text-ink outline-none placeholder:text-ink-3"
      />
      <input
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder={t.debts.whyPlaceholder}
        aria-label={t.debts.whyLabel}
        className="min-w-[7rem] flex-1 bg-transparent text-[13.5px] text-ink-2 outline-none placeholder:text-ink-3"
      />
      <input
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        inputMode="decimal"
        placeholder="0"
        aria-label={t.debts.amountLabel}
        className="num w-20 flex-none rounded-field border border-line bg-sunken px-2 py-1 text-right text-[13px] text-ink outline-none"
      />
      <select
        value={currency}
        onChange={(event) => setCurrency(event.target.value)}
        aria-label={t.debts.currencyLabel}
        className="flex-none rounded-field border border-line bg-sunken px-2 py-1 text-[12.5px] font-semibold text-ink-2 outline-none"
      >
        {["USD", "CLP", "EUR"].map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={busy || !name.trim() || !amount.trim()}
        className="ml-auto flex-none rounded-field bg-brand px-3 py-1.5 text-[13px] font-semibold text-brand-ink disabled:cursor-not-allowed disabled:opacity-40 sm:ml-0"
      >
        {busy ? "…" : t.debts.add}
      </button>
    </form>
  );
}

