import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { axiosInstance } from "../Config";
import "react-toastify/dist/ReactToastify.css";
import ApexCharts from "./ApexChart";
import {
  Users,
  Star,
  Store,
  MessageSquare,
  HelpCircle,
  DollarSign,
  Clock,
  Package,
  BarChart2,
  Calendar
} from "lucide-react";

const Dashboard = () => {
  const [users, setUsers] = useState(0);
  const [providers, setProviders] = useState(0);
  const [rating, setRating] = useState(0);
  const [contact, setContact] = useState(0);
  const [faq, setFaq] = useState(0);

  // New Freight Forwarder Metrics
  const [period, setPeriod] = useState("lifetime");
  const [metrics, setMetrics] = useState({
    totalOrders: 0,
    totalBarrels: 0,
    avgPricePerBarrel: 0,
    avgDeliveryTime: 0,
    avgBarrelsPerOrder: 0,
    transactions: []
  });
  const [page, setPage] = useState(1);
  const [loadingMetrics, setLoadingMetrics] = useState(false);

  const handlePeriodChange = (newPeriod) => {
    console.log("newPeriod", newPeriod);
    setPeriod(newPeriod);
    setPage(1); // Reset to first page when filter changes
  };

  const navigate = useNavigate();
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const response = await axiosInstance.get(`/dashboard?period=${period}`, {});
        console.log("response.data", response.data.body);

        if (response.data.success) {
          const body = response.data.body;
          setUsers(body.player || 0);
          setProviders(body.coach || 0);

          setRating(body.paidBookings || 0);
          setContact(body.contact || 0);
          setFaq(body.faq || 0);
        } else {
        }
      } catch (error) {
        toast.error("An error occurred while fetching the dashboard data");
      }
    };

    fetchDashboardData();
  }, [navigate, period]);

  useEffect(() => {
    const fetchMetrics = async () => {
      setLoadingMetrics(true);
      try {
        const response = await axiosInstance.get(`/metrics?period=${period}&page=${page}`);
        if (response.data.success) {
          console.log("response.data.body", response.data.body);
          setMetrics(response.data.body);
        }
      } catch (error) {
        toast.error("Error fetching freight metrics");
      } finally {
        setLoadingMetrics(false);
      }
    };
    fetchMetrics();
  }, [period, page]);

  const PeriodBadge = ({ value, label }) => (
    <button
      onClick={() => handlePeriodChange(value)}
      className={`btn btn-sm me-2 rounded-pill px-3 ${period === value ? 'btn-primary' : 'btn-outline-primary'
        }`}
    >
      {label}
    </button>
  );

  return (
    <>
      <div className="main-content">
        <div className="page-content">
          <div className="container-fluid">
            <div className="title-box mb-3 pb-1">
              <h4 className="mb-0 page-title">Dashboard</h4>
              <nav aria-label="breadcrumb" className="mt-1">
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to="/admin/dashboard" className="new">
                      <i className="ri-home-4-fill me-1"></i> Home
                    </Link>
                  </li>
                  {/* <li className="breadcrumb-item active" aria-current="page">
                    <i className="ri-pie-chart-2-fill me-1"></i> Dashboard
                  </li> */}
                </ol>
              </nav>
            </div>
            <div className="row">
              <div className="col-lg-12">
                <div className="card key-matrix">
                  <div className="card-body pb-0">
                    <div className="card-head mb-3">
                      <div>
                        <div className="card-title mb-0">Growth Dashboard</div>
                        <p className="card-sub-title text-muted mb-0">
                          Track your platform’s growth in real-time and get
                          insights at a glance.
                        </p>
                      </div>
                    </div>
                    <div className="row gx-3">
                      <div className="col-xl col-lg-4 col-sm-6 mb-3">
                        <Link to="/admin/userlist">
                          <div className="card bg-soft-blue">
                            <div
                              className="card-body"
                              style={{ paddingBottom: "13px" }}
                            >
                              <div className="d-flex align-items-center">
                                <div className="flex-shrink-0">
                                  <Users className="text-primary" size={40} />
                                </div>
                                <div className="flex-grow-1 ms-3">
                                  <h5 className="mb-1 mt-2 fw-semibold">
                                    {users}
                                  </h5>
                                  <p className="text-muted mb-1 fw-medium font-size-15">
                                    Total Users
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </Link>
                      </div>


                      <div className="col-xl col-lg-4 col-sm-6 mb-3">
                        <Link to="/admin/providerlist">
                          <div className="card bg-soft-blue">
                            <div className="card-body" style={{ paddingBottom: "13px" }}>
                              <div className="d-flex align-items-center">
                                <div className="flex-shrink-0">
                                  <Store className="text-primary" size={40} />
                                </div>
                                <div className="flex-grow-1 ms-3">
                                  <h5 className="mb-1 mt-2 fw-semibold">{providers}</h5>
                                  <p className="text-muted mb-1 fw-medium font-size-15">
                                    Total Providers
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </Link>
                      </div>



                      <div className="col-xl col-lg-4 col-sm-6 mb-3">
                        <Link to="/admin/Bookinglist">
                          <div className="card bg-soft-blue">
                            <div
                              className="card-body"
                              style={{ paddingBottom: "13px" }}
                            >
                              <div className="d-flex align-items-center">
                                <div className="flex-shrink-0">
                                  <Star className="text-primary" size={40} />
                                </div>
                                <div className="flex-grow-1 ms-3">
                                  <h5 className="mb-1 mt-2 fw-semibold">
                                    {rating}
                                  </h5>
                                  <p className="text-muted mb-1 fw-medium font-size-15">
                                    Total Bookings
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </Link>
                      </div>

                      <div className="col-xl col-lg-4 col-sm-6 mb-3">
                        <Link to="/admin/contactlist">
                          <div className="card bg-soft-blue">
                            <div
                              className="card-body"
                              style={{ paddingBottom: "13px" }}
                            >
                              <div className="d-flex align-items-center">
                                <div className="flex-shrink-0">
                                  <MessageSquare
                                    className="text-primary"
                                    size={40}
                                  />
                                </div>
                                <div className="flex-grow-1 ms-3">
                                  <h5 className="mb-1 mt-2 fw-semibold">
                                    {contact}
                                  </h5>
                                  <p className="text-muted mb-1 fw-medium font-size-15">
                                    Total Contacts
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </Link>
                      </div>

                      <div className="col-xl col-lg-4 col-sm-6 mb-3">
                        <Link to="/admin/faqlist">
                          <div className="card bg-soft-blue">
                            <div
                              className="card-body"
                              style={{ paddingBottom: "13px" }}
                            >
                              <div className="d-flex align-items-center">
                                <div className="flex-shrink-0">
                                  <HelpCircle
                                    className="text-primary"
                                    size={40}
                                  />
                                </div>
                                <div className="flex-grow-1 ms-3">
                                  <h5 className="mb-1 mt-2 fw-semibold">
                                    {faq}
                                  </h5>
                                  <p className="text-muted mb-1 fw-medium font-size-15">
                                    Total FAQ'S
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="row">
              <div className="col-lg-12">
                <div className="card">
                  <div className="card-body">
                    <div className="d-flex align-items-center justify-content-between mb-4">
                      <h4 className="card-title mb-0">Freight Performance Metrics</h4>
                      <div className="d-flex">
                        <PeriodBadge value="week" label="Week" />
                        <PeriodBadge value="month" label="Month" />
                        <PeriodBadge value="year" label="Year" />
                        <PeriodBadge value="lifetime" label="Lifetime" />
                      </div>
                    </div>

                    <div className="row gx-3">
                      <div className="col-md-4 col-sm-6 mb-3">
                        <div className="card bg-light border-0">
                          <div className="card-body">
                            <div className="d-flex align-items-center">
                              <div className="avatar-sm bg-soft-primary rounded-circle p-2 me-3">
                                <DollarSign className="text-primary" size={24} />
                              </div>
                              <div>
                                <h5 className="mb-0 fw-bold">${metrics.avgPricePerBarrel}</h5>
                                <p className="text-muted mb-0 small uppercase">Avg Price / Barrel</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="col-md-4 col-sm-6 mb-3">
                        <div className="card bg-light border-0">
                          <div className="card-body">
                            <div className="d-flex align-items-center">
                              <div className="avatar-sm bg-soft-info rounded-circle p-2 me-3">
                                <Clock className="text-info" size={24} />
                              </div>
                              <div>
                                <h5 className="mb-0 fw-bold">{metrics.avgDeliveryTime} Days</h5>
                                <p className="text-muted mb-0 small uppercase">Avg Delivery Time</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="col-md-4 col-sm-6 mb-3">
                        <div className="card bg-light border-0">
                          <div className="card-body">
                            <div className="d-flex align-items-center">
                              <div className="avatar-sm bg-soft-warning rounded-circle p-2 me-3">
                                <Package className="text-warning" size={24} />
                              </div>
                              <div>
                                <h5 className="mb-0 fw-bold">{metrics.avgBarrelsPerOrder}</h5>
                                <p className="text-muted mb-0 small uppercase">Avg Barrels / Order</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="col-md-6 col-sm-6 mb-3">
                        <div className="card bg-light border-0">
                          <div className="card-body">
                            <div className="d-flex align-items-center">
                              <div className="avatar-sm bg-soft-success rounded-circle p-2 me-3">
                                <BarChart2 className="text-success" size={24} />
                              </div>
                              <div>
                                <h5 className="mb-0 fw-bold">{metrics.totalOrders}</h5>
                                <p className="text-muted mb-0 small uppercase">Total Orders ({period})</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="col-md-6 col-sm-6 mb-3">
                        <div className="card bg-light border-0">
                          <div className="card-body">
                            <div className="d-flex align-items-center">
                              <div className="avatar-sm bg-soft-danger rounded-circle p-2 me-3">
                                <Package className="text-danger" size={24} />
                              </div>
                              <div>
                                <h5 className="mb-0 fw-bold">{metrics.totalBarrels}</h5>
                                <p className="text-muted mb-0 small uppercase">Total Barrels ({period})</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="row">
              <div className="col-lg-12">
                <div className="card">
                  <div className="card-body">
                    <h4 className="card-title mb-4">Transaction Level Details</h4>
                    <div className="table-responsive">
                      <table className="table table-hover align-middle mb-0">
                        <thead className="table-light">
                          <tr>
                            <th>Order ID</th>
                            <th>Customer</th>
                            <th>Price</th>
                            <th>Pickup Date</th>
                            <th>Delivery Date</th>
                            <th>Actual Delivery</th>
                          </tr>
                        </thead>
                        <tbody>
                          {metrics.transactions && metrics.transactions.length > 0 ? (
                            metrics.transactions.map((tx, i) => (
                              <tr key={i}>
                                <td className="fw-medium text-primary">#{tx.orderId}</td>
                                <td>
                                  <div className="d-flex align-items-center">
                                    <div className="avatar-xs bg-light rounded-circle p-1 me-2 text-center" style={{ width: '24px', height: '24px', fontSize: '10px' }}>
                                      {tx.customer?.charAt(0)}
                                    </div>
                                    <div>
                                      <div className="fw-semibold">{tx.customer}</div>
                                      <div className="text-muted" style={{ fontSize: '11px' }}>{tx.customerEmail}</div>
                                    </div>
                                  </div>
                                </td>
                                <td className="fw-bold text-success">${tx.price}</td>
                                <td>
                                  <div className="small">
                                    <Calendar size={12} className="me-1" />
                                    {tx.pickupDate ? new Date(tx.pickupDate).toLocaleDateString() : 'N/A'}
                                  </div>
                                </td>
                                <td>
                                  <div className="small">
                                    <Calendar size={12} className="me-1" />
                                    {tx.deliveryDate ? new Date(tx.deliveryDate).toLocaleDateString() : 'N/A'}
                                  </div>
                                </td>
                                <td>
                                  {tx.avgTime !== null ? (
                                    <span className="badge bg-soft-success text-success px-2 py-1">
                                      {tx.avgTime} hrs
                                    </span>
                                  ) : (
                                    <span className="text-muted italic small">In Progress</span>
                                  )}
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan="6" className="text-center py-4 text-muted">No transactions found for this period.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="row">
              <div className="col-lg-12">
                <div className="card">
                  <div className="card-body">
                    <h4 className="card-title mb-4">Volume Analysis</h4>
                    <ApexCharts width="100%" height="400" />
                  </div>
                  {/* Pagination */}
                  {metrics.pagination && metrics.pagination.totalPages > 1 && (
                    <div className="card-footer bg-transparent border-top-0 pb-4 px-4">
                      <div className="d-flex justify-content-between align-items-center">
                        <div className="text-muted small">
                          Showing {((page - 1) * 10) + 1} to {Math.min(page * 10, metrics.pagination.totalTransactions)} of {metrics.pagination.totalTransactions} transactions
                        </div>
                        <nav aria-label="Page navigation">
                          <ul className="pagination pagination-rounded mb-0">
                            <li className={`page-item ${page === 1 ? 'disabled' : ''}`}>
                              <button className="page-link" onClick={() => setPage(page - 1)}>
                                <i className="ri-arrow-left-s-line"></i>
                              </button>
                            </li>
                            {[...Array(metrics.pagination.totalPages)].map((_, i) => (
                              <li key={i} className={`page-item ${page === i + 1 ? 'active' : ''}`}>
                                <button className="page-link" onClick={() => setPage(i + 1)}>{i + 1}</button>
                              </li>
                            ))}
                            <li className={`page-item ${page === metrics.pagination.totalPages ? 'disabled' : ''}`}>
                              <button className="page-link" onClick={() => setPage(page + 1)}>
                                <i className="ri-arrow-right-s-line"></i>
                              </button>
                            </li>
                          </ul>
                        </nav>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Dashboard;
