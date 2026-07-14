import React, { useEffect, useState } from "react";
import Swal from "sweetalert2";
import { useSelector, useDispatch } from "react-redux";
import {
  fetchUsers,
  deleteUser,
  toggleUserStatus,
  // toggleUserBlock,
  // toggleUserSuspend,
} from "../redux/UserSlice";
import { toast, ToastContainer } from "react-toastify";
import { Link } from "react-router-dom";
import "@fortawesome/fontawesome-free/css/all.min.css";
import Pagination from "@mui/material/Pagination";
import Stack from "@mui/material/Stack";
import { BASE_URL } from "../../Config";
import "@fancyapps/fancybox/dist/jquery.fancybox.css";
import "@fancyapps/fancybox";

const UserList = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState(null);
  const limit = 10;
  const [dateFilter, setDateFilter] = useState("all");

  const dateFilters = [
    { value: "all", label: "All Data" },
    { value: "7", label: "Last 7 Days" },
    { value: "30", label: "This Month" },
    { value: "180", label: "Last 6 Months" },
    { value: "365", label: "Last Year" },
  ];

  const dispatch = useDispatch();
  const { users = [], totalPages = 1 } = useSelector((state) => state.users);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 400);
    return () => clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    dispatch(
      fetchUsers({
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

  const handlePageChange = (event, value) => {
    setCurrentPage(value);
  };

  const handleDateFilter = (value) => {
    setDateFilter(value);
    setCurrentPage(1);
  };

  const deleteUserHandler = async (id) => {
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
        await dispatch(deleteUser(id)).unwrap();
        dispatch(
          fetchUsers({
            page: currentPage,
            limit,
            search: debouncedSearch,
            dateFilter,
          })
        );

        Swal.fire("Deleted!", "User has been deleted.", "success");
      } catch (error) {
        Swal.fire(
          "Error!",
          error.response?.data?.message || "Error deleting user",
          "error"
        );
      }
    } else {
    }
  };

  const toggleStatus = async (id, currentStatus) => {
    try {
      await dispatch(toggleUserStatus({ id, currentStatus })).unwrap();
      toast.success("Status updated successfully");
    } catch (error) {
      toast.error("Failed to update status");
    }
  };

  // const toggleBlock = async (id, currentStatus) => {
  //   try {
  //     await dispatch(toggleUserBlock({ id, currentStatus })).unwrap();
  //     toast.success("Block Status updated successfully");
  //   } catch (error) {
  //     toast.error("Failed to update block status");
  //   }
  // };

  // const toggleSuspend = async (id, currentStatus) => {
  //   try {
  //     await dispatch(toggleUserSuspend({ id, currentStatus })).unwrap();
  //     toast.success("Suspend Status updated successfully");
  //   } catch (error) {
  //     toast.error("Failed to update suspend status");
  //   }
  // };

  const handleViewDetails = (user) => {
    setSelectedUser(user);
  };

  const getCurrentFilterLabel = () => {
    const filter = dateFilters.find((f) => f.value === dateFilter);
    return filter ? filter.label : "All Data";
  };

  return (
    <>
      <ToastContainer />

      <div id="layout-wrapper">
        <div className="main-content">
          <div className="page-content">
            <div className="container-fluid">
              <div className="title-box mb-3 pb-1">
                <h4 className="mb-0 page-title">Users List</h4>
                <nav aria-label="breadcrumb" className="mt-1">
                  <ol className="breadcrumb mb-0">
                    <li className="breadcrumb-item">
                      <Link to="/admin/dashboard" className="new">
                        <i className="ri-home-4-fill me-1 new" /> Home
                      </Link>
                    </li>
                    {/* <li className="breadcrumb-item">
                      <Link to="/admin/" className="new">
                        <i className="ri-group-2-line me-1 new" /> Users
                      </Link>
                    </li> */}
                    <li className="breadcrumb-item active" aria-current="page">
                      User Listings
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
                            {/* <th>Image</th> */}
                            <th>First Name</th>
                            <th>Last Name</th>
                            <th>Email Address</th>
                            <th>Phone</th>
                            <th>Location</th>
                            {/* <th>Blocked</th>
                            <th>Suspended</th> */}
                            <th>Status</th>
                            <th className="text-end">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {users.length > 0 ? (
                            users.map((user, index) => (
                              <tr key={user.id}>
                                <td>{(currentPage - 1) * limit + index + 1}</td>
                                {/* <td>
                                  {user.image ? (
                                    <img
                                      src={`${BASE_URL}/${user.image}`}
                                      alt="User"
                                      style={{
                                        width: "50px",
                                        height: "50px",
                                        borderRadius: "50%",
                                      }}
                                    />
                                  ) : (
                                    "No Image"
                                  )}
                                </td> */}
                                <td>{user.firstName || ""}</td>
                                <td>{user.lastName || ""}</td>
                                <td>{user.email || ""}</td>
                                <td style={{ whiteSpace: "nowrap" }}>
                                  {user.phoneNumber
                                    ? `${user.countryCode ? `+${String(user.countryCode).replace(/^\+/, "")} ` : ""}${user.phoneNumber}`
                                    : "-"}
                                </td>
                                <td
                                  style={{
                                    whiteSpace: "normal",
                                    wordBreak: "break-word",
                                    maxWidth: "250px",
                                  }}
                                >
                                  {[
                                    user.streetAddress,
                                    user.city,
                                    user.state,
                                    user.country,
                                  ]
                                    .filter(Boolean)
                                    .join(", ") || user.location || "-"}
                                </td>

                                <td>
                                  <div className="form-check form-switch">
                                    <input
                                      className="form-check-input"
                                      type="checkbox"
                                      id={`toggleStatus${user.id}`}
                                      checked={user.status === "1"}
                                      onChange={() =>
                                        toggleStatus(user.id, user.status)
                                      }
                                      style={{
                                        backgroundColor:
                                          user.status === "1"
                                            ? "#1e3308"
                                            : "lightgray",
                                        borderColor:
                                          user.status === "1"
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
                                      data-bs-toggle="offcanvas"
                                      data-bs-target="#view-details"
                                      aria-controls="offcanvasRight"
                                      onClick={() => handleViewDetails(user)}
                                    >
                                      <i className="ri-eye-fill font-size-16"></i>
                                    </button>
                                    <button
                                      onClick={() => deleteUserHandler(user.id)}
                                      className="btn btn-soft-danger px-2 btn-sm"
                                      style={{
                                        backgroundColor: "#ea5455",
                                        borderColor: "#ea5455",
                                        color: "#fff",
                                      }}
                                      title="Delete User"
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
                                No users found
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

      {/* User Details Offcanvas */}
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
                User Details
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
          {selectedUser ? (
            <>
              <div>
                {/* <div className="d-flex align-items-center border-bottom pt-1 pb-3">
                  {selectedUser.image ? (
                    <img
                      src={`${BASE_URL}/${selectedUser.image}`}
                      className="rounded-circle me-3"
                      width="100"
                      height="100"
                      alt="User Avatar"
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
                      <span className="me-2">User</span>
                      <span className="line-circle"></span>
                      <span className="ms-2 font-size-15 fw-semibold">
                        {selectedUser.firstName || "No Name"}
                      </span>
                    </div>
                    <div className="d-flex align-items-center position-relative mb-1">
                      <span className="me-2">
                        Email: {selectedUser.email || "No Email"}
                      </span>
                    </div>
                  </div>
                </div> */}
              </div>
              <div className="font-size-16 fw-medium pt-3 mt-1 mb-2">
                User Information
              </div>
              <table
                className="table table-borderless"
                style={{ marginLeft: "-8px" }}
              >
                <tbody>
                  <tr>
                    <td>User ID :</td>
                    <td className="text-end text-black fw-medium">
                      {selectedUser.id}
                    </td>
                  </tr>
                  <tr>
                    <td>Name :</td>
                    <td className="text-end text-black fw-medium">
                      {`${selectedUser.firstName || ""} ${selectedUser.lastName || ""
                        }`.trim() || "N/A"}
                    </td>
                  </tr>
                  <tr>
                    <td>Email :</td>
                    <td className="text-end text-black fw-medium">
                      {selectedUser.email || ""}
                    </td>
                  </tr>
                  <tr>
                    <td>Phone :</td>
                    <td className="text-end text-black fw-medium">
                      {selectedUser.phoneNumber
                        ? `${selectedUser.countryCode?.startsWith("+")
                          ? selectedUser.countryCode
                          : "+" + selectedUser.countryCode
                        } ${selectedUser.phoneNumber}`
                        : "N/A"}
                    </td>
                  </tr>

                  <tr>
                    <td>Location:</td>
                    <td
                      className="text-end text-black fw-medium"
                      style={{ whiteSpace: "normal", wordBreak: "break-word" }}
                    >
                      {[selectedUser.streetAddress, selectedUser.city, selectedUser.state, selectedUser.country]
                        .filter(Boolean)
                        .join(", ") || selectedUser.location || "-"}
                    </td>
                  </tr>
                  {/* <tr>
                    <td>Blocked Status :</td>
                    <td className="text-end text-black fw-medium">
                      <span
                        className={`badge ${
                          selectedUser.block === "1"
                            ? "bg-danger"
                            : "bg-success"
                        }`}
                      >
                        {selectedUser.block === "1" ? "Blocked" : "Not Blocked"}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td>Suspended Status :</td>
                    <td className="text-end text-black fw-medium">
                      <span
                        className={`badge ${
                          selectedUser.suspend === "1"
                            ? "bg-danger"
                            : "bg-success"
                        }`}
                      >
                        {selectedUser.suspend === "1"
                          ? "Suspended"
                          : "Not Suspended"}
                      </span>
                    </td>
                  </tr> */}
                  <tr>
                    <td>Account Status :</td>
                    <td className="text-end text-black fw-medium">
                      <span
                        className={`badge ${selectedUser.status === "1"
                          ? "bg-success"
                          : "bg-danger"
                          }`}
                      >
                        {selectedUser.status === "1" ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
              {/* <div className="mt-3">
                <div className="font-size-16 fw-medium mb-2">Bio:</div>
                <div className="bg-light">
                  {selectedUser.bio ? (
                    <textarea
                      readOnly
                      className="form-control"
                      rows="4"
                      value={selectedUser.bio}
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
            </>
          ) : (
            <div className="text-center py-5">
              <i className="ri-user-line font-size-48 text-muted"></i>
              <p className="mt-3 text-muted">No user selected</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default UserList;
