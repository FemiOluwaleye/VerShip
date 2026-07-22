import { ADMIN_BASE } from "../../adminBase";
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { toast, ToastContainer } from "react-toastify";
import { axiosInstance } from "../../Config";

const PrivacyPolicy = () => {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("<p><br></p>");
  const [error, setError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const hasShownError = useRef(false); 

  useEffect(() => {
    const fetchPrivacyPolicy = async () => {
      try {
        const response = await axiosInstance.get(`/privacypolicy`);
        const { data } = response.data;
        setTitle(data.title || "");
        setContent(data.content || "<p><br></p>");
        hasShownError.current = false; 
      } catch (error) {
        if (!hasShownError.current) {
          toast.error("Error fetching privacy policy data. Please try again.", {
            toastId: "fetch-privacy-policy-error", 
          });
          hasShownError.current = true; 
        }
      } finally {
        setLoading(false);
      }
    };

    fetchPrivacyPolicy();
  }, []); 

  const handleTitleChange = (e) => {
    setTitle(e.target.value);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (content.trim() === "<p><br></p>" || content.trim() === "") {
      setError("Privacy Policy cannot be empty.");
      return;
    }

    setError("");
    setSubmitError("");

    try {
      await axiosInstance.post(`/privacypolicy`, {
        title,
        content,
      });
      toast.success("Privacy policy updated successfully");
      navigate(`${ADMIN_BASE}/privacypolicy`);
    } catch (error) {
      setSubmitError("Error submitting privacy policy. Please try again.");
      toast.error("Error submitting privacy policy. Please try again.");
    }
  };

  return (
    <>
    <ToastContainer/>
      <div id="layout-wrapper">
        <div className="main-content">
          <div className="page-content">
            <div className="container-fluid">
              <div className="title-box mb-3 pb-1">
                <h4 className="mb-0 page-title">Privacy Policy</h4>
              </div>
              <div className="row justify-content-center">
                <div className="col-lg-12">
                  <div className="card">
                    <div className="card-body">
                      <form onSubmit={handleSubmit}>
                        <div className="mb-3">
                          <label className="mb-1 fw-medium">Title</label>
                          <input
                            type="text"
                            className="form-control"
                            name="title"
                            value={title}
                            onChange={handleTitleChange}
                            maxLength={50}
                            disabled
                          />
                        </div>

                        <div className="row mb-2">
                          <div className="col-12">
                            <div className="form-group">
                              <label htmlFor="content">Content</label>
                              <div style={{ position: "relative" }}>
                                <ReactQuill
                                  id="content"
                                  style={{
                                    height: "250px",
                                    marginBottom: "50px",
                                    color: "black",
                                  }}
                                  theme="snow"
                                  value={content}
                                  onChange={setContent}
                                  modules={{
                                    toolbar: [
                                      [{ header: "1" }, { header: "2" }, { font: [] }],
                                      [{ list: "ordered" }, { list: "bullet" }],
                                      ["bold", "italic", "underline"],
                                      [{ color: [] }, { background: [] }],
                                      [{ align: [] }],
                                      ["clean"],
                                    ],
                                  }}
                                />
                                {!loading && content.trim() === "<p><br></p>" && (
                                  <div
                                    style={{
                                      position: "absolute",
                                      top: 53,
                                      left: 18,
                                      right: 0,
                                      bottom: 0,
                                      pointerEvents: "none",
                                      color: "red",
                                      fontStyle: "italic",
                                    }}
                                  >
                                    Privacy Policy cannot be empty.
                                  </div>
                                )}
                              </div>
                              {error && <p className="text-danger">{error}</p>}
                              {submitError && (
                                <p className="text-danger">{submitError}</p>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="text-end mb-2">
                          <button
                            type="submit"
                            className="btn btn-primary px-4"
                          >
                            Update
                          </button>
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
    </>
  );
};

export default PrivacyPolicy;
