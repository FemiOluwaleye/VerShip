import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { toast, ToastContainer } from "react-toastify";
import { axiosInstance } from "../../Config";

const AboutUs = () => {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("<p><br></p>");
  const [error, setError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const hasShownError = useRef(false);

  useEffect(() => {
    const fetchAboutUs = async () => {
      try {
        const response = await axiosInstance.get(`/aboutus`);
        const { data } = response.data;
        setTitle(data.title || "");
        setContent(data.content || "<p><br></p>");
        hasShownError.current = false;
      } catch (error) {
        if (!hasShownError.current) {
          const errorToastId = "fetch-about-us-error";
          toast.error("Error fetching About Us data. Please try again.", {
            toastId: errorToastId,
          });
          hasShownError.current = true;
        }
      } finally {
        setLoading(false);
      }
    };

    fetchAboutUs();
  }, []);

  const handleTitleChange = (e) => {
    setTitle(e.target.value);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (content.trim() === "<p><br></p>" || content.trim() === "") {
      setError("About Us content cannot be empty.");
      return;
    }

    setError("");
    setSubmitError("");

    try {
      await axiosInstance.post(`/aboutus`, {
        title,
        content,
      });
      toast.success("About Us updated successfully");
      navigate("/aboutus");
    } catch (error) {
      setSubmitError("Error submitting About Us content. Please try again.");
      toast.error("Error submitting About Us content. Please try again.");
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
                <h4 className="mb-0 page-title">About Us</h4>
              </div>
              <div className="row justify-content-center">
                <div className="col-lg-12">
                  <div className="card">
                    <div className="card-body">
                      {loading ? (
                        <p>Loading...</p>
                      ) : (
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
                                      [
                                        { header: "1" },
                                        { header: "2" },
                                        { font: [] },
                                      ],
                                      [{ list: "ordered" }, { list: "bullet" }],
                                      ["bold", "italic", "underline"],
                                      [{ color: [] }, { background: [] }],
                                      [{ align: [] }],
                                      ["clean"],
                                    ],
                                  }}
                                />
                                {error && (
                                  <p className="text-danger">{error}</p>
                                )}
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

export default AboutUs;
