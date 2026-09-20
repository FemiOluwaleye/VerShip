import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import Commonbanner from "../components/Commonbanner";
import { accountSetup } from "../api/cms";

/* Landing page for the "Set your password" link in the guest receipt email. */
const AccountSetup = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") || "";
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    setError("");
    if (pw.length < 8) { setError("Use at least 8 characters."); return; }
    if (pw !== pw2) { setError("Passwords don't match."); return; }
    setSaving(true);
    try {
      const res = await accountSetup({ token, password: pw });
      if (!res.success) throw new Error(res.message);
      localStorage.setItem("token", res.body.authtoken);
      localStorage.setItem("user", JSON.stringify(res.body.user));
      localStorage.setItem("is_login", 1);
      toast.success("Your account is ready.");
      navigate("/history", { replace: true });
    } catch (e) {
      setError(e.response?.data?.message || e.message || "This link is no longer valid.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#243d34] to-[#0a1612] text-white">
      <Commonbanner title="Set your password" />
      <div className="container mx-auto px-4 py-12 max-w-md">
        <div className="bg-white text-black rounded-2xl p-6 shadow-xl" data-testid="account-setup-page">
          {!token ? (
            <p className="text-sm">This link is missing its token. Use "Forgot password" on the sign-in page instead.</p>
          ) : (
            <>
              <p className="text-sm text-black/70 mb-4">Choose a password for your VerShip account so you can track your shipment and pay later charges.</p>
              <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New password (8+ characters)" data-testid="setup-password" className="w-full border border-black/15 rounded-xl px-3 py-2.5 text-sm mb-2" />
              <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="Repeat password" data-testid="setup-password2" className="w-full border border-black/15 rounded-xl px-3 py-2.5 text-sm" />
              {error && <p className="text-red-600 text-sm mt-2" data-testid="setup-error">{error}</p>}
              <button onClick={save} disabled={saving} data-testid="setup-save" className="mt-4 w-full rounded-full bg-black text-white text-sm font-semibold py-3 disabled:opacity-50">
                {saving ? "Saving…" : "Save password"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AccountSetup;
