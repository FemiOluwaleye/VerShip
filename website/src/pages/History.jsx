import React, { useState, useEffect, useRef } from "react";
import Commonbanner from "../components/Commonbanner";
import { getBookings, updateBookingStatus, uploadBookingDocument, submitRating, checkRatingStatus } from "../api/cms";
import { pdf, file as fileIcon } from "../common/common-assets/assets-images";
import { useNavigate } from "react-router-dom";
import { API_URL } from "../api/axios";
import { toast } from "sonner";
import { Loader2, Star } from "lucide-react";
import moment from "moment";

// ─── Rating Modal ────────────────────────────────────────────────────────────
const RatingModal = ({ booking, onClose, onSuccess }) => {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [review, setReview] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error("Please select a star rating.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await submitRating({ bookingId: booking.id, rating, review });
      if (res.status) {
        toast.success("Rating submitted successfully!");
        onSuccess(booking.id);
        onClose();
      } else {
        toast.error(res.message || "Failed to submit rating.");
      }
    } catch (err) {
      toast.error("Failed to submit rating.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-[#1E2E2C] border border-[#4E6B5D] rounded-2xl p-8 w-full max-w-md mx-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-white font-bold text-2xl">Rate & Review</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl transition">✕</button>
        </div>

        {/* Provider name */}
        <p className="text-gray-300 text-sm mb-1">Reviewing provider:</p>
        <p className="text-[#FFC928] font-semibold text-lg mb-5">
          {booking.driverbook?.firstName || "Provider"}
        </p>

        {/* Stars */}
        <p className="text-gray-300 text-sm mb-3">Your rating</p>
        <div className="flex gap-2 mb-6">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => setRating(star)}
              onMouseEnter={() => setHovered(star)}
              onMouseLeave={() => setHovered(0)}
              className="transition-transform hover:scale-110"
            >
              <Star
                size={36}
                className={`transition-colors ${star <= (hovered || rating)
                  ? "fill-[#FFC928] text-[#FFC928]"
                  : "text-gray-500"
                  }`}
              />
            </button>
          ))}
        </div>

        {/* Review text */}
        <textarea
          value={review}
          onChange={(e) => setReview(e.target.value)}
          placeholder="Write your review (optional)..."
          rows={4}
          className="w-full bg-[#2D413F] border border-[#4E6B5D] rounded-xl p-3 text-white text-sm resize-none focus:outline-none focus:border-[#FFC928] placeholder-gray-500 mb-6"
        />

        {/* Order reference */}
        <p className="text-gray-500 text-xs mb-6">Order #{booking.orderId || booking.id}</p>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full py-3 rounded-xl font-bold text-black bg-[#FFC928] hover:bg-[#ffe58f] transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {submitting && <Loader2 className="animate-spin" size={18} />}
          {submitting ? "Submitting..." : "Submit Rating"}
        </button>
      </div>
    </div>
  );
};
// ─────────────────────────────────────────────────────────────────────────────

