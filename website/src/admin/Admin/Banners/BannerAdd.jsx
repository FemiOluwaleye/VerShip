import { ADMIN_BASE } from "../../adminBase";
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { axiosInstance } from "../../Config";

const BannerAdd = () => {
  const [data, setData] = useState({ title: "", image: null });
  const [imagePreview, setImagePreview] = useState(null);
  const [titleError, setTitleError] = useState("");
  const [imageError, setImageError] = useState("");
  const navigate = useNavigate();

  const validateTitle = (title) => {
    const trimmedTitle = title.trim();
    const errors = [];

    if (!trimmedTitle) {
      errors.push("Title is required.");
    } else {
      if (trimmedTitle.length < 3 || trimmedTitle.length > 50)
        errors.push("Title must be between 3 and 50 characters.");
      if (!/^[A-Za-z0-9@#&!()_\-., ]+$/.test(trimmedTitle))
        errors.push(
          "Title contains invalid characters. Only letters, numbers, spaces, and @#&!()_-., are allowed."
        );
    }

    setTitleError(errors.join(" "));
    return errors.length === 0;
  };

  const handleChange = (e) => {
    const { name, value, files } = e.target;

    if (name === "image") {
      if (files.length > 0) {
        const file = files[0];
        const allowedTypes = ["image/jpeg", "image/png"];

        if (allowedTypes.includes(file.type)) {
          setData((prev) => ({ ...prev, image: file }));
          setImagePreview(URL.createObjectURL(file));
          setImageError("");
        } else {
          setData((prev) => ({ ...prev, image: null }));
          setImagePreview(null);
          setImageError("Only JPG and PNG images are allowed.");
        }
      }
    } else if (name === "title") {
      setData((prev) => ({ ...prev, title: value }));
      if (titleError) setTitleError("");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setTitleError("");
    setImageError("");

    const isTitleValid = validateTitle(data.title);

    let isImageValid = true;
    if (!data.image) {
      setImageError("Banner image is required.");
      isImageValid = false;
    }

    if (!isTitleValid || !isImageValid) {
      return;
    }

    const formData = new FormData();
    formData.append("image", data.image);
    formData.append("title", data.title.trim());

    try {
      const response = await axiosInstance.post("/addbanner", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (response.status === 200 && response.data.success) {
        toast.success("Banner added successfully!");
        setTimeout(() => navigate(`${ADMIN_BASE}/bannerlist`), 1000);
      } else {
        toast.error(response.data.message || "Banner creation failed.");
      }
    } catch (error) {
      if (error.response?.data?.message) {
        toast.error(error.response.data.message);
      } else {
        toast.error("Request failed: " + error.message);
      }
    }
  };

  return (
    <>
      <div id="layout-wrapper">
        <div className="main-content">
          <div className="page-content">
            <div className="container-fluid">
              <div className="title-box mb-3 pb-1">
                <h4 className="mb-0 page-title">Add Banner</h4>
              </div>
              <div className="row justify-content-center">
                <div className="col-lg-12">
                  <div className="card">
                    <div className="card-body">
                      <form onSubmit={handleSubmit}>
                        <div className="mb-3">
                          <label className="mb-1 fw-medium">Banner Title</label>
                          <input
                            type="text"
                            className="form-control"
                            name="title"
                            value={data.title}
                            onChange={handleChange}
                            maxLength={50}
                          />
                          {titleError && (
                            <div
                              style={{
                                color: "red",
                                marginTop: "0.25rem",
                                fontSize: "0.875rem",
                              }}
                            >
                              {titleError}
                            </div>
                          )}
                        </div>

                        <div className="mb-3">
                          <div className="position-relative d-inline-block">
                            <label
                              htmlFor="image"
                              className="btn btn-outline-primary"
                              style={{ cursor: "pointer" }}
                            >
                              Select Image
                            </label>
                            <input
                              type="file"
                              accept="image/*"
                              id="image"
                              name="image"
                              style={{ display: "none" }}
                              onChange={handleChange}
                            />
                          </div>
                          {imageError && (
                            <div
                              style={{
                                color: "red",
                                marginTop: "0.25rem",
                                fontSize: "0.875rem",
                              }}
                            >
                              {imageError}
                            </div>
                          )}
                        </div>

                        {imagePreview && (
                          <div className="mb-3">
                            <img
                              src={imagePreview}
                              alt="Preview"
                              style={{
                                maxWidth: "200px",
                                maxHeight: "200px",
                                objectFit: "cover",
                              }}
                            />
                          </div>
                        )}

                        <div className="text-end mb-2">
                          <Link
                            className="btn btn-secondary px-4 mx-2"
                            to={`${ADMIN_BASE}/bannerlist`}
                          >
                            Back
                          </Link>
                          <button
                            type="submit"
                            className="btn btn-primary px-4"
                          >
                            Add Banner
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
      <ToastContainer />
    </>
  );
};

export default BannerAdd;
