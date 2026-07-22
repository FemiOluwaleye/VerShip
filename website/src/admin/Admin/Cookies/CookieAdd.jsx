import { ADMIN_BASE } from "../../adminBase";
import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { axiosInstance } from "../../Config";

const CookieAdd = () => {
    const [data, setData] = useState({
        name: "",
        description: "",
        type: "Essential",
        duration: "",
        status: 1
    });
    const navigate = useNavigate();

    const handleChange = (e) => {
        const { id, value } = e.target;
        setData((prev) => ({ ...prev, [id]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!data.name.trim()) {
            toast.error("Name is required");
            return;
        }
        if (!data.description.trim()) {
            toast.error("Description is required");
            return;
        }
        if (data.description.length < 10) {
            toast.error("Description must be at least 10 characters");
            return;
        }

        if (data.description.length > 500) {
            toast.error("Description must not exceed 500 characters");
            return;
        }
        if (!data.duration.trim()) {
            toast.error("Duration is required");
            return;
        }
        try {
            const response = await axiosInstance.post("/createcookie", data);
            if (response.data.success) {
                toast.success("Cookie added successfully!");
                setTimeout(() => navigate(`${ADMIN_BASE}/cookielist`), 1000);
            } else {
                toast.error(response.data.message || "Failed to add cookie");
            }
        } catch (error) {
            toast.error(error.response?.data?.message || "Request failed");
        }
    };

    return (
        <>
            <div id="layout-wrapper">
                <div className="main-content">
                    <div className="page-content">
                        <div className="container-fluid">
                            <div className="title-box mb-3 pb-1">
                                <h4 className="mb-0 page-title">Add Cookie</h4>
                            </div>
                            <div className="row justify-content-center">
                                <div className="col-lg-12">
                                    <div className="card">
                                        <div className="card-body">
                                            <form onSubmit={handleSubmit}>
                                                <div className="row">
                                                    <div className="col-md-6 mb-3">
                                                        <label className="mb-1 fw-medium">Cookie Name</label>
                                                        <input type="text" className="form-control" id="name" value={data.name} onChange={handleChange} placeholder="e.g. _ga" />
                                                    </div>
                                                    <div className="col-md-6 mb-3">
                                                        <label className="mb-1 fw-medium">Type</label>
                                                        <select className="form-select" id="type" value={data.type} onChange={handleChange}>
                                                            <option value="Essential">Essential</option>
                                                            <option value="Analytical">Analytical</option>
                                                            <option value="Marketing">Marketing</option>
                                                            <option value="Functional">Functional</option>
                                                        </select>
                                                    </div>
                                                    <div className="col-md-6 mb-3">
                                                        <label className="mb-1 fw-medium">Duration</label>
                                                        <input type="text" className="form-control" id="duration" value={data.duration} onChange={handleChange} placeholder="e.g. 2 years" />
                                                    </div>
                                                    <div className="col-md-6 mb-3">
                                                        <label className="mb-1 fw-medium">Status</label>
                                                        <select className="form-select" id="status" value={data.status} onChange={(e) => setData(p => ({ ...p, status: parseInt(e.target.value) }))}>
                                                            <option value={1}>Active</option>
                                                            <option value={0}>Inactive</option>
                                                        </select>
                                                    </div>
                                                    <div className="col-12 mb-3">
                                                        <label className="mb-1 fw-medium">Description</label>
                                                        <textarea className="form-control" id="description" value={data.description} onChange={handleChange} rows={4} placeholder="What this cookie does..." />
                                                    </div>
                                                </div>

                                                <div className="text-end mb-2">
                                                    <Link className="btn btn-secondary px-4 mx-2" to={`${ADMIN_BASE}/cookielist`}>Back</Link>
                                                    <button type="submit" className="btn btn-primary px-4">Add Cookie</button>
                                                </div>
                                            </form>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <ToastContainer />
        </>
    );
};

export default CookieAdd;
