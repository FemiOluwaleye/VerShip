import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { axiosInstance, BASE_URL } from "../../Config";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Pencil } from "lucide-react";

const BannerEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState({ title: "", image: "" });
  const [imagePreview, setImagePreview] = useState(null);
  const [newImage, setNewImage] = useState(null);
  const [titleError, setTitleError] = useState("");
  const [imageError, setImageError] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axiosInstance.get(`/bannerdetail/${id}`);
        if (response.data.success) {
          setData(response.data.body);
          setImagePreview(
            response.data.body.image
              ? `${BASE_URL}/${response.data.body.image}`
              : null
          );
        } else {
          toast.error("Failed to fetch banner data.");
        }
      } catch (err) {
        toast.error("Error fetching banner data.");
      }
    };

    fetchData();
  }, [id]);

  const validateTitle = (title) => {
    const trimmedTitle = title.trim();
    const errors = [];

    if (!trimmedTitle) {
      errors.push("Banner title is required.");
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

    if (name === "title") {
      setData((prev) => ({ ...prev, title: value }));
      validateTitle(value);
    } else if (name === "image" && files.length > 0) {
      const file = files[0];
      const allowedTypes = ["image/jpeg", "image/png"];

      if (allowedTypes.includes(file.type)) {
        setNewImage(file);
        setImagePreview(URL.createObjectURL(file));
        setImageError(""); 
      } else {
        setNewImage(null);
        setImageError("Only JPG and PNG images are allowed.");
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const isTitleValid = validateTitle(data.title);

    if (!isTitleValid || (newImage && imageError)) return;

    const formData = new FormData();
    formData.append("title", data.title.trim());
    if (newImage) formData.append("image", newImage);

    try {
      const response = await axiosInstance.post(`/bannerupdate/${id}`, formData);
      if (response.data.success) {
        toast.success("Banner updated successfully!");
        setTimeout(() => navigate("/bannerlist"), 1000);
      } else {
        toast.error(response.data.message || "Failed to update banner.");
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || "Error updating banner.");
    }
  };

  return (
    <>
      <div id="layout-wrapper">
        <div className="main-content">
          <div className="page-content">
            <div className="container-fluid">
              <div className="title-box mb-3 pb-1">
                <h4 className="mb-0 page-title">Edit Banner</h4>
              </div>
              <div className="row justify-content-center">
                <div className="col-lg-12">
                  <div className="card">
                    <div className="card-body">
                      <div className="text-center mb-4">
                        <div className="position-relative d-inline-block">
                          <img
                            src={imagePreview || ""}
                            style={{
                              width: 200,
                              height: 200,
                              objectFit: "cover",
                              borderRadius: "20%",
                            }}
                            alt="Banner"
                          />
                          <input
                            type="file"
                            accept="image/*"
                            name="image"
                            id="fileInput"
                            style={{ display: "none" }}
                            onChange={handleChange}
                          />
                          <label
                            htmlFor="fileInput"
                            className="position-absolute bottom-0 end-0 bg-primary text-white rounded-circle p-2"
                            style={{ cursor: "pointer" }}
                          >
                            <Pencil size={20} />
                          </label>
                        </div>
                      </div>
                      <form onSubmit={handleSubmit}>
                        <div className="mb-3">
                          <label className="mb-1 fw-medium">Title</label>
                          <input
                            type="text"
                            className="form-control"
                            name="title"
                            value={data.title}
                            onChange={handleChange}
                            maxLength={50}
                          />
                          {titleError && (
                            <div className="text-danger">{titleError}</div>
                          )}
                        </div>

                        <div className="d-flex justify-content-end">
                          <Link
                            type="button"
                            className="btn btn-secondary mx-2"
                            to='/bannerlist'
                          >
                            Back
                          </Link>

                          <button type="submit" className="btn btn-primary px-4">
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
      <ToastContainer />
    </>
  );
};

export default BannerEdit;
