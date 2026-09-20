import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Swal from "sweetalert2";
import "@fortawesome/fontawesome-free/css/all.min.css";
import { ADMIN_BASE } from "../../adminBase";
import { axiosInstance } from "../../Config";

/*
 * Money VerShip holds for forwarders who were paid before finishing Stripe
 * onboarding (forwarder_payouts). The headline "keep at least $X in Stripe" is
 * the operational number this page exists for: with separate charges and
 * transfers the platform balance must still contain the money when the
 * transfer is finally made, and Stripe sweeps the balance to the bank unless a
 * minimum balance is set (Stripe → Settings → Payouts → Minimum balance).
 */

const STATUS = [
  { value: "", label: "All" },
  { value: "owed", label: "Held" },
  { value: "failed", label: "Failed" },
  { value: "transferred", label: "Transferred" },
  { value: "reversed", label: "Reversed" },
  { value: "written_off", label: "Written off" },
];

const badge = (status) => {
  const map = {
    owed: ["warning", "Held"],
    transferring: ["info", "Transferring"],
    transferred: ["success", "Transferred"],
    failed: ["danger", "Failed"],
    reversed: ["secondary", "Reversed"],
    written_off: ["dark", "Written off"],
  };
  const [tone, label] = map[status] || ["secondary", status];
  return <span className={`badge bg-${tone}`}>{label}</span>;
};

