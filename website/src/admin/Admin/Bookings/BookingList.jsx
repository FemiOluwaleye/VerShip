import { ADMIN_BASE } from "../../adminBase";
import React, { useEffect, useState } from "react";
import Swal from "sweetalert2";
import { Link } from "react-router-dom";
import "@fortawesome/fontawesome-free/css/all.min.css";
import Pagination from "@mui/material/Pagination";
import Stack from "@mui/material/Stack";
import "@fancyapps/fancybox/dist/jquery.fancybox.css";
import "@fancyapps/fancybox";
import { axiosInstance, BASE_URL } from "../../Config";
import { resolveFileUrl } from "../../../utils/fileUrl";

const BookingList = () => {
  const tableStyle = {
    "--label-width": "180px",
  };

  const [matches, setMatches] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [dateFilter, setDateFilter] = useState("all");
  const [selectedMatch, setSelectedMatch] = useState(null);
  // const [providers, setProviders] = useState([]);
  // const [showAssignModal, setShowAssignModal] = useState(false);
  // const [selectedProvider, setSelectedProvider] = useState("");
  const limit = 10;

  const dateFilters = [
    { value: "all", label: "All Data" },
    { value: "7", label: "Last 7 Days" },
    { value: "30", label: "This Month" },
    { value: "180", label: "Last 6 Months" },
    { value: "365", label: "Last Year" },
  ];

  const getRideTypeLabel = (rideType) => {
    if (rideType === "0") return "Single Ride";
    if (rideType === "1") return "Pool Ride";
    return "Unknown";
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      0: { label: "Pending", className: "bg-warning text-dark" },
      1: { label: "Shipped", className: "bg-primary" },
      2: { label: "Delivered", className: "bg-success" },
      3: { label: "Dispatched", className: "bg-info" },
      4: { label: "Completed", className: "bg-secondary" },
    };

    return statusMap[status] || { label: "Unknown", className: "bg-light text-dark" };
  };

  useEffect(() => {
    fetchData(currentPage, searchTerm, dateFilter);
    // fetchProviders();
  }, [currentPage, searchTerm, dateFilter]);

  /* 
  const fetchProviders = async () => {
    try {
      const response = await axiosInstance.get("/providers?limit=100");
      if (response.data.success) {
        setProviders(response.data.body.data);
      }
    } catch (error) {
      console.error("Error fetching providers:", error);
    }
  };
  */

  const fetchData = async (page, search = "", filter = "all") => {
    try {
      const response = await axiosInstance.get(
        `/bookinglist?page=${page}&limit=${limit}&search=${encodeURIComponent(
          search
        )}&dateFilter=${filter}`
      );
      if (response.data.success) {
        setMatches(response.data.body.data);
        setTotalPages(response.data.body.totalPages);
      } else {
        Swal.fire(
          "Error",
          response.data.message || "Failed to load ride",
          "error"
        );
      }
    } catch (error) {
      Swal.fire(
        "Error",
        "An error occurred while fetching the booking list",
        "error"
      );
    }
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const handlePageChange = (event, value) => {
    setCurrentPage(value);
  };

  const handleDateFilter = (filterValue) => {
    setDateFilter(filterValue);
    setCurrentPage(1);
  };

  const getCurrentFilterLabel = () => {
    const filter = dateFilters.find((f) => f.value === dateFilter);
    return filter ? filter.label : "All Data";
  };

  const deleteMatch = async (id) => {
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
        await axiosInstance.post(`/bookingdelete/${id}`);

        const response = await axiosInstance.get(
          `/bookinglist?page=${currentPage}&limit=${limit}&search=${encodeURIComponent(
            searchTerm
          )}&dateFilter=${dateFilter}`
        );

        if (response.data.success) {
          const newTotalPages = response.data.body.totalPages;
          const newData = response.data.body.data;
          if (newData.length === 0 && currentPage > 1) {
            setCurrentPage((prevPage) => prevPage - 1);
          } else {
            setMatches(newData);
            setTotalPages(newTotalPages);
          }

          Swal.fire("Deleted!", "Ride has been deleted.", "success");
        }
      } catch (error) {
        Swal.fire(
          "Error!",
          error.response?.data?.message || "Error deleting Ride",
          "error"
        );
      }
    } else {
    }
  };

  const handleViewDetails = (match) => {
    setSelectedMatch(match);
  };

  /* 
  const handleAssignClick = (match) => {
    setSelectedMatch(match);
    setSelectedProvider(match.driverId || "");
    setShowAssignModal(true);
  };
  */

  /* 
  const handleAssign = async () => {
    if (!selectedProvider) {
      Swal.fire("Error", "Please select a provider", "error");
      return;
    }

    try {
      const response = await axiosInstance.post("/assignbooking", {
        bookingId: selectedMatch.id,
        driverId: selectedProvider,
      });

      if (response.data.success) {
        Swal.fire("Success", "Booking assigned successfully", "success");
        setShowAssignModal(false);
        fetchData(currentPage, searchTerm, dateFilter);
      } else {
        Swal.fire("Error", response.data.message || "Assignment failed", "error");
      }
    } catch (error) {
      Swal.fire("Error", "An error occurred during assignment", "error");
    }
  };
  */

  return (
    <>
      <div id="layout-wrapper">
        <div className="main-content">
          <div className="page-content">
            <div className="container-fluid">
              <div className="title-box mb-3 pb-1">
                <h4 className="mb-0 page-title">Bookings List</h4>
                <nav aria-label="breadcrumb" className="mt-1">
                  <ol className="breadcrumb mb-0">
                    <li className="breadcrumb-item">
                      <Link to={`${ADMIN_BASE}/dashboard`} className="new">
                        <i className="ri-home-4-fill me-1" /> Home
                      </Link>
                    </li>
                    {/* <li className="breadcrumb-item">
                      <Link to={`${ADMIN_BASE}/`} className="new">
                        <i className="ri-group-2-line me-1" /> Rides
                      </Link>
                    </li> */}
                    <li className="breadcrumb-item active" aria-current="page">
                      Bookings List
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
                            <th>First Name</th>
                            <th>Last Name</th>
                            <th>Provider Name</th>
                            <th>Shipping Type</th>
                            <th>Price($)</th>
                            <th>Status</th>
                            <th className="text-end">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {matches.length > 0 ? (
                            matches.map((match, index) => {
                              const { label, className } = getStatusBadge(
                                match.status
                              );

                              return (
                                <tr key={match.id}>
                                  <td>
                                    {(currentPage - 1) * limit + index + 1}
                                  </td>
                                  <td>{match.userbook?.firstName || match.primary_name?.split(' ')[0] || match.bookingRequest?.name?.split(' ')[0] || "N/A"}</td>
                                  <td>{match.userbook?.lastName || match.primary_name?.split(' ').slice(1).join(' ') || match.bookingRequest?.name?.split(' ').slice(1).join(' ') || ""}</td>
                                  <td>{match.driverbook ? `${match.driverbook.firstName} ${match.driverbook.lastName || ""}` : "Not Assigned"}</td>

                                  <td>{match.bookingRequest?.items?.[0]?.item_type || match.bookingRequest?.item_type || "Parcel"}</td>
                                  <td>${match.total_amount || "0"}</td>
                                  <td>
                                    <span className={`badge ${className}`}>
                                      {label}
                                    </span>
                                  </td>
                                  <td>
                                    <div className="d-flex justify-content-end">
                                      <button
                                        type="button"
                                        className="btn btn-soft-primary px-2 btn-sm me-1"
                                        data-bs-toggle="offcanvas"
                                        data-bs-target="#view-details"
                                        aria-controls="offcanvasRight"
                                        onClick={() => handleViewDetails(match)}
                                      >
                                        <i className="ri-eye-fill font-size-16"></i>
                                      </button>
                                      {/* 
                                      <button
                                        type="button"
                                        className="btn btn-soft-success px-2 btn-sm me-1"
                                        onClick={() => handleAssignClick(match)}
                                        title="Assign Provider"
                                      >
                                        <i className="ri-user-add-fill font-size-16"></i>
                                      </button> */}

                                      {/* <button
                                        onClick={() => deleteMatch(match.id)}
                                        className="btn btn-soft-danger px-2 btn-sm"
                                        style={{
                                          backgroundColor: "#ea5455",
                                          borderColor: "#ea5455",
                                          color: "#fff",
                                        }}
                                        title="Delete ride"
                                      >
                                        <i className="ri-delete-bin-line font-size-16"></i>
                                      </button> */}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td
                                colSpan="8"
                                style={{ textAlign: "center", padding: "20px" }}
                              >
                                No results found
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

      {/* Match Details Offcanvas */}
      <div
        className="offcanvas offcanvas-end rdetails"
        tabIndex="-1"
        id="view-details"
        aria-labelledby="offcanvasRightLabel"
      >
        <div className="offcanvas-header d-block">
          <div className="d-flex align-items-center">
            <div className="d-flex align-items-center">
              <h5
                className="offcanvas-title mb-0 me-3 fw-semibold"
                id="offcanvasRightLabel"
              >
                Booking Details
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
          {selectedMatch ? (
            <>
              <style>
                {`
                  .details-table td:first-child {
                    width: 180px;
                    white-space: nowrap;
                  }
                `}
              </style>
              <table
                className="table table-borderless details-table"
                style={{ marginLeft: "-8px" }}
              >

                <tbody>
                  <tr>
                    <td>Booking ID :</td>
                    <td className="text-end text-black fw-medium">
                      {selectedMatch.orderId || selectedMatch.id}
                    </td>
                  </tr>
                  <tr>
                    <td>First Name :</td>
                    <td className="text-end text-black fw-medium">
                      {selectedMatch.userbook?.firstName || selectedMatch.primary_name?.split(' ')[0] || selectedMatch.bookingRequest?.name?.split(' ')[0] || "N/A"}
                    </td>
                  </tr>
                  <tr>
                    <td>Last Name :</td>
                    <td className="text-end text-black fw-medium">
                      {selectedMatch.userbook?.lastName || selectedMatch.primary_name?.split(' ').slice(1).join(' ') || selectedMatch.bookingRequest?.name?.split(' ').slice(1).join(' ') || ""}
                    </td>
                  </tr>
                  <tr>
                    <td>Provider Name :</td>
                    <td className="text-end text-black fw-medium">
                      {`${selectedMatch.driverbook?.firstName || ""} ${selectedMatch.driverbook?.lastName || ""}`.trim() || "Not Assigned"}
                    </td>
                  </tr>
                  <tr>
                    <td>Origin :</td>
                    <td className="text-end text-black fw-medium">
                      {selectedMatch.bookingRequest?.origin || "N/A"}
                    </td>
                  </tr>
                  <tr>
                    <td>Destination :</td>
                    <td className="text-end text-black fw-medium">
                      {selectedMatch.bookingRequest?.destination || "N/A"}
                    </td>
                  </tr>
                  {selectedMatch.distance && (
                    <tr>
                      <td>Distance :</td>
                      <td className="text-end text-black fw-medium">
                        {selectedMatch.distance}
                      </td>
                    </tr>
                  )}
                  <tr>
                    <td>Item Type :</td>
                    <td className="text-end text-black fw-medium">
                      {selectedMatch.bookingRequest?.items?.[0]?.item_type || selectedMatch.bookingRequest?.item_type || "Parcel"}
                    </td>
                  </tr>
                  <tr>
                    <td>Service Type :</td>
                    <td className="text-end text-black fw-medium">
                      {selectedMatch?.sub_type || selectedMatch.bookingRequest?.items?.[0]?.sub_type || selectedMatch.bookingRequest?.sub_type || "N/A"}
                    </td>
                  </tr>

                  {/* Conditional Fields based on sub_type */}
                  {(selectedMatch?.sub_type === "Ship Your Own Barrel" || selectedMatch.bookingRequest?.sub_type === "Ship Your Own Barrel" || selectedMatch.bookingRequest?.items?.[0]?.sub_type === "Ship Your Own Barrel") ? (
                    <>
                      {/* Primary Contact */}
                      <tr className="table-light"><td colSpan="2" className="fw-bold">Primary Contact</td></tr>
                      <tr>
                        <td>Name :</td>
                        <td className="text-end text-black fw-medium">{selectedMatch?.primary_name || "N/A"}</td>
                      </tr>
                      <tr>
                        <td>Phone :</td>
                        <td className="text-end text-black fw-medium">{selectedMatch?.primary_phone_number || "N/A"}</td>
                      </tr>
                      <tr>
                        <td>Email :</td>
                        <td className="text-end text-black fw-medium">{selectedMatch?.primary_email || "N/A"}</td>
                      </tr>
                      <tr>
                        <td>Address :</td>
                        <td className="text-end text-black fw-medium">{selectedMatch?.primary_address || "N/A"}</td>
                      </tr>

                      {/* Secondary Contact */}
                      {selectedMatch?.secondary_name && (
                        <>
                          <tr className="table-light"><td colSpan="2" className="fw-bold">Secondary Contact</td></tr>
                          <tr>
                            <td>Name :</td>
                            <td className="text-end text-black fw-medium">{selectedMatch?.secondary_name || "N/A"}</td>
                          </tr>
                          <tr>
                            <td>Phone :</td>
                            <td className="text-end text-black fw-medium">{selectedMatch?.secondary_phone_number || "N/A"}</td>
                          </tr>
                        </>
                      )}

                      {/* Shipper Details */}
                      <tr className="table-light"><td colSpan="2" className="fw-bold">Shipper Details</td></tr>
                      <tr>
                        <td>Shipper Name :</td>
                        <td className="text-end text-black fw-medium">{selectedMatch?.shiper_name || "N/A"}</td>
                      </tr>
                      <tr>
                        <td>Shipper Email :</td>
                        <td className="text-end text-black fw-medium">{selectedMatch?.shiper_email || "N/A"}</td>
                      </tr>
                      <tr>
                        <td>Shipper Address :</td>
                        <td className="text-end text-black fw-medium">{selectedMatch?.shiper_address || "N/A"}</td>
                      </tr>

                      {/* Consignee Details */}
                      <tr className="table-light"><td colSpan="2" className="fw-bold">Delivery Details</td></tr>
                      <tr>
                        <td>Name :</td>
                        <td className="text-end text-black fw-medium">{selectedMatch?.consignee_name || "N/A"}</td>
                      </tr>
                      <tr>
                        <td>Email :</td>
                        <td className="text-end text-black fw-medium">{selectedMatch?.consignee_email || "N/A"}</td>
                      </tr>
                      <tr>
                        <td>Address :</td>
                        <td className="text-end text-black fw-medium">{selectedMatch?.consignee_address || "N/A"}</td>
                      </tr>

                      {/* Add-ons */}
                      {selectedMatch?.addOns && (
                        <tr>
                          <td>Add-ons :</td>
                          <td className="text-end text-black fw-medium">
                            {Array.isArray(selectedMatch.addOns)
                              ? selectedMatch.addOns.join(", ")
                              : typeof selectedMatch.addOns === 'string'
                                ? selectedMatch.addOns
                                : "N/A"}
                          </td>
                        </tr>
                      )}
                    </>
                  ) : (selectedMatch?.sub_type === "Request Barrel Drop-Off" || selectedMatch.bookingRequest?.sub_type === "Request Barrel Drop-Off" || selectedMatch.bookingRequest?.items?.[0]?.sub_type === "Request Barrel Drop-Off") && (
                    <>
                      <tr>
                        <td>Account Type :</td>
                        <td className="text-end text-black fw-medium">
                          {selectedMatch.bookingRequest?.account_type || "Personal"}
                        </td>
                      </tr>
                      <tr>
                        <td>Contact Name :</td>
                        <td className="text-end text-black fw-medium">
                          {selectedMatch.bookingRequest?.name || "N/A"}
                        </td>
                      </tr>
                      <tr>
                        <td>Email :</td>
                        <td className="text-end text-black fw-medium">
                          {selectedMatch.bookingRequest?.email || "N/A"}
                        </td>
                      </tr>
                      <tr>
                        <td>Phone :</td>
                        <td className="text-end text-black fw-medium">
                          {selectedMatch.bookingRequest?.phone || selectedMatch.bookingRequest?.items?.[0]?.phone || "N/A"}
                        </td>
                      </tr>
                      <tr>
                        <td>WhatsApp :</td>
                        <td className="text-end text-black fw-medium">
                          {selectedMatch.bookingRequest?.whatsapp || selectedMatch.bookingRequest?.items?.[0]?.whatsapp || "N/A"}
                        </td>
                      </tr>
                      <tr>
                        <td>Drop Off Address :</td>
                        <td className="text-end text-black fw-medium">
                          {selectedMatch.bookingRequest?.drop_off_address || "N/A"}
                        </td>
                      </tr>
                      {/* Add these rows after Drop Off Address in the Request Barrel Drop-Off section */}
                      <tr>
                        <td>Street Address :</td>
                        <td className="text-end text-black fw-medium">
                          {selectedMatch.bookingRequest?.streetAddress || "N/A"}
                        </td>
                      </tr>
                      <tr>
                        <td>City :</td>
                        <td className="text-end text-black fw-medium">
                          {selectedMatch.bookingRequest?.city || "N/A"}
                        </td>
                      </tr>
                      <tr>
                        <td>State :</td>
                        <td className="text-end text-black fw-medium">
                          {selectedMatch.bookingRequest?.state || "N/A"}
                        </td>
                      </tr>

                    </>
                  )}

                  <tr>
                    <td>Pickup Date :</td>
                    <td className="text-end text-black fw-medium">
                      {selectedMatch.bookingRequest?.pickup_date
                        ? new Date(selectedMatch.bookingRequest?.pickup_date).toLocaleDateString()
                        : "N/A"}
                    </td>
                  </tr>
                  <tr>
                    <td>Delivery Date :</td>
                    <td className="text-end text-black fw-medium">
                      {selectedMatch.bookingRequest?.delivery_date
                        ? new Date(selectedMatch.bookingRequest?.delivery_date).toLocaleDateString()
                        : "N/A"}
                    </td>
                  </tr>
                  <tr>
                    <td>Booking Price :</td>
                    <td className="text-end text-black fw-medium">
                      ${selectedMatch.total_amount || "0"}
                    </td>
                  </tr>

                  <tr>
                    <td>Pay Now :</td>
                    <td className="text-end text-black fw-medium">
                      ${selectedMatch.pay_now_price || "0"}
                    </td>
                  </tr>
                  {selectedMatch.is_pay_later == 1 && (
                    <tr>
                      <td>Pay Later :</td>
                      <td className="text-end text-black fw-medium">
                        ${selectedMatch.pay_later_price || "0"}
                      </td>
                    </tr>
                  )}

                  {/* Documents Section */}
                  <tr className="table-light">
                    <td colSpan="2" className="fw-bold">Documents</td>
                  </tr>
                  <tr>
                    <td colSpan="2">
                      <div className="d-flex gap-3 flex-wrap mt-2">
                        {selectedMatch.document ? (
                          <div className="document-preview-container">
                            <div
                              className="document-preview border rounded overflow-hidden bg-light d-flex align-items-center justify-content-center"
                              style={{ width: "80px", height: "80px", cursor: "pointer" }}
                              onClick={() => window.open(resolveFileUrl(selectedMatch.document, BASE_URL), '_blank')}
                            >
                              {selectedMatch.document.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                                <img
                                  src={resolveFileUrl(selectedMatch.document, BASE_URL)}
                                  alt="Document"
                                  className="w-100 h-100 object-fit-cover"
                                />
                              ) : selectedMatch.document.endsWith('.pdf') ? (
                                <div className="text-center">
                                  <i className="fas fa-file-pdf fa-2x text-danger"></i>
                                  <div className="xsmall mt-1 text-muted" style={{ fontSize: '10px' }}>PDF</div>
                                </div>
                              ) : (
                                <div className="text-center">
                                  <i className="fas fa-file fa-2x text-secondary"></i>
                                  <div className="xsmall mt-1 text-muted" style={{ fontSize: '10px' }}>File</div>
                                </div>
                              )}
                            </div>
                            <div className="mt-1 text-center">
                              <a
                                href={resolveFileUrl(selectedMatch.document, BASE_URL)}
                                target="_blank"
                                rel="noreferrer"
                                className="btn btn-sm btn-link p-0 text-primary"
                                style={{ fontSize: "12px" }}
                              >
                                View / Download
                              </a>
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted italic">No documents uploaded</span>
                        )}
                      </div>
                    </td>
                  </tr>

                  <tr>
                    <td>Status :</td>
                    <td className="text-end text-black fw-medium">
                      <span
                        className={`badge ${getStatusBadge(selectedMatch.status).className}`}
                      >
                        {getStatusBadge(selectedMatch.status).label}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </>
          ) : (
            <div className="text-center py-5">
              <i className="ri-file-list-line font-size-48 text-muted"></i>
              <p className="mt-3 text-muted">No booking selected</p>
            </div>
          )}
        </div >
      </div >

      {/* Assign Provider Modal */}
      {/* 
      {showAssignModal && (
        <div className="modal fade show" style={{ display: "block", backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Assign Provider</h5>
                <button type="button" className="btn-close" onClick={() => setShowAssignModal(false)}></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">Select Provider</label>
                  <select
                    className="form-select"
                    value={selectedProvider}
                    onChange={(e) => setSelectedProvider(e.target.value)}
                  >
                    <option value="">-- Choose Provider --</option>
                    {providers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.firstName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAssignModal(false)}>
                  Cancel
                </button>
                <button type="button" className="btn btn-primary" onClick={handleAssign}>
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      */}
    </>
  );
};

export default BookingList;
