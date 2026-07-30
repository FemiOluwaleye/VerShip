import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Swal from "sweetalert2";
import Pagination from "@mui/material/Pagination";
import Stack from "@mui/material/Stack";
import "@fortawesome/fontawesome-free/css/all.min.css";
import { ADMIN_BASE } from "../../adminBase";
import { axiosInstance } from "../../Config";

/*
 * Cross-provider pricing index — the "who is live, on what model, at what
 * price, and what is blocking the rest" screen.
 *
 * Read-only by design: it answers questions and routes to the per-provider
 * editor for changes. The four gate pills mirror getForwarders() on the server
 * (role '2' + status '1' + documentVerify 1 + at least one live rate card), so
 * "Not live" always names the field to go fix rather than leaving an admin to
 * guess which of the four is at fault.
 */

const FILTERS = [
  { value: "all", label: "All forwarders" },
  { value: "priced", label: "Has pricing" },
  { value: "live", label: "Live on site" },
  { value: "notlive", label: "Not live" },
  { value: "misconfigured", label: "Needs attention" },
  { value: "v2", label: "Simplified (v2)" },
  { value: "legacy", label: "Legacy pricing" },
];

const GATE_LABELS = {
  role: "not a forwarder account",
  status: "account inactive",
  documentVerify: "documents unverified",
  hasLiveCard: "no rate card",
};

const money = (v) =>
  v === null || v === undefined || v === "" ? "—" : `$${(parseFloat(v) || 0).toFixed(2)}`;

