import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { CheckCircle2, Truck, Ship, Anchor, PackageCheck, KeyRound } from "lucide-react";
import Commonbanner from "../components/Commonbanner";
import { accountSetup, getBookingCharges } from "../api/cms";

/*
 * After the deposit is paid: what was paid, what comes later and when, and —
 * for accounts created at checkout — the "set a password" step. Skippable:
 * the receipt email carries a 24h link to the same form.
 */
const money = (n) => `$${(Number(n) || 0).toFixed(2)}`;
const cents = (c) => money((Number(c) || 0) / 100);

const Step = ({ icon: Icon, title, text, active, done }) => (
  <li className="flex gap-3">
    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${done ? "bg-emerald-400 text-black" : active ? "bg-[#FFC928] text-black" : "bg-white/10 text-white/60"}`}>
      <Icon size={17} />
    </div>
    <div>
      <p className={`font-semibold ${done || active ? "text-white" : "text-white/70"}`}>{title}</p>
      <p className="text-sm text-white/60">{text}</p>
    </div>
  </li>
);

const CheckoutSuccess = () => {
  const { state } = useLocation();
  const navigate = useNavigate();
  const [charges, setCharges] = useState(state?.charges || []);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  let user = {};
  try { user = JSON.parse(localStorage.getItem("user") || "{}"); } catch { /* ignore */ }
  const pendingPassword = user?.account_state === "pending_password" && !done;
  const booking = state?.booking;

  useEffect(() => {
    if (!booking) { navigate("/history", { replace: true }); return; }
    if (!charges.length) getBookingCharges(booking.id).then((r) => r.success && setCharges(r.body)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const deposit = charges.find((c) => c.kind === "deposit");
  const later = charges.filter((c) => c.kind !== "deposit" && c.status === "pending");
  const paid = state?.paid ?? (deposit ? deposit.amount_cents / 100 : 0);

  const savePassword = async () => {
    if (pw.length < 8) { toast.error("Use at least 8 characters."); return; }
    if (pw !== pw2) { toast.error("Passwords don't match."); return; }
    setSaving(true);
    try {
      const res = await accountSetup({ password: pw });
      if (!res.success) throw new Error(res.message);
      localStorage.setItem("token", res.body.authtoken);
      localStorage.setItem("user", JSON.stringify(res.body.user));
      setDone(true);
      toast.success("Your account is ready.");
    } catch (e) {
      toast.error(e.response?.data?.message || e.message || "Could not save your password.");
    } finally {
      setSaving(false);
    }
  };

  if (!booking) return null;
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#243d34] to-[#0a1612] text-white">
      <Commonbanner title="Payment received" />
      <div className="container mx-auto px-4 py-10 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_400px] gap-8 items-start">
        <div className="space-y-6">
          <div className="bg-[#2D413F] rounded-2xl p-6 sm:p-8" data-testid="success-card">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="text-emerald-400" size={34} />
              <div>
                <h2 className="text-[24px] sm:text-[28px] font-bold leading-tight">You're booked{user?.firstName ? `, ${user.firstName}` : ""}.</h2>
                <p className="text-white/70 text-sm">Order <span className="font-mono">{booking.orderId}</span> · paid <strong className="text-white">{money(paid)}</strong> today</p>
              </div>
            </div>
            {state?.provider?.businessName && (
              <p className="mt-4 text-sm text-white/80">Your forwarder is <strong className="text-white">{state.provider.businessName}</strong>. They've been notified and will be in touch about pickup.</p>
            )}
            <ol className="mt-6 space-y-4">
              <Step icon={PackageCheck} title="Booked & paid" text="Sea freight and service fee are covered." done />
              <Step icon={Truck} title="Pickup" text="The forwarder collects your barrel." active />
              <Step icon={Ship} title="At sea" text="You'll get a status update when it ships." />
              <Step icon={Anchor} title="Arrives in Jamaica" text={later.length ? `${later.map((c) => cents(c.amount_cents)).join(" + ")} customs & delivery becomes due — we'll email you a pay link.` : "No further charges expected."} />
              <Step icon={CheckCircle2} title="Delivered" text="Your recipient signs for it." />
            </ol>
            <div className="mt-6 flex flex-wrap gap-3">
              <button onClick={() => navigate("/history")} className="rounded-full bg-[#FFC928] text-black font-semibold px-6 py-2.5 text-sm">Track in My History</button>
              <button onClick={() => navigate("/")} className="rounded-full border border-white/20 px-6 py-2.5 text-sm">Back to home</button>
            </div>
          </div>
        </div>

        <aside className="space-y-5">
          <div className="bg-white text-black rounded-2xl p-6 shadow-xl" data-testid="receipt">
            <p className="text-[12px] uppercase tracking-wider font-semibold text-black/60">Paid today</p>
            <p className="text-[28px] font-bold">{money(paid)}</p>
            {later.length > 0 && (
              <>
                <p className="text-[12px] uppercase tracking-wider font-semibold text-black/60 mt-4">Estimated later</p>
                <ul className="mt-1 space-y-1">
                  {later.map((c) => (
                    <li key={c.id} className="flex justify-between text-sm"><span>{c.description}</span><span className="font-semibold">{cents(c.amount_cents)}</span></li>
                  ))}
                </ul>
                <p className="text-[12px] text-black/50 mt-2">Not charged yet — due when your barrel arrives in Jamaica.</p>
              </>
            )}
          </div>

          {pendingPassword && (
            <div className="bg-white text-black rounded-2xl p-6 shadow-xl" data-testid="account-setup">
              <div className="flex items-center gap-2 mb-1"><KeyRound size={18} /><h4 className="font-bold text-[17px]">Secure your account</h4></div>
              <p className="text-[13px] text-black/60 mb-3">We created a VerShip account for <strong>{user.email}</strong> so you can track this shipment. Set a password to sign in later.</p>
              <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New password (8+ characters)" data-testid="setup-password" className="w-full border border-black/15 rounded-xl px-3 py-2.5 text-sm mb-2" />
              <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="Repeat password" data-testid="setup-password2" className="w-full border border-black/15 rounded-xl px-3 py-2.5 text-sm" />
              <button onClick={savePassword} disabled={saving} data-testid="setup-save" className="mt-3 w-full rounded-full bg-black text-white text-sm font-semibold py-3 disabled:opacity-50">
                {saving ? "Saving…" : "Save password"}
              </button>
              <p className="text-[11px] text-black/50 mt-2">Prefer to do it later? The link in your receipt email works for 24 hours.</p>
            </div>
          )}
          {done && (
            <div className="bg-emerald-400/15 border border-emerald-400/30 text-emerald-100 rounded-2xl p-4 text-sm" data-testid="account-ready">
              Password saved — you can sign in with {user.email} any time.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};

export default CheckoutSuccess;
