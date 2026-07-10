import React, { useEffect, useState } from "react";
import Swal from "sweetalert2";
import { useSelector, useDispatch } from "react-redux";
import {
  fetchProviders,
  deleteProvider,
  toggleProviderStatus,
  updateProviderDocumentVerify,
  updateRanking,
} from "../redux/ProviderSlice";
import { toast, ToastContainer } from "react-toastify";
import { Link } from "react-router-dom";
import "@fortawesome/fontawesome-free/css/all.min.css";
import Pagination from "@mui/material/Pagination";
import Stack from "@mui/material/Stack";
import { BASE_URL, API_URL, axiosInstance } from "../../Config";
import "@fancyapps/fancybox/dist/jquery.fancybox.css";
import "@fancyapps/fancybox";
const PLACEHOLDER = "/images/no-image.png";

const isPdfDocument = (filePath) =>
  Boolean(filePath && String(filePath).toLowerCase().endsWith(".pdf"));

const normalizeStoragePath = (filePath) => {
  if (!filePath) return "";
  let normalized = String(filePath).trim();

  if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
    try {
      normalized = new URL(normalized).pathname;
    } catch {
      return "";
    }
  }

  normalized = normalized.replace(/^\/+/, "");
  if (!normalized.startsWith("images/") && !normalized.includes("/")) {
    normalized = `images/${normalized}`;
  }
  return normalized;
};

const getDocumentUrl = (filePath) => {
  const storagePath = normalizeStoragePath(filePath);
  return storagePath ? `${BASE_URL}/${storagePath}` : null;
};

const saveBlobAsFile = (blob, fileName) => {
  const blobUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = fileName;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(blobUrl);
};

