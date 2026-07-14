import React, { useEffect, useState } from "react";
import Swal from "sweetalert2";
import { Link } from "react-router-dom";
import "@fortawesome/fontawesome-free/css/all.min.css";
import Pagination from "@mui/material/Pagination";
import Stack from "@mui/material/Stack";
import { axiosInstance, BASE_URL } from "../../Config";

// Admin catalog management for the pre-packed barrel products (name, price,
// image, contents). Mirrors the Banners list: search / paginate / add / edit /
// delete. Order fulfilment lives in the sibling OrderList.
const ProductList = () => {
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 10;

  useEffect(() => {
    fetchData(currentPage, searchTerm);
  }, [currentPage, searchTerm]);

  const fetchData = async (page, search = "") => {
    try {
      const response = await axiosInstance.get(
        `/prepacked/list?page=${page}&limit=${limit}&search=${encodeURIComponent(
          search
        )}`
      );
      if (response.data.success) {
        setProducts(response.data.body.data || []);
        setTotalPages(response.data.body.totalPages || 1);
      } else {
        Swal.fire(
          "Error",
          response.data.message || "Failed to load products",
          "error"
        );
      }
    } catch (error) {
      Swal.fire(
        "Error",
        "An error occurred while fetching the barrel list",
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

  const deleteProduct = async (id) => {
    const result = await Swal.fire({
      title: "Are you sure?",
      text: "This barrel and its contents will be deleted.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#1e3308",
      cancelButtonColor: "#d33",
      confirmButtonText: "Yes, delete it!",
    });

    if (result.isConfirmed) {
      try {
        await axiosInstance.post(`/prepacked/delete/${id}`);
        // Step back a page if we just removed the last row on this one.
        if (products.length === 1 && currentPage > 1) {
          setCurrentPage(currentPage - 1);
        } else {
          fetchData(currentPage, searchTerm);
        }
        Swal.fire("Deleted!", "Barrel has been deleted.", "success");
      } catch (error) {
        Swal.fire(
          "Error!",
          error.response?.data?.message || "Error deleting barrel",
          "error"
        );
      }
    }
  };

  const toggleFeatured = async (product) => {
    const next = !product.featured;
    // Optimistic flip; revert on failure.
    setProducts((prev) =>
      prev.map((p) => (p.id === product.id ? { ...p, featured: next } : p))
    );
    try {
      const response = await axiosInstance.post(`/prepacked/update/${product.id}`, {
        featured: next ? "1" : "0",
      });
      if (!response.data.success) throw new Error(response.data.message);
    } catch (error) {
      setProducts((prev) =>
        prev.map((p) =>
          p.id === product.id ? { ...p, featured: product.featured } : p
        )
      );
      Swal.fire(
        "Error",
        error?.response?.data?.message || "Failed to update featured status",
        "error"
      );
    }
  };

  const money = (product) => `${product.currency || "USD"} ${product.price || "0"}`;

  return (
    <div id="layout-wrapper">
      <div className="main-content">
        <div className="page-content">
          <div className="container-fluid">
            <div className="title-box mb-3 pb-1">
              <h4 className="mb-0 page-title">Pre-Packed Barrels</h4>
              <nav aria-label="breadcrumb" className="mt-1">
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to="/admin/dashboard" className="new">
                      <i className="ri-home-4-fill me-1" /> Home
                    </Link>
                  </li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Barrel Catalog
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
                      placeholder="Search barrel name..."
                      value={searchTerm}
                      onChange={handleSearchChange}
                    />
                    <i className="ri-search-line" />
                  </div>
                  <div className="d-flex justify-content-end ms-auto">
                    <Link
                      to="/admin/prepacked/add"
                      className="btn btn-soft-primary px-2 btn-sm me-1"
                      title="Add Barrel"
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
                        <th>Image</th>
                        <th>Name</th>
                        <th>Price</th>
                        <th>Items</th>
                        <th>Status</th>
                        <th>Featured</th>
                        <th className="text-end">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.length > 0 ? (
                        products.map((product, index) => (
                          <tr key={product.id}>
                            <td>{(currentPage - 1) * limit + index + 1}</td>
                            <td>
                              {product.image ? (
                                /\.(mp4|webm|ogg|mov)$/i.test(product.image) ? (
                                  <video
                                    src={`${BASE_URL}/${product.image.replace(/^\/+/, "")}`}
                                    muted
                                    loop
                                    autoPlay
                                    playsInline
                                    style={{
                                      width: "50px",
                                      height: "50px",
                                      borderRadius: "5px",
                                      objectFit: "cover",
                                    }}
                                  />
                                ) : (
                                  <img
                                    src={`${BASE_URL}/${product.image.replace(/^\/+/, "")}`}
                                    alt={product.name}
                                    style={{
                                      width: "50px",
                                      height: "50px",
                                      borderRadius: "5px",
                                      objectFit: "cover",
                                    }}
                                  />
                                )
                              ) : (
                                "No Image"
                              )}
                            </td>
                            <td>{product.name}</td>
                            <td style={{ whiteSpace: "nowrap" }}>
                              {money(product)}
                            </td>
                            <td>{product.contents?.length || 0}</td>
                            <td>
                              {String(product.status) === "1" ? (
                                <span className="badge badge-soft-success">
                                  Active
                                </span>
                              ) : (
                                <span className="badge badge-soft-secondary">
                                  Hidden
                                </span>
                              )}
                            </td>
                            <td>
                              <div className="form-check form-switch mb-0">
                                <input
                                  type="checkbox"
                                  className="form-check-input"
                                  role="switch"
                                  style={{ cursor: "pointer" }}
                                  checked={!!product.featured}
                                  onChange={() => toggleFeatured(product)}
                                  title={
                                    product.featured
                                      ? "Featured — click to unfeature"
                                      : "Not featured — click to feature"
                                  }
                                />
                              </div>
                            </td>
                            <td>
                              <div className="d-flex justify-content-end">
                                <Link
                                  to={`/admin/prepacked/edit/${product.id}`}
                                  className="btn btn-soft-primary px-2 btn-sm me-1"
                                  title="Edit Barrel"
                                >
                                  <i className="ri-edit-fill font-size-16"></i>
                                </Link>
                                <button
                                  onClick={() => deleteProduct(product.id)}
                                  className="btn btn-soft-danger px-2 btn-sm"
                                  style={{
                                    backgroundColor: "#ea5455",
                                    borderColor: "#ea5455",
                                    color: "#fff",
                                  }}
                                  title="Delete Barrel"
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
                            colSpan="8"
                            style={{ textAlign: "center", padding: "20px" }}
                          >
                            No barrels found
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

export default ProductList;
