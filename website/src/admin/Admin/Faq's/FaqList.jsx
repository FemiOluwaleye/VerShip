import React, { useEffect, useState } from "react";
import Swal from "sweetalert2";
import { Link } from "react-router-dom";
import "@fortawesome/fontawesome-free/css/all.min.css";
import Pagination from "@mui/material/Pagination";
import Stack from "@mui/material/Stack";
import { axiosInstance } from "../../Config";

const FaqList = () => {
  const [faqs, setFaqs] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [dateFilter, setDateFilter] = useState("all");
  const [selectedFaq, setSelectedFaq] = useState(null);
  const limit = 10;

  const dateFilters = [
    { value: "all", label: "All Data" },
    { value: "7", label: "Last 7 Days" },
    { value: "30", label: "This Month" },
    { value: "180", label: "Last 6 Months" },
    { value: "365", label: "Last Year" },
  ];

  useEffect(() => {
    fetchData(currentPage, searchTerm, dateFilter);
  }, [currentPage, searchTerm, dateFilter]);

  const fetchData = async (page, search = "", filter = "all") => {
    try {
      const response = await axiosInstance.get(
        `/faqlist?page=${page}&limit=${limit}&search=${encodeURIComponent(
          search
        )}&dateFilter=${filter}`
      );
      if (response.data.success) {
        setFaqs(response.data.body.data);
        setTotalPages(response.data.body.totalPages);
      } else {
        Swal.fire(
          "Error",
          response.data.message || "Failed to load FAQs",
          "error"
        );
      }
    } catch (error) {
      Swal.fire(
        "Error",
        "An error occurred while fetching the FAQ list",
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

  const deleteFaq = async (id) => {
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
        await axiosInstance.post(`/faqdelete/${id}`);

        const response = await axiosInstance.get(
          `/faqlist?page=${currentPage}&limit=${limit}&search=${encodeURIComponent(
            searchTerm
          )}&dateFilter=${dateFilter}`
        );

        if (response.data.success) {
          const newTotalPages = response.data.body.totalPages;
          const newData = response.data.body.data;
          if (newData.length === 0 && currentPage > 1) {
            setCurrentPage((prevPage) => prevPage - 1);
          } else {
            setFaqs(newData);
            setTotalPages(newTotalPages);
          }

          Swal.fire("Deleted!", "FAQ has been deleted.", "success");
        }
      } catch (error) {
        Swal.fire(
          "Error!",
          error.response?.data?.message || "Error deleting FAQ",
          "error"
        );
      }
    } else {
    }
  };

  const handleViewDetails = (faq) => {
    setSelectedFaq(faq);
  };

  const truncateText = (text, maxLength = 100) => {
    const words = text.trim().split(/\s+/);
    if (words.length > 15) {
      return words.slice(0, 15).join(" ") + "...";
    }
    return text.length > maxLength
      ? text.substring(0, maxLength) + "..."
      : text;
  };

  return (
    <>
      <div id="layout-wrapper">
        <div className="main-content">
          <div className="page-content">
            <div className="container-fluid">
              <div className="title-box mb-3 pb-1">
                <h4 className="mb-0 page-title">FAQ's List</h4>
                <nav aria-label="breadcrumb" className="mt-1">
                  <ol className="breadcrumb mb-0">
                    <li className="breadcrumb-item">
                      <Link to="/admin/dashboard" className="new">
                        <i className="ri-home-4-fill me-1" /> Home
                      </Link>
                    </li>
                    <li className="breadcrumb-item">
                      <Link to="/admin/" className="new">
                        <i className="ri-group-2-line me-1" /> FAQ's
                      </Link>
                    </li>
                    <li className="breadcrumb-item active" aria-current="page">
                      FAQ's Listings
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
                    <div className="d-flex justify-content-end ms-auto">
                      <Link
                        to="/admin/addfaq"
                        className="btn btn-soft-primary px-2 btn-sm me-1"
                      >
                        <i className="ri-add-fill font-size-16"></i>
                      </Link>
                    </div>
                  </div>
                  <div className="table-responsive table-card border-top">
                    <div data-simplebar="" className="cus-scroll scmob">
                      <table className="table table-centered cus-nowrap align-middle hltr mb-0">
                        <thead>
                          <tr>
                            <th>Sr no.</th>
                            <th>Question</th>
                            <th>Answer</th>
                            <th className="text-end">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {faqs.length > 0 ? (
                            faqs.map((faq, index) => (
                              <tr key={faq.id}>
                                <td>{(currentPage - 1) * limit + index + 1}</td>
                                <td
                                  style={{
                                    wordBreak: "break-word",
                                    maxWidth: "300px",
                                  }}
                                >
                                  {truncateText(faq.question)}
                                </td>
                                <td
                                  style={{
                                    wordBreak: "break-word",
                                    maxWidth: "300px",
                                  }}
                                >
                                  {truncateText(faq.answer)}
                                </td>
                                <td>
                                  <div className="d-flex justify-content-end">
                                    <button
                                      type="button"
                                      className="btn btn-soft-primary px-2 btn-sm me-1"
                                      data-bs-toggle="offcanvas"
                                      data-bs-target="#view-details"
                                      aria-controls="offcanvasRight"
                                      onClick={() => handleViewDetails(faq)}
                                    >
                                      <i className="ri-eye-fill font-size-16"></i>
                                    </button>
                                    <Link
                                      to={`/updatefaq/${faq.id}`}
                                      className="btn btn-soft-primary px-2 btn-sm me-1"
                                      title="View Details"
                                    >
                                      <i className="ri-edit-fill font-size-16"></i>{" "}
                                    </Link>
                                    <button
                                      onClick={() => deleteFaq(faq.id)}
                                      className="btn btn-soft-danger px-2 btn-sm"
                                      style={{
                                        backgroundColor: "#ea5455",
                                        borderColor: "#ea5455",
                                        color: "#fff",
                                      }}
                                      title="Delete FAQ"
                                    >
                                      <i className="ri-delete-bin-line font-size-16"></i>
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td
                                colSpan="4"
                                style={{ textAlign: "center", padding: "20px" }}
                              >
                                No FAQs found
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

      {/* FAQ Details Offcanvas */}
      <div
        className="offcanvas offcanvas-end rdetails"
        tabIndex="-1"
        id="view-details"
        aria-labelledby="offcanvasRightLabel"
      >
        <div className="offcanvas-header d-block">
          <div className="d-flex align-items-center">
            <h5
              className="offcanvas-title mb-0 me-3 fw-semibold"
              id="offcanvasRightLabel"
            >
              FAQ's Details
            </h5>
            <button
              type="button"
              className="btn-close"
              data-bs-dismiss="offcanvas"
              aria-label="Close"
            ></button>
          </div>
        </div>
        <div className="offcanvas-body">
          {selectedFaq ? (
            <>
              <div className="mt-3">
                <div className="font-size-16 fw-medium mb-2">Question:</div>
                <textarea
                  className="form-control bg-light"
                  style={{
                    minHeight: "150px",
                    border: "1px solid black",
                    resize: "none",
                  }}
                  value={selectedFaq.question || ""}
                  readOnly
                />
              </div>
              <div className="mt-3">
                <div className="font-size-16 fw-medium mb-2">Answer:</div>
                <textarea
                  className="form-control bg-light"
                  style={{
                    minHeight: "150px",
                    border: "1px solid black",
                    resize: "none",
                  }}
                  value={selectedFaq.answer || ""}
                  readOnly
                />
              </div>
            </>
          ) : (
            <div className="text-center py-5">
              <i className="ri-question-line font-size-48 text-muted"></i>
              <p className="mt-3 text-muted">No FAQ selected</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default FaqList;
