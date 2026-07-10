import React, { useEffect, useState } from "react";
import Swal from "sweetalert2";
import { Link } from "react-router-dom";
import "@fortawesome/fontawesome-free/css/all.min.css";
import Pagination from "@mui/material/Pagination";
import Stack from "@mui/material/Stack";
import "@fancyapps/fancybox/dist/jquery.fancybox.css";
import "@fancyapps/fancybox";
import { axiosInstance } from "../../Config";

const ActiveBookingList = () => {
  const [matches, setMatches] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [dateFilter, setDateFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedMatch, setSelectedMatch] = useState(null);
  const limit = 10;

  const dateFilters = [
    { value: "all", label: "All Data" },
    { value: "7", label: "Last 7 Days" },
    { value: "30", label: "This Month" },
    { value: "180", label: "Last 6 Months" },
    { value: "365", label: "Last Year" },
  ];

  const statusFilters = [
    { value: "all", label: "All Active" },
    { value: "1", label: "Arrived" },
    { value: "2", label: "Ride Started" },
  ];

  const getRideTypeLabel = (rideType) => {
    if (rideType === "0") return "Single Ride";
    if (rideType === "1") return "Pool Ride";
    return "Unknown";
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      1: { label: "Arrived", className: "bg-primary" },
      2: { label: "Ride Started", className: "bg-warning" },
    };

    return statusMap[status] || { label: "Unknown", className: "bg-light" };
  };

  useEffect(() => {
    fetchData(currentPage, searchTerm, dateFilter, statusFilter);
  }, [currentPage, searchTerm, dateFilter, statusFilter]);

  const fetchData = async (
    page,
    search = "",
    dateFilter = "all",
    statusFilter = "all"
  ) => {
    try {
      const response = await axiosInstance.get(
        `/activebookinglist?page=${page}&limit=${limit}&search=${encodeURIComponent(
          search
        )}&dateFilter=${dateFilter}&statusFilter=${statusFilter}`
      );
      if (response.data.success) {
        setMatches(response.data.body.data);
        setTotalPages(response.data.body.totalPages);
      } else {
        Swal.fire(
          "Error",
          response.data.message || "Failed to load bookings",
          "error"
        );
      }
    } catch (error) {
      Swal.fire(
        "Error",
        "An error occurred while fetching the active bookings list",
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

  const handleStatusFilter = (filterValue) => {
    setStatusFilter(filterValue);
    setCurrentPage(1);
  };

  const getCurrentFilterLabel = () => {
    const filter = dateFilters.find((f) => f.value === dateFilter);
    return filter ? filter.label : "All Data";
  };

  const getCurrentStatusFilterLabel = () => {
    const filter = statusFilters.find((f) => f.value === statusFilter);
    return filter ? filter.label : "All Active";
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
          `/activebookinglist?page=${currentPage}&limit=${limit}&search=${encodeURIComponent(
            searchTerm
          )}&dateFilter=${dateFilter}&statusFilter=${statusFilter}`
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

  return (
    <>
      <div id="layout-wrapper">
        <div className="main-content">
          <div className="page-content">
            <div className="container-fluid">
              <div className="title-box mb-3 pb-1">
                <h4 className="mb-0 page-title">Active Ride List</h4>
                <nav aria-label="breadcrumb" className="mt-1">
                  <ol className="breadcrumb mb-0">
                    <li className="breadcrumb-item">
                      <Link to="/dashboard" className="new">
                        <i className="ri-home-4-fill me-1" /> Home
                      </Link>
                    </li>
                    <li className="breadcrumb-item">
                      <Link to="/" className="new">
                        <i className="ri-group-2-line me-1" /> Rides
                      </Link>
                    </li>
                    <li className="breadcrumb-item active" aria-current="page">
                      Active Ride Listings
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

                    {/* Date Filter Dropdown */}
                    <div className="dropdown tbl-drop mb-3 me-2">
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

                    {/* Status Filter Dropdown */}
                    <div className="dropdown tbl-drop mb-3">
                      <button
                        className="btn btn-light dropdown-toggle"
                        type="button"
                        data-bs-toggle="dropdown"
                        aria-expanded="false"
                      >
                        {getCurrentStatusFilterLabel()}
                      </button>
                      <ul className="dropdown-menu">
                        {statusFilters.map((filter) => (
                          <li key={filter.value}>
                            <button
                              className="dropdown-item"
                              type="button"
                              onClick={() => handleStatusFilter(filter.value)}
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
                            <th>User Name</th>
                            <th>Driver Name</th>
                            <th>Ride Type</th>
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
                                  <td>{`${match.userbook?.firstName || ""} ${
                                    match.userbook?.lastName || ""
                                  }`}</td>
                                  <td>{`${match.driverbook?.firstName || ""} ${
                                    match.driverbook?.lastName || ""
                                  }`}</td>

                                  <td>{getRideTypeLabel(match.rideType)}</td>
                                  <td>${match.bookingPrice || "0"}</td>
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

                                      <button
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
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td
                                colSpan="7"
                                style={{ textAlign: "center", padding: "20px" }}
                              >
                                No active rides found
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
                Ride Details
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
              <table
                className="table table-borderless"
                style={{ marginLeft: "-8px" }}
              >
                <tbody>
                  <tr>
                    <td>Ride ID :</td>
                    <td className="text-end text-black fw-medium">
                      {selectedMatch.id}
                    </td>
                  </tr>
                  <tr>
                    <td>User Name :</td>
                    <td className="text-end text-black fw-medium">
                      {`${selectedMatch.userbook?.firstName || ""} ${
                        selectedMatch.userbook?.lastName || ""
                      }`}
                    </td>
                  </tr>
                  <tr>
                    <td>Driver Name:</td>
                    <td className="text-end text-black fw-medium">
                      {`${selectedMatch.driverbook?.firstName || ""} ${
                        selectedMatch.driverbook?.lastName || ""
                      }`}
                    </td>
                  </tr>

                  <tr>
                    <td>Ride Type :</td>
                    <td className="text-end text-black fw-medium">
                      {getRideTypeLabel(selectedMatch.rideType)}
                    </td>
                  </tr>
                  <tr>
                    <td>Price:</td>
                    <td className="text-end text-black fw-medium">
                      ${selectedMatch.bookingPrice || "0"}
                    </td>
                  </tr>
                  <tr>
                    <td>Booking Date:</td>
                    <td className="text-end text-black fw-medium">
                      {selectedMatch.bookingDate
                        ? new Date(
                            selectedMatch.bookingDate
                          ).toLocaleDateString()
                        : ""}
                    </td>
                  </tr>

                  <tr>
                    <td>Pickup Location:</td>
                    <td className="text-end text-black fw-medium">
                      {selectedMatch.pickupLocation || ""}
                    </td>
                  </tr>
                  <tr>
                    <td>Drop Location:</td>
                    <td className="text-end text-black fw-medium">
                      {selectedMatch.dropLocation || ""}
                    </td>
                  </tr>
                  <tr>
                    <td>Number Of Passenger:</td>
                    <td className="text-end text-black fw-medium">
                      {selectedMatch.numberOfPassenger || ""}
                    </td>
                  </tr>
                  <tr>
                    <td>Payment Method:</td>
                    <td className="text-end text-black fw-medium">
                      {selectedMatch.paymentMethod === "0"
                        ? "Cash"
                        : selectedMatch.paymentMethod === "1"
                        ? "Online"
                        : ""}
                    </td>
                  </tr>
                  <tr>
                    <td>Status :</td>
                    <td className="text-end text-black fw-medium">
                      <span
                        className={`badge ${
                          getStatusBadge(selectedMatch.status).className
                        }`}
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
              <i className="ri-user-line font-size-48 text-muted"></i>
              <p className="mt-3 text-muted">No rides selected</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default ActiveBookingList;
