import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import Autocomplete from "react-google-autocomplete";
import { Lock, ShieldCheck, Ship, Anchor, PackageCheck, Truck } from "lucide-react";
import Commonbanner from "../components/Commonbanner";
import PhoneInput from "../components/PhoneInput";
import {
  getQuoteBreakdown, postQuoteBreakdown, getAddons, getStripeConfig,
  createBooking, guestCheckout, createChargeIntent, confirmCharge, login, saveBookingRequest,
} from "../api/cms";
import { validatePhoneForCountry, normalizePhoneForCountry } from "../utils/countryPhoneData";
import { JAMAICA_PARISHES } from "../utils/parishes";
import { useGooglePlaces, extractAddressComponents } from "../utils/googlePlaces";

/*
 * One-page checkout: recipient + shipper on the left, "Pay as Your Shipment
 * Moves" on the right with the Stripe Payment Element inline. Money is never
 * computed here — the Due now / Estimated later figures come from
 * /website/quote-breakdown and the card is charged for the deposit row the
 * server creates, so the page can only ever show what will be charged.
 *
 * Guests check out too: "Pay now" creates their account from the shipper block
 * (password comes afterwards). An email that already has an account gets an
 * inline sign-in instead of a silent attach.
 *
 * Reached from the quotes page with location.state = { providerId,
 * providerDetail, bookingRequest, guest, guestPayload }; mirrored into
 * sessionStorage so a refresh survives.
 */

const money = (n) => `$${(Number(n) || 0).toFixed(2)}`;
const isEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || ""));
const cap = (v) => (v && v.length === 1 ? v.toUpperCase() : v);

const inputCls = (err) =>
  `w-full mt-1 bg-transparent border rounded-[14px] px-3 py-3.5 text-sm text-white focus:outline-none transition ${
    err ? "border-red-400 focus:border-red-400" : "border-[#4E6B5D] focus:border-[#9fe0b8]"
  }`;