const DocumentCard = ({ filePath, label, fancyboxGroup = "docs" }) => {
  const [downloading, setDownloading] = useState(false);
  const fileUrl = getDocumentUrl(filePath);
  const isPdf = isPdfDocument(filePath);

  if (!fileUrl) {
    return (
      <div className="text-center" style={{ width: "32%" }}>
        <div
          className="d-flex align-items-center justify-content-center text-muted small"
          style={{
            width: "100%",
            height: "100px",
            background: "#f2f2f2",
            borderRadius: "6px",
            border: "1px dashed #ccc",
          }}
        >
          No document
        </div>
        <div className="mt-1 small fw-medium">{label}</div>
      </div>
    );
  }

  const storagePath = normalizeStoragePath(filePath);
  const fileName = storagePath.split("/").pop() || "document";

  const handleDownload = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (downloading || !storagePath) return;

    setDownloading(true);
    try {
      const response = await axiosInstance.get("/download-document", {
        params: { path: `/${storagePath}` },
        responseType: "blob",
      });

      const contentType = response.headers["content-type"] || "";
      if (contentType.includes("application/json")) {
        throw new Error("Invalid file response");
      }

      saveBlobAsFile(
        new Blob([response.data], {
          type: contentType || "application/octet-stream",
        }),
        fileName
      );
      toast.success("Document downloaded");
    } catch {
      try {
        let directFileUrl = fileUrl;
        try {
          directFileUrl = `${new URL(API_URL).origin}/${storagePath}`;
        } catch {
          // keep BASE_URL fallback
        }
        const fetchResponse = await fetch(directFileUrl, {
          method: "GET",
          mode: "cors",
        });
        if (!fetchResponse.ok) {
          throw new Error("Fetch failed");
        }
        const blob = await fetchResponse.blob();
        if (blob.type.includes("application/json")) {
          throw new Error("Invalid file response");
        }
        saveBlobAsFile(blob, fileName);
        toast.success("Document downloaded");
      } catch {
        toast.error("Unable to download document. Please try again.");
      }
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="text-center position-relative" style={{ width: "32%" }}>
      <div className="position-relative">
        {isPdf ? (
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="d-block text-decoration-none"
          >
            <div
              style={{
                width: "100%",
                height: "100px",
                background: "#fff5f5",
                borderRadius: "6px",
                border: "1px solid #f5c6cb",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <i
                className="fa fa-file-pdf"
                style={{ fontSize: "42px", color: "#d9534f" }}
                aria-hidden
              />
              <span className="small text-muted mt-1">PDF</span>
            </div>
          </a>
        ) : (
          <a href={fileUrl} data-fancybox={fancyboxGroup} className="d-block">
            <img
              src={fileUrl}
              alt={label}
              style={{
                width: "100%",
                height: "100px",
                objectFit: "cover",
                borderRadius: "6px",
                border: "1px solid #dee2e6",
              }}
            />
          </a>
        )}
        <button
          type="button"
          className="btn btn-sm btn-primary position-absolute top-0 end-0 d-flex align-items-center justify-content-center"
          style={{
            width: "28px",
            height: "28px",
            padding: 0,
            margin: "4px",
            borderRadius: "50%",
            zIndex: 2,
          }}
          title="Download document"
          disabled={downloading}
          onClick={handleDownload}
        >
          {downloading ? (
            <span
              className="spinner-border spinner-border-sm"
              role="status"
              aria-hidden="true"
            />
          ) : (
            <i className="ri-download-2-line font-size-14" />
          )}
        </button>
      </div>
      <div className="mt-1 small fw-medium">{label}</div>
    </div>
  );
};

const ProviderList = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const limit = 10;
  const [dateFilter, setDateFilter] = useState("all");

  // Password modal state
  const [pwdModal, setPwdModal] = useState(null); // { id, currentStatus }
  const [pwdInput, setPwdInput] = useState("");
  const [pwdError, setPwdError] = useState("");
  const [pwdLoading, setPwdLoading] = useState(false);

  const dateFilters = [
    { value: "all", label: "All Data" },
    { value: "7", label: "Last 7 Days" },
    { value: "30", label: "This Month" },
    { value: "180", label: "Last 6 Months" },
    { value: "365", label: "Last Year" },
  ];

  const dispatch = useDispatch();
  const { providers = [], totalPages = 1 } = useSelector(
    (state) => state.providers
  );

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 400);
    return () => clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    dispatch(
      fetchProviders({
        page: currentPage,
        limit,
        search: debouncedSearch,
        dateFilter,
      })
    );
  }, [dispatch, currentPage, debouncedSearch, dateFilter]);

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const freightLabel = {
    1: "Flight",
    2: "Ship",
    3: "Both",
  };

  const handleDocumentVerifyChange = async (providerId, newStatus) => {
    try {
      await dispatch(
        updateProviderDocumentVerify({
          id: providerId,
          documentVerify: newStatus,
        })
      ).unwrap();

      setSelectedProvider((prev) => ({
        ...prev,
        businessInfo: {
          ...prev.businessInfo,
          documentVerify: newStatus,
        },
      }));

      toast.success("Document verification updated");
    } catch (err) {
      toast.error("Failed to update");
    }
  };

  const handlePageChange = (event, value) => {
    setCurrentPage(value);
  };

  const handleDateFilter = (value) => {
    setDateFilter(value);
    setCurrentPage(1);
  };

  const deleteProviderHandler = async (id) => {
    const result = await Swal.fire({
      title: "Are you sure?",
      text: "You won't be able to revert this!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#1e3308",
      cancelButtonColor: "#d33",
      confirmButtonText: "Yes, delete it!",
    });

    if (result.isConfirmed) {
      try {
        await dispatch(deleteProvider(id)).unwrap();
        dispatch(
          fetchProviders({
            page: currentPage,
            limit,
            search: debouncedSearch,
            dateFilter,
          })
        );

        Swal.fire("Deleted!", "Provider has been deleted.", "success");
      } catch (error) {
        Swal.fire(
          "Error!",
          error.response?.data?.message || "Error deleting provider",
          "error"
        );
      }
    }
  };

  const toggleStatus = (id, currentStatus) => {
    // Instead of directly toggling, open password modal
    setPwdModal({ id, currentStatus });
    setPwdInput("");
    setPwdError("");
  };

  const handlePasswordVerifyAndToggle = async () => {
    if (!pwdInput) {
      setPwdError("Password is required.");
      return;
    }
    setPwdLoading(true);
    setPwdError("");
    try {
      const res = await axiosInstance.post("/verify-password", { password: pwdInput });
      if (res.data && res.data.success) {
        // Password correct – proceed with status toggle
        await dispatch(toggleProviderStatus({ id: pwdModal.id, currentStatus: pwdModal.currentStatus })).unwrap();
        toast.success("Status updated successfully");
        setPwdModal(null);
      } else {
        setPwdError("Incorrect password.");
      }
    } catch (err) {
      const msg = err?.response?.data?.message || "Incorrect password.";
      setPwdError(msg);
    } finally {
      setPwdLoading(false);
    }
  };

  //   const toggleBlock = async (id, currentStatus) => {
  //     try {
  //       await dispatch(toggleProviderBlock({ id, currentStatus })).unwrap();
  //       toast.success("Block Status updated successfully");
  //     } catch (error) {
  //       toast.error("Failed to update block status");
  //     }
  //   };

  //   const toggleSuspend = async (id, currentStatus) => {
  //     try {
  //       await dispatch(toggleProviderSuspend({ id, currentStatus })).unwrap();
  //     toast.success("Suspend Status updated successfully");
  //     } catch (error) {
  //       toast.error("Failed to update suspend status");
  //     }
  //   };

  const handleViewDetails = (provider) => {
    setSelectedProvider(provider);

    setTimeout(() => {
      const offcanvasEl = document.getElementById("view-details");
      const bsOffcanvas = new window.bootstrap.Offcanvas(offcanvasEl);
      bsOffcanvas.show();
    }, 0);
  };

  const getCurrentFilterLabel = () => {
    const filter = dateFilters.find((f) => f.value === dateFilter);
    return filter ? filter.label : "All Data";
  };

  const pricingFile = selectedProvider?.businessInfo?.pricingDocument
    ? `${BASE_URL}/${selectedProvider.businessInfo.pricingDocument}`
    : PLACEHOLDER;

  const isPricingPDF = pricingFile.toLowerCase().endsWith(".pdf");

  const handleRankChange = async (id, newRank) => {
    try {
      await dispatch(updateRanking({ id, ranking: newRank })).unwrap();
      toast.success("Ranking updated successfully");
    } catch (error) {
      toast.error("Failed to update ranking");
    }
  };

  return (
    <>
      <ToastContainer />

      <div id="layout-wrapper">
        <div className="main-content">
          <div className="page-content">
            <div className="container-fluid">
              <div className="title-box mb-3 pb-1">
                <h4 className="mb-0 page-title">Providers List</h4>
                <nav aria-label="breadcrumb" className="mt-1">
                  <ol className="breadcrumb mb-0">
                    <li className="breadcrumb-item">
                      <Link to="/admin/dashboard" className="new">
                        <i className="ri-home-4-fill me-1 new" /> Home
                      </Link>
                    </li>
                    <li className="breadcrumb-item">
                      <Link to="/admin/" className="new">
                        <i className="ri-group-2-line me-1 new" /> Providers
                      </Link>
                    </li>
                    <li className="breadcrumb-item active" aria-current="page">
                      Provider Listings
                    </li>
                  </ol>
                </nav>
              </div>

              <div className="card">
                <div className="card-body cusbar">
                  <div
                    className="card-head justify-content-start adjusttwo mb-3"
                    style={{ flexWrap: "nowrap" }}
                  >
                    <div className="tbl-search position-relative">
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Search..."
                        value={searchTerm}
                        onChange={handleSearchChange}
                      />
                      <i className="ri-search-line" />
                    </div>
                    <div className="dropdown tbl-drop mb-3">
                      <button
                        className="btn btn-light dropdown-toggle"
                        type="button"
                        data-bs-toggle="dropdown"
                        aria-expanded="false"
                      >
                        {getCurrentFilterLabel()}
                      </button>
                      <ul className="dropdown-menu">
                        {dateFilters.map((filter) => (
                          <li key={filter.value}>
                            <button
                              className="dropdown-item"
                              type="button"
                              onClick={() => handleDateFilter(filter.value)}
                            >
                              {filter.label}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="table-responsive table-card border-top">
                    <div data-simplebar="" className="cus-scroll scmob">
                      <table className="table table-centered cus-nowrap align-middle hltr mb-0">
                        <thead>
                          <tr>
                            <th>Sr no.</th>
                            <th>Image</th>
                            <th>Company Name</th>
                            <th>Doing Business as</th>
                            <th>Email Address</th>
                            <th>Location</th>
                            <th>Relibility Avg</th>
                            <th>Safety Avg</th>
                            <th>Rating Avg</th>
                            <th>Ranking</th>
                            {/* <th>Blocked</th> */}
                            {/* <th>Suspended</th> */}
                            <th>Status</th>
                            <th className="text-end">Action</th>
                          </tr>
                        </thead>

                        <tbody>
                          {providers.length > 0 ? (
                            providers.map((provider, index) => (
                              <tr key={provider.id}>
                                <td>{(currentPage - 1) * limit + index + 1}</td>
                                <td>
                                  {provider.image ? (
                                    <img
                                      src={`${BASE_URL}/${provider.image}`}
                                      alt="Provider"
                                      style={{
                                        width: "50px",
                                        height: "50px",
                                        borderRadius: "50%",
                                      }}
                                    />
                                  ) : (
                                    "No Image"
                                  )}
                                </td>
                                <td>{provider.firstName || ""}</td>
                                <td>{provider.working_as || ""}</td>
                                <td>{provider.email || ""}</td>
                                <td>
                                  {provider.location || ""}
                                </td>
                                <td>
                                  {provider.delivery_avg ? parseFloat(provider.delivery_avg).toFixed(2) : "0.00"}
                                </td>
                                <td>
                                  {provider.safety_avg || "0"}
                                </td>
                                <td>
                                  {provider.avg_rating || "0.00"}
                                </td>
                                <td>
                                  <select
                                    className="form-select form-select-sm"
                                    value={provider.ranking || ""}
                                    onChange={(e) => handleRankChange(provider.id, e.target.value)}
                                    style={{ width: "80px" }}
                                  >
                                    <option value="">Rank</option>
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                                      <option key={num} value={num}>
                                        {num}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                {/* <td>
                                  <div className="form-check form-switch">
                                    <input
                                      className="form-check-input"
                                      type="checkbox"
                                      id={`toggleBlock${provider.id}`}
                                      checked={provider.block === "1"}
                                      onChange={() =>
                                        toggleBlock(provider.id, provider.block)
                                      }
                                      style={{
                                        backgroundColor:
                                          provider.block === "1"
                                            ? "#1e3308"
                                            : "lightgray",
                                        borderColor:
                                          provider.block === "1"
                                            ? "#1e3308"
                                            : "lightgray",
                                      }}
                                    />
                                  </div>
                                </td> */}
                                {/* <td>
                                  <div className="form-check form-switch">
                                    <input
                                      className="form-check-input"
                                      type="checkbox"
                                      id={`toggleSuspend${provider.id}`}
                                      checked={provider.suspend === "1"}
                                      onChange={() =>
                                        toggleSuspend(
                                          provider.id,
                                          provider.suspend
                                        )
                                      }
                                      style={{
                                        backgroundColor:
                                          provider.suspend === "1"
                                            ? "#1e3308"
                                            : "lightgray",
                                        borderColor:
                                          provider.suspend === "1"
                                            ? "#1e3308"
                                            : "lightgray",
                                      }}
                                    />
                                  </div>
                                </td> */}
                                <td>
                                  <div className="form-check form-switch">
                                    <input
                                      className="form-check-input"
                                      type="checkbox"
                                      id={`toggleStatus${provider.id}`}
                                      checked={provider.status === "1"}
                                      onChange={() =>
                                        toggleStatus(
                                          provider.id,
                                          provider.status
                                        )
                                      }
                                      style={{
                                        backgroundColor:
                                          provider.status === "1"
                                            ? "#1e3308"
                                            : "lightgray",
                                        borderColor:
                                          provider.status === "1"
                                            ? "#1e3308"
                                            : "lightgray",
                                      }}
                                    />
                                  </div>
                                </td>
                                <td>
                                  <div className="d-flex justify-content-end">
                                    <button
                                      type="button"
                                      className="btn btn-soft-primary px-2 btn-sm me-1"
                                      aria-controls="offcanvasRight"
                                      onClick={() =>
                                        handleViewDetails(provider)
                                      }
                                    >
                                      <i className="ri-eye-fill font-size-16"></i>
                                    </button>
                                    <button
                                      onClick={() =>
                                        deleteProviderHandler(provider.id)
                                      }
                                      className="btn btn-soft-danger px-2 btn-sm"
                                      style={{
                                        backgroundColor: "#ea5455",
                                        borderColor: "#ea5455",
                                        color: "#fff",
                                      }}
                                      title="Delete Provider"
                                    >
                                      <i className="ri-delete-bin-line font-size-16"></i>{" "}
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td
                                colSpan="9"
                                style={{ textAlign: "center", padding: "20px" }}
                              >
                                No providers found
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>

                      <div className="d-flex justify-content-center align-items-center mt-3 ">
                        <Stack
                          spacing={2}
                          className="d-flex justify-content-center mt-3"
                        >
                          <Pagination
                            count={totalPages}
                            page={currentPage}
                            onChange={handlePageChange}
                            color="primary"
                          />
                        </Stack>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        className="offcanvas offcanvas-end rdetails"
        tabIndex="-1"
        id="view-details"
        aria-labelledby="offcanvasRightLabel"
      >
        <div className="offcanvas-header d-block">
          <div className="d-flex align-items-center">
            <div className="d-flex align-items-center">
              <h5 className="offcanvas-title mb-0 me-3 fw-semibold">
                Provider Details
              </h5>
            </div>
            <button
              type="button"
              className="btn-close"
              data-bs-dismiss="offcanvas"
              aria-label="Close"
            ></button>
          </div>
        </div>

        <div className="offcanvas-body">
          {selectedProvider ? (
            <>
              <div>
                <div className="d-flex align-items-center border-bottom pt-1 pb-3">

                  {selectedProvider.image ? (
                    <img
                      src={`${BASE_URL}/${selectedProvider.image}`}
                      className="rounded-circle me-3"
                      width="100"
                      height="100"
                      alt="Provider Avatar"
                    />
                  ) : (
                    <div
                      className="rounded-circle bg-light d-flex align-items-center justify-content-center me-3"
                      style={{ width: "100px", height: "100px" }}
                    >
                      <i className="ri-user-line font-size-20 text-muted"></i>
                    </div>
                  )}
                  <div>
                    <div className="d-flex align-items-center position-relative mb-1">
                      <span className="me-2">Company Name</span>
                      <span className="line-circle"></span>
                      <span className="ms-2 font-size-15 fw-semibold">
                        {selectedProvider.firstName || "No Name"}
                      </span>
                    </div>
                    <div className="d-flex align-items-center position-relative mb-1"></div>
                  </div>
                </div>
              </div>

              <div className="font-size-16 fw-medium pt-3 mt-1 mb-2">
                Provider Information
              </div>

              <table className="table table-borderless">
                <tbody>
                  <tr>
                    <td>Provider ID :</td>
                    <td className="text-end fw-medium">
                      {selectedProvider.id}
                    </td>
                  </tr>
                  <tr>
                    <td>Company Name :</td>
                    <td className="text-end fw-medium">
                      {selectedProvider.firstName || ""}
                    </td>
                  </tr>
                  <tr>
                    <td>Doing Business as :</td>
                    <td className="text-end fw-medium">
                      {selectedProvider.working_as || ""}
                    </td>
                  </tr>
                  <tr>
                    <td>Email :</td>
                    <td className="text-end fw-medium">
                      {selectedProvider.email || ""}
                    </td>
                  </tr>
                  <tr>
                    <td>Phone :</td>
                    <td className="text-end fw-medium">
                      {selectedProvider.phoneNumber
                        ? `${selectedProvider.countryCode?.startsWith("+")
                          ? selectedProvider.countryCode
                          : "+" + selectedProvider.countryCode
                        } ${selectedProvider.phoneNumber}`
                        : "N/A"}
                    </td>
                  </tr>
                  <tr>
                    <td>Location:</td>
                    <td className="text-end fw-medium">
                      {/* {`${selectedProvider.country || ""}${selectedProvider.country && selectedProvider.city
                        ? ", "
                        : ""
                        }${selectedProvider.city || ""}${(selectedProvider.city || selectedProvider.country) &&
                          selectedProvider.state
                          ? ", "
                          : ""
                        }${selectedProvider.state || ""}`} */}
                      {selectedProvider.location || ""}
                    </td>
                  </tr>
                  <tr>
                    {/* <td>Blocked Status :</td> */}
                    {/* <td className="text-end fw-medium">
                      <span
                        className={`badge ${
                          selectedProvider.block === "1"
                            ? "bg-danger"
                            : "bg-success"
                        }`}
                      >
                        {selectedProvider.block === "1"
                          ? "Blocked"
                          : "Not Blocked"}
                      </span>
                    </td> */}
                  </tr>
                  {/* Add these rows after Business Address */}
             

                  <tr>
                    <td>City :</td>
                    <td className="text-end fw-medium">
                      {selectedProvider?.businessInfo?.city || "N/A"}
                    </td>
                  </tr>

                  <tr>
                    <td>State :</td>
                    <td className="text-end fw-medium">
                      {selectedProvider?.businessInfo?.state || "N/A"}
                    </td>
                  </tr>
                  <tr>
                    <td>Delivery Timeline :</td>
                    <td className="text-end fw-medium">
                      {selectedProvider.businessInfo?.deliveryTimeline || ""}
                    </td>
                  </tr>

                  {/* <tr>
                    <td>Delivery Policy :</td>
                    <td className="text-end fw-medium">
                      {selectedProvider?.businessInfo?.deliveryPolicy || "N/A"}
                    </td>
                  </tr> */}
                  <tr>
                    <td>Supported Country :</td>
                    <td className="text-end fw-medium">
                      {selectedProvider?.businessInfo?.countryOfRegistration || "N/A"}
                    </td>
                  </tr>

                  <tr>
                    <td>Supported Freight Type :</td>
                    <td className="text-end fw-medium">
                      {"Sea"}
                    </td>
                  </tr>

                  <tr>
                    <td>Suspended Status :</td>
                    <td className="text-end fw-medium">
                      <span
                        className={`badge ${selectedProvider.suspend === "1"
                          ? "bg-danger"
                          : "bg-success"
                          }`}
                      >
                        {selectedProvider.suspend === "1"
                          ? "Suspended"
                          : "Not Suspended"}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td>Account Status :</td>
                    <td className="text-end fw-medium">
                      <span
                        className={`badge ${selectedProvider.status === "1"
                          ? "bg-success"
                          : "bg-danger"
                          }`}
                      >
                        {selectedProvider.status === "1"
                          ? "Active"
                          : "Inactive"}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* <div className="mt-3">
                <div className="font-size-16 fw-medium mb-2">Bio:</div>
                <div className="bg-light">
                  {selectedProvider.bio ? (
                    <textarea
                      readOnly
                      className="form-control"
                      rows="4"
                      value={selectedProvider.bio}
                      style={{
                        resize: "none",
                        backgroundColor: "#f8f9fa",
                        border: "1px solid black",
                      }}
                    />
                  ) : (
                    "No bio available"
                  )}
                </div>
              </div> */}

              <div className="font-size-16 fw-medium pt-3 mt-3 mb-2">
                Business Information
              </div>

              <table className="table table-borderless">
                <tbody>
                  <tr>
                    <td>Business Name:</td>
                    <td className="text-end fw-medium">
                      {selectedProvider?.businessInfo?.businessName || "N/A"}
                    </td>
                  </tr>

                  <tr>
                    <td>Registration Number:</td>
                    <td className="text-end fw-medium">
                      {selectedProvider?.businessInfo?.registerationNumber ||
                        "N/A"}
                    </td>
                  </tr>

                  <tr>
                    <td>Country of Registration:</td>
                    <td className="text-end fw-medium">
                      {selectedProvider?.businessInfo?.countryOfRegistration ||
                        "N/A"}
                    </td>
                  </tr>

                  <tr>
                    <td>Business Address:</td>
                    <td className="text-end fw-medium">
                      {selectedProvider?.businessInfo?.businessAddress || "N/A"}
                    </td>
                  </tr>
                  {/* Complete Address Block - Replace the existing Business Address row */}
                  <tr>
                    <td>Business Address :</td>
                    <td className="text-end fw-medium">
                      {selectedProvider?.businessInfo?.businessAddress || "N/A"}
                    </td>
                  </tr>

               

                  <tr>
                    <td>City :</td>
                    <td className="text-end fw-medium">
                      {selectedProvider?.businessInfo?.city || "N/A"}
                    </td>
                  </tr>

                  <tr>
                    <td>State :</td>
                    <td className="text-end fw-medium">
                      {selectedProvider?.businessInfo?.state || "N/A"}
                    </td>
                  </tr>

                  <tr>
                    <td>Shipment Type:</td>
                    <td className="text-end fw-medium">
                      {selectedProvider?.businessInfo?.shipmentType || "N/A"}
                    </td>
                  </tr>

                  <tr>
                    <td>Description:</td>
                    <td className="text-end fw-medium">
                      {selectedProvider?.businessInfo?.description || "N/A"}
                    </td>
                  </tr>

                  <tr>
                    <td>Business Email:</td>
                    <td className="text-end fw-medium">
                      {selectedProvider?.businessInfo?.email || "N/A"}
                    </td>
                  </tr>

                  <tr>
                    <td>Business Phone:</td>
                    <td className="text-end fw-medium">
                      {selectedProvider?.businessInfo?.phone || "N/A"}
                    </td>
                  </tr>

                  <tr>
                    <td>Primary Person First Name:</td>
                    <td className="text-end fw-medium">
                      {selectedProvider?.businessInfo?.primaryContactPersonLastName ||
                        "N/A"}
                    </td>
                  </tr>

                  <tr>
                    <td>Primary Person Last Name:</td>
                    <td className="text-end fw-medium">
                      {selectedProvider?.businessInfo?.primaryContactPersonFirstName ||
                        "N/A"}
                    </td>
                  </tr>

                  <tr>
                    <td colSpan="2">
                      <div className="font-size-16 fw-medium mb-2 mt-2">
                        Business Documents
                      </div>

                      <div className="d-flex justify-content-between gap-2">
                        <DocumentCard
                          filePath={
                            selectedProvider?.businessInfo?.certificateOfIncorporation
                          }
                          label="Certificate of Incorporation/Business Registration"
                        />
                        <DocumentCard
                          filePath={selectedProvider?.businessInfo?.ValidBusinessId}
                          label="Tax/EIN ID Document"
                        />
                        <DocumentCard
                          filePath={selectedProvider?.businessInfo?.AddressProof}
                          label="Government ID of Owner"
                        />
                      </div>
                    </td>
                  </tr>

                  <tr>
                    <td>Document Verification:</td>
                    <td className="text-end fw-medium">
                      <select
                        className="form-select"
                        value={
                          selectedProvider?.businessInfo?.documentVerify ?? 0
                        }
                        onChange={(e) =>
                          handleDocumentVerifyChange(
                            selectedProvider.id,
                            Number(e.target.value)
                          )
                        }
                      >
                        <option value={0}>Pending</option>
                        <option value={1}>Verified</option>
                        <option value={2}>Rejected</option>
                      </select>
                    </td>
                  </tr>

                  {/* <tr>
                    <td colSpan="2">
                      <div className="font-size-16 fw-medium mb-2 mt-3">
                        Pricing Document
                      </div>

                      <a
                        href={pricingFile}
                        className="text-center"
                        style={{ width: "100%", display: "block" }}
                        data-fancybox={isPricingPDF ? undefined : "pricing"}
                        target={isPricingPDF ? "_blank" : undefined}
                        rel="noopener noreferrer"
                      >
                        {isPricingPDF ? (
                          <div
                            style={{
                              width: "100%",
                              height: "120px",
                              background: "#f2f2f2",
                              borderRadius: "6px",
                              border: "1px solid #ccc",
                              display: "flex",
                              flexDirection: "column",
                              justifyContent: "center",
                              alignItems: "center",
                            }}
                          >
                            <i
                              className="fa fa-file-pdf"
                              style={{ fontSize: "40px", color: "#d9534f" }}
                            />
                            <div className="small mt-1">View PDF</div>
                          </div>
                        ) : (
                          <img
                            src={pricingFile}
                            alt="Pricing Document"
                            style={{
                              width: "100%",
                              height: "120px",
                              objectFit: "cover",
                              borderRadius: "6px",
                              border: "1px solid #ccc",
                            }}
                          />
                        )}
                      </a>
                    </td>
                  </tr> */}
                </tbody>
              </table>
            </>
          ) : (
            <div className="text-center py-5">
              <i className="ri-user-line font-size-48 text-muted"></i>
              <p className="mt-3 text-muted">No provider selected</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Admin Password Confirmation Modal ── */}
      {pwdModal && (
        <div
          className="modal show d-block"
          style={{ backgroundColor: "rgba(0,0,0,0.5)", zIndex: 9999 }}
          tabIndex="-1"
        >
          <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: "420px" }}>
            <div className="modal-content">
              <div className="modal-header border-bottom">
                <h5 className="modal-title fw-semibold">
                  <i className="ri-lock-password-line me-2 text-warning"></i>
                  Confirm Password
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setPwdModal(null)}
                  disabled={pwdLoading}
                />
              </div>
              <div className="modal-body">
                <p className="text-muted mb-3">
                  Please enter your admin password to change this provider's status.
                </p>
                <div className="mb-3">
                  <label className="form-label fw-medium">Password</label>
                  <input
                    type="password"
                    className={`form-control ${pwdError ? "is-invalid" : ""}`}
                    value={pwdInput}
                    onChange={(e) => { setPwdInput(e.target.value); setPwdError(""); }}
                    placeholder="Enter your password"
                    onKeyDown={(e) => { if (e.key === "Enter") handlePasswordVerifyAndToggle(); }}
                    autoFocus
                  />
                  {pwdError && (
                    <div className="invalid-feedback d-block">
                      <i className="ri-error-warning-line me-1"></i>{pwdError}
                    </div>
                  )}
                </div>
              </div>
              <div className="modal-footer border-top">
                <button
                  type="button"
                  className="btn btn-light"
                  onClick={() => setPwdModal(null)}
                  disabled={pwdLoading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn"
                  style={{ backgroundColor: "#1e3308", color: "#fff" }}
                  onClick={handlePasswordVerifyAndToggle}
                  disabled={pwdLoading}
                >
                  {pwdLoading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Verifying...
                    </>
                  ) : (
                    "Confirm & Change Status"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ProviderList;

