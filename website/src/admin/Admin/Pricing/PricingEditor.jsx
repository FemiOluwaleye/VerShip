import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Swal from "sweetalert2";
import "@fortawesome/fontawesome-free/css/all.min.css";
import { ADMIN_BASE } from "../../adminBase";
import { axiosInstance } from "../../Config";
import { JAMAICA_PARISHES } from "../../../utils/parishes";
import {
  isPricingV2,
  calculateBarrelPricing,
  calculateBarrelPricingV2,
  v2PickupCharge,
  v2ParishFee,
  calculateBarrelBasedFees,
} from "../../../utils/pricing";

/*
 * Per-forwarder rate card editor.
 *
 * One panel per barrelsprices row. Route identity (barrel type, origin,
 * destination) is displayed but not editable — those fields decide which
 * bookings a card prices, so changing them would silently re-point live
 * matching. Admins change numbers.
 *
 * The preview panel imports the SAME functions the customer's quote screen runs
 * (website/src/utils/pricing.js, via components/ShipmentDetailsSection), so the
 * figure an admin sees before saving cannot drift from what a customer is
 * quoted. The total is assembled in the same order as finalTotal there:
 *   barrel line + parish customs&delivery + pickup + commission + service fee
 * (delivery is folded into the parish fee under v2, and drop-off orders pay no
 * pickup.)
 */

const money = (v) => `$${(parseFloat(v) || 0).toFixed(2)}`;
const num = (v) => (v === null || v === undefined || v === "" ? "" : String(v));

// Editable fields per model, mirroring V2_FIELDS / LEGACY_FIELDS in
// server/controller/admincontroller/pricingController.js. The server is the
// authority — anything not in its spec is ignored on save — so these lists must
// stay in step or an admin will type into a field that silently does nothing.
const V2_NUMERIC = [
  { key: "seaFreightPrice", label: "Sea freight, per barrel", prefix: "$", hint: "Price for 1–4 barrels. Tier discounts below come off this." },
  { key: "discount5to9", label: "Discount, 5–9 barrels", prefix: "$", hint: "Dollars off per barrel at 5–9 barrels." },
  { key: "discount10plus", label: "Discount, 10+ barrels", prefix: "$", hint: "Dollars off per barrel at 10 or more. Must be at least the 5–9 discount." },
  { key: "pickupCharge", label: "Flat pickup charge", prefix: "$", hint: "Charged once per order for collection. Drop-off orders pay nothing." },
  { key: "pickupRadius", label: "Free pickup radius", suffix: "mi", hint: "Miles included in the flat charge." },
  { key: "extraMileageCost", label: "Cost per extra mile", prefix: "$", hint: "Applied to each mile beyond the free radius." },
];

const LEGACY_NUMERIC = [
  { key: "basePrice", label: "Base price, per barrel", prefix: "$" },
  { key: "pricePerMile", label: "Price per mile", prefix: "$" },
  { key: "freeMiles", label: "Free miles", suffix: "mi" },
  { key: "flatPickupCharge", label: "Flat pickup charge", prefix: "$" },
  { key: "pickupFreeMiles", label: "Pickup free miles", suffix: "mi" },
  { key: "pickupPerMileCharge", label: "Pickup per-mile charge", prefix: "$" },
  { key: "flatDeliveryCharge", label: "Flat delivery charge", prefix: "$" },
  { key: "deliveryFreeMiles", label: "Delivery free miles", suffix: "mi" },
  { key: "deliveryPerMileCharge", label: "Delivery per-mile charge", prefix: "$" },
  { key: "discountAfter", label: "Volume discount after N barrels" },
  { key: "discountPercent", label: "Volume discount percent", suffix: "%" },
];

const GATE_COPY = {
  role: { ok: "Forwarder account", bad: "Not a forwarder account" },
  status: { ok: "Account active", bad: "Account inactive" },
  documentVerify: { ok: "Documents verified", bad: "Documents not verified" },
  hasLiveCard: { ok: "Has a rate card", bad: "No rate card" },
};