const Field = ({ label, placeholder, value, onChange, error, type = "text", autoComplete, optional, testid }) => (
  <div>
    <label className="text-sm text-white/80 font-medium">
      {label} {optional && <span className="text-white/40 font-normal">(optional)</span>}
    </label>
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      autoComplete={autoComplete}
      data-testid={testid}
      className={inputCls(error)}
    />
    {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
  </div>
);

const AddressField = ({ label, placeholder, value, onChange, onPlace, error, apiLoaded, country, testid }) => (
  <div className="flex flex-col">
    <label className="text-sm text-white/80 font-medium">{label}</label>
    {apiLoaded ? (
      <Autocomplete
        onPlaceSelected={(place) => onPlace(place, extractAddressComponents(place))}
        options={{ types: ["address"], ...(country ? { componentRestrictions: { country } } : {}) }}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={inputCls(error)}
        data-testid={testid}
      />
    ) : (
      <input type="text" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} className={inputCls(error)} data-testid={testid} />
    )}
    {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
  </div>
);

const emptyShipper = () => {
  let u = {};
  try { u = JSON.parse(localStorage.getItem("user") || "{}"); } catch { /* guest */ }
  const dial = u.countryCode && u.countryCode !== "+1876" ? u.countryCode : "+1";
  return {
    firstName: u.firstName || "", lastName: u.lastName || "", email: u.email || "",
    phone: u.phoneNumber || "", country: { code: dial === "+1" ? "US" : "US", dialCode: dial },
    address: u.streetAddress || "", city: u.city || "", state: u.state || "", suite: "",
    lat: u.latitude || "", lng: u.longitude || "",
  };
};
const emptyRecipient = (parish) => ({
  firstName: "", lastName: "", phone: "", country: { code: "JM", dialCode: "+1876" }, email: "",
  address: "", city: "", parish: parish || "", suite: "", lat: "", lng: "",
});

/* ───────────────────────── Payment column ───────────────────────── */
const PaymentPanel = ({ breakdown, loadingBreakdown, provider, onPay, paying, guest, existingEmail, onInlineLogin, elementsReady, setElementsReady }) => {
  const [pw, setPw] = useState("");
  const dueNow = breakdown?.dueNow?.total || 0;
  const later = breakdown?.later?.total || 0;
  const needsParish = breakdown?.later?.needsParish;

  return (
    <aside className="lg:sticky lg:top-4 space-y-4" data-testid="payment-panel">
      <div className="bg-white rounded-2xl p-5 text-black shadow-xl">
        <h3 className="text-[22px] font-bold leading-tight">Pay as Your Shipment Moves</h3>
        <p className="text-[12px] text-black/60 mt-1.5 leading-relaxed" data-testid="pay-blurb">
          After entering recipient's details, you will see the remaining estimated charges associated with the shipment.
          These amounts are not due immediately - you will receive a notification when each payment is required.
        </p>

        {provider && (
          <div className="mt-3 flex items-center gap-3 rounded-xl bg-[#f6f7f6] px-3 py-2">
            <div className="w-9 h-9 rounded-full bg-[#FFC928] text-black font-bold flex items-center justify-center text-sm shrink-0">
              {(provider.businessName || "FF").substring(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">
                <span className="select-none" style={{ filter: "blur(5px)" }}>{provider.businessName || "Forwarder"}</span>
                <span className="ml-2 text-[11px] font-medium text-emerald-700">Verified freight forwarder</span>
              </p>
              <p className="text-[12px] text-black/50">Forwarder details are revealed after your first payment.</p>
            </div>
          </div>
        )}

        <div className="mt-4">
          <div className="flex items-center justify-between">
            <p className="text-[12px] uppercase tracking-wider font-semibold text-black/60">Due now</p>
            {loadingBreakdown && <span className="text-[11px] text-black/40">updating…</span>}
          </div>
          <ul className="mt-2 space-y-1.5" data-testid="due-now-lines">
            {(breakdown?.dueNow?.lines || []).filter((l) => !l.internal).map((l) => (
              <li key={l.key} className="flex justify-between text-sm">
                <span className="text-black/75">{l.label}</span>
                <span className="font-semibold">{money(l.amount)}</span>
              </li>
            ))}
          </ul>
          <div className="flex justify-between items-baseline border-t border-black/10 mt-2 pt-2">
            <span className="font-bold">Pay today</span>
            <span className="text-[22px] font-bold" data-testid="due-now-total">{money(dueNow)}</span>
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-dashed border-black/15 px-3 py-2">
          <p className="text-[12px] uppercase tracking-wider font-semibold text-black/60">Estimated later</p>
          {needsParish ? (
            <p className="text-sm text-black/60 mt-1">Choose the recipient's parish to see customs &amp; delivery.</p>
          ) : (
            <ul className="mt-2 space-y-1.5" data-testid="later-lines">
              {(breakdown?.later?.lines || []).map((l) => (
                <li key={l.key} className="flex justify-between text-sm">
                  <span className="text-black/75">{l.label}</span>
                  <span className="font-semibold">{money(l.amount)}</span>
                </li>
              ))}
              {later === 0 && <li className="text-sm text-black/50">No further charges expected.</li>}
            </ul>
          )}
          {later > 0 && (
            <p className="text-[12px] text-black/50 mt-2 flex items-start gap-1.5">
              <Anchor size={13} className="mt-0.5 shrink-0" />
              <span>Due when your barrel arrives in Jamaica — we'll email you a payment link. Not charged today.</span>
            </p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl p-5 text-black shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-bold text-[17px]">Payment method</h4>
          <span className="text-[11px] text-black/50 flex items-center gap-1"><Lock size={12} /> Secured by Stripe</span>
        </div>

        {existingEmail ? (
          <div className="rounded-xl bg-[#fff8e1] border border-[#ffe08a] p-4 mb-4" data-testid="welcome-back">
            <p className="text-sm font-semibold">Welcome back</p>
            <p className="text-[13px] text-black/70 mt-1">
              <strong>{existingEmail}</strong> already has a VerShip account. Enter your password to continue with this shipment.
            </p>
            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="Password"
              data-testid="inline-password"
              className="w-full mt-3 border border-black/15 rounded-xl px-3 py-2.5 text-sm"
            />
            <div className="flex items-center justify-between mt-3">
              <a href="/forgot" className="text-[12px] underline text-black/60">Forgot password?</a>
              <button
                type="button"
                onClick={() => onInlineLogin(pw)}
                disabled={paying}
                data-testid="inline-login"
                className="rounded-full bg-black text-white text-sm font-semibold px-4 py-2 disabled:opacity-50"
              >
                Sign in &amp; continue
              </button>
            </div>
          </div>
        ) : null}

        <div className="min-h-[120px]" data-testid="payment-element">
          <PaymentElement
            onReady={() => setElementsReady(true)}
            options={{
              layout: "tabs",
              fields: { billingDetails: { email: "never" } },
              // Customers are in the US; without this Stripe guesses the country from the IP.
              defaultValues: { billingDetails: { address: { country: "US" } } },
            }}
          />
        </div>

        <button
          type="button"
          onClick={onPay}
          disabled={paying || !elementsReady || loadingBreakdown || dueNow <= 0}
          data-testid="pay-now"
          className="mt-5 w-full text-[16px] bg-gradient-to-r from-[#FFB800] via-[#FFD24D] to-[#FFE58F] text-black font-bold py-4 rounded-full hover:brightness-110 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {paying ? "Processing…" : `Pay ${money(dueNow)} now`}
        </button>
        <p className="text-[11px] text-black/50 mt-3 flex items-start gap-1.5">
          <ShieldCheck size={13} className="mt-0.5 shrink-0" />
          <span>
            {guest ? "We'll create your VerShip account so you can track this shipment — you'll set a password after paying. " : ""}
            Only the amount above is charged today. Card details never touch VerShip's servers.
          </span>
        </p>
      </div>
    </aside>
  );
};

/* ───────────────────────── Page ───────────────────────── */
const CheckoutInner = ({ ctx, stripe: stripeInstance }) => {
  const navigate = useNavigate();
  const stripe = useStripe();
  const elements = useElements();
  const apiLoaded = useGooglePlaces();

  const { providerId, providerDetail, bookingRequest, guest, guestPayload } = ctx;
  const request = bookingRequest || guestPayload || {};
  const isOwn = !String(request?.items?.[0]?.sub_type || request?.sub_type || "own").toLowerCase().includes("drop");
  const quantity = parseInt(request?.quantity || request?.items?.[0]?.quantity || 1, 10) || 1;

  const [shipper, setShipper] = useState(emptyShipper);
  const [recipient, setRecipient] = useState(() => emptyRecipient(request?.parish));
  const [errors, setErrors] = useState({});
  const [addons, setAddons] = useState([]);
  const [addOnState, setAddOnState] = useState({});
  const [breakdown, setBreakdown] = useState(null);
  const [loadingBreakdown, setLoadingBreakdown] = useState(true);
  const [paying, setPaying] = useState(false);
  const [existingEmail, setExistingEmail] = useState("");
  const [elementsReady, setElementsReady] = useState(false);
  const [isGuest, setIsGuest] = useState(!!guest);
  const [requestId, setRequestId] = useState(bookingRequest?.id || null);
  const bdTimer = useRef(null);
  const elementsAmount = useRef(null);

  const setS = (k) => (v) => { setShipper((p) => ({ ...p, [k]: v })); setErrors((e) => ({ ...e, [`s_${k}`]: "" })); };
  const setR = (k) => (v) => { setRecipient((p) => ({ ...p, [k]: v })); setErrors((e) => ({ ...e, [`r_${k}`]: "" })); };

  useEffect(() => {
    getAddons().then((res) => {
      if (res.status || res.success) {
        setAddons(res.body || []);
        const init = {}; (res.body || []).forEach((a) => { init[a.name] = true; });
        setAddOnState(init);
      }
    }).catch(() => {});
  }, []);

  // Server-side breakdown; re-priced when parish or the pickup point changes.
  useEffect(() => {
    clearTimeout(bdTimer.current);
    bdTimer.current = setTimeout(async () => {
      setLoadingBreakdown(true);
      try {
        const params = { providerId, parish: recipient.parish || "", shipperLat: shipper.lat || "", shipperLng: shipper.lng || "" };
        const res = isGuest && !requestId
          ? await postQuoteBreakdown({ request: guestPayload, ...params })
          : await getQuoteBreakdown({ requestId, ...params });
        if (res.success) {
          setBreakdown(res.body);
          const cents = Math.round((res.body.dueNow?.total || 0) * 100);
          if (elements && cents > 0) { elements.update({ amount: cents }); elementsAmount.current = cents; }
        }
      } catch (e) {
        toast.error(e.response?.data?.message || "Could not price this shipment.");
      } finally {
        setLoadingBreakdown(false);
      }
    }, 250);
    return () => clearTimeout(bdTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerId, recipient.parish, shipper.lat, shipper.lng, requestId, isGuest]);

  const validate = () => {
    const e = {};
    if (!shipper.firstName.trim()) e.s_firstName = "First name is required";
    if (!shipper.lastName.trim()) e.s_lastName = "Last name is required";
    if (!isEmail(shipper.email)) e.s_email = "A valid email is required";
    const sp = validatePhoneForCountry(shipper.country.dialCode, shipper.phone); if (sp) e.s_phone = sp;
    if (isOwn) {
      if (!shipper.address.trim()) e.s_address = "Pickup address is required";
      if (!shipper.city.trim()) e.s_city = "City is required";
      if (!shipper.state.trim()) e.s_state = "State is required";
    }
    if (!recipient.firstName.trim()) e.r_firstName = "First name is required";
    if (!recipient.lastName.trim()) e.r_lastName = "Last name is required";
    const rp = validatePhoneForCountry(recipient.country.dialCode, recipient.phone); if (rp) e.r_phone = rp;
    if (recipient.email && !isEmail(recipient.email)) e.r_email = "Invalid email";
    if (!recipient.address.trim()) e.r_address = "Street address is required";
    if (!recipient.city.trim()) e.r_city = "Town / city is required";
    if (!recipient.parish) e.r_parish = "Parish is required";
    setErrors(e);
    if (Object.keys(e).length) {
      const first = document.querySelector("[data-error-anchor]");
      first?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    return Object.keys(e).length === 0;
  };

  const bookingPayload = () => {
    const sPhone = normalizePhoneForCountry(shipper.country.dialCode, shipper.phone);
    const rPhone = normalizePhoneForCountry(recipient.country.dialCode, recipient.phone);
    const rFull = `${recipient.address}${recipient.suite ? ", " + recipient.suite : ""}`;
    const sFull = `${shipper.address}${shipper.suite ? ", " + shipper.suite : ""}`;
    return {
      providerIds: [providerId],
      barrel_type: isOwn ? "own" : "dropoff",
      addOns: Object.keys(addOnState).filter((k) => addOnState[k]),
      // Recipient = primary contact = consignee (one person, written to both column sets)
      primary_firstName: recipient.firstName, primary_lastName: recipient.lastName,
      primary_phone_number: rPhone, primary_country_code: recipient.country.dialCode, primary_country: recipient.country.code,
      primary_email: recipient.email || shipper.email,
      primary_address: recipient.address, primary_city: recipient.city, primary_state: recipient.parish,
      primary_suite_apt_building: recipient.suite, primary_full_address: rFull, primary_lat: recipient.lat, primary_lng: recipient.lng,
      consignee_firstName: recipient.firstName, consignee_lastName: recipient.lastName,
      consignee_phone_number: rPhone, consignee_country_code: recipient.country.dialCode, consignee_country: recipient.country.code,
      consignee_email: recipient.email || shipper.email,
      consignee_address: recipient.address, consignee_city: recipient.city, consignee_state: recipient.parish,
      consignee_suite_apt_building: recipient.suite, consignee_full_address: rFull,
      consignee_lat: recipient.lat || "17.9712", consignee_lng: recipient.lng || "-76.7924",
      // Secondary contact removed from the UI; columns stay empty.
      secondary_firstName: "", secondary_lastName: "", secondary_phone_number: "", secondary_country_code: "", secondary_email: "", secondary_address: "", secondary_city: "", secondary_state: "", secondary_suite_apt_building: "", secondary_full_address: "",
      // Shipper (the customer)
      shiper_firstName: shipper.firstName, shiper_lastName: shipper.lastName, shiper_email: shipper.email,
      shiper_phone_number: sPhone, shiper_country_code: shipper.country.dialCode, shiper_country: shipper.country.code,
      shiper_address: shipper.address, shiper_city: shipper.city, shiper_state: shipper.state,
      shiper_suite_apt_building: shipper.suite, shiper_full_address: sFull,
      shiper_lat: shipper.lat || "", shiper_lng: shipper.lng || "",
    };
  };

  const finishPayment = async (bookings, charges) => {
    const deposit = charges?.[0]?.deposit;
    if (!deposit) throw new Error("The booking was created but no deposit charge was returned.");
    const intent = await createChargeIntent({ bookingChargeId: deposit.id });
    if (!intent.success) throw new Error(intent.message || "Could not start payment.");
    // The Payment Element must carry the exact amount Stripe will confirm.
    const cents = Math.round(parseFloat(intent.amount) * 100);
    if (elementsAmount.current !== cents) {
      // The server priced the deposit differently from the last breakdown the
      // page showed (e.g. pickup address changed) — resync before confirming.
      elements.update({ amount: cents });
      elementsAmount.current = cents;
      const { error: submitError } = await elements.submit();
      if (submitError) throw new Error(submitError.message);
    }
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      clientSecret: intent.clientSecret,
      confirmParams: {
        return_url: `${window.location.origin}/checkout/success?charge=${deposit.id}&booking=${bookings[0].id}`,
        // Email is hidden in the Payment Element (we already have it), so Stripe requires it here.
        payment_method_data: { billing_details: { email: shipper.email.trim(), name: `${shipper.firstName} ${shipper.lastName}`.trim() } },
      },
      redirect: "if_required",
    });
    if (error) throw new Error(error.message);
    if (!paymentIntent || paymentIntent.status !== "succeeded") throw new Error("Payment was not completed.");
    let confirmed = null;
    try { confirmed = await confirmCharge(paymentIntent.id); } catch (e) { console.error("confirm-charge failed; webhook reconciles", e); }
    sessionStorage.removeItem("checkout_state");
    localStorage.removeItem("guest_booking_payload");
    navigate("/checkout/success", {
      replace: true,
      state: {
        booking: confirmed?.body?.booking || bookings[0],
        charges: confirmed?.body?.charges || [deposit, charges[0].customsDelivery].filter(Boolean),
        paid: confirmed?.body?.paid ?? parseFloat(intent.amount),
        provider: providerDetail,
        breakdown,
        guest: isGuest,
      },
    });
  };

  const handlePay = async () => {
    if (!stripe || !elements) return;
    if (!validate()) { toast.error("Please fix the highlighted fields."); return; }
    setPaying(true);
    try {
      // Stripe validates the card fields before we create anything server-side.
      const { error: submitError } = await elements.submit();
      if (submitError) throw new Error(submitError.message);

      let bookings; let charges;
      if (isGuest && !requestId) {
        let res;
        try {
          res = await guestCheckout({
            providerId,
            request: guestPayload,
            booking: bookingPayload(),
            shipper: {
              firstName: shipper.firstName, lastName: shipper.lastName, email: shipper.email,
              phone: shipper.phone, countryCode: shipper.country.dialCode, country: shipper.country.code,
            },
          });
        } catch (e) {
          if (e.response?.status === 409 && e.response?.data?.code === "EXISTING_ACCOUNT") {
            setExistingEmail(shipper.email.trim().toLowerCase());
            toast.info("You already have an account — sign in to continue.");
            return;
          }
          throw new Error(e.response?.data?.message || e.message);
        }
        if (!res.success) throw new Error(res.message);
        localStorage.setItem("token", res.body.authtoken);
        localStorage.setItem("user", JSON.stringify(res.body.user));
        localStorage.setItem("is_login", 1);
        setRequestId(res.body.bookingRequest.id);
        bookings = res.body.bookings; charges = res.body.charges;
      } else {
        const res = await createBooking({ ...bookingPayload(), booking_request_id: requestId });
        if (!res.success) throw new Error(res.message || "Could not create the booking.");
        bookings = res.body.bookings || res.body; charges = res.body.charges;
      }
      await finishPayment(bookings, charges);
    } catch (e) {
      console.error("[checkout] payment failed:", e.message);
      toast.error(e.message || "Payment failed.", { duration: 8000 });
    } finally {
      setPaying(false);
    }
  };

  // "Welcome back": sign in, persist the guest's request under their account, then pay as a member.
  const handleInlineLogin = async (password) => {
    if (!password) { toast.error("Enter your password."); return; }
    setPaying(true);
    try {
      const res = await login({ email: existingEmail, password, role: "1" });
      if (!res.success) throw new Error(res.message || "Sign-in failed.");
      localStorage.setItem("token", res.body.authtoken);
      localStorage.setItem("user", JSON.stringify(res.body.user));
      localStorage.setItem("is_login", 1);
      const saved = await saveBookingRequest(guestPayload);
      const newId = saved.body?.id;
      setRequestId(newId);
      setIsGuest(false);
      setExistingEmail("");
      toast.success("Signed in — completing your payment.");
      const { error: submitError } = await elements.submit();
      if (submitError) throw new Error(submitError.message);
      const cb = await createBooking({ ...bookingPayload(), booking_request_id: newId });
      if (!cb.success) throw new Error(cb.message);
      await finishPayment(cb.body.bookings || cb.body, cb.body.charges);
    } catch (e) {
      toast.error(e.response?.data?.message || e.message || "Sign-in failed.");
    } finally {
      setPaying(false);
    }
  };

  const err = (k) => errors[k];
  const anchor = (k) => (errors[k] ? { "data-error-anchor": true } : {});

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#243d34] to-[#0a1612] text-white">
      {/* Slim header: a checkout page needs the summary and the card form in view, not a hero. */}
      <div className="border-b border-white/10 bg-[#0a1612]/60">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-[22px] sm:text-[26px] font-bold">Checkout</h1>
          <span className="text-xs text-white/50 flex items-center gap-1"><Lock size={12} /> Secure checkout</span>
        </div>
      </div>
      <div className="container mx-auto px-4 py-6">
        {/* Shipment summary strip */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-white/70 mb-6" data-testid="shipment-strip">
          <span className="flex items-center gap-2"><Ship size={16} className="text-[#FFC928]" /> {request?.origin || "Origin"} → Jamaica{recipient.parish ? ` · ${recipient.parish}` : ""}</span>
          <span className="flex items-center gap-2"><PackageCheck size={16} className="text-[#FFC928]" /> {quantity} barrel{quantity === 1 ? "" : "s"} · {isOwn ? "Ship your own" : "Barrel drop-off"}</span>
          {request?.pickup_date && <span className="flex items-center gap-2"><Truck size={16} className="text-[#FFC928]" /> Pickup {String(request.pickup_date).slice(0, 10)}</span>}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_400px] gap-8 items-start">
          {/* ── Left: details ── */}
          <div className="space-y-8">
            <section className="bg-[#2D413F] rounded-2xl p-5 sm:p-7" data-testid="section-shipper">
              <h3 className="text-[22px] sm:text-[26px] font-semibold">1. Your details</h3>
              <p className="text-sm text-white/60 mb-4">You're the shipper — we'll send receipts and updates here{isOwn ? ", and the forwarder collects from this address" : ""}.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div {...anchor("s_firstName")}><Field label="First name" placeholder="e.g. Jane" value={shipper.firstName} onChange={(v) => setS("firstName")(cap(v))} error={err("s_firstName")} autoComplete="given-name" testid="s-first" /></div>
                <div {...anchor("s_lastName")}><Field label="Last name" placeholder="e.g. Doe" value={shipper.lastName} onChange={(v) => setS("lastName")(cap(v))} error={err("s_lastName")} autoComplete="family-name" testid="s-last" /></div>
                <div {...anchor("s_email")}><Field label="Email" placeholder="e.g. jane@example.com" value={shipper.email} onChange={setS("email")} error={err("s_email")} type="email" autoComplete="email" testid="s-email" /></div>
                <div {...anchor("s_phone")}>
                  <PhoneInput label="Phone number" labelClassName="text-sm text-white/80 font-medium" value={shipper.phone} onChange={setS("phone")} country={shipper.country}
                    onCountryChange={(c) => setShipper((p) => ({ ...p, country: c }))} error={err("s_phone")} />
                </div>
              </div>
              {isOwn && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div className="md:col-span-2" {...anchor("s_address")}>
                    <AddressField label="Pickup address" placeholder="e.g. 100 Grant St" value={shipper.address} onChange={setS("address")} apiLoaded={apiLoaded} country="us" error={err("s_address")} testid="s-address"
                      onPlace={(place, c) => setShipper((p) => ({ ...p, address: c.street || place.formatted_address || p.address, city: c.city || p.city, state: c.state || p.state, lat: c.lat || "", lng: c.lng || "" }))} />
                  </div>
                  <div {...anchor("s_city")}><Field label="City" placeholder="e.g. Pittsburgh" value={shipper.city} onChange={setS("city")} error={err("s_city")} testid="s-city" /></div>
                  <div {...anchor("s_state")}><Field label="State" placeholder="e.g. PA" value={shipper.state} onChange={setS("state")} error={err("s_state")} testid="s-state" /></div>
                  <div className="md:col-span-2"><Field label="Apt / Suite" placeholder="e.g. Apt 2B" value={shipper.suite} onChange={setS("suite")} optional /></div>
                </div>
              )}
            </section>

            <section className="bg-[#2D413F] rounded-2xl p-5 sm:p-7" data-testid="section-recipient">
              <h3 className="text-[22px] sm:text-[26px] font-semibold">2. Recipient in Jamaica</h3>
              <p className="text-sm text-white/60 mb-4">The person receiving the barrel. Their parish sets the customs &amp; delivery estimate.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div {...anchor("r_firstName")}><Field label="First name" placeholder="e.g. Elvis" value={recipient.firstName} onChange={(v) => setR("firstName")(cap(v))} error={err("r_firstName")} testid="r-first" /></div>
                <div {...anchor("r_lastName")}><Field label="Last name" placeholder="e.g. Livingston" value={recipient.lastName} onChange={(v) => setR("lastName")(cap(v))} error={err("r_lastName")} testid="r-last" /></div>
                <div {...anchor("r_phone")}>
                  <PhoneInput label="Phone number" labelClassName="text-sm text-white/80 font-medium" value={recipient.phone} onChange={setR("phone")} country={recipient.country}
                    onCountryChange={(c) => setRecipient((p) => ({ ...p, country: c }))} error={err("r_phone")} />
                </div>
                <div {...anchor("r_email")}><Field label="Email" placeholder="e.g. elvis@example.com" value={recipient.email} onChange={setR("email")} error={err("r_email")} type="email" optional testid="r-email" /></div>
                <div className="md:col-span-2" {...anchor("r_address")}>
                  <AddressField label="Street address" placeholder="e.g. 15 Molynes Road" value={recipient.address} onChange={setR("address")} apiLoaded={apiLoaded} country="jm" error={err("r_address")} testid="r-address"
                    onPlace={(place, c) => setRecipient((p) => ({ ...p, address: c.street || place.formatted_address || p.address, city: c.city || c.sublocality || p.city, parish: JAMAICA_PARISHES.includes(c.county) ? c.county : p.parish, lat: c.lat || "", lng: c.lng || "" }))} />
                </div>
                <div {...anchor("r_city")}><Field label="Town / City" placeholder="e.g. Kingston 10" value={recipient.city} onChange={setR("city")} error={err("r_city")} testid="r-city" /></div>
                <div {...anchor("r_parish")}>
                  <label className="text-sm text-white/80 font-medium">Parish</label>
                  <select value={recipient.parish} onChange={(e) => setR("parish")(e.target.value)} data-testid="r-parish"
                    className={`w-full mt-1 bg-[#0b1f1a] border rounded-[14px] px-3 py-3.5 text-sm text-white focus:outline-none ${err("r_parish") ? "border-red-400" : "border-[#4E6B5D] focus:border-[#9fe0b8]"}`}>
                    <option value="" disabled>Select parish</option>
                    {JAMAICA_PARISHES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                  {err("r_parish") && <p className="text-red-400 text-xs mt-1">{err("r_parish")}</p>}
                </div>
                <div className="md:col-span-2"><Field label="Apt / Suite" placeholder="e.g. Apt 2B" value={recipient.suite} onChange={setR("suite")} optional /></div>
              </div>
            </section>

            {addons.length > 0 && (
              <section className="bg-[#2D413F] rounded-2xl p-5 sm:p-7" data-testid="section-addons">
                <h3 className="text-[22px] sm:text-[26px] font-semibold">3. Included services</h3>
                <p className="text-sm text-white/60 mb-3">Untick anything you'd rather arrange yourself.</p>
                <div className="flex flex-wrap gap-x-8 gap-y-3">
                  {addons.map((a) => (
                    <label key={a.id || a.name} className="flex items-center gap-3 text-[15px] cursor-pointer">
                      <input type="checkbox" checked={!!addOnState[a.name]} onChange={() => setAddOnState((p) => ({ ...p, [a.name]: !p[a.name] }))}
                        className="w-5 h-5 appearance-none rounded-sm border border-[#4E6B5D] bg-transparent cursor-pointer relative checked:bg-[#FFD233] checked:border-[#FFD233] after:content-['✓'] after:absolute after:text-black after:text-[12px] after:font-bold after:left-1/2 after:top-1/2 after:-translate-x-1/2 after:-translate-y-1/2 after:opacity-0 checked:after:opacity-100" />
                      {a.name}
                    </label>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* ── Right: pay ── */}
          <PaymentPanel
            breakdown={breakdown}
            loadingBreakdown={loadingBreakdown}
            provider={providerDetail}
            onPay={handlePay}
            paying={paying}
            guest={isGuest}
            existingEmail={existingEmail}
            onInlineLogin={handleInlineLogin}
            elementsReady={elementsReady}
            setElementsReady={setElementsReady}
          />
        </div>
      </div>
    </div>
  );
};

const appearance = {
  theme: "stripe",
  variables: { colorPrimary: "#0D4D4D", borderRadius: "12px", fontSizeBase: "15px" },
};

const Checkout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [stripePromise, setStripePromise] = useState(null);
  const [initialAmount, setInitialAmount] = useState(null);

  const ctx = useMemo(() => {
    const fromState = location.state;
    if (fromState?.providerId) {
      try { sessionStorage.setItem("checkout_state", JSON.stringify(fromState)); } catch { /* ignore */ }
      return fromState;
    }
    try { return JSON.parse(sessionStorage.getItem("checkout_state") || "null"); } catch { return null; }
  }, [location.state]);

  useEffect(() => {
    if (!ctx?.providerId) { navigate("/", { replace: true }); return; }
    getStripeConfig().then((res) => {
      const key = res.body?.publishableKey;
      if (key) setStripePromise(loadStripe(key));
      else toast.error("Payments are not configured.");
    }).catch(() => toast.error("Payments are not configured."));
    // First breakdown just to size the Payment Element; the page refreshes it itself.
    const params = { providerId: ctx.providerId, parish: ctx.bookingRequest?.parish || ctx.guestPayload?.parish || "" };
    const p = ctx.guest && !ctx.bookingRequest?.id
      ? postQuoteBreakdown({ request: ctx.guestPayload, ...params })
      : getQuoteBreakdown({ requestId: ctx.bookingRequest?.id, ...params });
    p.then((res) => setInitialAmount(Math.max(100, Math.round((res.body?.dueNow?.total || 1) * 100)))).catch(() => setInitialAmount(100));
  }, [ctx, navigate]);

  if (!ctx?.providerId) return null;
  if (!stripePromise || initialAmount === null) {
    return (
      <div className="min-h-screen bg-[#0a1612] flex items-center justify-center text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-400" />
      </div>
    );
  }
  return (
    <Elements stripe={stripePromise} options={{ mode: "payment", amount: initialAmount, currency: "usd", appearance }}>
      <CheckoutInner ctx={ctx} />
    </Elements>
  );
};

export default Checkout;
