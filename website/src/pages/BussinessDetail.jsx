import React, { useState, useEffect, useRef } from 'react'
import moment from "moment";
import Commonbanner from "../components/Commonbanner";
import { tick, check, card, file as fileIcon, pdf } from "../common/common-assets/assets-images";
import { useNavigate, useLocation } from 'react-router-dom';
import { updateBookingStatus, getBookingDetail, getAddons, getServiceFeePercent } from '../api/cms';
import {
  getServiceFeePercentFromAddons,
  calculateBarrelPricing,
  calculateBarrelBasedFees,
} from '../utils/pricing';
import { toast } from 'sonner';
import { Printer } from 'lucide-react';
import { API_URL } from '../api/axios';

const BuisnessDetail = () => {
  const [openModal, setOpenModal] = useState(false);
  const [openSuccessModal, setOpenSuccessModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [userRole, setUserRole] = useState(null);
  const [bookingData, setBookingData] = useState(null);
  const [adminCommValue, setAdminCommValue] = useState("0");
  const [serviceFeePercentValue, setServiceFeePercentValue] = useState("0");

  const [availableAddons, setAvailableAddons] = useState([]);

  const navigate = useNavigate();
  const location = useLocation();
  const stateBooking = location.state;
  const printContentRef = useRef(null);

  const handlePrint = () => {
  const el = printContentRef.current;
  if (!el) return;

  const iframe = document.createElement('iframe');
  iframe.setAttribute(
    'style',
    'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden'
  );
  iframe.setAttribute('title', 'Print');
  document.body.appendChild(iframe);

  const win = iframe.contentWindow;
  const doc = win?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    toast.error('Unable to open print view.');
    return;
  }

  const styleLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
    .map((link) => `<link rel="stylesheet" href="${link.href}" />`)
    .join('\n');
  doc.open();
  doc.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Business Detail</title>
  ${styleLinks}
  <style>
    /* Force everything to fit on one page */
    @page { 
      size: letter portrait; 
      margin: 6mm; /* Reduced margins to fit more content */
    }
    
    html, body {
      margin: 0;
      padding: 4mm; /* Reduced padding */
      background: #0E1F17 !important;
      color: #fff;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      font-size: 9.5px; /* Slightly smaller font */
      line-height: 1.2; /* Tighter line height */
      min-height: 0 !important;
      height: auto !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    
    /* Prevent page breaks */
    .bussiness-detail-print-root {
      max-width: 100%;
      min-height: 0 !important;
      height: auto !important;
      page-break-after: avoid !important;
      page-break-inside: avoid !important;
      break-after: avoid !important;
      break-inside: avoid !important;
    }
    
    /* Remove the page break element */
    .bussiness-detail-print-break {
      display: none !important; /* Hide the break element */
    }
    
    .bussiness-detail-print-root > * + * { 
      margin-top: 4px; /* Reduced spacing */
    }
    
    /* Ensure all blocks stay together */
    .bussiness-detail-print-block {
      background: #2D413F !important;
      border-radius: 8px;
      padding: 10px 14px !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      page-break-after: avoid !important;
      break-after: avoid !important;
      margin-bottom: 4px !important; /* Reduced spacing */
    }
    
    .bussiness-detail-print-block-header {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    
    /* Compact spacing */
    .bussiness-detail-print-block .mt-4 { margin-top: 6px !important; }
    .bussiness-detail-print-block .mb-4 { margin-bottom: 4px !important; }
    .bussiness-detail-print-block .mt-6 { margin-top: 6px !important; }
    
    /* Smaller fonts and compact layouts */
    .bussiness-detail-print-section-title {
      font-size: 11px !important;
      font-weight: 700;
      color: #FFBF00 !important;
      margin: 0 0 4px 0 !important;
      padding-bottom: 1px;
      text-align: left;
    }
    
    /* Smaller avatar */
    .bussiness-detail-print-avatar {
      width: 40px !important;
      height: 40px !important;
      min-width: 40px;
      flex-shrink: 0;
    }
    
    /* More compact grids */
    .bussiness-detail-print-grid-2 {
      display: grid !important;
      grid-template-columns: 1fr 1fr !important;
      gap: 4px 10px !important;
      align-items: start;
    }
    
    .bussiness-detail-print-grid-2-cards {
      display: grid !important;
      grid-template-columns: 1fr 1fr !important;
      gap: 4px !important;
      align-items: start;
    }
    
    .bussiness-detail-print-grid-booking {
      display: grid !important;
      grid-template-columns: 1fr 1fr 1fr !important;
      gap: 4px !important;
      align-items: stretch;
    }
    
    /* Compact fields */
    .bussiness-detail-print-field {
      display: flex;
      flex-direction: column;
      min-width: 0;
      text-align: left;
      padding: 3px 6px;
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.04);
    }
    
    .bussiness-detail-print-field > span:first-child {
      font-size: 7px;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: rgba(255,255,255,0.55);
      margin-bottom: 1px;
    }
    
    .bussiness-detail-print-field > span:last-child {
      font-size: 9px;
      font-weight: 500;
      color: #fff;
      word-break: break-word;
      line-height: 1.3;
    }
    
    /* Compact meta */
    .bussiness-detail-print-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 10px;
      margin-top: 4px;
      padding: 6px 10px;
      border: 1px solid #676767;
      border-radius: 6px;
      font-size: 9px;
      line-height: 1.3;
    }
    
    .bussiness-detail-print-meta p { 
      margin: 0; 
      padding: 1px 0; 
    }
    
    /* Compact booking tiles */
    .bussiness-detail-print-booking-tile {
      padding: 6px 8px !important;
    }
    
    .bussiness-detail-print-booking-tile p {
      font-size: 9px !important;
      margin: 0 !important;
    }
    
    .bussiness-detail-print-booking-tile .text-lg {
      font-size: 11px !important;
    }
    
    /* Smaller headings */
    .bussiness-detail-print-block h4 {
      font-size: 14px !important;
      line-height: 1.1;
      margin: 0 0 2px 0 !important;
    }
    
    .bussiness-detail-print-block h5 {
      font-size: 11px !important;
      line-height: 1.1;
      margin: 0 0 2px 0 !important;
    }
    
    img { max-width: 100%; height: auto; }
    
    /* Make text smaller and more compact */
    .bussiness-detail-print-header {
      display: flex !important;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: flex-start;
      gap: 6px;
    }
    
    .bussiness-detail-print-header-left {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 1;
      min-width: 0;
    }
    
    .bussiness-detail-print-header-right { 
      text-align: right; 
      flex-shrink: 0; 
    }
    
    /* Force everything to fit in one page */
    .bussiness-detail-print-shell {
      max-height: 100vh !important;
      overflow: visible !important;
    }
    
    /* Hide any overflow that might cause second page */
    .bussiness-detail-print-grid {
      overflow: visible !important;
    }
  </style>
</head>
<body>
  <div class="bussiness-detail-print-root">
    ${el.innerHTML}
  </div>
</body>
</html>`);
  doc.close();

  const cleanup = () => {
    if (iframe.parentNode) document.body.removeChild(iframe);
  };

  const runPrint = () => {
    try {
      win.focus();
      win.print();
    } finally {
      setTimeout(cleanup, 500);
    }
  };

  const links = doc.querySelectorAll('link[rel="stylesheet"]');
  if (links.length === 0) {
    setTimeout(runPrint, 100);
    return;
  }

  let loaded = 0;
  const onReady = () => {
    loaded += 1;
    if (loaded >= links.length) setTimeout(runPrint, 150);
  };
  links.forEach((link) => {
    link.addEventListener('load', onReady);
    link.addEventListener('error', onReady);
  });
  setTimeout(runPrint, 2000);
};
  useEffect(() => {
    const fetchDetail = async () => {
      // Use ID from state if available
      const bookingId = stateBooking?.id;
      console.log("Booking ID:---------------", stateBooking);
      if (!bookingId) {
        toast.error("No booking ID found");
        navigate('/history');
        return;
      }

      setFetching(true);
      try {
        const response = await getBookingDetail(bookingId);
        console.log("Booking Detail:---------------", response);
        if (response.status) {
          setBookingData(response.body.booking);
          setAdminCommValue(response.body.adminCommission || "0");
          setServiceFeePercentValue(response.body.serviceFeePercent || "0");
        } else {
          toast.error(response.message || "Failed to fetch booking details");
          if (!stateBooking) navigate('/history');
        }
      } catch (error) {
        console.error("Error fetching booking detail:", error);
        if (!stateBooking) {
          toast.error("Something went wrong");
          navigate('/history');
        }
      } finally {
        setFetching(false);
      }
    };

    fetchDetail();

    const fetchAddonsData = async () => {
      let loadedFeePercent = false;
      try {
        const feeRes = await getServiceFeePercent();
        if (feeRes.success && feeRes.body?.serviceFeePercent != null) {
          const pct = parseFloat(feeRes.body.serviceFeePercent);
          if (!Number.isNaN(pct) && pct > 0) {
            setServiceFeePercentValue(String(pct));
            loadedFeePercent = true;
          }
        }
      } catch (err) {
        console.error("Error fetching service fee percent:", err);
      }
      try {
        const res = await getAddons();
        if (res.success) {
          setAvailableAddons(res.body);
          if (!loadedFeePercent) {
            const pct = getServiceFeePercentFromAddons(res.body);
            if (pct > 0) setServiceFeePercentValue(String(pct));
          }
        }
      } catch (err) {
        console.error("Error fetching add-ons:", err);
      }
    };
    fetchAddonsData();

    const user = JSON.parse(localStorage.getItem("user") || "{}");
    setUserRole(user.role);
  }, [stateBooking?.id, navigate]);

  const booking = bookingData || stateBooking;
  const adminCommission = adminCommValue || stateBooking?.adminCommission;
  const parsedFeeFromState = parseFloat(serviceFeePercentValue);
  const serviceFeePercent =
    (parsedFeeFromState > 0 ? parsedFeeFromState : getServiceFeePercentFromAddons(availableAddons)) || 0;

  if (fetching && !booking) {
    return (
      <div className="min-h-screen bg-[#0a1612] flex items-center justify-center text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-400"></div>
      </div>
    );
  }

  if (!booking) return null;

  // Data extraction - same pattern as ShipmentDetailsSection
  const user = booking.userbook || {};
  const bookingRequest = booking.bookingRequest || {};
  // providerDetail comes from driverbook.businessInfo (new relation added in getBookings)
  const providerDetail = booking.driverbook?.businessInfo || {};

  console.log("booking", booking);
  console.log("bookingRequest", bookingRequest);
  console.log("providerDetail", providerDetail);

  const userName = `${user.firstName || ''}`.trim() || 'Unknown User';
  const initials = userName.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  const items = bookingRequest.items || [];
  const itemType = items.length > 0 ? (items[0].item_type || "Parcel") : (bookingRequest.item_type || "Parcel");
  const itemSubTypes = items.length > 0 ? (items[0].sub_type || "N/A") : (bookingRequest.sub_type || "N/A");

  const quantity = bookingRequest ? parseInt(bookingRequest.quantity || 0) : 0;

  let barrelPriceObj = null;
  const isShipYourOwn = !bookingRequest?.drop_off_address;
  const type = isShipYourOwn ? 'own' : 'dropoff';

  if (providerDetail?.barrelPrices && Array.isArray(providerDetail.barrelPrices)) {
    barrelPriceObj = providerDetail.barrelPrices.find(bp => {
      const bpType = (bp.type || "").toLowerCase().trim();
      return bpType === type;
    });
  }

  const basePrice = booking?.base_price ? parseFloat(booking.base_price) : (barrelPriceObj ? parseFloat(barrelPriceObj.basePrice || 0) : (providerDetail ? parseFloat(providerDetail.basePrice || 0) : 0));
  const perBarrelPrice = booking ? parseFloat(booking.bookingPrice || 0) : 0;

  const storedBarrelDiscount =
    booking?.barrel_discount != null && booking?.barrel_discount !== ""
      ? booking.barrel_discount
      : null;

  const isVolumeDiscount =
    booking?.isVolumeDiscount == 1 || booking?.isVolumeDiscount === true;

  const {
    barrelPrice: itemPrice,
    barrelDiscount: volumeDiscount,
    discountApplies,
    discountPercent,
    discountAfter,
    listTotal: totalWithoutDiscount,
  } = calculateBarrelPricing({
    quantity,
    perBarrelPrice,
    isVolumeDiscount: booking?.isVolumeDiscount,
    discountAfter: booking?.discountAfter,
    discountPercent: booking?.discountPercent,
    storedBarrelDiscount,
  });

  const totalBarrelCost = itemPrice;
  // Calculate Distance (Haversine Formula)
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
    const R = 3958.8; // Radius of Earth in miles
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const flatDeliveryFee = parseFloat(barrelPriceObj?.pricePerMile ?? providerDetail?.pricePerMile ?? 0) || 0;
  let deliveryFee = flatDeliveryFee;

  const getCustomsFeeForQty = (rawVal, qty) => {
    if (!rawVal) return 0;
    const str = String(rawVal);
    const parts = str.split(",");
    if (parts.length === 25) {
      const index = Math.min(Math.max(1, qty), 25) - 1;
      return parseFloat(parts[index] || 0) || 0;
    }
    return (parseFloat(parts[0] || 0) || 0) * qty;
  };

  const totalCustomsFee = getCustomsFeeForQty(
    barrelPriceObj?.customsAndHandling ?? providerDetail?.customsAndHandling,
    quantity
  );
  const customsAndHandlingFee = totalCustomsFee;
  let distance = 0;
  if (isShipYourOwn) {
    const pickupStartLat = parseFloat(bookingRequest?.origin_lat || barrelPriceObj?.originLat || 0);
    const pickupStartLng = parseFloat(bookingRequest?.origin_long || barrelPriceObj?.originLong || 0);
    const pickupEndLat = parseFloat(booking?.shiper_lat || 0);
    const pickupEndLng = parseFloat(booking?.shiper_lng || 0);
    const deliveryStartLat = parseFloat(bookingRequest?.destination_lat || barrelPriceObj?.destinationLat || 0);
    const deliveryStartLng = parseFloat(bookingRequest?.destination_long || barrelPriceObj?.destinationLong || 0);
    const deliveryEndLat = parseFloat(booking?.consignee_lat || 0);
    const deliveryEndLng = parseFloat(booking?.consignee_lng || 0);
    distance =
      calculateDistance(pickupStartLat, pickupStartLng, pickupEndLat, pickupEndLng) +
      calculateDistance(deliveryStartLat, deliveryStartLng, deliveryEndLat, deliveryEndLng);
  } else {
    const startLat = parseFloat(bookingRequest?.destination_lat || barrelPriceObj?.destinationLat || 0);
    const startLng = parseFloat(bookingRequest?.destination_long || barrelPriceObj?.destinationLong || 0);
    const endLat = parseFloat(bookingRequest?.drop_off_lat || booking?.consignee_lat || 0);
    const endLng = parseFloat(bookingRequest?.drop_off_long || booking?.consignee_lng || 0);
    distance = calculateDistance(startLat, startLng, endLat, endLng);
    if (distance === 0 && providerDetail?.distance) {
      distance = providerDetail.distance;
    }
  }

  let subtotal = itemPrice;
  let actualAdminCommission = parseFloat(booking?.adminCommission ?? adminCommission ?? 0) || 0;
  const actualServiceFeePercent = parseFloat(serviceFeePercent) || 0;

  let { commissionAmount: adminPrice, serviceFeeAmount } = calculateBarrelBasedFees(
    itemPrice,
    actualAdminCommission,
    actualServiceFeePercent
  );
  const shouldAddCustomsFee = customsAndHandlingFee > 0;


  let finalTotal = subtotal +
    (shouldAddCustomsFee ? customsAndHandlingFee : 0) +
    deliveryFee +
    adminPrice +
    serviceFeeAmount;
  let amountPaid = finalTotal;

  const isEndUser = userRole === "1";
  const bundledServiceFee = deliveryFee +
    (shouldAddCustomsFee ? customsAndHandlingFee : 0) +
    adminPrice +
    serviceFeeAmount;
  const endUserDisplayServiceFeeAmount = adminPrice + serviceFeeAmount;
  const endUserDisplayServiceFeePercent = actualAdminCommission + actualServiceFeePercent;
  let barrel_discount = volumeDiscount;
  if (booking?.total_distance !== null && booking?.total_distance !== undefined) {
    distance = parseFloat(booking.total_distance);
  }
  if (booking?.delivery_fee !== null && booking?.delivery_fee !== undefined) {
    const storedDelivery = parseFloat(booking.delivery_fee);
    if (!Number.isNaN(storedDelivery) && storedDelivery > 0) {
      deliveryFee = storedDelivery;
    }
  }
  if (booking.pay_now_price != "" && booking.pay_now_price != null) {
    amountPaid = parseFloat(booking.pay_now_price);
  }
  if (booking.total_amount != "" && booking.total_amount != null) {
    finalTotal = parseFloat(booking.total_amount);
    if (booking.payment_status == "1") {
      amountPaid = finalTotal;
    }
  }
  if (booking.subtotal != "" && booking.subtotal != null) {
    subtotal = parseFloat(booking.subtotal);
  }
  if (booking?.barrel_discount != "" && booking?.barrel_discount != null) {
    barrel_discount = parseFloat(booking.barrel_discount);
  }

  const feesFromBarrel = calculateBarrelBasedFees(
    itemPrice,
    actualAdminCommission,
    actualServiceFeePercent
  );
  adminPrice = feesFromBarrel.commissionAmount;
  serviceFeeAmount = feesFromBarrel.serviceFeeAmount;

  if (booking.payment_status != "1") {
    finalTotal = subtotal + customsAndHandlingFee + deliveryFee + adminPrice + serviceFeeAmount;
    amountPaid = finalTotal;
  }
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
      case "0": return "text-yellow-400"; // Pending
      case "1": return "text-blue-400"; // Shipped
      case "2": return "text-green-400"; // Delivered
      case "3": return "text-orange-400"; // Dispatched
      case "4": return "text-green-500"; // Completed
      default: return "text-[#FF9900]"; // Others
    }
  };

  const handleStatusUpdate = async (status) => {
    setLoading(true);
    try {
      const response = await updateBookingStatus({
        bookingId: booking.id,
        status: status
      });
      if (response.status) {
        toast.success(status === '3' ? "Request Accepted" : "Request Rejected");
        navigate(status === '3' ? '/history' : '/request');
      } else {
        toast.error(response.message || "Failed to update status");
      }
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
      setOpenModal(false);
      setOpenSuccessModal(false);
    }
  };

  const PrintInfoRow = ({ label, value }) =>
    value ? (
      <div className="bussiness-detail-print-field flex flex-col py-1.5 px-2">
        <span className="text-white/50 text-xs uppercase tracking-wider mb-1.5">{label}</span>
        <span className="text-white font-medium leading-relaxed">{value}</span>
      </div>
    ) : null;

  return (
    <div className="bussiness-detail-page">
      <div className="bussiness-detail-no-print">
        <Commonbanner title="Payment Overview" />
      </div>
      <div className="w-full bg-[#0E1F17] px-4 md:px-8 py-4 bussiness-detail-no-print flex justify-center">
        <button
          type="button"
          onClick={handlePrint}
          className="flex items-center gap-2 bg-[#2D413F] hover:bg-[#3a5650] text-white border border-[#4E6B5D] px-4 py-2.5 rounded-full text-sm font-semibold transition-all hover:scale-[1.02]"
          aria-label="Print page"
        >
          <Printer size={18} />
          Print
        </button>
      </div>
      <div className="w-full bg-[#0E1F17] py-15 px-4 md:px-8 pt-0 bussiness-detail-print-shell">
        <div className="container mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6 bussiness-detail-print-grid">

          {/* LEFT CONTENT — only this section prints */}
          <div
            ref={printContentRef}
            className="lg:col-span-2 bussiness-detail-print-only bussiness-detail-print-root"
          >
            {/* User/Shipper Card */}
            <div className="bg-[#2D413F] rounded-xl p-[25px] text-white bussiness-detail-print-block bussiness-detail-print-block-header mb-2">
              <div className="flex items-center justify-between flex-wrap gap-3 bussiness-detail-print-header">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bussiness-detail-print-header-left">
                  <div className="
                    bussiness-detail-print-avatar
                    w-[70px] h-[70px] sm:w-[80px] sm:h-[80px]
                    rounded-full
                    flex items-center justify-center
                    bg-[radial-gradient(circle_at_center,#FFD95A_0%,#FFC928_45%,#FFB800_100%)]
                  ">
                    {userRole === "1" ? (
                      booking.driverbook?.image ? (
                        <img src={`${API_URL}${booking.driverbook.image}`} alt="Provider" className="w-full h-full rounded-full object-cover" />
                      ) : (
                        <span className="text-black text-[32px] sm:text-[36px] font-bold">
                          {providerDetail.businessName?.substring(0, 2).toUpperCase() || "P"}
                        </span>
                      )
                    ) : (
                      // user.image ? (
                      //   <img src={`${API_URL}${user.image}`} alt={userName} className="w-full h-full rounded-full object-cover" />
                      // ) : (
                      <span className="text-black text-[32px] sm:text-[36px] font-bold">{initials}</span>
                      // )
                    )}
                  </div>
                  <div>
                    <h4 className="font-bold text-[20px] sm:text-[25px]">
                      {userRole === "1" ? booking.driverbook?.firstName : userName}
                    </h4>
                    <div className="flex items-start gap-2 text-sm text-white">
                      <span className="ms-1 text-[13px] font-semibold gap-1 flex align-middle">
                        <img src={tick} alt="verified" />Verified {userRole === "1" ? "Provider" : "User"}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col text-start sm:text-end bussiness-detail-print-header-right">
                  <p className={`text-[16px] font-bold mb-1 ${getStatusColor(booking.status)}`}>
                    {getStatusLabel(booking.status)}
                  </p>
                  <p className="text-gray-400 text-sm">Order ID: {booking.orderId || booking.id}</p>
                </div>
              </div>

              <div className="mt-4">
                <h5 className="font-bold text-lg mb-2 bussiness-detail-print-section-title">Descriptions</h5>
                <p className="text-gray-300 text-md leading-relaxed">
                  {userRole === "1" ? (providerDetail.description || "No description provided.") : (bookingRequest.description || "No description provided.")}
                </p>
              </div>

              <div className="mt-4 flex flex-wrap gap-10 text-sm text-gray-200 border-1 p-4 px-5 rounded-[10px] border-[#676767] bussiness-detail-print-meta">
                <p><span className="text-white">Desired Delivery Date:</span> {bookingRequest.delivery_date ? moment(bookingRequest.delivery_date).format("MM/DD/YYYY") : 'N/A'}</p>
                {userRole !== "1" && (
                  <p><span className="text-white">Base Price:</span> ${basePrice.toFixed(2)}</p>
                )}
              </div>
            </div>

            {/* Customs Handling Policies */}
            {/* <div className="text-white">
              <h5 className="font-bold text-lg mb-3">Customs Handling Policies</h5>
              <ul className="space-y-2 text-sm text-gray-300">
                <li className="flex text-[16px] items-center gap-3">
                  <img src={check} alt="check" />
                  {providerDetail?.deliveryPolicy || "Standard customs handling applies"}
                </li>
              </ul>
            </div> */}

            {/* Address & Contact Details */}
            {!isShipYourOwn ? (
              <>
                <div className="bg-[#2D413F] rounded-xl p-5 text-white grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm bussiness-detail-print-block bussiness-detail-print-grid-2 mb-2">
                  <div>
                    <p className="text-white font-semibold text-md mb-3">
                      <i className="fa-solid fa-user text-[#FFBF00] me-3"></i>Name
                    </p>
                    <p className="text-gray-100">{bookingRequest.name || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-white font-semibold text-md mb-3">
                      <i className="fa-solid fa-location-dot text-[#FFBF00] me-3"></i>Drop Off Address
                    </p>
                    <p>{bookingRequest.drop_off_address || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-white font-semibold text-md mb-3">
                      <i className="fa-solid fa-location-dot text-[#FFBF00] me-3"></i>Street Address
                    </p>
                    <p>{bookingRequest.streetAddress || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-white font-semibold text-md mb-3">
                      <i className="fa-solid fa-location-dot text-[#FFBF00] me-3"></i>City
                    </p>
                    <p>{bookingRequest.city || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-white font-semibold text-md mb-3">
                      <i className="fa-solid fa-location-dot text-[#FFBF00] me-3"></i>State
                    </p>
                    <p>{bookingRequest.state || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-white font-semibold text-md mb-3">
                      <i className="fa-solid fa-building text-[#FFBF00] me-3"></i>Suite/Apt/Building
                    </p>
                    <p>{bookingRequest.suite_apt_building || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-white font-semibold text-md mb-3">
                      <i className="fa-solid fa-location-dot text-[#FFBF00] me-3"></i>Origin
                    </p>
                    <p>{bookingRequest.origin || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-white font-semibold text-md mb-3">
                      <i className="fa-solid fa-location-dot text-[#FFBF00] me-3"></i>Destination
                    </p>
                    <p>{bookingRequest.destination || "N/A"}</p>
                  </div>
                </div>

                <div className="bg-[#2D413F] rounded-xl p-5 text-white grid grid-cols-1 md:grid-cols-3 gap-4 text-sm bussiness-detail-print-block bussiness-detail-print-grid-2 mb-2">
                  <div>
                    <p className="text-white font-semibold text-md mb-3">
                      <i className="fa-solid fa-phone text-[#FFBF00] me-3"></i>Phone
                    </p>
                    <p className="text-gray-100">{bookingRequest.phone || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-white font-semibold text-md mb-3">
                      <i className="fa-solid fa-envelope text-[#FFBF00] me-3"></i>Email
                    </p>
                    <p className="text-gray-100">{bookingRequest.email || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-white font-semibold text-md mb-3">
                      <i className="fa-brands fa-whatsapp text-[#FFBF00] me-3"></i>WhatsApp
                    </p>
                    <p className="text-gray-100">{bookingRequest.whatsapp || "N/A"}</p>
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-[#2D413F] rounded-xl p-6 text-white bussiness-detail-print-block mb-2">
                <h5 className="font-bold text-lg mb-4 text-yellow-400 bussiness-detail-print-section-title">Primary Recipient Contact</h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm bussiness-detail-print-grid-2">
                  <PrintInfoRow label="First Name" value={booking.primary_firstName} />
                  <PrintInfoRow label="Last Name" value={booking.primary_lastName} />
                  <PrintInfoRow label="Phone" value={booking.primary_phone_number} />
                  <PrintInfoRow label="Email" value={booking.primary_email} />
                  <PrintInfoRow label="Address" value={booking.primary_address} />
                  <PrintInfoRow label="Street Address" value={booking.primary_streetAddress} />
                  <PrintInfoRow label="City" value={booking.primary_city} />
                  <PrintInfoRow label="State" value={booking.primary_state} />
                  <PrintInfoRow label="Suite/Apt/Building" value={booking.primary_suite_apt_building} />
                </div>
              </div>
            )}

            {isShipYourOwn &&
              (booking.secondary_firstName ||
                booking.secondary_lastName ||
                booking.secondary_email ||
                booking.secondary_phone_number) && (
                <div className="bg-[#2D413F] rounded-xl p-6 text-white bussiness-detail-print-block mb-2">
                  <h5 className="font-bold text-lg mb-4 text-yellow-400 bussiness-detail-print-section-title">
                    Secondary Recipient Contact
                  </h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm bussiness-detail-print-grid-2">
                    <PrintInfoRow label="First Name" value={booking.secondary_firstName} />
                    <PrintInfoRow label="Last Name" value={booking.secondary_lastName} />
                    <PrintInfoRow label="Phone" value={booking.secondary_phone_number} />
                    <PrintInfoRow label="Email" value={booking.secondary_email} />
                    <PrintInfoRow label="Address" value={booking.secondary_address} />
                    <PrintInfoRow label="Street Address" value={booking.secondary_streetAddress} />
                    <PrintInfoRow label="City" value={booking.secondary_city} />
                    <PrintInfoRow label="State" value={booking.secondary_state} />
                    <PrintInfoRow label="Suite/Apt/Building" value={booking.secondary_suite_apt_building} />
                  </div>
                </div>
              )}

            {isShipYourOwn && <div className="bussiness-detail-print-break" aria-hidden="true" />}

            {isShipYourOwn && (
              <>
                {/* Shipper & Delivery Addresses */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bussiness-detail-print-grid-2-cards">
                  <div className="bg-[#2D413F] rounded-xl p-6 text-white bussiness-detail-print-block mb-2">
                    <h5 className="font-bold text-lg mb-4 text-yellow-400 bussiness-detail-print-section-title">Shipper Address</h5>
                    <div className="grid grid-cols-1 gap-3 text-sm bussiness-detail-print-grid-2">
                      <PrintInfoRow label="First Name" value={booking.shiper_firstName} />
                      <PrintInfoRow label="Last Name" value={booking.shiper_lastName} />
                      <PrintInfoRow label="Email" value={booking.shiper_email} />
                      <PrintInfoRow label="Phone" value={booking.shiper_phone_number} />
                      <PrintInfoRow label="Address" value={booking.shiper_address} />
                      <PrintInfoRow label="Street Address" value={booking.shiper_streetAddress} /> {/* Added */}
                      <PrintInfoRow label="City" value={booking.shiper_city} /> {/* Added */}
                      <PrintInfoRow label="State" value={booking.shiper_state} /> {/* Added */}
                      <PrintInfoRow label="Suite/Apt/Building" value={booking.shiper_suite_apt_building} />
                    </div>
                  </div>
                  <div className="bg-[#2D413F] rounded-xl p-6 text-white bussiness-detail-print-block mb-2">
                    <h5 className="font-bold text-lg mb-4 text-yellow-400 bussiness-detail-print-section-title">Delivery Address</h5>
                    <div className="grid grid-cols-1 gap-3 text-sm bussiness-detail-print-grid-2">
                      <PrintInfoRow label="First Name" value={booking.consignee_firstName} />
                      <PrintInfoRow label="Last Name" value={booking.consignee_lastName} />
                      <PrintInfoRow label="Email" value={booking.consignee_email} />
                      <PrintInfoRow label="Phone" value={booking.consignee_phone_number} />
                      <PrintInfoRow label="Address" value={booking.consignee_address} />
                      <PrintInfoRow label="Street Address" value={booking.consignee_streetAddress} /> {/* Added */}
                      <PrintInfoRow label="City" value={booking.consignee_city} /> {/* Added */}
                      <PrintInfoRow label="State" value={booking.consignee_state} /> {/* Added */}
                      <PrintInfoRow label="Suite/Apt/Building" value={booking.consignee_suite_apt_building} />
                    </div>
                  </div>
                </div>
              </>
            )}

            {!isShipYourOwn && <div className="bussiness-detail-print-break" aria-hidden="true" />}

            {/* Booking Details */}
            <div className="bg-[#2D413F] rounded-xl p-6 text-white bussiness-detail-print-block">
              <h5 className="font-bold text-lg mb-4 bussiness-detail-print-section-title">Booking Details</h5>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 bussiness-detail-print-grid-booking">
                <div className="bg-white/5 p-4 rounded-xl border border-white/10 bussiness-detail-print-booking-tile">
                  <p className="text-[#FFBF00] font-semibold text-sm mb-2 uppercase tracking-wider">Item Type</p>
                  <p className="text-lg font-bold">{itemType}</p>
                </div>
                <div className="bg-white/5 p-4 rounded-xl border border-white/10 bussiness-detail-print-booking-tile">
                  <p className="text-[#FFBF00] font-semibold text-sm mb-2 uppercase tracking-wider">Service Type</p>
                  <p className="text-lg font-bold">{itemSubTypes}</p>
                </div>
                <div className="bg-white/5 p-4 rounded-xl border border-white/10 bussiness-detail-print-booking-tile">
                  <p className="text-[#FFBF00] font-semibold text-sm mb-2 uppercase tracking-wider">Quantity</p>
                  <p className="text-lg font-bold">{quantity}</p>
                </div>
                {userRole !== "1" && isVolumeDiscount && discountAfter > 0 && discountPercent > 0 && (
                  <div className="bg-white/5 p-4 rounded-xl border border-white/10 bussiness-detail-print-booking-tile sm:col-span-2 lg:col-span-3">
                    <p className="text-[#FFBF00] font-semibold text-sm mb-2 uppercase tracking-wider">Volume Discount</p>
                    <p className="text-lg font-bold text-green-400">
                      {discountPercent}% off after {discountAfter} barrels
                    </p>
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Uploaded Documents */}
          {/* <div className="bg-[#2D413F] rounded-xl p-5 text-white">
              <h5 className="font-bold text-lg mb-4">Uploaded Documents</h5>
              {booking.document ? (
                <div className="rounded-xl border border-white/10 overflow-hidden">
                  Large Preview
                  <a
                    href={`${API_URL}${booking.document}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    {booking.document.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                      <img
                        src={`${API_URL}${booking.document}`}
                        alt="Uploaded Document"
                        className="w-full max-h-[320px] object-contain bg-black/30 cursor-pointer"
                        onError={(e) => {
                          // If image fails (e.g. PDF), maybe show something else or just let it be
                          // But user specifically said show image
                        }}
                      /> */}
          {/* ) : (
                      <div className="flex items-center gap-4 p-4 bg-white/5 cursor-pointer">
                        <img
                          src={booking.document.endsWith('.pdf') ? pdf : fileIcon}
                          alt="File"
                          className="w-16 h-16 object-contain"
                        />
                        <div>
                          <p className="text-[#FFBF00] font-semibold text-sm uppercase tracking-wider mb-1">Document</p>
                          <p className="text-sm text-gray-300 truncate max-w-[250px]">{booking.document.split('/').pop()}</p>
                          <span className="text-yellow-400 text-xs underline mt-1 block">Open File</span>
                        </div>
                      </div>
                    )} */}
          {/* </a>
                </div>
              ) : (
                <div className="bg-white/5 p-6 rounded-xl border border-dashed border-white/20 flex flex-col items-center gap-3 text-center">
                  <img src={fileIcon} alt="No Document" className="w-12 h-12 opacity-30" />
                  <p className="text-gray-400 text-sm">No document uploaded yet</p>
                </div>
              )}
            </div> */}

          {/* RIGHT CONTENT */}
          <div className="space-y-6 text-center bussiness-detail-no-print">

            {/* Order Summary */}
            <div className="bg-white rounded-xl p-5 bussiness-detail-no-print">
              <h4 className="font-bold text-lg mb-3 text-start">Order Summary</h4>
              <div className="text-sm space-y-2">
                <div className="flex justify-between items-start">
                  <div className="text-start">
                    <span className='text-[16px] font-semibold text-black block'>
                      {userRole === "1" ? "Barrel price" : `${quantity} x Barrel @ $${perBarrelPrice.toFixed(2)}`}
                    </span>
                    {discountApplies && (
                      <span className='text-[11px] font-medium text-black/40 block -mt-1'>
                        (all {quantity} barrels at {discountPercent}% off)
                      </span>
                    )}
                  </div>
                  <span className='text-[14px] font-semibold text-black/80'>${totalBarrelCost.toFixed(2)}</span>
                </div>
                {userRole !== "1" && barrel_discount > 0 && (
                  <div className="flex justify-between">
                    <span className='text-[16px] font-semibold text-green-600'>Volume Discount</span>
                    <span className='text-[14px] font-semibold text-green-600'>-${barrel_discount.toFixed(2)}</span>
                  </div>
                )}
                {userRole !== "1" && (
                  <div className="flex justify-between">
                    <span className='text-[16px] font-semibold text-black'>Base Price</span>
                    <span className='text-[14px] font-semibold text-black/80'>${basePrice.toFixed(2)}</span>
                  </div>
                )}
                {userRole !== "1" && shouldAddCustomsFee && customsAndHandlingFee > 0 && (
                  <div className="flex justify-between">
                    <span className='text-[16px] font-semibold text-black'>Customs and handling</span>
                    <span className='text-[14px] font-semibold text-black/80'>${totalCustomsFee.toFixed(2)}</span>
                  </div>
                )}

                {/* {userRole !== "1" && (
                  <div className="flex justify-between">
                    <span className='text-[16px] font-semibold text-black'>Subtotal</span>
                    <span className='text-[14px] font-semibold text-black/80'>${subtotal.toFixed(2)}</span>
                  </div>
                )} */}
                {userRole === "1" && shouldAddCustomsFee && customsAndHandlingFee > 0 && (
                  <div className="flex justify-between">
                    <span className='text-[16px] font-semibold text-black'>Customs and handling</span>
                    <span className='text-[14px] font-semibold text-black/80'>${totalCustomsFee.toFixed(2)}</span>
                  </div>
                )}
                {userRole === "1" ? (
                  <>

                    {deliveryFee !== 0 && (
                      <div className="flex justify-between">
                        <span className='text-[16px] font-semibold text-black'>Delivery</span>
                        <span className='text-[14px] font-semibold text-black/80'>${deliveryFee.toFixed(2)}</span>
                      </div>
                    )}
                    {(endUserDisplayServiceFeeAmount > 0 ||
                      endUserDisplayServiceFeePercent > 0) && (
                        <div className="flex justify-between">
                          <span className='text-[16px] font-semibold text-black'>
                            Service Fee
                          </span>
                          <span className='text-[14px] font-semibold text-black/80'>
                            ${endUserDisplayServiceFeeAmount.toFixed(2)}
                          </span>
                        </div>
                      )}
                  </>
                ) : (
                  <>
                    {deliveryFee !== 0 && (
                      <div className="flex justify-between">
                        <span className='text-[16px] font-semibold text-black'>Delivery</span>
                        <span className='text-[14px] font-semibold text-black/80'>${deliveryFee.toFixed(2)}</span>
                      </div>
                    )}
                    {/* <div className="flex justify-between">
                      <span className='text-[16px] font-semibold text-black'>Admin Commission </span>
                      <span className='text-[14px] font-semibold text-black/80'>${adminPrice.toFixed(2)}</span>
                    </div> */}
                    {actualServiceFeePercent > 0 && (
                      <div className="flex justify-between">
                        <span className='text-[16px] font-semibold text-black'>Service Fee</span>
                        <span className='text-[14px] font-semibold text-black/80'>${(adminPrice + serviceFeeAmount).toFixed(2)}</span>
                      </div>
                    )}
                  </>
                )}
                {booking?.flat_pickup_charge && parseFloat(booking.flat_pickup_charge) > 0 && (
                  <div className="flex justify-between">
                    <span className='text-[16px] font-semibold text-black'>Pickup Fee</span>
                    <span className='text-[14px] font-semibold text-black/80'>${parseFloat(booking.flat_pickup_charge).toFixed(2)}</span>
                  </div>
                )}

                {/* ADDED: Flat Delivery Fee */}
                {booking?.flat_delivery_charge && parseFloat(booking.flat_delivery_charge) > 0 && (
                  <div className="flex justify-between">
                    <span className='text-[16px] font-semibold text-black'>Delivery Fee</span>
                    <span className='text-[14px] font-semibold text-black/80'>${parseFloat(booking.flat_delivery_charge).toFixed(2)}</span>
                  </div>
                )}

                <div className="flex justify-between mt-2 border-t pt-2">
                  <span className='text-[18px] font-bold text-black'>Total</span>
                  <span className='text-[16px] font-bold text-black'>${finalTotal.toFixed(2)}</span>
                </div>
                {booking.payment_status == "1" && (
                  <div className="flex justify-between items-center mt-2">
                    <span className='text-[16px] font-semibold text-black'>Amount Paid</span>
                    <span className="text-[14px] text-green-600 font-bold">${amountPaid.toFixed(2)} — Paid in full</span>
                  </div>
                )}
                <p className="text-[12px] text-gray-500 italic mt-3 text-center">
                  <b>Final amount may vary based on shipment details and additional services</b>
                </p>
              </div>
            </div>

            {/* Payment Method */}
            <div className="bg-[#2D413F] rounded-xl p-5 bussiness-detail-no-print">
              <div className="flex justify-between items-center">
                <p className="m-0 text-lg font-bold text-white">Payment Method</p>
                <img src={card} alt="Card" />
              </div>
            </div>

          </div>
        </div>
      </div>

      {openSuccessModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 bussiness-detail-no-print">
          <div className="bg-white mx-[15px] rounded-2xl p-8 text-center relative">

            <button
              onClick={() => {
                setOpenSuccessModal(false);
                window.location.reload();
              }}
              className="absolute right-4 top-4 w-[35px] h-[35px] rounded-full bg-black/10 text-black flex items-center justify-center font-bold"
            >
              ✕
            </button>

            <div className="flex justify-center mb-4">
              <div className="w-[70px] h-[70px] rounded-full bg-green-500 flex items-center justify-center">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>

            <h3 className="text-[22px] font-bold text-black mb-1">Success</h3>
            <p className="text-gray-500 text-md mb-6">Payment completed successfully</p>

            <button
              onClick={() => {
                setOpenSuccessModal(false);
                window.location.reload();
              }}
              className="bg-gradient-to-r from-[#FFB800] via-[#FFD24D] to-[#FFE58F] text-black px-12 py-3 rounded-full font-semibold hover:brightness-110 transition"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default BuisnessDetail
