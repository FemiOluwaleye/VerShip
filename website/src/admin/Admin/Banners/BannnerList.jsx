import { ADMIN_BASE } from "../../adminBase";
import React, { useEffect, useState } from "react";
import Swal from "sweetalert2";
import { Link } from "react-router-dom";
import "@fortawesome/fontawesome-free/css/all.min.css";
import Pagination from "@mui/material/Pagination";
import Stack from "@mui/material/Stack";
import { axiosInstance, BASE_URL } from "../../Config";
import { resolveFileUrl } from "../../../utils/fileUrl";

const BannerList = () => {
  const [banners, setBanners] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [dateFilter, setDateFilter] = useState("all");
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
        `/bannerlist?page=${page}&limit=${limit}&search=${encodeURIComponent(
          search
        )}&dateFilter=${filter}`
      );
      console.log("Banner List Response:", response.data);

      if (response.data.success) {
        setBanners(response.data.body.data);
        setTotalPages(response.data.body.totalPages);
      } else {
        Swal.fire(
          "Error",
          response.data.message || "Failed to load banners",
          "error"
        );
      }
    } catch (error) {
      Swal.fire(
        "Error",
        "An error occurred while fetching the banner list",
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

  const deleteBanner = async (id) => {
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
        await axiosInstance.post(`/bannerdelete/${id}`);

        const response = await axiosInstance.get(
          `/bannerlist?page=${currentPage}&limit=${limit}&search=${encodeURIComponent(
            searchTerm
          )}&dateFilter=${dateFilter}`
        );

        if (response.data.success) {
          const newData = response.data.body.data || [];

          if (newData.length === 0 && currentPage > 1) {
            setCurrentPage(currentPage - 1);
          } else {
            fetchData(currentPage, searchTerm, dateFilter);
          }

          Swal.fire("Deleted!", "Banner has been deleted.", "success");
        }
      } catch (error) {
        Swal.fire(
          "Error!",
          error.response?.data?.message || "Error deleting banner",
          "error"
        );
      }
    }
  };

  const truncateText = (text, maxLength = 100) => {
    return text.length > maxLength
      ? text.substring(0, maxLength) + "..."
      : text;
  };

  return (
    <div id="layout-wrapper">
      <div className="main-content">
        <div className="page-content">
          <div className="container-fluid">
            <div className="title-box mb-3 pb-1">
              <h4 className="mb-0 page-title">Banners List</h4>
              <nav aria-label="breadcrumb" className="mt-1">
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={`${ADMIN_BASE}/dashboard`} className="new">
                      <i className="ri-home-4-fill me-1" /> Home
                    </Link>
                  </li>
                  <li className="breadcrumb-item">
                    <Link to={`${ADMIN_BASE}/`} className="new">
                      <i className="ri-image-2-line me-1" /> Banners
                    </Link>
                  </li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Banner Listings
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
                      to={`${ADMIN_BASE}/addbanner`}
                      className="btn btn-soft-primary px-2 btn-sm me-1"
                    >
                      <i className="ri-add-fill font-size-16"></i>
                    </Link>
                  </div>
                </div>

                <div className="table-responsive table-card border-top">
                  <table className="table table-centered cus-nowrap align-middle hltr mb-0">
                    <thead>
                      <tr>
                        <th>Sr no.</th>
                        <th>Title</th>
                        <th>Image</th>
                        <th className="text-end">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {banners.length > 0 ? (
                        banners.map((banner, index) => (
                          <tr key={banner.id}>
                            <td>{(currentPage - 1) * limit + index + 1}</td>
                            <td>{truncateText(banner.title)}</td>
                            <td>
                              {banner.image ? (
                                <img
                                  src={resolveFileUrl(banner.image, BASE_URL)}
                                  alt="Banner"
                                  style={{
                                    width: "50px",
                                    height: "50px",
                                    borderRadius: "5px",
                                  }}
                                />
                              ) : (
                                "No Image"
                              )}
                            </td>
                            <td>
                              <div className="d-flex justify-content-end">
                                <Link
                                  to={`/updatebanner/${banner.id}`}
                                  className="btn btn-soft-primary px-2 btn-sm me-1"
                                  title="Edit Banner"
                                >
                                  <i className="ri-edit-fill font-size-16"></i>
                                </Link>
                                <button
                                  onClick={() => deleteBanner(banner.id)}
                                  className="btn btn-soft-danger px-2 btn-sm"
                                  style={{
                                    backgroundColor: "#ea5455",
                                    borderColor: "#ea5455",
                                    color: "#fff",
                                  }}
                                  title="Delete Banner"
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
                            No banners found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                  <div className="d-flex justify-content-center align-items-center mt-3">
                    <Stack spacing={2}>
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
  );
};

export default BannerList;
