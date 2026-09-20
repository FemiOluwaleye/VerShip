import React, { useState, useEffect, useRef } from "react";
import Commonbanner from "../components/Commonbanner";
import { getBookings, updateBookingStatus, uploadBookingDocument, submitRating, checkRatingStatus, getMyPrepackedOrders, addBookingAdditionalCost, payAdditionalCost, confirmAdditionalCostPayment, createChargeIntent, confirmCharge } from "../api/cms";
import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import CheckoutForm from "../components/CheckoutForm";
import { Printer } from "lucide-react";
import { pdf, file as fileIcon } from "../common/common-assets/assets-images";
import { useNavigate } from "react-router-dom";
import { API_URL } from "../api/axios";
import { toast } from "sonner";
import { Loader2, Star } from "lucide-react";
import moment from "moment";

// ─── Print receipt ───────────────────────────────────────────────────────────
// Opens a minimal branded receipt in a new window and triggers the print dialog.
const printReceipt = (title, rows) => {
  const w = window.open("", "_blank", "width=720,height=900");
  if (!w) return;
  const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  w.document.write(`<!doctype html><html><head><title>${esc(title)}</title>
    <style>
      body { font-family: 'Segoe UI', Arial, sans-serif; color: #2D413F; margin: 40px; }
      .brand { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #FFC928; padding-bottom: 14px; }
      .brand h1 { margin: 0; font-size: 26px; }
      .brand span { color: #888; font-size: 13px; }
      h2 { font-size: 18px; margin: 24px 0 8px; }
      table { width: 100%; border-collapse: collapse; margin-top: 10px; }
      td { padding: 9px 6px; border-bottom: 1px solid #eee; font-size: 14px; }
      td:first-child { color: #777; width: 42%; }
      td:last-child { font-weight: 600; }
      .foot { margin-top: 30px; color: #999; font-size: 12px; text-align: center; }
      @media print { body { margin: 12mm; } }
    </style></head><body>
    <div class="brand"><h1>VerShip</h1><span>Printed ${esc(moment().format("MMM D, YYYY h:mm A"))}</span></div>
    <h2>${esc(title)}</h2>
    <table>${rows.filter(([, v]) => v !== undefined && v !== null && v !== "").map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join("")}</table>
    <div class="foot">vershipgo.com — thank you for shipping with VerShip</div>
    </body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
};

// ─── Add Additional Cost Modal (provider) ───────────────────────────────────
const AddCostModal = ({ booking, onClose, onSuccess }) => {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const amt = parseFloat(amount);
    if (!Number.isFinite(amt) || amt <= 0) return toast.error("Enter a valid amount.");
    if (!description.trim()) return toast.error("Describe what the cost is for.");
    setSubmitting(true);
    try {
      const res = await addBookingAdditionalCost({ bookingId: booking.id, amount: amt, description: description.trim() });
      if (res.status) {
        toast.success("Cost requested — the customer has been emailed.");
        onSuccess();
        onClose();
      } else {
        toast.error(res.message || "Failed to add cost.");
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to add cost.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4" onClick={onClose}>
      <div className="bg-[#1E2E2C] rounded-2xl p-6 w-full max-w-md border border-[#4E6B5D]" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-white text-xl font-bold mb-1">Request Additional Cost</h3>
        <p className="text-gray-400 text-sm mb-5">Order {booking.orderId || booking.id} — the customer is emailed a payment request and pays in their History page.</p>
        <label className="block text-gray-300 text-sm mb-1">Amount (USD)</label>
        <input
          type="number" min="1" step="0.01" value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="e.g. 25.00"
          className="w-full bg-[#0f1b19] text-white border border-[#4E6B5D] rounded-lg px-4 py-2.5 mb-4 focus:outline-none focus:border-[#FFC928]"
        />
        <label className="block text-gray-300 text-sm mb-1">What is it for?</label>
        <textarea
          rows={3} value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Storage fee — barrels held over 14 days"
          className="w-full bg-[#0f1b19] text-white border border-[#4E6B5D] rounded-lg px-4 py-2.5 mb-6 focus:outline-none focus:border-[#FFC928]"
        />
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} disabled={submitting} className="px-5 py-2 rounded-lg border border-[#4E6B5D] text-gray-300 hover:bg-white/5 transition">Cancel</button>
          <button onClick={handleSubmit} disabled={submitting} className="px-6 py-2 rounded-lg bg-[#FFC928] text-black font-semibold hover:bg-[#ffe58f] transition disabled:opacity-50">
            {submitting ? "Sending…" : "Send Request"}
          </button>
        </div>
      </div>
    </div>
  );
};

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

  // Additional-cost modals
  const [addCostModal, setAddCostModal] = useState(null);   // booking (provider)
  const [payCostModal, setPayCostModal] = useState(null);   // { cost, clientSecret, stripePromise } (customer)

  // "Pay as Your Shipment Moves": pay any pending booking_charges row through
  // the server-priced intent (customs & delivery on arrival, forwarder extras).
  const startPayCharge = async (charge) => {
    try {
      const res = await createChargeIntent({ bookingChargeId: charge.id });
      if (res.success && res.clientSecret) {
        setPayCostModal({
          cost: { id: charge.id, description: charge.description, amount: (charge.amount_cents / 100).toFixed(2) },
          charge,
          clientSecret: res.clientSecret,
          stripePromise: loadStripe(res.publishkey),
        });
      } else {
        toast.error(res.message || "Could not start payment.");
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || "Could not start payment.");
    }
  };

  const startPayAdditionalCost = async (cost) => {
    try {
      const res = await payAdditionalCost({ additionalCostId: cost.id });
      if (res.status && res.body?.clientSecret) {
        setPayCostModal({
          cost,
          clientSecret: res.body.clientSecret,
          stripePromise: loadStripe(res.body.publishkey),
        });
      } else {
        toast.error(res.message || "Could not start payment.");
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || "Could not start payment.");
    }
  };

  // Pre-packed barrel orders (separate table from bookings)
  const [prepackedOrders, setPrepackedOrders] = useState([]);

  useEffect(() => {
    fetchBookings();
    fetchPrepackedOrders();
    const user = JSON.parse(localStorage.getItem("user"));
    if (user) setUserRole(user.role);
  }, []);

  const fetchPrepackedOrders = async () => {
    try {
      const response = await getMyPrepackedOrders();
      if (response.status) setPrepackedOrders(response.body?.orders || []);
    } catch (error) {
      // Non-fatal: bookings still render if this fails.
      console.error("Failed to fetch pre-packed orders", error);
    }
  };

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

  const currentBookings = bookings.filter(b => ["0", "1", "3", "5"].includes(b.status));
  const pastBookings = bookings.filter(b => ["2", "4"].includes(b.status)); // delivered or cancelled
  const orders = activeTab === "current" ? currentBookings : pastBookings;

  const getStatusLabel = (status) => {
    switch (status) {
      case "0": return "Pending";
      case "1": return "Shipped";
      case "2": return "Delivered";
      case "3": return "Dispatched";
      case "4": return "Cancelled";
      case "5": return "Arrived in Jamaica";
      default: return "Unknown";
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "0": return "text-yellow-400 border-yellow-400";
      case "1": return "text-blue-400 border-blue-400";
      case "2": return "text-green-400 border-green-400";
      case "3": return "text-orange-400 border-orange-400";
      case "4": return "text-red-400 border-red-400";
      case "5": return "text-teal-300 border-teal-300";
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
              <div key={index} className="bg-[#2D413F] rounded-xl shadow-lg overflow-hidden" data-testid={`booking-card-${item.id}`}>
              <div
                onClick={() => navigate("/businessdetail", { state: item })}
                className="cursor-pointer px-6 py-4 flex md:items-center items-start justify-between flex-col md:flex-row gap-5 md:gap-0"
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
                        <option value="1" disabled={item.status === "2" || item.status === "5"}>Shipped</option>
                        {/* Arrival makes the customs & delivery milestone due (customer is emailed a pay link). */}
                        <option value="5" disabled={item.status === "2"}>Arrived in Jamaica</option>
                        <option value="2">Delivered</option>
                      </select>
                    </div>
                  )}

                  {/* Role 2: Provider - request an extra charge */}
                  {userRole === "2" && (
                    <button
                      onClick={() => setAddCostModal(item)}
                      className="px-5 py-2 rounded-[12px] text-sm font-semibold bg-transparent border border-[#FFC928] text-[#FFC928] hover:bg-[#FFC928] hover:text-black transition"
                    >
                      + Additional Cost
                    </button>
                  )}

                  {/* Print order */}
                  <button
                    onClick={() =>
                      printReceipt(`Shipment Order ${item.orderId || item.id}`, [
                        ["Order ID", item.orderId || item.id],
                        ["Status", getStatusLabel(item.status)],
                        ["Order date", moment(item.createdAt).format("MMM D, YYYY")],
                        ["Freight forwarder", item.driverbook?.firstName],
                        ["Customer", item.userbook ? `${item.userbook.firstName || ""} ${item.userbook.lastName || ""}`.trim() : undefined],
                        ["Origin", item.bookingRequest?.origin],
                        ["Destination", item.bookingRequest?.destination],
                        ["Quantity", item.bookingRequest?.quantity],
                        ["Pickup date", item.bookingRequest?.pickup_date ? moment(item.bookingRequest.pickup_date).format("MMM D, YYYY") : undefined],
                        ["Delivery date", item.bookingRequest?.delivery_date ? moment(item.bookingRequest.delivery_date).format("MMM D, YYYY") : undefined],
                        ["Payment", Number(item.payment_status) === 1 ? "Paid" : "Unpaid"],
                        ["Total", item.total_amount ? `$${item.total_amount}` : undefined],
                        ["Transaction", item.trasaction_id],
                      ])
                    }
                    className="px-5 py-2 rounded-[12px] text-sm font-semibold bg-transparent border border-[#4E6B5D] text-gray-300 hover:bg-white/10 transition flex items-center gap-2"
                  >
                    <Printer size={15} /> Print
                  </button>
                </div>
              </div>

              {/* Payments on this booking — deposit, customs & delivery (due on arrival), forwarder extras */}
              {(item.charges?.length > 0 || item.additionalCosts?.length > 0) && (() => {
                const charges = item.charges?.length ? item.charges : (item.additionalCosts || []).map((c) => ({
                  id: `legacy-${c.id}`, kind: "extra", description: c.description, amount_cents: Math.round(parseFloat(c.amount) * 100),
                  status: c.status === "1" ? "paid" : c.status === "2" ? "cancelled" : "pending", createdAt: c.createdAt, _legacy: c,
                }));
                const label = (c) => c.kind === "deposit" ? "Sea freight & service fee" : c.kind === "customs_delivery" ? (c.description || "Customs & delivery") : c.description;
                const dueNote = (c) => c.kind === "customs_delivery" && c.status === "pending"
                  ? (c.due_at ? "Due now — your barrel has arrived" : "Due when your barrel arrives in Jamaica") : null;
                return (
                  <div className="border-t border-[#4E6B5D]/40 px-6 py-3 space-y-2" onClick={(e) => e.stopPropagation()} data-testid={`charges-${item.id}`}>
                    <p className="text-gray-400 text-xs uppercase tracking-wider font-semibold">Payments</p>
                    {charges.map((c) => (
                      <div key={c.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="text-sm text-gray-200">
                          {label(c)}
                          <span className="text-gray-400"> · {moment(c.paid_at || c.createdAt).format("MMM D")}</span>
                          {dueNote(c) && <span className={`block text-xs ${c.due_at ? "text-[#FFC928]" : "text-gray-400"}`}>{dueNote(c)}</span>}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[#FFC928] font-bold">${(c.amount_cents / 100).toFixed(2)}</span>
                          {c.status === "paid" ? (
                            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-600/30 text-green-300">Paid</span>
                          ) : c.status === "cancelled" ? (
                            // A cancelled charge that had been paid was refunded (booking cancelled); one never paid was simply voided.
                            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-white/10 text-gray-300">{c.paid_at || c.charge_id ? "Refunded" : "Cancelled"}</span>
                          ) : userRole === "1" ? (
                            (c.kind !== "customs_delivery" || c.due_at) ? (
                              <button
                                onClick={() => (c._legacy ? startPayAdditionalCost(c._legacy) : startPayCharge(c))}
                                data-testid={`pay-charge-${c.id}`}
                                className="px-4 py-1.5 rounded-full text-xs font-bold bg-[#FFC928] text-black hover:bg-[#ffe58f] transition"
                              >
                                Pay Now
                              </button>
                            ) : (
                              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-white/10 text-gray-300">Not due yet</span>
                            )
                          ) : (
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${c.kind === "customs_delivery" && !c.due_at ? "bg-white/10 text-gray-300" : "bg-red-600/30 text-red-300"}`}>
                              {c.kind === "customs_delivery" && !c.due_at ? "Due on arrival" : "Unpaid"}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
              </div>
            ))
          )}
        </div>

        {/* Pre-packed barrel orders — current: placed/processing/shipped, past: delivered/cancelled */}
        {(() => {
          const PP_STATUS = { 0: "Placed", 1: "Processing", 2: "Shipped", 3: "Delivered", 4: "Cancelled" };
          const visiblePrepacked = prepackedOrders.filter((o) =>
            activeTab === "current" ? Number(o.status) <= 2 : Number(o.status) >= 3
          );
          return (
            <>
              {visiblePrepacked.length > 0 && (
                <div className="mt-12">
                  <h3 className="text-white text-xl md:text-2xl font-bold mb-6">Pre-Packed Barrel Orders</h3>
                  <div className="space-y-6">
                    {visiblePrepacked.map((o) => (
                      <div key={o.id} className="bg-[#2D413F] rounded-xl px-6 py-4 flex md:items-center items-start justify-between shadow-lg flex-col md:flex-row gap-5 md:gap-0">
                        <div className="flex items-center md:gap-8 gap-4 flex-wrap">
                          <div className="w-[92px] h-[92px] text-[40px] rounded-full bg-[#FFC928] flex items-center justify-center" aria-hidden="true">🛢️</div>
                          <div>
                            <p className="text-white font-semibold text-lg">{o.barrel?.name || "Pre-Packed Barrel"}</p>
                            <p className="text-gray-300 text-sm">Order {o.orderId} · Qty {o.quantity}</p>
                            <p className="text-gray-300 text-sm">
                              {o.delivery_town}, {o.delivery_parish} · {moment(o.createdAt).format("MMM D, YYYY")}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col items-start md:items-end gap-2">
                          <p className="text-[#FFC928] font-bold text-xl">{o.currency} {o.total_price}</p>
                          <div className="flex gap-2 items-center">
                            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${Number(o.payment_status) === 1 ? "bg-green-600/30 text-green-300" : "bg-red-600/30 text-red-300"}`}>
                              {Number(o.payment_status) === 1 ? "Paid" : "Unpaid"}
                            </span>
                            <span className="px-3 py-1 rounded-full text-sm font-semibold bg-[#4E6B5D]/60 text-gray-200">
                              {PP_STATUS[Number(o.status)] || "Placed"}
                            </span>
                            <button
                              onClick={() =>
                                printReceipt(`Pre-Packed Barrel Order ${o.orderId}`, [
                                  ["Order ID", o.orderId],
                                  ["Product", o.barrel?.name || "Pre-Packed Barrel"],
                                  ["Quantity", o.quantity],
                                  ["Unit price", `${o.currency} ${o.unit_price}`],
                                  ["Total", `${o.currency} ${o.total_price}`],
                                  ["Payment", Number(o.payment_status) === 1 ? "Paid" : "Unpaid"],
                                  ["Status", PP_STATUS[Number(o.status)] || "Placed"],
                                  ["Recipient", o.recipient_name],
                                  ["Delivery address", [o.delivery_street, o.delivery_town, o.delivery_parish, o.delivery_country].filter(Boolean).join(", ")],
                                  ["Order date", moment(o.createdAt).format("MMM D, YYYY")],
                                ])
                              }
                              className="px-3 py-1.5 rounded-full text-xs font-semibold bg-transparent border border-[#4E6B5D] text-gray-300 hover:bg-white/10 transition flex items-center gap-1.5"
                            >
                              <Printer size={13} /> Print
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty State */}
              {!loading && orders.length === 0 && visiblePrepacked.length === 0 && (
                <div className="text-center text-gray-400 mt-10">
                  No {activeTab} orders available.
                </div>
              )}
            </>
          );
        })()}
      </div>

      {/* Rating Modal */}
      {ratingModal && (
        <RatingModal
          booking={ratingModal}
          onClose={() => setRatingModal(null)}
          onSuccess={handleRatingSuccess}
        />
      )}

      {/* Provider: request additional cost */}
      {addCostModal && (
        <AddCostModal
          booking={addCostModal}
          onClose={() => setAddCostModal(null)}
          onSuccess={fetchBookings}
        />
      )}

      {/* Customer: pay an additional cost */}
      {payCostModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4 py-6" onClick={() => setPayCostModal(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[#071618] text-xl font-bold mb-1">{payCostModal.charge?.kind === "customs_delivery" ? "Pay Customs & Delivery" : "Pay Additional Cost"}</h3>
            <p className="text-gray-500 text-sm mb-4">{payCostModal.cost.description}</p>
            <Elements stripe={payCostModal.stripePromise} options={{ clientSecret: payCostModal.clientSecret }}>
              <CheckoutForm
                amount={parseFloat(payCostModal.cost.amount).toFixed(2)}
                onSuccess={async (paymentIntent) => {
                  try {
                    if (payCostModal.charge) await confirmCharge(paymentIntent.id);
                    else await confirmAdditionalCostPayment({ paymentId: paymentIntent.id });
                  } catch (e) {
                    console.error("Additional cost confirm failed", e); // webhook reconciles
                  }
                  setPayCostModal(null);
                  fetchBookings();
                }}
                onCancel={() => setPayCostModal(null)}
              />
            </Elements>
          </div>
        </div>
      )}
    </div>
  );
};

export default History;