// Build the editable draft for one card. parishFees becomes a flat
// { parish: {first, additional} } map with every parish present, so the grid
// renders blanks rather than dropping rows that have no fee yet.
const draftFromCard = (card) => {
  const d = {};
  const fields = isPricingV2(card) ? V2_NUMERIC : LEGACY_NUMERIC;
  fields.forEach((f) => { d[f.key] = num(card[f.key]); });
  d.transitTime = num(card.transitTime);
  if (!isPricingV2(card)) {
    d.isVolumeDiscount = String(card.isVolumeDiscount) === "1" ? "1" : "0";
    d.customsAndHandling = num(card.customsAndHandling);
  }
  const fees = card.parishFees || {};
  d.parishFees = {};
  JAMAICA_PARISHES.forEach((p) => {
    const raw = fees[p];
    if (raw && typeof raw === "object") {
      d.parishFees[p] = { first: num(raw.first), additional: num(raw.additional) };
    } else if (raw !== undefined && raw !== null && raw !== "") {
      // Scalar entries from the v2 auto-migration are a flat per-order fee.
      d.parishFees[p] = { first: num(raw), additional: "0" };
    } else {
      d.parishFees[p] = { first: "", additional: "" };
    }
  });
  return d;
};

// A draft shaped like a barrelsprices row, so the real pricing functions can be
// run against unsaved edits.
const draftAsCard = (card, draft) => ({
  ...card,
  ...Object.fromEntries(
    Object.entries(draft).filter(([k]) => k !== "parishFees")
  ),
  parishFees: draft.parishFees,
});

