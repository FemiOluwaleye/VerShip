import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { toast, ToastContainer } from "react-toastify";
import { axiosInstance } from "../../Config";

const CookiePolicy = () => {
    const [content, setContent] = useState("<p><br></p>");
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const hasShownError = useRef(false);

    useEffect(() => {
        const fetchContent = async () => {
            try {
                const response = await axiosInstance.get(`/cookiepolicy`);
                const { data } = response.data;
                setContent(data.content || "<p><br></p>");
                hasShownError.current = false;
            } catch (error) {
                if (!hasShownError.current) {
                    toast.error("Error fetching cookie policy. Please try again.");
                    hasShownError.current = true;
                }
            } finally {
                setLoading(false);
            }
        };
        fetchContent();
    }, []);

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (content.trim() === "<p><br></p>" || content.trim() === "") {
            toast.error("Cookie policy cannot be empty.");
            return;
        }
        try {
            await axiosInstance.post(`/cookiepolicy`, { content });
            toast.success("Cookie policy updated successfully");
        } catch (error) {
            toast.error("Error updating cookie policy. Please try again.");
        }
    };

    return (
        <>
            <ToastContainer />
            <div id="layout-wrapper">
                <div className="main-content">
                    <div className="page-content">
                        <div className="container-fluid">
                            <div className="title-box mb-3 pb-1">
                                <h4 className="mb-0 page-title">Cookie Policy</h4>
                            </div>
                            <div className="row justify-content-center">
                                <div className="col-lg-12">
                                    <div className="card">
                                        <div className="card-body">
                                            {loading ? (
                                                <p>Loading...</p>
                                            ) : (
                                                <form onSubmit={handleSubmit}>
                                                    <div className="row mb-2">
                                                        <div className="col-12">
                                                            <div className="form-group">
                                                                <label htmlFor="content">Content</label>
                                                                <ReactQuill
                                                                    id="content"
                                                                    style={{ height: "400px", marginBottom: "50px", color: "black" }}
                                                                    theme="snow"
                                                                    value={content}
                                                                    onChange={setContent}
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="text-end mb-2">
                                                        <button type="submit" className="btn btn-primary px-4">Update</button>
                                                    </div>
                                                </form>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default CookiePolicy;