const History = () => {
  const [activeTab, setActiveTab] = useState("current");
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState(null);
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [selectedBookingId, setSelectedBookingId] = useState(null);

  // Rating modal state
  const [ratingModal, setRatingModal] = useState(null); // booking object
  const [ratedBookings, setRatedBookings] = useState({}); // { bookingId: true }

  useEffect(() => {
    fetchBookings();
    const user = JSON.parse(localStorage.getItem("user"));
    if (user) setUserRole(user.role);
  }, []);

  const fetchBookings = async () => {
    try {
      const response = await getBookings();
      if (response.status) {
        const fetchedBookings = response.body.bookings;
        setBookings(fetchedBookings);
        // Check which past delivered bookings have been rated
        const pastDelivered = fetchedBookings.filter(b => b.status === "2");
        if (pastDelivered.length > 0) {
          const ratedMap = {};
          await Promise.all(
            pastDelivered.map(async (b) => {
              try {
                const res = await checkRatingStatus(b.id);
                if (res.status && res.body?.hasRated) {
                  ratedMap[b.id] = true;
                }
              } catch (e) {
                // ignore
              }
            })
          );
          setRatedBookings(ratedMap);
        }
      }
    } catch (error) {
      toast.error("Failed to fetch bookings");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (bookingId, newStatus) => {
    try {
      const response = await updateBookingStatus({ bookingId, status: newStatus });
      if (response.status) {
        toast.success("Status updated successfully");
        fetchBookings();
      } else {
        toast.error(response.message);
      }
    } catch (error) {
      toast.error("Failed to update status");
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file || !selectedBookingId) return;
    const formData = new FormData();
    formData.append("bookingId", selectedBookingId);
    formData.append("document", file);
    try {
      toast.loading("Uploading document...");
      const response = await uploadBookingDocument(formData);
      toast.dismiss();
      if (response.status) {
        toast.success("Document uploaded successfully");
        fetchBookings();
        setSelectedBookingId(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      } else {
        toast.error(response.message);
      }
    } catch (error) {
      toast.dismiss();
      toast.error("Failed to upload document");
    }
  };

  const triggerFileUpload = (bookingId) => {
    setSelectedBookingId(bookingId);
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleRatingSuccess = (bookingId) => {
    setRatedBookings(prev => ({ ...prev, [bookingId]: true }));
  };

  const currentBookings = bookings.filter(b => ["0", "1", "3"].includes(b.status));
  const pastBookings = bookings.filter(b => ["2"].includes(b.status));
  const orders = activeTab === "current" ? currentBookings : pastBookings;

  const getStatusLabel = (status) => {
    switch (status) {
      case "0": return "Pending";
      case "1": return "Shipped";
      case "2": return "Delivered";
      case "3": return "Dispatched";
      case "4": return "Completed";
      default: return "Unknown";
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "0": return "text-yellow-400 border-yellow-400";
      case "1": return "text-blue-400 border-blue-400";
      case "2": return "text-green-400 border-green-400";
      case "3": return "text-orange-400 border-orange-400";
      case "4": return "text-green-500 border-green-500";
      default: return "text-[#FF9900] border-[#FF9900]";
    }
  };

  return (
    <div className="pb-10 bg-gradient-to-b from-[#2C4736] to-[#09120F]">
      <Commonbanner title="My History" />

      <div className="max-w-6xl mx-auto px-4 py-10">
        {/* Tabs */}
        <div className="flex justify-center mb-10">
          <div className=" rounded-full p-1 flex gap-4">
            <button
              onClick={() => setActiveTab("current")}
              className={`flex-1 py-4 md:px-15 px-10 rounded-full md:text-[21px] text-[18px] font-semibold transition ${activeTab === "current"
                ? "bg-[#FFC928] text-black"
                : "text-gray-300 border border-[#4E6B5D]"
                }`}
            >
              Current
            </button>
            <button
              onClick={() => setActiveTab("past")}
              className={`flex-1 py-4 md:px-15 px-10 rounded-full md:text-[21px] text-[18px] font-semibold transition border border-[#4E6B5D] ${activeTab === "past"
                ? "bg-[#FFC928] text-black"
                : "text-gray-300"
                }`}
            >
              Past
            </button>
          </div>
        </div>

        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: "none" }}
          onChange={handleFileUpload}
          accept=".pdf,.doc,.docx,.jpg,.png"
        />

        {/* Cards */}
        <div className="space-y-6">
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="animate-spin text-[#FFC928]" size={40} />
            </div>
          ) : (
            orders.map((item, index) => (
              <div
                key={index}
                onClick={() => navigate("/businessdetail", { state: item })}
                className="bg-[#2D413F] cursor-pointer rounded-xl px-6 py-4 flex md:items-center items-start justify-between shadow-lg flex-col md:flex-row gap-5 md:gap-0"
              >
                {/* Left */}
                <div className="flex items-center md:gap-8 gap-4 flex-wrap">
                  <div
                    className="w-[92px] h-[92px] text-[40px] rounded-full bg-[#FFC928] flex items-center justify-center font-bold text-black"
                    style={{
                      backgroundImage: (userRole === "1" && item.driverbook?.image)
                        ? `url(${API_URL}${item.driverbook?.image})`
                        : 'none',
                      backgroundSize: 'cover',
                      backgroundPosition: 'center'
                    }}
                  >
                    {!(userRole === "1" ? item.driverbook?.image : false) && (userRole === "1" ? (item.driverbook?.firstName?.[0] || "D") : (item.userbook?.firstName?.[0] || "U"))}
                  </div>
                  <div>
                    <h4 className="text-white font-bold text-[23px]">
                      {userRole === "1" ? (item.driverbook ? item.driverbook.firstName : "Provider") : (item.userbook ? item.userbook.firstName : "User")}
                    </h4>
                    <div className="flex md:gap-20 gap-5 flex-wrap text-sm text-white mt-1">
                      <p>
                        <span className="block text-[15px]">Order ID</span>
                        <span className="block text-[15px] border border-[#5c5c5c] rounded-md p-2 px-5 mt-2">{item.orderId || item.id}</span>
                      </p>
                      <p>
                        <span className="block text-[15px]">Quantity</span>
                        <span className="block text-[15px] border border-[#5c5c5c] rounded-md p-2 px-5 mt-2"> {item.bookingRequest?.quantity || "N/A"}</span>
                      </p>
                      <p>
                        <span className="block text-[15px]">Order Date</span>
                        <span className="block text-[15px] border border-[#5c5c5c] rounded-md p-2 px-5 mt-2">{moment(item.createdAt).format("MM/DD/YYYY")}</span>
                      </p>
                      <div className="flex flex-col">
                        <span className="block text-[15px]">Status</span>
                        <span className={`font-medium block text-[14px] border rounded-lg p-2 px-5 mt-2 ${getStatusColor(item.status)}`}>
                          {getStatusLabel(item.status)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Document Preview */}
                {item.document ? (
                  <div className="relative group px-4" onClick={(e) => e.stopPropagation()}>
                    <div className="w-16 h-16 rounded-md border border-[#4E6B5D] overflow-hidden bg-white/5 flex items-center justify-center">
                      {item.document.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                        <img src={`${API_URL}${item.document}`} alt="Document" className="w-full h-full object-cover" />
                      ) : item.document.endsWith('.pdf') ? (
                        <img src={pdf} alt="PDF" className="w-12 h-12 object-contain" />
                      ) : (
                        <img src={fileIcon} alt="File" className="w-12 h-12 object-contain" />
                      )}
                    </div>
                    <a
                      href={`${API_URL}${item.document}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-md"
                    >
                      <span className="text-white text-[10px] font-bold">View</span>
                    </a>
                  </div>
                ) : null}

                {/* Right Button / Action */}
                <div className="flex flex-col gap-2 items-end" onClick={(e) => e.stopPropagation()}>
                  {/* Role 1: User - Upload Docs (current tab) */}
                  {/* {userRole === "1" && activeTab === "current" && (
                    <button
                      onClick={() => triggerFileUpload(item.id)}
                      className="px-8 py-2 rounded-[12px] text-md font-semibold bg-[#FFC928] text-black hover:bg-[#ffe58f] transition"
                    >
                      Upload Docs
                    </button>
                  )} */}

                  {/* Role 1: User - Rate & Review (past tab, delivered) */}
                  {userRole === "1" && activeTab === "past" && item.status === "2" && (
                    ratedBookings[item.id] ? (
                      <span className="px-6 py-2 rounded-[12px] text-sm font-semibold bg-green-800 text-green-300 border border-green-600 flex items-center gap-1">
                        <Star size={14} className="fill-green-400 text-green-400" /> Rated ✓
                      </span>
                    ) : (
                      <button
                        onClick={() => setRatingModal(item)}
                        className="px-6 py-2 rounded-[12px] text-sm font-semibold bg-[#FFC928] text-black hover:bg-[#ffe58f] transition flex items-center gap-1"
                      >
                        <Star size={14} /> Rate & Review
                      </button>
                    )
                  )}

                  {/* Role 2: Provider - Change Status */}
                  {userRole === "2" && activeTab === "current" && (
                    <div className="flex flex-col gap-2">
                      <select
                        value={item.status}
                        onChange={(e) => handleStatusChange(item.id, e.target.value)}
                        className="bg-[#1E2E2C] text-white border border-[#4E6B5D] rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#FFC928]"
                      >
                        <option value="0" disabled={item.status !== "0"}>Pending</option>
                        <option value="3" disabled={item.status === "1" || item.status === "2"}>Dispatched</option>
                        <option value="1" disabled={item.status === "2"}>Shipped</option>
                        <option value="2">Delivered</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Empty State */}
        {!loading && orders.length === 0 && (
          <div className="text-center text-gray-400 mt-10">
            No {activeTab} orders available.
          </div>
        )}
      </div>

      {/* Rating Modal */}
      {ratingModal && (
        <RatingModal
          booking={ratingModal}
          onClose={() => setRatingModal(null)}
          onSuccess={handleRatingSuccess}
        />
      )}
    </div>
  );
};

export default History;
