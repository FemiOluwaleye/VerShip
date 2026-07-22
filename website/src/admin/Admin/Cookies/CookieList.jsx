import { ADMIN_BASE } from "../../adminBase";
import React, { useEffect, useState } from "react";
import Swal from "sweetalert2";
import { Link } from "react-router-dom";
import "@fortawesome/fontawesome-free/css/all.min.css";
import Pagination from "@mui/material/Pagination";
import Stack from "@mui/material/Stack";
import { axiosInstance } from "../../Config";

const CookieList = () => {
    const [cookies, setCookies] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [selectedCookie, setSelectedCookie] = useState(null);
    const limit = 10;

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const response = await axiosInstance.get('/cookielist');
            if (response.data.success) {
                setCookies(response.data.data);
                // Simple searching/pagination on frontend if backend doesn't support it yet
                // But let's assume backend might support it or we just show all for now
            }
        } catch (error) {
            console.error(error);
        }
    };

    const deleteCookie = async (id) => {
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
                const response = await axiosInstance.post(`/cookiedelete/${id}`);
                if (response.data.success) {
                    Swal.fire("Deleted!", "Cookie has been deleted.", "success");
                    fetchData();
                }
            } catch (error) {
                Swal.fire("Error!", "Error deleting cookie.", "error");
            }
        }
    };

    const handleViewDetails = (cookie) => {
        setSelectedCookie(cookie);
    };

    const filteredCookies = cookies.filter(cookie =>
        cookie.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cookie.type.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <>
            <div id="layout-wrapper">
                <div className="main-content">
                    <div className="page-content">
                        <div className="container-fluid">
                            <div className="title-box mb-3 pb-1">
                                <h4 className="mb-0 page-title">Cookies List</h4>
                                <nav aria-label="breadcrumb" className="mt-1">
                                    <ol className="breadcrumb mb-0">
                                        <li className="breadcrumb-item">
                                            <Link to={`${ADMIN_BASE}/dashboard`} className="new"><i className="ri-home-4-fill me-1" /> Home</Link>
                                        </li>
                                        <li className="breadcrumb-item active" aria-current="page">Cookies</li>
                                    </ol>
                                </nav>
                            </div>

                            <div className="card">
                                <div className="card-body cusbar">
                                    <div className="card-head justify-content-start adjusttwo mb-3" style={{ flexWrap: "nowrap" }}>
                                        <div className="tbl-search position-relative">
                                            <input
                                                type="text"
                                                className="form-control"
                                                placeholder="Search name or type..."
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                            />
                                            <i className="ri-search-line" />
                                        </div>
                                        <div className="d-flex justify-content-end ms-auto">
                                            <Link to={`${ADMIN_BASE}/addcookie`} className="btn btn-soft-primary px-2 btn-sm me-1">
                                                <i className="ri-add-fill font-size-16"></i>
                                            </Link>
                                        </div>
                                    </div>
                                    <div className="table-responsive table-card border-top">
                                        <table className="table table-centered cus-nowrap align-middle hltr mb-0">
                                            <thead>
                                                <tr>
                                                    <th>Sr no.</th>
                                                    <th>Name</th>
                                                    <th>Type</th>
                                                    <th>Duration</th>
                                                    <th className="text-end">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredCookies.length > 0 ? (
                                                    filteredCookies.map((cookie, index) => (
                                                        <tr key={cookie.id}>
                                                            <td>{index + 1}</td>
                                                            <td>{cookie.name}</td>
                                                            <td>{cookie.type}</td>
                                                            <td>{cookie.duration}</td>
                                                            <td>
                                                                <div className="d-flex justify-content-end">
                                                                    <button
                                                                        type="button"
                                                                        className="btn btn-soft-primary px-2 btn-sm me-1"
                                                                        data-bs-toggle="offcanvas"
                                                                        data-bs-target="#view-cookie"
                                                                        onClick={() => handleViewDetails(cookie)}
                                                                    >
                                                                        <i className="ri-eye-fill font-size-16"></i>
                                                                    </button>
                                                                    <Link to={`/updatecookie/${cookie.id}`} className="btn btn-soft-primary px-2 btn-sm me-1">
                                                                        <i className="ri-edit-fill font-size-16"></i>
                                                                    </Link>
                                                                    <button
                                                                        onClick={() => deleteCookie(cookie.id)}
                                                                        className="btn btn-soft-danger px-2 btn-sm"
                                                                        style={{ backgroundColor: "#ea5455", borderColor: "#ea5455", color: "#fff" }}
                                                                    >
                                                                        <i className="ri-delete-bin-line font-size-16"></i>
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))
                                                ) : (
                                                    <tr>
                                                        <td colSpan="5" className="text-center py-4">No cookies found</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Cookie Details Offcanvas */}
            <div className="offcanvas offcanvas-end rdetails" tabIndex="-1" id="view-cookie">
                <div className="offcanvas-header d-block">
                    <div className="d-flex align-items-center">
                        <h5 className="offcanvas-title mb-0 me-3 fw-semibold">Cookie Details</h5>
                        <button type="button" className="btn-close" data-bs-dismiss="offcanvas"></button>
                    </div>
                </div>
                <div className="offcanvas-body">
                    {selectedCookie && (
                        <>
                            <div className="mt-3">
                                <div className="font-size-16 fw-medium mb-1">Name:</div>
                                <div className="p-2 bg-light border rounded">{selectedCookie.name}</div>
                            </div>
                            <div className="mt-3">
                                <div className="font-size-16 fw-medium mb-1">Type:</div>
                                <div className="p-2 bg-light border rounded">{selectedCookie.type}</div>
                            </div>
                            <div className="mt-3">
                                <div className="font-size-16 fw-medium mb-1">Duration:</div>
                                <div className="p-2 bg-light border rounded">{selectedCookie.duration}</div>
                            </div>
                            <div className="mt-3">
                                <div className="font-size-16 fw-medium mb-1">Description:</div>
                                <textarea className="form-control bg-light" rows={6} readOnly value={selectedCookie.description || ""} />
                            </div>
                            <div className="mt-3">
                                <div className="font-size-16 fw-medium mb-1">Status:</div>
                                <div className="p-2 bg-light border rounded">{selectedCookie.status == 1 ? "Active" : "Inactive"}</div>
                            </div>
                        </>
                    )}
                </div>
            </div >
        </>
    );
};

export default CookieList;