const PricingEditor = () => {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState({});
  const [openCard, setOpenCard] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [confirmState, setConfirmState] = useState(null); // { cardId, changes, password, reason, notify, saving }

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get(`/provider/${id}/pricing`);
      if (res.data.success) {
        const b = res.data.body;
        setData(b);
        const d = {};
        (b.cards || []).forEach((c) => { d[c.id] = draftFromCard(c); });
        setDrafts(d);
        if (b.cards?.length) setOpenCard(b.cards[0].id);
      } else {
        Swal.fire("Error", res.data.message || "Failed to load pricing", "error");
      }
    } catch (e) {
      Swal.fire("Error", "An error occurred while fetching this forwarder's pricing", "error");
    } finally {
      setLoading(false);
    }
  };

  const setField = (cardId, key, value) =>
    setDrafts((prev) => ({ ...prev, [cardId]: { ...prev[cardId], [key]: value } }));

  const setParish = (cardId, parish, which, value) =>
    setDrafts((prev) => ({
      ...prev,
      [cardId]: {
        ...prev[cardId],
        parishFees: {
          ...prev[cardId].parishFees,
          [parish]: { ...prev[cardId].parishFees[parish], [which]: value },
        },
      },
    }));

  // Diff the draft against the saved card so the confirm dialog shows only what
  // actually moved. Compared numerically to avoid flagging "95" -> "95.00".
  const diffFor = (card) => {
    const draft = drafts[card.id];
    if (!draft) return {};
    const out = {};
    const v2 = isPricingV2(card);
    const fields = [...(v2 ? V2_NUMERIC : LEGACY_NUMERIC).map((f) => f.key), "transitTime"];
    if (!v2) fields.push("isVolumeDiscount", "customsAndHandling");

    fields.forEach((key) => {
      const before = card[key];
      const after = draft[key];
      if (key === "transitTime" || key === "customsAndHandling") {
        if (String(before ?? "").trim() !== String(after ?? "").trim()) {
          out[key] = { from: before, to: after };
        }
        return;
      }
      if (key === "isVolumeDiscount") {
        const b = String(before) === "1" ? "1" : "0";
        if (b !== after) out[key] = { from: b === "1" ? "On" : "Off", to: after === "1" ? "On" : "Off" };
        return;
      }
      const b = parseFloat(before) || 0;
      const a = parseFloat(after) || 0;
      if (b !== a) out[key] = { from: money(b), to: money(a) };
    });

    // parishFees is one field on the wire; summarise how many parishes moved.
    const changedParishes = JAMAICA_PARISHES.filter((p) => {
      const savedRaw = card.parishFees?.[p];
      const saved = savedRaw && typeof savedRaw === "object"
        ? savedRaw
        : { first: savedRaw ?? "", additional: 0 };
      const d = drafts[card.id].parishFees[p];
      return (
        (parseFloat(saved.first) || 0) !== (parseFloat(d.first) || 0) ||
        (parseFloat(saved.additional) || 0) !== (parseFloat(d.additional) || 0)
      );
    });
    if (changedParishes.length) {
      out.parishFees = {
        from: `${changedParishes.length} parish${changedParishes.length > 1 ? "es" : ""}`,
        to: changedParishes.join(", "),
      };
    }
    return out;
  };

  const openConfirm = (card) => {
    const changes = diffFor(card);
    if (!Object.keys(changes).length) {
      Swal.fire("Nothing to save", "This rate card has no unsaved changes.", "info");
      return;
    }
    setConfirmState({ cardId: card.id, changes, password: "", reason: "", notify: true, saving: false });
  };

  const submitSave = async () => {
    const { cardId, password, reason, notify, changes } = confirmState;
    const draft = drafts[cardId];

    // Send ONLY the fields that changed. Posting the whole row back would put
    // untouched legacy values through validation they were never held to — some
    // production cards carry customsAndHandling: "Included", which is not a
    // number, so a base-price edit would be refused for a field the admin never
    // opened.
    const patch = {};
    Object.keys(changes).forEach((key) => {
      if (key === "parishFees") {
        patch.parishFees = Object.fromEntries(
          JAMAICA_PARISHES.map((p) => [p, {
            first: draft.parishFees[p].first,
            additional: draft.parishFees[p].additional || "0",
          }])
        );
      } else {
        patch[key] = draft[key];
      }
    });
    if (!Object.keys(patch).length) {
      setConfirmState(null);
      return;
    }

    setConfirmState((s) => ({ ...s, saving: true }));
    try {
      const res = await axiosInstance.put(`/provider/${id}/pricing/${cardId}`, {
        password, reason, notify, patch,
      });
      if (res.data.success) {
        setConfirmState(null);
        const notice = res.data.body.notifyError
          ? `Saved, but the notice to the forwarder failed to send: ${res.data.body.notifyError}`
          : res.data.body.notified
          ? "Saved. The forwarder has been emailed the change."
          : "Saved. No notice was sent to the forwarder.";
        Swal.fire("Pricing updated", notice, "success");
        fetchData();
      } else {
        setConfirmState((s) => ({ ...s, saving: false }));
        Swal.fire("Not saved", res.data.message || "Failed to save", "error");
      }
    } catch (e) {
      setConfirmState((s) => ({ ...s, saving: false }));
      Swal.fire("Not saved", e?.response?.data?.message || "Failed to save", "error");
    }
  };

  const retireCard = async (card) => {
    const { value: formValues } = await Swal.fire({
      title: "Retire this rate card?",
      html: `
        <p style="font-size:14px;text-align:left;margin-bottom:12px">
          <strong>${card.type === "dropoff" ? "Barrel drop-off" : "Ship your own barrel"}</strong><br/>
          ${card.originCountry} → ${card.destinationCountry}
        </p>
        <p style="font-size:13px;color:#666;text-align:left">
          It stops being offered on new quotes. Orders already placed keep their booked price.
        </p>
        <input id="swal-reason" class="swal2-input" placeholder="Reason (required)">
        <input id="swal-pw" type="password" class="swal2-input" placeholder="Your admin password">
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;margin-top:10px;justify-content:center">
          <input id="swal-notify" type="checkbox" checked> Email the forwarder
        </label>`,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonColor: "#d33",
      confirmButtonText: "Retire card",
      preConfirm: () => ({
        reason: document.getElementById("swal-reason").value,
        password: document.getElementById("swal-pw").value,
        notify: document.getElementById("swal-notify").checked,
      }),
    });
    if (!formValues) return;
    try {
      const res = await axiosInstance.delete(`/provider/${id}/pricing/${card.id}`, {
        data: formValues,
      });
      if (res.data.success) {
        Swal.fire("Retired", "The rate card is no longer offered on new quotes.", "success");
        fetchData();
      } else {
        Swal.fire("Not retired", res.data.message || "Failed", "error");
      }
    } catch (e) {
      Swal.fire("Not retired", e?.response?.data?.message || "Failed", "error");
    }
  };

  if (loading) {
    return (
      <div id="layout-wrapper">
        <div className="main-content">
          <div className="page-content">
            <div className="container-fluid">
              <p className="text-muted">Loading pricing…</p>
            </div>
          </div>
        </div>
      </div>
    );
  }
  if (!data) return null;

  const { provider, cards, history, audit, serviceFeePercent, serviceFeeLabel } = data;

  return (
    <div id="layout-wrapper">
      <div className="main-content">
        <div className="page-content">
      <div className="container-fluid">
        <div className="title-box mb-3 pb-1 d-flex align-items-start justify-content-between">
          <div>
            <h4 className="mb-0 page-title">{provider.businessName}</h4>
            <nav aria-label="breadcrumb" className="mt-1">
              <ol className="breadcrumb mb-0">
                <li className="breadcrumb-item">
                  <Link to={`${ADMIN_BASE}/dashboard`} className="new">
                    <i className="ri-home-4-fill me-1 new" /> Home
                  </Link>
                </li>
                <li className="breadcrumb-item">
                  <Link to={`${ADMIN_BASE}/pricing`} className="new">
                    <i className="ri-money-dollar-circle-line me-1 new" /> Pricing
                  </Link>
                </li>
                <li className="breadcrumb-item active" aria-current="page">
                  {provider.email} · provider #{provider.id}
                </li>
              </ol>
            </nav>
          </div>
          <Link to={`${ADMIN_BASE}/pricing`} className="btn btn-sm btn-light">
            <i className="uil-arrow-left me-1" /> All forwarders
          </Link>
        </div>

        {/* Publish readiness — the four gates getForwarders() applies, named
            individually so a "not live" forwarder points at its own fix. */}
        <div className="card mb-3">
          <div className="card-body">
            <h5 className="card-title mb-3">Public listing status</h5>
            <div className="d-flex flex-wrap gap-3">
              {Object.entries(provider.gates).map(([key, ok]) => (
                <span key={key} className={`badge ${ok ? "bg-success" : "bg-danger"} p-2`}>
                  <i className={`${ok ? "uil-check" : "uil-times"} me-1`} />
                  {ok ? GATE_COPY[key].ok : GATE_COPY[key].bad}
                </span>
              ))}
            </div>
            {!Object.values(provider.gates).every(Boolean) && (
              <p className="text-muted font-13 mb-0 mt-3">
                All four must pass before this forwarder appears on the public site or can be
                quoted. Account status and document verification are set on the{" "}
                <Link to={`${ADMIN_BASE}/providerlist`}>Providers</Link> page.
              </p>
            )}
          </div>
        </div>

        {cards.length === 0 && (
          <div className="card">
            <div className="card-body">
              <p className="mb-0 text-muted">
                This forwarder has no live rate card, so they cannot be quoted. Rate cards are
                created by the forwarder in their own onboarding — admins adjust existing pricing
                rather than inventing routes on their behalf.
              </p>
            </div>
          </div>
        )}

        {cards.map((card) => {
          const draft = drafts[card.id];
          if (!draft) return null;
          const v2 = isPricingV2(card);
          const isOpen = openCard === card.id;
          const changeCount = Object.keys(diffFor(card)).length;

          return (
            <div className="card mb-3" key={card.id}>
              <div
                className="card-body pb-2"
                style={{ cursor: "pointer" }}
                onClick={() => setOpenCard(isOpen ? null : card.id)}
              >
                <div className="d-flex justify-content-between align-items-start">
                  <div>
                    <h5 className="mb-1">
                      {card.type === "dropoff" ? "Barrel drop-off" : "Ship your own barrel"}
                      <span className={`badge ms-2 ${v2 ? "bg-primary" : "bg-secondary"}`}>
                        {v2 ? "simplified (v2)" : "legacy"}
                      </span>
                      {changeCount > 0 && (
                        <span className="badge bg-warning text-dark ms-2">
                          {changeCount} unsaved change{changeCount > 1 ? "s" : ""}
                        </span>
                      )}
                    </h5>
                    <p className="text-muted mb-0 font-13">
                      {card.originCountry} → {card.destinationCountry} · card #{card.id} ·{" "}
                      {money(v2 ? card.seaFreightPrice : card.barrelPrice)} per barrel
                      {v2 && ` · ${card.parishCoverage}/14 parishes priced`}
                    </p>
                  </div>
                  <i className={isOpen ? "uil-angle-up font-20" : "uil-angle-down font-20"} />
                </div>
              </div>

              {isOpen && (
                <div className="card-body pt-0">
                  <hr />
                  <p className="text-muted font-13">
                    Barrel type and route are fixed — they decide which bookings this card prices.
                    Saved changes apply to new quotes only; orders already placed keep the price
                    they were booked at.
                  </p>

                  <div className="row">
                    <div className="col-lg-7">
                      <div className="row">
                        {(v2 ? V2_NUMERIC : LEGACY_NUMERIC).map((f) => (
                          <div className="col-md-6 mb-3" key={f.key}>
                            <label className="form-label font-13 mb-1">{f.label}</label>
                            <div className="input-group input-group-sm">
                              {f.prefix && <span className="input-group-text">{f.prefix}</span>}
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                className="form-control"
                                value={draft[f.key]}
                                onChange={(e) => setField(card.id, f.key, e.target.value)}
                              />
                              {f.suffix && <span className="input-group-text">{f.suffix}</span>}
                            </div>
                            {f.hint && <div className="form-text font-12">{f.hint}</div>}
                          </div>
                        ))}

                        <div className="col-md-6 mb-3">
                          <label className="form-label font-13 mb-1">Transit time</label>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            value={draft.transitTime}
                            onChange={(e) => setField(card.id, "transitTime", e.target.value)}
                            placeholder="e.g. 14 days"
                          />
                        </div>

                        {!v2 && (
                          <>
                            <div className="col-md-6 mb-3">
                              <label className="form-label font-13 mb-1">Volume discount</label>
                              <select
                                className="form-select form-select-sm"
                                value={draft.isVolumeDiscount}
                                onChange={(e) =>
                                  setField(card.id, "isVolumeDiscount", e.target.value)
                                }
                              >
                                <option value="0">Off</option>
                                <option value="1">On</option>
                              </select>
                            </div>
                            <div className="col-12 mb-3">
                              <label className="form-label font-13 mb-1">
                                Customs &amp; handling (legacy 25-slot list, by barrel count)
                              </label>
                              <input
                                type="text"
                                className="form-control form-control-sm font-monospace"
                                value={draft.customsAndHandling}
                                onChange={(e) =>
                                  setField(card.id, "customsAndHandling", e.target.value)
                                }
                              />
                              <div className="form-text font-12">
                                Comma-separated, read positionally by barrel quantity. Position 1 is
                                a 1-barrel order.
                              </div>
                            </div>
                          </>
                        )}
                      </div>

                      {v2 && (
                        <>
                          <h6 className="mt-2 mb-1">Customs &amp; delivery, by parish</h6>
                          <p className="text-muted font-12">
                            One combined fee per parish. The first barrel pays “First”, every
                            additional barrel adds “Additional”. A parish left blank means customers
                            shipping there are quoted no customs or delivery cost at all.
                          </p>
                          <div className="table-responsive">
                            <table className="table table-sm table-bordered mb-0">
                              <thead className="table-light">
                                <tr>
                                  <th>Parish</th>
                                  <th style={{ width: 130 }}>First barrel</th>
                                  <th style={{ width: 130 }}>Each additional</th>
                                </tr>
                              </thead>
                              <tbody>
                                {JAMAICA_PARISHES.map((p) => {
                                  const entry = draft.parishFees[p];
                                  const blank = !(parseFloat(entry.first) > 0);
                                  return (
                                    <tr key={p} className={blank ? "table-warning" : ""}>
                                      <td className="font-13">{p}</td>
                                      <td>
                                        <input
                                          type="number"
                                          step="0.01"
                                          min="0"
                                          className="form-control form-control-sm"
                                          value={entry.first}
                                          onChange={(e) =>
                                            setParish(card.id, p, "first", e.target.value)
                                          }
                                        />
                                      </td>
                                      <td>
                                        <input
                                          type="number"
                                          step="0.01"
                                          min="0"
                                          className="form-control form-control-sm"
                                          value={entry.additional}
                                          onChange={(e) =>
                                            setParish(card.id, p, "additional", e.target.value)
                                          }
                                        />
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="col-lg-5">
                      <QuotePreview
                        card={card}
                        draft={draft}
                        serviceFeePercent={serviceFeePercent}
                        serviceFeeLabel={serviceFeeLabel}
                      />
                    </div>
                  </div>

                  <hr />
                  <div className="d-flex justify-content-between align-items-center">
                    <button
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => retireCard(card)}
                    >
                      Retire this card
                    </button>
                    <div>
                      <button
                        className="btn btn-sm btn-light me-2"
                        onClick={() =>
                          setDrafts((prev) => ({ ...prev, [card.id]: draftFromCard(card) }))
                        }
                        disabled={changeCount === 0}
                      >
                        Discard changes
                      </button>
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => openConfirm(card)}
                        disabled={changeCount === 0}
                      >
                        Review &amp; save
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Admin edit trail. Separate from `history`, which is the forwarder's
            own soft-deleted revisions. */}
        <div className="card mb-3">
          <div className="card-body">
            <h5 className="card-title mb-3">Admin change log</h5>
            {audit.length === 0 ? (
              <p className="text-muted mb-0 font-13">
                No admin has changed this forwarder's pricing.
              </p>
            ) : (
              <div className="table-responsive">
                <table className="table table-sm table-centered mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>When</th>
                      <th>Admin</th>
                      <th>Action</th>
                      <th>Changed</th>
                      <th>Reason</th>
                      <th>Notified</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audit.map((a) => (
                      <tr key={a.id}>
                        <td className="font-12">{new Date(a.createdAt).toLocaleString()}</td>
                        <td className="font-12">{a.adminEmail}</td>
                        <td className="font-12">
                          {a.action}
                          {a.cardId ? ` #${a.cardId}` : ""}
                        </td>
                        <td className="font-12">
                          {a.changes
                            ? Object.entries(a.changes).map(([f, v]) => (
                                <div key={f}>
                                  {f}: <s className="text-muted">{String(v.from ?? "—")}</s> →{" "}
                                  <strong>{String(v.to ?? "—")}</strong>
                                </div>
                              ))
                            : "—"}
                        </td>
                        <td className="font-12">{a.reason}</td>
                        <td className="font-12">
                          {a.notified ? (
                            <span className="text-success">yes</span>
                          ) : a.notifyError ? (
                            <span className="text-danger" title={a.notifyError}>
                              failed
                            </span>
                          ) : (
                            <span className="text-muted">suppressed</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {history.length > 0 && (
          <div className="card mb-3">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center">
                <h5 className="card-title mb-0">
                  Retired rate cards ({history.length})
                </h5>
                <button
                  className="btn btn-sm btn-light"
                  onClick={() => setShowHistory(!showHistory)}
                >
                  {showHistory ? "Hide" : "Show"}
                </button>
              </div>
              <p className="text-muted font-12 mb-0 mt-2">
                Superseded whenever the forwarder re-saves their pricing. Kept because
                reconstructing what an old order was quoted at needs the card that priced it.
              </p>
              {showHistory && (
                <div className="table-responsive mt-3">
                  <table className="table table-sm mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Card</th>
                        <th>Type</th>
                        <th>Route</th>
                        <th>Per barrel</th>
                        <th>Model</th>
                        <th>Retired</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((h) => (
                        <tr key={h.id}>
                          <td className="font-12">#{h.id}</td>
                          <td className="font-12">{h.type}</td>
                          <td className="font-12">
                            {h.originCountry} → {h.destinationCountry}
                          </td>
                          <td className="font-12">
                            {money(h.modelVersion === "v2" ? h.seaFreightPrice : h.barrelPrice)}
                          </td>
                          <td className="font-12">{h.modelVersion}</td>
                          <td className="font-12">
                            {h.deletedAt ? new Date(h.deletedAt).toLocaleDateString() : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {confirmState && (
        <ConfirmSaveModal
          state={confirmState}
          setState={setConfirmState}
          onSubmit={submitSave}
          card={cards.find((c) => c.id === confirmState.cardId)}
          draft={drafts[confirmState.cardId]}
          serviceFeePercent={serviceFeePercent}
          providerName={provider.businessName}
        />
      )}
        </div>
      </div>
    </div>
  );
};

/*
 * Live quote preview. Runs the unsaved draft through the same pricing functions
 * the customer's quote screen uses, and composes the total in the same order as
 * finalTotal in components/ShipmentDetailsSection.jsx.
 *
 * Admin commission is excluded: it is a per-provider field on users
 * (adminCommission), currently unset for every forwarder, and is out of scope
 * for this screen. When it is set, it adds a percentage of the barrel line.
 */
const QuotePreview = ({ card, draft, serviceFeePercent, serviceFeeLabel }) => {
  const [quantity, setQuantity] = useState(1);
  const [parish, setParish] = useState(JAMAICA_PARISHES[0]);
  const [pickupMiles, setPickupMiles] = useState(0);

  const live = useMemo(() => draftAsCard(card, draft), [card, draft]);
  const v2 = isPricingV2(card);
  const isDropoff = card.type === "dropoff";

  const barrel = v2
    ? calculateBarrelPricingV2({ quantity, barrelPrices: live })
    : calculateBarrelPricing({
        quantity,
        perBarrelPrice: live.basePrice,
        isVolumeDiscount: live.isVolumeDiscount,
        discountAfter: live.discountAfter,
        discountPercent: live.discountPercent,
      });

  // Drop-off orders pay no pickup — the customer brings the barrel.
  const pickup = v2 && !isDropoff ? v2PickupCharge(live, pickupMiles) : { total: 0, extraMiles: 0 };
  const parishFee = v2 ? v2ParishFee(live, parish, quantity) : 0;
  const { serviceFeeAmount } = calculateBarrelBasedFees(barrel.barrelPrice, 0, serviceFeePercent);
  const total = barrel.barrelPrice + parishFee + pickup.total + serviceFeeAmount;

  const row = (label, value, muted) => (
    <div className="d-flex justify-content-between font-13 py-1">
      <span className={muted ? "text-muted" : ""}>{label}</span>
      <span className={muted ? "text-muted" : "fw-semibold"}>{value}</span>
    </div>
  );

  return (
    <div className="card bg-light border-0">
      <div className="card-body">
        <h6 className="mb-1">What the customer would pay</h6>
        <p className="text-muted font-12 mb-3">
          Calculated with the same functions the customer's quote screen uses, against your
          unsaved edits.
        </p>

        <div className="row g-2 mb-3">
          <div className="col-4">
            <label className="form-label font-12 mb-1">Barrels</label>
            <input
              type="number"
              min="1"
              className="form-control form-control-sm"
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
            />
          </div>
          <div className="col-8">
            <label className="form-label font-12 mb-1">Destination parish</label>
            <select
              className="form-select form-select-sm"
              value={parish}
              onChange={(e) => setParish(e.target.value)}
              disabled={!v2}
            >
              {JAMAICA_PARISHES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          {v2 && !isDropoff && (
            <div className="col-12">
              <label className="form-label font-12 mb-1">Pickup distance (miles)</label>
              <input
                type="number"
                min="0"
                className="form-control form-control-sm"
                value={pickupMiles}
                onChange={(e) => setPickupMiles(Math.max(0, parseFloat(e.target.value) || 0))}
              />
            </div>
          )}
        </div>

        <hr className="my-2" />

        {row(
          `Barrels (${quantity} × ${money(barrel.discountedPerBarrel)})`,
          money(barrel.barrelPrice)
        )}
        {barrel.barrelDiscount > 0 &&
          row(
            `Tier discount applied (list ${money(barrel.listTotal)})`,
            `−${money(barrel.barrelDiscount)}`,
            true
          )}
        {v2 && row(`Customs & delivery — ${parish}`, parishFee > 0 ? money(parishFee) : "not priced")}
        {v2 &&
          !isDropoff &&
          row(
            `Pickup${pickup.extraMiles > 0 ? ` (+${pickup.extraMiles.toFixed(1)} mi beyond radius)` : ""}`,
            money(pickup.total)
          )}
        {isDropoff && row("Pickup", "n/a — customer drops off", true)}
        {row(`${serviceFeeLabel} (${serviceFeePercent}%)`, money(serviceFeeAmount))}

        <hr className="my-2" />
        <div className="d-flex justify-content-between">
          <strong>Customer total</strong>
          <strong>{money(total)}</strong>
        </div>

        {v2 && parishFee === 0 && (
          <div className="alert alert-warning mt-3 mb-0 font-12 py-2">
            {parish} has no customs &amp; delivery fee, so this quote understates the real cost.
          </div>
        )}
        <p className="text-muted font-12 mb-0 mt-2">
          Excludes platform commission (unset for this forwarder) and optional add-ons like cargo
          insurance.
        </p>
      </div>
    </div>
  );
};

/*
 * Save confirmation. Shows the field-by-field diff and the change in the
 * customer's total before asking for a reason, the admin's password, and
 * whether to notify the forwarder.
 */
const ConfirmSaveModal = ({
  state, setState, onSubmit, card, draft, serviceFeePercent, providerName,
}) => {
  const { changes, password, reason, notify, saving } = state;
  const v2 = isPricingV2(card);

  // Sample impact on a mid-size order, so the diff is grounded in a number that
  // means something commercially rather than a list of field edits.
  const sampleQty = 5;
  const sampleParish = JAMAICA_PARISHES[0];
  const totalFor = (source) => {
    const barrel = v2
      ? calculateBarrelPricingV2({ quantity: sampleQty, barrelPrices: source })
      : calculateBarrelPricing({
          quantity: sampleQty,
          perBarrelPrice: source.basePrice,
          isVolumeDiscount: source.isVolumeDiscount,
          discountAfter: source.discountAfter,
          discountPercent: source.discountPercent,
        });
    const pickup =
      v2 && card.type !== "dropoff" ? v2PickupCharge(source, 0).total : 0;
    const parishFee = v2 ? v2ParishFee(source, sampleParish, sampleQty) : 0;
    const { serviceFeeAmount } = calculateBarrelBasedFees(barrel.barrelPrice, 0, serviceFeePercent);
    return barrel.barrelPrice + parishFee + pickup + serviceFeeAmount;
  };

  const before = totalFor(card);
  const after = totalFor(draftAsCard(card, draft));
  const delta = after - before;

  return (
    <div
      className="modal fade show"
      style={{ display: "block", background: "rgba(0,0,0,0.5)" }}
      tabIndex={-1}
    >
      <div className="modal-dialog modal-lg modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Confirm pricing change</h5>
            <button
              type="button"
              className="btn-close"
              onClick={() => setState(null)}
              disabled={saving}
            />
          </div>
          <div className="modal-body">
            <p className="font-13 text-muted">
              {providerName} · {card.type === "dropoff" ? "Barrel drop-off" : "Ship your own barrel"}{" "}
              · {card.originCountry} → {card.destinationCountry}
            </p>

            <table className="table table-sm mb-3">
              <thead className="table-light">
                <tr>
                  <th>Field</th>
                  <th>Was</th>
                  <th>Now</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(changes).map(([field, v]) => (
                  <tr key={field}>
                    <td className="font-13">{field}</td>
                    <td className="font-13 text-muted">
                      <s>{String(v.from ?? "—")}</s>
                    </td>
                    <td className="font-13 fw-semibold">{String(v.to ?? "—")}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="alert alert-info font-13">
              A {sampleQty}-barrel order to {sampleParish} goes{" "}
              <strong>{money(before)} → {money(after)}</strong>{" "}
              <span className={delta > 0 ? "text-danger" : delta < 0 ? "text-success" : ""}>
                ({delta >= 0 ? "+" : "−"}
                {money(Math.abs(delta))})
              </span>
              . New quotes only — orders already placed keep their booked price.
            </div>

            <div className="mb-3">
              <label className="form-label font-13">Reason for this change (recorded)</label>
              <input
                type="text"
                className="form-control"
                value={reason}
                onChange={(e) => setState((s) => ({ ...s, reason: e.target.value }))}
                placeholder="e.g. Correcting rate to match signed agreement"
              />
            </div>

            <div className="mb-3">
              <label className="form-label font-13">Your admin password</label>
              <input
                type="password"
                className="form-control"
                value={password}
                onChange={(e) => setState((s) => ({ ...s, password: e.target.value }))}
                autoComplete="off"
              />
            </div>

            <div className="form-check">
              <input
                className="form-check-input"
                type="checkbox"
                id="notify-forwarder"
                checked={notify}
                onChange={(e) => setState((s) => ({ ...s, notify: e.target.checked }))}
              />
              <label className="form-check-label font-13" htmlFor="notify-forwarder">
                Email {providerName} about this change
              </label>
              {!notify && (
                <div className="form-text font-12 text-warning">
                  The forwarder will not be told their published pricing changed. The suppression is
                  recorded in the change log.
                </div>
              )}
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-light" onClick={() => setState(null)} disabled={saving}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={onSubmit}
              disabled={saving || !password || reason.trim().length < 3}
            >
              {saving ? "Saving…" : "Save pricing"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PricingEditor;