const PricingListing = () => {
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filter, setFilter] = useState("priced");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const limit = 20;

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 400);
    return () => clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, filter]);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, debouncedSearch, filter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get(
        `/pricing?page=${currentPage}&limit=${limit}&filter=${filter}&search=${encodeURIComponent(
          debouncedSearch
        )}`
      );
      if (res.data.success) {
        setRows(res.data.body.data || []);
        setTotalPages(res.data.body.totalPages || 1);
        setSummary(res.data.body.summary || null);
      } else {
        Swal.fire("Error", res.data.message || "Failed to load pricing", "error");
      }
    } catch (e) {
      Swal.fire("Error", "An error occurred while fetching forwarder pricing", "error");
    } finally {
      setLoading(false);
    }
  };

  // Flags worth an admin's attention, in severity order. Each is a real
  // inconsistency rather than a style preference.
  const warningsFor = (r) => {
    const out = [];
    if (r.routeCollisions > 0) {
      out.push({
        tone: "danger",
        text: `${r.routeCollisions} duplicate route${r.routeCollisions > 1 ? "s" : ""}`,
        title:
          "Two live rate cards share the same type and route. Quotes pick one arbitrarily — retire the stale card.",
      });
    }
    // There was a "listed price mismatch" flag here, for when the public
    // forwarder card advertised a different price than quotes charged. The
    // listing derives its price from the same card now, so the two cannot
    // disagree and there is nothing left to flag.
    if (r.modelVersion === "v2" && r.parishCoverage < r.parishTotal) {
      out.push({
        tone: "warning",
        text: `${r.parishTotal - r.parishCoverage} parish${
          r.parishTotal - r.parishCoverage > 1 ? "es" : ""
        } unpriced`,
        title:
          "Customers shipping to these parishes get no customs & delivery fee, so the quote understates the real cost.",
      });
    }
    if (r.staleCardCount > 3) {
      out.push({
        tone: "secondary",
        text: `${r.staleCardCount} retired cards`,
        title:
          "Historical rate cards from the forwarder's own edits. Harmless, but useful when reconstructing an old quote.",
      });
    }
    return out;
  };

  return (
    <div id="layout-wrapper">
      <div className="main-content">
        <div className="page-content">
      <div className="container-fluid">
        <div className="title-box mb-3 pb-1">
          <h4 className="mb-0 page-title">Forwarder pricing</h4>
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
              <li className="breadcrumb-item active" aria-current="page">
                Pricing
              </li>
            </ol>
          </nav>
        </div>

        {summary && (
          <div className="row">
            {[
              { label: "Live on site", value: summary.live, icon: "uil-check-circle" },
              { label: "Has pricing", value: summary.priced, icon: "uil-usd-circle" },
              { label: "Simplified (v2)", value: summary.v2, icon: "uil-layer-group" },
              { label: "Legacy pricing", value: summary.legacy, icon: "uil-history" },
              { label: "No pricing yet", value: summary.unpriced, icon: "uil-minus-circle" },
            ].map((c) => (
              <div className="col-md-6 col-xl" key={c.label}>
                <div className="card">
                  <div className="card-body py-3">
                    <div className="d-flex align-items-center">
                      <i className={`${c.icon} font-24 me-2 text-muted`} />
                      <div>
                        <h4 className="mb-0">{c.value}</h4>
                        <p className="text-muted mb-0 font-13">{c.label}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="row">
          <div className="col-12">
            <div className="card">
              <div className="card-body">
                <div className="row mb-3 align-items-center">
                  <div className="col-md-5">
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Search by business name or email…"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <div className="col-md-4">
                    <select
                      className="form-select"
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                    >
                      {FILTERS.map((f) => (
                        <option key={f.value} value={f.value}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-3 text-md-end mt-2 mt-md-0">
                    <span className="text-muted font-13">
                      Editing a rate card affects new quotes only
                    </span>
                  </div>
                </div>

                <div className="table-responsive">
                  <table className="table table-centered table-nowrap mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Forwarder</th>
                        <th>Route</th>
                        <th>Model</th>
                        <th>Per barrel</th>
                        <th>Parishes</th>
                        <th>Cards</th>
                        <th>On site</th>
                        <th className="text-end">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading && (
                        <tr>
                          <td colSpan={8} className="text-center text-muted py-4">
                            Loading…
                          </td>
                        </tr>
                      )}
                      {!loading && rows.length === 0 && (
                        <tr>
                          <td colSpan={8} className="text-center text-muted py-4">
                            No forwarders match this filter.
                          </td>
                        </tr>
                      )}
                      {!loading &&
                        rows.map((r) => {
                          const warnings = warningsFor(r);
                          return (
                            <tr key={r.id}>
                              <td>
                                <div className="fw-semibold">{r.businessName}</div>
                                <div className="text-muted font-12">{r.email}</div>
                                {warnings.length > 0 && (
                                  <div className="mt-1">
                                    {warnings.map((w) => (
                                      <span
                                        key={w.text}
                                        className={`badge bg-${w.tone}-subtle text-${w.tone} me-1`}
                                        title={w.title}
                                      >
                                        {w.text}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </td>
                              <td className="font-13">{r.route || "—"}</td>
                              <td>
                                <span
                                  className={`badge ${
                                    r.modelVersion === "v2"
                                      ? "bg-primary"
                                      : r.modelVersion === "legacy"
                                      ? "bg-secondary"
                                      : "bg-light text-muted"
                                  }`}
                                  title={
                                    r.modelVersion === "v2"
                                      ? "Simplified model: sea freight + tier discounts + per-parish customs & delivery"
                                      : r.modelVersion === "legacy"
                                      ? "Original model: base price + per-mile charges"
                                      : "No rate card yet"
                                  }
                                >
                                  {r.modelVersion === "none" ? "none" : r.modelVersion}
                                </span>
                              </td>
                              <td>{money(r.headlinePrice)}</td>
                              <td>
                                {r.modelVersion === "v2" ? (
                                  <span
                                    className={
                                      r.parishCoverage === r.parishTotal
                                        ? "text-success"
                                        : "text-warning"
                                    }
                                  >
                                    {r.parishCoverage}/{r.parishTotal}
                                  </span>
                                ) : (
                                  <span className="text-muted">n/a</span>
                                )}
                              </td>
                              <td>
                                {r.liveCardCount}
                                {r.staleCardCount > 0 && (
                                  <span className="text-muted font-12"> (+{r.staleCardCount})</span>
                                )}
                              </td>
                              <td>
                                {r.isLive ? (
                                  <span className="badge bg-success">Live</span>
                                ) : (
                                  <span
                                    className="badge bg-danger"
                                    title={r.failingGates
                                      .map((g) => GATE_LABELS[g] || g)
                                      .join(", ")}
                                  >
                                    {r.failingGates.map((g) => GATE_LABELS[g] || g).join(", ")}
                                  </span>
                                )}
                              </td>
                              <td className="text-end">
                                <Link
                                  to={`${ADMIN_BASE}/pricing/${r.id}`}
                                  className="btn btn-sm btn-primary"
                                >
                                  {r.liveCardCount > 0 ? "View / edit" : "View"}
                                </Link>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>

                {totalPages > 1 && (
                  <Stack spacing={2} className="mt-3 align-items-center">
                    <Pagination
                      count={totalPages}
                      page={currentPage}
                      onChange={(e, v) => setCurrentPage(v)}
                      color="primary"
                    />
                  </Stack>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
        </div>
      </div>
    </div>
  );
};

export default PricingListing;
