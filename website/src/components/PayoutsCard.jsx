import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { getMyPayouts, collectPayouts, createStripeAccount } from "../api/cms";

/**
 * Forwarder-facing view of money VerShip is holding for them, and the way to
 * get it: finish Stripe onboarding (money moves automatically) or press
 * "Collect funds" for anything that arrived later / failed.
 *
 * Shown on the business profile and the earnings page. Replaces the old
 * "you can't be paid yet" banner: forwarders are quoted and paid whether or
 * not Stripe is set up, so the message is about collecting, not eligibility.
 */
const money = (cents) => `$${(Number(cents || 0) / 100).toFixed(2)}`;

const PayoutsCard = ({ compact = false }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const res = await getMyPayouts();
      if (res.success) setData(res.body);
    } catch (e) {
      console.error("payouts/me failed:", e);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const startOnboarding = async () => {
    setBusy(true);
    try {
      const response = await createStripeAccount();
      const url = response.body?.url || response.url;
      if (response.success && url) { window.location.href = url; return; }
      toast.error(response.message || "Failed to start payout setup.");
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || "Unable to start payout setup.");
    } finally {
      setBusy(false);
    }
  };

  const collect = async () => {
    setBusy(true);
    try {
      const res = await collectPayouts();
      if (res.success) { toast.success(res.message); setData((d) => ({ ...d, ...res.body })); }
      else toast.error(res.message || "Could not collect funds.");
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not collect funds.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return null;
  const held = data?.heldCents || 0;
  const transferred = data?.transferredCents || 0;
  const canReceive = !!data?.canReceive;
  const failed = data?.failedCents || 0;
  const recent = (data?.rows || []).slice(0, compact ? 3 : 8);

  return (
    <div
      data-testid="payouts-card"
      className={`mb-6 rounded-2xl border p-4 sm:p-5 ${canReceive ? "border-emerald-400/20 bg-emerald-400/10" : "border-yellow-400/20 bg-yellow-400/10"}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-white/60">Held for you</p>
          <p className="text-[28px] font-bold text-white leading-tight" data-testid="payouts-held">{money(held)}</p>
          <p className="text-xs text-white/60 mt-1">
            {transferred > 0 ? `${money(transferred)} transferred to your bank so far.` : "Payments customers have made that VerShip is holding for you."}
          </p>
        </div>
        <div className="flex flex-col items-start sm:items-end gap-2">
          {!canReceive ? (
            <button
              type="button"
              onClick={startOnboarding}
              disabled={busy}
              className="inline-flex items-center justify-center rounded-full bg-yellow-400 px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-yellow-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "Opening…" : held > 0 ? "Set up payouts to collect" : "Set up payouts"}
            </button>
          ) : (
            <button
              type="button"
              onClick={collect}
              disabled={busy || held === 0}
              data-testid="collect-funds"
              className="inline-flex items-center justify-center rounded-full bg-emerald-400 px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Transferring…" : held > 0 ? `Collect ${money(held)}` : "Collect funds"}
            </button>
          )}
          <p className="text-[11px] text-white/50 max-w-[260px] sm:text-right">
            {!canReceive
              ? "Takes about five minutes with Stripe. Money transfers automatically as soon as you finish."
              : held > 0
                ? "Payouts are set up. New payments transfer automatically; press to collect anything waiting."
                : "Payouts are set up. New payments reach your Stripe balance automatically."}
          </p>
        </div>
      </div>

      {failed > 0 && (
        <p className="mt-3 text-xs text-red-200">
          A transfer of {money(failed)} failed and VerShip support has been alerted. It will be retried — you don't need to do anything.
        </p>
      )}

      {recent.length > 0 && (
        <ul className="mt-4 divide-y divide-white/10 text-sm">
          {recent.map((r) => (
            <li key={r.id} className="flex items-center justify-between py-2 text-white/80">
              <span className="truncate">{r.orderId || `Booking #${r.bookingId}`}</span>
              <span className="flex items-center gap-3 shrink-0">
                <span className="font-semibold text-white">${r.amount}</span>
                <span className={`text-[11px] uppercase tracking-wide px-2 py-0.5 rounded-full ${
                  r.status === "transferred" ? "bg-emerald-400/20 text-emerald-200"
                  : r.status === "failed" ? "bg-red-400/20 text-red-200"
                  : r.status === "reversed" || r.status === "written_off" ? "bg-white/10 text-white/50"
                  : "bg-yellow-400/20 text-yellow-100"}`}>
                  {r.status === "owed" ? "held" : r.status.replace("_", " ")}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default PayoutsCard;
