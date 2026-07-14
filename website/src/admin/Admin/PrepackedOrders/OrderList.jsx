import React, { useEffect, useState } from "react";
import Swal from "sweetalert2";
import { Link } from "react-router-dom";
import "@fortawesome/fontawesome-free/css/all.min.css";
import Pagination from "@mui/material/Pagination";
import Stack from "@mui/material/Stack";
import { axiosInstance } from "../../Config";
import { CSVLink } from "react-csv";
import * as XLSX from "xlsx";

// '0' = placed, '1' = processing, '2' = shipped, '3' = delivered, '4' = cancelled
const STATUS_MAP = {
  0: { label: "Placed", cls: "badge-soft-secondary" },
  1: { label: "Processing", cls: "badge-soft-info" },
  2: { label: "Shipped", cls: "badge-soft-primary" },
  3: { label: "Delivered", cls: "badge-soft-success" },
  4: { label: "Cancelled", cls: "badge-soft-danger" },
};

const statusInfo = (status) => STATUS_MAP[Number(status)] || STATUS_MAP[0];

const OrderList = () => {
  const [orders, setOrders] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [editStatus, setEditStatus] = useState("0");
  const [editPayment, setEditPayment] = useState(0);
  const [saving, setSaving] = useState(false);
  const limit = 10;

  useEffect(() => {
    fetchData(currentPage, searchTerm);
  }, [currentPage, searchTerm]);

  const fetchData = async (page, search = "") => {
    try {
      const response = await axiosInstance.get(
        `/prepacked-orders/list?page=${page}&limit=${limit}&search=${encodeURIComponent(
          search
        )}`
      );
      if (response.data.success) {
        setOrders(response.data.body.data || []);
        setTotalPages(response.data.body.totalPages || 1);
      } else {
        Swal.fire(
          "Error",
          response.data.message || "Failed to load orders",
          "error"
        );
      }
    } catch (error) {
      Swal.fire(
        "Error",
        "An error occurred while fetching the pre-packed orders list",
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

  const handleViewDetails = (order) => {
    setSelectedOrder(order);
    setEditStatus(String(order.status ?? "0"));
    setEditPayment(Number(order.payment_status) === 1 ? 1 : 0);
  };

  const handleSaveStatus = async () => {
    if (!selectedOrder) return;
    setSaving(true);
    try {
      const response = await axiosInstance.post(
        `/prepacked-orders/update/${selectedOrder.id}`,
        { status: editStatus, payment_status: editPayment }
      );
      if (response.data.success) {
        // Reflect the change locally so the row and panel update without a full refetch.
        setOrders((prev) =>
          prev.map((o) =>
            o.id === selectedOrder.id
              ? { ...o, status: editStatus, payment_status: editPayment }
              : o
          )
        );
        setSelectedOrder((prev) =>
          prev ? { ...prev, status: editStatus, payment_status: editPayment } : prev
        );
        Swal.fire("Saved", "Order updated successfully", "success");
      } else {
        Swal.fire("Error", response.data.message || "Failed to update order", "error");
      }
    } catch (error) {
      Swal.fire("Error", "An error occurred while updating the order", "error");
    } finally {
      setSaving(false);
    }
  };

  const customerName = (order) => {
    const buyer = order.buyer;
    if (buyer && (buyer.firstName || buyer.lastName)) {
      return `${buyer.firstName || ""} ${buyer.lastName || ""}`.trim();
    }
    return order.recipient_name || "Guest";
  };

  const money = (order, field) =>
    `${order.currency || "USD"} ${order[field] || "0"}`;

  const prepareDataForExport = () => {
    return orders.map((order) => ({
      "Order ID": order.orderId || "",
      Customer: customerName(order),
      Barrel: order.barrel?.name || "",
      Quantity: order.quantity || 0,
      "Unit Price": money(order, "unit_price"),
      "Total Price": money(order, "total_price"),
      Status: statusInfo(order.status).label,
      Payment: Number(order.payment_status) === 1 ? "Paid" : "Unpaid",
      Recipient: order.recipient_name || "",
      "Recipient Phone": order.recipient_phone || "",
      "Recipient Email": order.recipient_email || "",
      Address: [
        order.delivery_street,
        order.delivery_town,
        order.delivery_parish,
        order.delivery_country,
      ]
        .filter(Boolean)
        .join(", "),
      Date: order.createdAt ? new Date(order.createdAt).toLocaleString() : "",
    }));
  };

  const handleExcelExport = () => {
    const worksheet = XLSX.utils.json_to_sheet(prepareDataForExport());
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "PrepackedOrders");
    XLSX.writeFile(workbook, "prepacked-orders.xlsx");
  };

  return (
    <>
      <div id="layout-wrapper">
        <div className="main-content">
          <div className="page-content">
            <div className="container-fluid">
              <div className="title-box mb-3 pb-1">
                <h4 className="mb-0 page-title">Pre-Packed Orders</h4>
                <nav aria-label="breadcrumb" className="mt-1">
                  <ol className="breadcrumb mb-0">
                    <li className="breadcrumb-item">
                      <Link to="/admin/dashboard" className="new">
                        <i className="ri-home-4-fill me-1" /> Home
                      </Link>
                    </li>
                    <li className="breadcrumb-item active" aria-current="page">
                      Pre-Packed Order Listings
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
                        placeholder="Search order ID, name or email..."
                        value={searchTerm}
                        onChange={handleSearchChange}
                      />
                      <i className="ri-search-line" />
                    </div>
                  </div>
                  <div className="d-flex justify-content-end mb-3">
                    <CSVLink
                      data={prepareDataForExport()}
                      filename={"prepacked-orders.csv"}
                      className="btn btn-success me-2"
                    >
                      Export to CSV
                    </CSVLink>
                    <button
                      className="btn btn-primary"
                      onClick={handleExcelExport}
                    >
                      Export to Excel
                    </button>
                  </div>
                  <div className="table-responsive table-card border-top">
                    <div data-simplebar="" className="cus-scroll scmob">
                      <table className="table table-centered cus-nowrap align-middle hltr mb-0">
                        <thead>
                          <tr>
                            <th>Sr no.</th>
                            <th>Order ID</th>
                            <th>Customer</th>
                            <th>Barrel</th>
                            <th>Qty</th>
                            <th>Total</th>
                            <th>Status</th>
                            <th>Payment</th>
                            <th>Date</th>
                            <th className="text-end">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {orders.length > 0 ? (
                            orders.map((order, index) => (
                              <tr key={order.id}>
                                <td>{(currentPage - 1) * limit + index + 1}</td>
                                <td>{order.orderId || ""}</td>
                                <td>{customerName(order)}</td>
                                <td>{order.barrel?.name || "-"}</td>
                                <td>{order.quantity || 0}</td>
                                <td style={{ whiteSpace: "nowrap" }}>
                                  {money(order, "total_price")}
                                </td>
                                <td>
                                  <span
                                    className={`badge ${statusInfo(order.status).cls}`}
                                  >
                                    {statusInfo(order.status).label}
                                  </span>
                                </td>
                                <td>
                                  {Number(order.payment_status) === 1 ? (
                                    <span className="badge badge-soft-success">
                                      Paid
                                    </span>
                                  ) : (
                                    <span className="badge badge-soft-warning">
                                      Unpaid
                                    </span>
                                  )}
                                </td>
                                <td style={{ whiteSpace: "nowrap" }}>
                                  {order.createdAt
                                    ? new Date(
                                        order.createdAt
                                      ).toLocaleDateString()
                                    : "-"}
                                </td>
                                <td>
                                  <div className="d-flex justify-content-end">
                                    <button
                                      type="button"
                                      className="btn btn-soft-primary px-2 btn-sm me-1"
                                      data-bs-toggle="offcanvas"
                                      data-bs-target="#order-details"
                                      aria-controls="offcanvasRight"
                                      onClick={() => handleViewDetails(order)}
                                    >
                                      <i className="ri-eye-fill font-size-16"></i>
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td
                                colSpan="10"
                                style={{ textAlign: "center", padding: "20px" }}
                              >
                                No pre-packed orders found
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

      {/* Order Details Offcanvas */}
      <div
        className="offcanvas offcanvas-end rdetails"
        tabIndex="-1"
        id="order-details"
        aria-labelledby="offcanvasRightLabel"
      >
        <div className="offcanvas-header d-block">
          <div className="d-flex align-items-center">
            <div className="d-flex align-items-center">
              <h5
                className="offcanvas-title mb-0 me-3 fw-semibold"
                id="offcanvasRightLabel"
              >
                Order Details
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
          {selectedOrder ? (
            <>
              <div className="font-size-16 fw-medium mb-2">Order</div>
              <table
                className="table table-borderless"
                style={{ marginLeft: "-8px" }}
              >
                <tbody>
                  <tr>
                    <td>Order ID :</td>
                    <td className="text-end text-black fw-medium">
                      {selectedOrder.orderId || ""}
                    </td>
                  </tr>
                  <tr>
                    <td>Barrel :</td>
                    <td className="text-end text-black fw-medium">
                      {selectedOrder.barrel?.name || "-"}
                    </td>
                  </tr>
                  <tr>
                    <td>Quantity :</td>
                    <td className="text-end text-black fw-medium">
                      {selectedOrder.quantity || 0}
                    </td>
                  </tr>
                  <tr>
                    <td>Unit Price :</td>
                    <td className="text-end text-black fw-medium">
                      {money(selectedOrder, "unit_price")}
                    </td>
                  </tr>
                  <tr>
                    <td>Total Price :</td>
                    <td className="text-end text-black fw-medium">
                      {money(selectedOrder, "total_price")}
                    </td>
                  </tr>
                  <tr>
                    <td>Placed On :</td>
                    <td className="text-end text-black fw-medium">
                      {selectedOrder.createdAt
                        ? new Date(selectedOrder.createdAt).toLocaleString()
                        : "-"}
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className="font-size-16 fw-medium mb-2 mt-2">
                Fulfilment
              </div>
              <div className="mb-3">
                <label className="form-label">Status</label>
                <select
                  className="form-select"
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                >
                  {Object.entries(STATUS_MAP).map(([value, { label }]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-3">
                <label className="form-label">Payment</label>
                <select
                  className="form-select"
                  value={editPayment}
                  onChange={(e) => setEditPayment(Number(e.target.value))}
                >
                  <option value={0}>Unpaid</option>
                  <option value={1}>Paid</option>
                </select>
              </div>
              <button
                type="button"
                className="btn btn-primary w-100 mb-3"
                onClick={handleSaveStatus}
                disabled={saving}
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>

              <div className="font-size-16 fw-medium mb-2 mt-2">
                Customer / Recipient
              </div>
              <table
                className="table table-borderless"
                style={{ marginLeft: "-8px" }}
              >
                <tbody>
                  <tr>
                    <td>Account :</td>
                    <td className="text-end text-black fw-medium">
                      {selectedOrder.buyer
                        ? `${selectedOrder.buyer.firstName || ""} ${
                            selectedOrder.buyer.lastName || ""
                          }`.trim() || "-"
                        : "Guest"}
                    </td>
                  </tr>
                  {selectedOrder.buyer?.email && (
                    <tr>
                      <td>Account Email :</td>
                      <td className="text-end text-black fw-medium">
                        {selectedOrder.buyer.email}
                      </td>
                    </tr>
                  )}
                  <tr>
                    <td>Recipient Name :</td>
                    <td className="text-end text-black fw-medium">
                      {selectedOrder.recipient_name || "-"}
                    </td>
                  </tr>
                  <tr>
                    <td>Recipient Phone :</td>
                    <td className="text-end text-black fw-medium">
                      {selectedOrder.recipient_phone || "-"}
                    </td>
                  </tr>
                  <tr>
                    <td>Recipient Email :</td>
                    <td className="text-end text-black fw-medium">
                      {selectedOrder.recipient_email || "-"}
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className="font-size-16 fw-medium mb-2 mt-2">
                Delivery Address
              </div>
              <div className="bg-light p-2 mb-3">
                {[
                  selectedOrder.delivery_street,
                  selectedOrder.delivery_town,
                  selectedOrder.delivery_parish,
                  selectedOrder.delivery_country,
                ]
                  .filter(Boolean)
                  .join(", ") || "No address provided"}
              </div>

              {selectedOrder.notes ? (
                <>
                  <div className="font-size-16 fw-medium mb-2">Notes</div>
                  <div className="bg-light">
                    <textarea
                      readOnly
                      className="form-control"
                      rows="4"
                      value={selectedOrder.notes}
                      style={{
                        resize: "none",
                        backgroundColor: "#f8f9fa",
                        border: "1px solid black",
                      }}
                    />
                  </div>
                </>
              ) : null}
            </>
          ) : (
            <div className="text-center py-5">
              <i className="ri-shopping-bag-line font-size-48 text-muted"></i>
              <p className="mt-3 text-muted">No order selected</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default OrderList;