const PayoutsListing = () => {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("");
  const [providerId, setProviderId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get(`/payouts?status=${status}&providerId=${providerId}`);
      if (res.data.success) setData(res.data.body);
      else Swal.fire("Error", res.data.message || "Failed to load payouts", "error");
    } catch (e) {
      Swal.fire("Error", "An error occurred while fetching payouts", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, providerId]);

  const retry = async (row) => {
    setBusyId(row.id);
    try {
      const res = await axiosInstance.post(`/payouts/${row.id}/retry`);
      if (res.data.success) Swal.fire("Done", res.data.message, "success");
      else Swal.fire("Not transferred", res.data.message, "warning");
    } catch (e) {
      Swal.fire("Error", e.response?.data?.message || "Retry failed", "error");
    } finally {
      setBusyId(null);
      fetchData();
    }
  };

  const writeOff = async (row) => {
    const { value: reason } = await Swal.fire({
      title: `Write off $${row.amount}?`,
      text: "Use this only when the forwarder was paid another way or the customer was refunded outside Stripe. This does not move any money.",
      input: "text",
      inputPlaceholder: "Reason (required)",
      showCancelButton: true,
      confirmButtonText: "Write off",
      inputValidator: (v) => (!v || v.trim().length < 5 ? "Please give a reason (at least 5 characters)" : undefined),
    });
    if (!reason) return;
    setBusyId(row.id);
    try {
      const res = await axiosInstance.post(`/payouts/${row.id}/write-off`, { reason });
      if (res.data.success) Swal.fire("Written off", "", "success");
      else Swal.fire("Error", res.data.message, "error");
    } catch (e) {
      Swal.fire("Error", e.response?.data?.message || "Write-off failed", "error");
    } finally {
      setBusyId(null);
      fetchData();
    }
  };

  const t = data?.totals;

  return (
    <div id="layout-wrapper">
      <div className="main-content">
        <div className="page-content">
          <div className="container-fluid">
            <div className="title-box mb-3 pb-1">
              <h4 className="mb-0 page-title">Forwarder payouts</h4>
              <nav aria-label="breadcrumb" className="mt-1">
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={`${ADMIN_BASE}/dashboard`} className="new">
                      <i className="ri-home-4-fill me-1 new" /> Home
                    </Link>
                  </li>
                  <li className="breadcrumb-item">
                    <Link to={`${ADMIN_BASE}/providerlist`} className="new">
                      <i className="ri-group-2-line me-1 new" /> Providers
                    </Link>
                  </li>
                  <li className="breadcrumb-item active" aria-current="page">Payouts</li>
                </ol>
              </nav>
            </div>

            {t && (
              <>
                <div className="alert alert-warning d-flex align-items-start gap-2" role="alert" data-testid="min-balance-hint">
                  <i className="uil-exclamation-triangle font-20" />
                  <div>
                    <strong>Keep at least ${t.minimumBalanceHint} in the VerShip Stripe balance.</strong>{" "}
                    That is what is currently held for forwarders who have not set up payouts. Stripe pays your
                    balance out to the bank automatically, so set this as the <em>minimum balance</em> under
                    Stripe → Settings → Payouts, or transfers will fail when the forwarder finally connects.
                    {t.oldestHeldDays > 0 && <> Oldest held payment: <strong>{t.oldestHeldDays} day{t.oldestHeldDays === 1 ? "" : "s"}</strong>.</>}
                  </div>
                </div>
                <div className="row">
                  {[
                    { label: "Held for forwarders", value: `$${t.held}`, icon: "uil-wallet", id: "held" },
                    { label: "Failed transfers", value: `$${t.failed}`, icon: "uil-exclamation-octagon", id: "failed" },
                    { label: "Transferred", value: `$${t.transferred}`, icon: "uil-check-circle", id: "transferred" },
                    { label: "Reversed (refunds)", value: `$${t.reversed}`, icon: "uil-history", id: "reversed" },
                    { label: "Written off", value: `$${t.writtenOff}`, icon: "uil-minus-circle", id: "written" },
                  ].map((c) => (
                    <div className="col-md-6 col-xl" key={c.label}>
                      <div className="card">
                        <div className="card-body py-3">
                          <div className="d-flex align-items-center">
                            <i className={`${c.icon} font-24 me-2 text-muted`} />
                            <div>
                              <h4 className="mb-0" data-testid={`total-${c.id}`}>{c.value}</h4>
                              <p className="text-muted mb-0 font-13">{c.label}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {data?.forwarders?.length > 0 && (
              <div className="card">
                <div className="card-body">
                  <h5 className="card-title mb-3">By forwarder</h5>
                  <div className="table-responsive">
                    <table className="table table-sm align-middle mb-0">
                      <thead>
                        <tr>
                          <th>Forwarder</th>
                          <th>Stripe</th>
                          <th className="text-end">Held</th>
                          <th className="text-end">Failed</th>
                          <th className="text-end">Transferred</th>
                          <th className="text-end">Oldest held</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {data.forwarders.map((f) => (
                          <tr key={f.providerId}>
                            <td>
                              <div className="fw-semibold">{f.businessName}</div>
                              <div className="text-muted font-12">{f.email}</div>
                            </td>
                            <td>{f.stripeConnected ? <span className="badge bg-success">connected</span> : <span className="badge bg-warning text-dark">not set up</span>}</td>
                            <td className="text-end">${f.held}</td>
                            <td className="text-end">{parseFloat(f.failed) > 0 ? <span className="text-danger">${f.failed}</span> : "—"}</td>
                            <td className="text-end">${f.transferred}</td>
                            <td className="text-end">{f.heldCents > 0 ? `${f.oldestHeldDays}d` : "—"}</td>
                            <td className="text-end">
                              <button className="btn btn-sm btn-outline-secondary" onClick={() => setProviderId(String(f.providerId))}>
                                Show rows
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            <div className="card">
              <div className="card-body">
                <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
                  <div className="btn-group btn-group-sm" role="group">
                    {STATUS.map((s) => (
                      <button
                        key={s.value}
                        type="button"
                        className={`btn ${status === s.value ? "btn-primary" : "btn-outline-primary"}`}
                        onClick={() => setStatus(s.value)}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                  {providerId && (
                    <button className="btn btn-sm btn-link" onClick={() => setProviderId("")}>
                      Clear forwarder filter
                    </button>
                  )}
                </div>

                {loading ? (
                  <p className="text-muted mb-0">Loading…</p>
                ) : !data?.rows?.length ? (
                  <p className="text-muted mb-0">No payout rows{status ? ` with status "${status}"` : ""}.</p>
                ) : (
                  <div className="table-responsive">
                    <table className="table align-middle mb-0" data-testid="payout-rows">
                      <thead>
                        <tr>
                          <th>Order</th>
                          <th>Forwarder</th>
                          <th className="text-end">Gross</th>
                          <th className="text-end">VerShip fee</th>
                          <th className="text-end">Owed</th>
                          <th>Status</th>
                          <th>Age</th>
                          <th>Reminders</th>
                          <th>Detail</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {data.rows.map((r) => (
                          <tr key={r.id}>
                            <td className="font-monospace font-12">{r.orderId || `#${r.bookingId}`}</td>
                            <td>
                              <div>{r.businessName}</div>
                              <div className="text-muted font-12">{r.email}</div>
                            </td>
                            <td className="text-end">${r.gross}</td>
                            <td className="text-end">${r.platformFee}</td>
                            <td className="text-end fw-semibold">${r.amount}</td>
                            <td>{badge(r.status)}</td>
                            <td>{r.ageDays}d</td>
                            <td>{r.reminders || 0}</td>
                            <td className="font-12 text-muted" style={{ maxWidth: 260 }}>
                              {r.status === "transferred" && r.transferId && <span className="font-monospace">{r.transferId}</span>}
                              {r.status === "failed" && <span className="text-danger">{r.failureReason}</span>}
                              {r.status === "written_off" && r.writtenOffReason}
                            </td>
                            <td className="text-end text-nowrap">
                              {["owed", "failed"].includes(r.status) && (
                                <>
                                  <button
                                    className="btn btn-sm btn-primary me-1"
                                    disabled={busyId === r.id}
                                    onClick={() => retry(r)}
                                    title="Re-run the transfer (only works once the forwarder's Stripe account can receive transfers)"
                                  >
                                    {busyId === r.id ? "…" : "Retry"}
                                  </button>
                                  <button className="btn btn-sm btn-outline-dark" disabled={busyId === r.id} onClick={() => writeOff(r)}>
                                    Write off
                                  </button>
                                </>
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default PayoutsListing;
