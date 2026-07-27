import { ADMIN_BASE } from "../../adminBase";
import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { axiosInstance, BASE_URL } from "../../Config";

// Shared add/edit form for pre-packed barrel products. mode="add" | "edit".
// Contents (the barrel's item list) are edited inline as dynamic rows and sent
// as a JSON array; the server replaces the child rows wholesale.
// Groups the public page lists contents under (see PrepackedBarrel.jsx).
const CONTENT_CATEGORIES = ["Food", "Household Items", "Personal Care"];

const emptyRow = () => ({ name: "", quantity: "1", icon: "", category: CONTENT_CATEGORIES[0] });

const ProductForm = ({ mode }) => {
  const isEdit = mode === "edit";
  const { id } = useParams();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    tagline: "",
    description: "",
    price: "",
    compareAtPrice: "",
    currency: "USD",
    transitTime: "",
    status: "1",
    featured: false,
  });
  const [contents, setContents] = useState([emptyRow()]);
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [existingImage, setExistingImage] = useState("");
  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      try {
        const response = await axiosInstance.get(`/prepacked/detail/${id}`);
        if (response.data.success) {
          const p = response.data.body;
          setForm({
            name: p.name || "",
            tagline: p.tagline || "",
            description: p.description || "",
            price: p.price || "",
            compareAtPrice: p.compareAtPrice || "",
            currency: p.currency || "USD",
            transitTime: p.transitTime || "",
            status: String(p.status ?? "1"),
            featured: !!p.featured,
          });
          const rows = (p.contents || [])
            .slice()
            .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
            .map((c) => ({
              name: c.name || "",
              quantity: String(c.quantity ?? "1"),
              icon: c.icon || "",
              category: CONTENT_CATEGORIES.includes(c.category)
                ? c.category
                : CONTENT_CATEGORIES[0],
            }));
          setContents(rows.length ? rows : [emptyRow()]);
          setExistingImage(p.image || "");
        } else {
          toast.error(response.data.message || "Failed to load barrel");
        }
      } catch (error) {
        toast.error("An error occurred while loading the barrel");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, isEdit]);

  const handleField = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const handleImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = [
      "image/jpeg", "image/png", "image/webp", "image/gif",
      "video/mp4", "video/webm",
    ];
    if (!allowed.includes(file.type)) {
      toast.error("Allowed: JPG, PNG, GIF, WEBP images or MP4 / WEBM video.");
      return;
    }
    setImage(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleRowChange = (index, key, value) => {
    setContents((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [key]: value } : row))
    );
  };

  const addRow = () => setContents((prev) => [...prev, emptyRow()]);

  const removeRow = (index) =>
    setContents((prev) =>
      prev.length === 1 ? prev : prev.filter((_, i) => i !== index)
    );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error("Barrel name is required.");
    if (form.price === "" || isNaN(Number(form.price)))
      return toast.error("A valid price is required.");
    if (!isEdit && !image) return toast.error("A barrel image is required.");

    // Drop empty content rows and stamp sort order from row position.
    const cleanContents = contents
      .filter((c) => c.name.trim())
      .map((c, i) => ({
        name: c.name.trim(),
        quantity: String(c.quantity || "1"),
        icon: c.icon || "",
        category: c.category || CONTENT_CATEGORIES[0],
        sort_order: i + 1,
      }));

    const formData = new FormData();
    formData.append("name", form.name.trim());
    formData.append("tagline", form.tagline);
    formData.append("description", form.description);
    formData.append("price", String(form.price));
    formData.append("compareAtPrice", form.compareAtPrice ? String(form.compareAtPrice) : "");
    formData.append("currency", form.currency);
    formData.append("transitTime", form.transitTime);
    formData.append("status", form.status);
    formData.append("featured", form.featured ? "1" : "0");
    formData.append("contents", JSON.stringify(cleanContents));
    if (image) formData.append("image", image);

    const url = isEdit ? `/prepacked/update/${id}` : "/prepacked/add";

    setSubmitting(true);
    try {
      const response = await axiosInstance.post(url, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (response.data.success) {
        toast.success(`Barrel ${isEdit ? "updated" : "created"} successfully!`);
        setTimeout(() => navigate(`${ADMIN_BASE}/prepacked/list`), 900);
      } else {
        toast.error(response.data.message || "Save failed.");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Request failed: " + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div id="layout-wrapper">
        <div className="main-content">
          <div className="page-content">
            <div className="container-fluid">
              <p className="text-muted">Loading barrel…</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const previewSrc =
    imagePreview || (existingImage ? `${BASE_URL}/${existingImage.replace(/^\/+/, "")}` : null);
  const previewIsVideo = image
    ? image.type.startsWith("video")
    : /\.(mp4|webm|ogg|mov)$/i.test(existingImage || "");

  return (
    <>
      <div id="layout-wrapper">
        <div className="main-content">
          <div className="page-content">
            <div className="container-fluid">
              <div className="title-box mb-3 pb-1">
                <h4 className="mb-0 page-title">
                  {isEdit ? "Edit Barrel" : "Add Barrel"}
                </h4>
              </div>
              <div className="row justify-content-center">
                <div className="col-lg-12">
                  <div className="card">
                    <div className="card-body">
                      <form onSubmit={handleSubmit}>
                        <div className="row">
                          <div className="col-md-6 mb-3">
                            <label className="mb-1 fw-medium">Name</label>
                            <input
                              type="text"
                              className="form-control"
                              name="name"
                              value={form.name}
                              onChange={handleField}
                              maxLength={255}
                            />
                          </div>
                          <div className="col-md-6 mb-3">
                            <label className="mb-1 fw-medium">Tagline</label>
                            <input
                              type="text"
                              className="form-control"
                              name="tagline"
                              value={form.tagline}
                              onChange={handleField}
                              maxLength={255}
                            />
                          </div>
                          <div className="col-md-4 mb-3">
                            <label className="mb-1 fw-medium">Price</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              className="form-control"
                              name="price"
                              value={form.price}
                              onChange={handleField}
                            />
                          </div>
                          <div className="col-md-4 mb-3">
                            <label className="mb-1 fw-medium">
                              Regular Price <span className="text-muted">(optional)</span>
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              className="form-control"
                              name="compareAtPrice"
                              value={form.compareAtPrice}
                              onChange={handleField}
                              placeholder="e.g. 1099"
                            />
                            <div className="text-muted" style={{ fontSize: "0.8rem" }}>
                              Shown struck-through beside the price to signal a promo. Leave blank for none.
                            </div>
                          </div>
                          <div className="col-md-4 mb-3">
                            <label className="mb-1 fw-medium">Currency</label>
                            <input
                              type="text"
                              className="form-control"
                              name="currency"
                              value={form.currency}
                              onChange={handleField}
                              maxLength={8}
                            />
                          </div>
                          <div className="col-md-4 mb-3">
                            <label className="mb-1 fw-medium">Status</label>
                            <select
                              className="form-select"
                              name="status"
                              value={form.status}
                              onChange={handleField}
                            >
                              <option value="1">Active (shown on site)</option>
                              <option value="0">Hidden</option>
                            </select>
                          </div>
                          <div className="col-md-6 mb-3">
                            <label className="mb-1 fw-medium">
                              Transit Time
                            </label>
                            <input
                              type="text"
                              className="form-control"
                              name="transitTime"
                              value={form.transitTime}
                              onChange={handleField}
                              placeholder="e.g. 2-3 weeks"
                              maxLength={255}
                            />
                          </div>
                          <div className="col-md-6 mb-3 d-flex align-items-end">
                            <div className="form-check">
                              <input
                                type="checkbox"
                                className="form-check-input"
                                id="featured"
                                name="featured"
                                checked={form.featured}
                                onChange={handleField}
                              />
                              <label
                                className="form-check-label fw-medium"
                                htmlFor="featured"
                              >
                                Featured on landing page
                              </label>
                              <div className="text-muted" style={{ fontSize: "0.8rem" }}>
                                Shown in the public barrels grid (must also be Active).
                              </div>
                            </div>
                          </div>
                          <div className="col-12 mb-3">
                            <label className="mb-1 fw-medium">Description</label>
                            <textarea
                              className="form-control"
                              name="description"
                              rows="3"
                              value={form.description}
                              onChange={handleField}
                            />
                          </div>
                        </div>

                        <div className="mb-3">
                          <label className="mb-1 fw-medium d-block">
                            Barrel Image / Animation
                          </label>
                          <label
                            htmlFor="barrel-image"
                            className="btn btn-outline-primary"
                            style={{ cursor: "pointer" }}
                          >
                            {isEdit ? "Replace Media" : "Select Media"}
                          </label>
                          <div className="text-muted" style={{ fontSize: "0.8rem" }}>
                            JPG, PNG, GIF, WEBP, or MP4 / WEBM video.
                          </div>
                          <input
                            type="file"
                            accept="image/*,video/mp4,video/webm"
                            id="barrel-image"
                            style={{ display: "none" }}
                            onChange={handleImage}
                          />
                          {previewSrc && (
                            <div className="mt-2">
                              {previewIsVideo ? (
                                <video
                                  src={previewSrc}
                                  autoPlay
                                  loop
                                  muted
                                  playsInline
                                  style={{
                                    maxWidth: "200px",
                                    maxHeight: "200px",
                                    objectFit: "cover",
                                    borderRadius: "6px",
                                  }}
                                />
                              ) : (
                                <img
                                  src={previewSrc}
                                  alt="Preview"
                                  style={{
                                    maxWidth: "200px",
                                    maxHeight: "200px",
                                    objectFit: "cover",
                                    borderRadius: "6px",
                                  }}
                                />
                              )}
                            </div>
                          )}
                        </div>

                        <div className="mb-2 d-flex align-items-center justify-content-between">
                          <label className="fw-medium mb-0">
                            Barrel Contents
                          </label>
                          <button
                            type="button"
                            className="btn btn-soft-primary btn-sm"
                            onClick={addRow}
                          >
                            <i className="ri-add-fill" /> Add Item
                          </button>
                        </div>
                        <div className="table-responsive mb-3">
                          <table className="table table-bordered align-middle mb-0">
                            <thead>
                              <tr>
                                <th style={{ width: "90px" }}>Icon</th>
                                <th>Item Name</th>
                                <th style={{ width: "170px" }}>Category</th>
                                <th style={{ width: "120px" }}>Quantity</th>
                                <th style={{ width: "60px" }}></th>
                              </tr>
                            </thead>
                            <tbody>
                              {contents.map((row, index) => (
                                <tr key={index}>
                                  <td>
                                    <input
                                      type="text"
                                      className="form-control"
                                      placeholder="🍚"
                                      value={row.icon}
                                      onChange={(e) =>
                                        handleRowChange(
                                          index,
                                          "icon",
                                          e.target.value
                                        )
                                      }
                                    />
                                  </td>
                                  <td>
                                    <input
                                      type="text"
                                      className="form-control"
                                      placeholder="e.g. Rice"
                                      value={row.name}
                                      onChange={(e) =>
                                        handleRowChange(
                                          index,
                                          "name",
                                          e.target.value
                                        )
                                      }
                                    />
                                  </td>
                                  <td>
                                    <select
                                      className="form-select"
                                      value={row.category}
                                      onChange={(e) =>
                                        handleRowChange(
                                          index,
                                          "category",
                                          e.target.value
                                        )
                                      }
                                    >
                                      {CONTENT_CATEGORIES.map((c) => (
                                        <option key={c} value={c}>
                                          {c}
                                        </option>
                                      ))}
                                    </select>
                                  </td>
                                  <td>
                                    <input
                                      type="text"
                                      className="form-control"
                                      value={row.quantity}
                                      onChange={(e) =>
                                        handleRowChange(
                                          index,
                                          "quantity",
                                          e.target.value
                                        )
                                      }
                                    />
                                  </td>
                                  <td className="text-center">
                                    <button
                                      type="button"
                                      className="btn btn-soft-danger btn-sm"
                                      onClick={() => removeRow(index)}
                                      title="Remove item"
                                    >
                                      <i className="ri-delete-bin-line" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <div className="text-end mb-2">
                          <Link
                            className="btn btn-secondary px-4 mx-2"
                            to={`${ADMIN_BASE}/prepacked/list`}
                          >
                            Back
                          </Link>
                          <button
                            type="submit"
                            className="btn btn-primary px-4"
                            disabled={submitting}
                          >
                            {submitting
                              ? "Saving…"
                              : isEdit
                              ? "Update Barrel"
                              : "Add Barrel"}
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

export default ProductForm;
