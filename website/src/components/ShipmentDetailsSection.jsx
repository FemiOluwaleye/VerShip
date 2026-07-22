import React, { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom';
import { tick } from "../common/common-assets/assets-images";
import { check } from "../common/common-assets/assets-images";
import { box } from "../common/common-assets/assets-images";
import { useNavigate } from 'react-router-dom';
import { updateBookingPayment, createPaymentIntent, getAddons, getServiceFeePercent } from '../api/cms';
import {
  getServiceFeePercentFromAddons,
  calculateBarrelPricing,
  calculateBarrelBasedFees,
  isPricingV2,
  calculateBarrelPricingV2,
  v2PickupCharge,
  v2ParishFee,
} from '../utils/pricing';
import { JAMAICA_PARISHES, detectParish } from '../utils/parishes';
import { toast } from 'sonner';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import CheckoutForm from './CheckoutForm';
import { API_URL } from '../api/axios';

const DESTINATION_COORDINATES = {
  "Kingston, Jamaica": { lat: "17.9712", lng: "-76.7924" },
};

// Fixed Jamaica delivery origin — the port every shipment is delivered from:
// 95 Second Street, Newport West, Kingston 13, St. Andrew, Jamaica.
// Delivery miles are measured from here to the recipient (drives per-mile billing).
// Coordinate triangulated from web sources: the Newport West port estate sits
// just south of Tinson Pen Aerodrome (17.9890, -76.8251), and Second Street is a
// confirmed corridor there (Kingston Wharves #195, MTS #40, Laparkan #10). For a
// to-the-metre pin, replace with the exact lat/lng from Google Maps.
const PORT_COORDINATES = { lat: 17.966, lng: -76.829 };

const CITY_COORDINATES = {
  "Fort Lauderdale, FL": { lat: "26.1224", lng: "-80.1373" },
  "Miami, FL": { lat: "25.7617", lng: "-80.1918" },
  "Pittsburgh, PA": { lat: "40.4387", lng: "-79.9972" },
  "Orlando, FL": { lat: "28.4778279", lng: "-81.2880713" },
};

const getValueForQuantity = (rawVal, qty) => {
  if (!rawVal) return 0;
  const str = String(rawVal);
  const parts = str.split(",");
  if (parts.length === 25) {
    const index = Math.min(Math.max(1, qty), 25) - 1;
    // Freight users may price only the first N barrels; any larger order is
    // charged at the last entered (highest) barrel price. Walk back to it.
    for (let i = index; i >= 0; i--) {
      const v = String(parts[i] ?? "").trim();
      if (v !== "") return parseFloat(v) || 0;
    }
    return 0;
  }
  return parseFloat(parts[0] || 0) || 0;
};

const ShipmentDetailsSection = () => {
  const [openModal, setOpenModal] = useState(false);
  const [openSuccessModal, setOpenSuccessModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(1);
  const [clientSecret, setClientSecret] = useState("");
  const [stripePromise, setStripePromise] = useState(null);
  const [googleDistance, setGoogleDistance] = useState({ d1: null, d2: null });
  const [distanceLoading, setDistanceLoading] = useState(false);
  const [isPaymentCompleted, setIsPaymentCompleted] = useState(false);

  const location = useLocation();
  const { bookings: bookingsState, bookingRequest, providers, isShipOwn, shipownFormData, adminCommission, serviceFeePercent } = location.state || {};
  const bookings = Array.isArray(bookingsState) ? bookingsState : bookingsState?.bookings;
  const [adminServiceFeePercent, setAdminServiceFeePercent] = useState(parseFloat(serviceFeePercent) || 0);
  // Pricing v2: consignee destination parish (drives the combined Customs & Delivery fee)
  const [selectedParish, setSelectedParish] = useState("");

  const booking = bookings && bookings.length > 0 ? bookings[0] : null;
  const providerId = booking ? booking.driverId : null;
  const providerDetail = providers ? providers.find(p => Number(p.providerId) === Number(providerId)) : null;

  // Auto-detect the parish from the saved booking/request; the shopper can correct it below.
  // consignee_state IS the parish (the delivery form's parish select stores it there).
  useEffect(() => {
    if (selectedParish) return;
    const detected =
      (JAMAICA_PARISHES.includes(booking?.consignee_state) && booking.consignee_state) ||
      bookingRequest?.parish ||
      detectParish(booking?.consignee_address) ||
      detectParish(bookingRequest?.drop_off_address);
    if (detected) setSelectedParish(detected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking?.consignee_state, bookingRequest?.parish, booking?.consignee_address, bookingRequest?.drop_off_address]);

  const itemType = bookingRequest && bookingRequest.items && bookingRequest.items.length > 0 ? bookingRequest.items[0].item_type : "Parcel";
  const itemSubTypes = bookingRequest && bookingRequest.items && bookingRequest.items.length > 0 ? (bookingRequest.items[0].sub_type || "N/A") : "N/A";
  const itemSubTypesLower = String(itemSubTypes).toLowerCase();
  const isShipYourOwn = itemSubTypesLower.includes('ship your own') || itemSubTypesLower.includes('own barrel');
  const isRequestBarrel = itemSubTypesLower.includes('request barrel') || itemSubTypesLower.includes('drop-off') || itemSubTypesLower.includes('dropoff');

  const quantity = bookingRequest ? parseInt(bookingRequest.quantity || 0) : 0;

  let barrelPriceObj = null;
  let type = null;

  if (providerDetail?.barrelPrices && Array.isArray(providerDetail.barrelPrices)) {
    const sub = itemSubTypesLower;
    type = (sub.includes('ship your own') || sub.includes('own barrel')) ? 'own' : 'dropoff';

    barrelPriceObj = providerDetail.barrelPrices.find(bp => {
      const bpType = (bp.type || "").toLowerCase().trim();
      return bpType === type;
    });
  }

  // Simplified pricing model (v2): active when the matched rate card has a seaFreightPrice.
  const pricingV2 = isPricingV2(barrelPriceObj);

  const flatPickupChargeBase = getValueForQuantity(barrelPriceObj?.flatPickupCharge, quantity);
  const flatDeliveryChargeBase = getValueForQuantity(barrelPriceObj?.flatDeliveryCharge, quantity);

  const pickupFreeMiles = parseFloat(barrelPriceObj?.pickupFreeMiles || 0);
  const pickupPerMileCharge = parseFloat(barrelPriceObj?.pickupPerMileCharge || 0);
  const deliveryFreeMiles = parseFloat(barrelPriceObj?.deliveryFreeMiles || 0);
  const deliveryPerMileCharge = parseFloat(barrelPriceObj?.deliveryPerMileCharge || 0);

  console.log("🔍 Flat Pickup Charge Base (for qty:", quantity, "):", flatPickupChargeBase);
  console.log("🔍 Flat Delivery Charge Base (for qty:", quantity, "):", flatDeliveryChargeBase);
  console.log("🔍 Pickup Free Miles:", pickupFreeMiles);
  console.log("🔍 Pickup Per Mile Charge:", pickupPerMileCharge);
  console.log("🔍 Delivery Free Miles:", deliveryFreeMiles);
  console.log("🔍 Delivery Per Mile Charge:", deliveryPerMileCharge);

  const basePrice = barrelPriceObj ? parseFloat(barrelPriceObj.basePrice || 0) : (providerDetail ? parseFloat(providerDetail.basePrice || 0) : 0);

  // v2: one combined Customs & Delivery fee for the consignee's parish.
  // Legacy: quantity-tiered customs CSV lookup.
  const customsAndHandlingFee = pricingV2
    ? v2ParishFee(barrelPriceObj, selectedParish, quantity)
    : getValueForQuantity(
        barrelPriceObj?.customsAndHandling ?? providerDetail?.customsAndHandling,
        quantity
      );

  const perBarrelPrice = barrelPriceObj ? parseFloat(barrelPriceObj.barrelPrice || 0) : 0;

  const {
    barrelPrice: itemPrice,
    barrelDiscount,
    discountApplies,
    discountPercent,
    discountAfter,
    listTotal: totalWithoutDiscount,
    discountedPerBarrel,
  } = pricingV2
    ? calculateBarrelPricingV2({ quantity, barrelPrices: barrelPriceObj })
    : calculateBarrelPricing({
        quantity,
        perBarrelPrice,
        isVolumeDiscount: barrelPriceObj?.isVolumeDiscount,
        discountAfter: barrelPriceObj?.discountAfter,
        discountPercent: barrelPriceObj?.discountPercent,
      });

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
    const R = 3958.8;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const originCity = bookingRequest?.origin || "";
  const originCoords = CITY_COORDINATES[originCity] || { lat: 0, lng: 0 };

  const destinationCity = bookingRequest?.destination || "";
  const destCoords = DESTINATION_COORDINATES[destinationCity] || { lat: 0, lng: 0 };

  const shipperLat = parseFloat(booking?.shiper_lat || 0);
  const shipperLng = parseFloat(booking?.shiper_lng || 0);

  const consigneeLat = parseFloat(booking?.consignee_lat || 0);
  const consigneeLng = parseFloat(booking?.consignee_lng || 0);

  const businessLat = parseFloat(providerDetail?.businessLatitude || 0);
  const businessLng = parseFloat(providerDetail?.businessLongitude || 0);

  console.log("🔍 Origin City:", originCity);
  console.log("🔍 Origin Coordinates from CITY_COORDINATES:", originCoords);
  console.log("🔍 Provider Business Lat/Lng:", businessLat, businessLng);
  console.log("🔍 Shipper Lat/Lng (from booking):", shipperLat, shipperLng);
  console.log("🔍 Destination City:", destinationCity);
  console.log("🔍 Destination Coordinates from DESTINATION_COORDINATES:", destCoords);
  console.log("🔍 Consignee Lat/Lng (from booking):", consigneeLat, consigneeLng);

  const pickupDistance = calculateDistance(
    businessLat,
    businessLng,
    shipperLat,
    shipperLng
  );

  // Delivery is measured from the fixed Jamaica port, not the destination city.
  const deliveryDistance = calculateDistance(
    PORT_COORDINATES.lat,
    PORT_COORDINATES.lng,
    consigneeLat,
    consigneeLng
  );

  console.log("🔍 Pickup Distance (miles):", pickupDistance);
  console.log("🔍 Delivery Distance (miles):", deliveryDistance);

  // Prefer real driving distance (Google Distance Matrix, set async into
  // googleDistance) over straight-line Haversine. The forwarder's per-mile
  // pickup/delivery pricing is meant to bill against road miles; Haversine
  // undercounts them, so it's only a fallback until Google resolves.
  let effectivePickupDistance =
    googleDistance.d1 != null ? googleDistance.d1 : pickupDistance;
  let effectiveDeliveryDistance =
    googleDistance.d2 != null ? googleDistance.d2 : deliveryDistance;

  if (isRequestBarrel) {
    effectivePickupDistance = 0;
    effectiveDeliveryDistance = 0;
    console.log("🔍 Request Barrel Drop-Off: Both pickup and delivery fees set to 0");
  }

  let finalFlatPickupCharge = 0;
  let finalFlatDeliveryCharge = 0;

  if (pricingV2) {
    // v2: pickup = flat charge + extra-mileage beyond the free radius; delivery
    // is included in the per-parish Customs & Delivery fee (no separate charge).
    if (!isRequestBarrel) {
      finalFlatPickupCharge = v2PickupCharge(barrelPriceObj, effectivePickupDistance).total;
    }
    finalFlatDeliveryCharge = 0;
  } else if (!isRequestBarrel) {
    finalFlatPickupCharge = flatPickupChargeBase;
    if (effectivePickupDistance > 0 && effectivePickupDistance > pickupFreeMiles) {
      const extraMiles = effectivePickupDistance - pickupFreeMiles;
      const extraCharge = extraMiles * pickupPerMileCharge;
      finalFlatPickupCharge = finalFlatPickupCharge + extraCharge;
      console.log(`🔍 Pickup: ${effectivePickupDistance.toFixed(2)} miles, Free: ${pickupFreeMiles}, Extra: ${extraMiles.toFixed(2)} miles, Extra Charge: $${extraCharge.toFixed(2)}`);
      console.log(`🔍 Final Pickup Fee: $${finalFlatPickupCharge.toFixed(2)}`);
    } else {
      console.log(`🔍 Pickup: ${effectivePickupDistance.toFixed(2)} miles, Within free miles (${pickupFreeMiles})`);
    }
  } else {
    console.log("🔍 Request Barrel Drop-Off: No pickup fee applied");
  }

  if (!pricingV2 && !isRequestBarrel) {
    finalFlatDeliveryCharge = flatDeliveryChargeBase;
    if (effectiveDeliveryDistance > 0 && effectiveDeliveryDistance > deliveryFreeMiles) {
      const extraMiles = effectiveDeliveryDistance - deliveryFreeMiles;
      const extraCharge = extraMiles * deliveryPerMileCharge;
      finalFlatDeliveryCharge = finalFlatDeliveryCharge + extraCharge;
      console.log(`🔍 Delivery: ${effectiveDeliveryDistance.toFixed(2)} miles, Free: ${deliveryFreeMiles}, Extra: ${extraMiles.toFixed(2)} miles, Extra Charge: $${extraCharge.toFixed(2)}`);
      console.log(`🔍 Final Delivery Fee: $${finalFlatDeliveryCharge.toFixed(2)}`);
    } else {
      console.log(`🔍 Delivery: ${effectiveDeliveryDistance.toFixed(2)} miles, Within free miles (${deliveryFreeMiles})`);
    }
  } else {
    console.log("🔍 Request Barrel Drop-Off: No delivery fee applied");
  }

  let totalDistance = effectivePickupDistance + effectiveDeliveryDistance;
  console.log("🔍 Total Distance (miles):", totalDistance);

  useEffect(() => {
    const fetchDistances = async () => {
      if (!window.google || !window.google.maps) return;

      const service = new window.google.maps.DistanceMatrixService();
      setDistanceLoading(true);

      const getMatrixDistance = (origin, dest) => {
        return new Promise((resolve) => {
          service.getDistanceMatrix(
            {
              origins: [origin],
              destinations: [dest],
              travelMode: window.google.maps.TravelMode.DRIVING,
              unitSystem: window.google.maps.UnitSystem.IMPERIAL,
            },
            (response, status) => {
              if (status === 'OK' && response.rows[0].elements[0].status === 'OK') {
                const miles = response.rows[0].elements[0].distance.value * 0.000621371;
                resolve(miles);
              } else {
                console.error("Distance Matrix error:", status, response);
                resolve(null);
              }
            }
          );
        });
      };

      try {
        if (isShipYourOwn) {
          const pickupStart = {
            lat: parseFloat(providerDetail?.businessLatitude || 0),
            lng: parseFloat(providerDetail?.businessLongitude || 0)
          };
          const pickupEnd = {
            lat: parseFloat(booking?.shiper_lat || 0),
            lng: parseFloat(booking?.shiper_lng || 0)
          };

          const deliveryStart = {
            lat: PORT_COORDINATES.lat,
            lng: PORT_COORDINATES.lng
          };
          const deliveryEnd = {
            lat: parseFloat(booking?.consignee_lat || 0),
            lng: parseFloat(booking?.consignee_lng || 0)
          };

          const d1 = await getMatrixDistance(pickupStart, pickupEnd);
          const d2 = await getMatrixDistance(deliveryStart, deliveryEnd);

          if (d1 !== null && d2 !== null) {
            setGoogleDistance({ d1, d2 });
          }
        } else {
          const start = {
            lat: parseFloat(destCoords.lat || 0),
            lng: parseFloat(destCoords.lng || 0)
          };
          const end = {
            lat: parseFloat(bookingRequest?.drop_off_lat || booking?.consignee_lat || 0),
            lng: parseFloat(bookingRequest?.drop_off_long || booking?.consignee_long || 0)
          };

          const d = await getMatrixDistance(start, end);
          if (d !== null) {
            setGoogleDistance({ d1: d, d2: 0 });
          }
        }
      } catch (error) {
        console.error("Error in Distance Matrix fetching:", error);
      } finally {
        setDistanceLoading(false);
      }
    };

    fetchDistances();

    const fetchServiceFeePercent = async () => {
      try {
        const res = await getServiceFeePercent();
        if (res.success && res.body?.serviceFeePercent != null) {
          const pct = parseFloat(res.body.serviceFeePercent);
          if (!Number.isNaN(pct) && pct > 0) {
            setAdminServiceFeePercent(pct);
            return;
          }
        }
      } catch (err) {
        console.error("Error fetching service fee percent:", err);
      }
      try {
        const res = await getAddons();
        if (res.success) {
          const pct = getServiceFeePercentFromAddons(res.body);
          if (pct > 0) setAdminServiceFeePercent(pct);
        }
      } catch (err) {
        console.error("Error fetching add-ons:", err);
      }
    };
    fetchServiceFeePercent();
  }, [bookingRequest, booking, barrelPriceObj, isShipOwn, providerDetail]);

  useEffect(() => {
    const paymentStatus = localStorage.getItem(`payment_completed_${booking?.id}`);
    if (paymentStatus === 'true') {
      setIsPaymentCompleted(true);
    }
    if (booking?.paymentStatus === 'completed' || booking?.pay_now > 0) {
      setIsPaymentCompleted(true);
    }
  }, [booking?.id]);

  useEffect(() => {
    const pct = parseFloat(serviceFeePercent);
    if (!Number.isNaN(pct) && pct > 0) {
      setAdminServiceFeePercent(pct);
    }
  }, [serviceFeePercent]);

  const renderStars = (rating) => {
    const numRating = parseFloat(rating) || 0;
    const fullStars = Math.floor(numRating);
    const hasHalfStar = numRating % 1 >= 0.5;
    const emptyStars = Math.max(0, 5 - fullStars - (hasHalfStar ? 1 : 0));

    return (
      <div className="flex items-center gap-0.5">
        {[...Array(fullStars)].map((_, i) => (
          <span key={`full-${i}`} style={{ color: '#FFBF00', fontSize: '16px' }}>★</span>
        ))}
        {hasHalfStar && (
          <span key="half" style={{ color: '#FFBF00', fontSize: '16px' }}>⭐</span>
        )}
        {[...Array(emptyStars)].map((_, i) => (
          <span key={`empty-${i}`} style={{ color: '#FFBF00', fontSize: '16px' }}>☆</span>
        ))}
      </div>
    );
  };

  // v2 folds delivery into the parish fee — no separate flat "Delivery ($)" fee.
  const flatDeliveryFee = pricingV2
    ? 0
    : parseFloat(barrelPriceObj?.pricePerMile ?? providerDetail?.pricePerMile ?? 0) || 0;
  let deliveryFee = flatDeliveryFee;

  const subtotal = itemPrice;
  const actualAdminCommission = parseFloat(booking?.adminCommission ?? adminCommission ?? 0) || 0;

  const navServiceFeePct = parseFloat(serviceFeePercent);
  const actualServiceFeePercent =
    (navServiceFeePct > 0 ? navServiceFeePct : parseFloat(adminServiceFeePercent)) || 0;

  const { commissionAmount: adminPrice, serviceFeeAmount } = calculateBarrelBasedFees(
    itemPrice,
    actualAdminCommission,
    actualServiceFeePercent
  );

  let user = {};
  try {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      user = typeof userStr === 'string' ? JSON.parse(userStr) : userStr;
    }
  } catch (e) {
    console.error("Error parsing user from localStorage:", e);
  }
  const userRole = user.role;
  const isEndUser = userRole === "1";

  const shouldAddCustomsFee = customsAndHandlingFee > 0;

  const finalTotal = subtotal +
    (shouldAddCustomsFee ? customsAndHandlingFee : 0) +
    deliveryFee +
    finalFlatPickupCharge +
    finalFlatDeliveryCharge +
    adminPrice +
    serviceFeeAmount;
  const paynowamount = finalTotal;

  const bundledServiceFee = deliveryFee +
    (shouldAddCustomsFee ? customsAndHandlingFee : 0) +
    adminPrice +
    serviceFeeAmount;

  const endUserDisplayServiceFeeAmount = adminPrice + serviceFeeAmount;
  const endUserDisplayServiceFeePercent = actualAdminCommission + actualServiceFeePercent;

  const navigate = useNavigate();

  if (!booking || !bookingRequest) {
    return (
      <div className="w-full bg-[#0E1F17] py-15 px-4 md:px-8">
        <div className="container mx-auto text-center text-white py-20">
          <p className="text-lg mb-4">Booking details are missing. Please start from quotes again.</p>
          <button
            type="button"
            onClick={() => navigate('/quotes')}
            className="bg-[#FFB800] text-black font-semibold px-8 py-3 rounded-full"
          >
            Back to Quotes
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="w-full bg-[#0E1F17] py-15 px-4 md:px-8">
        <div className="container mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* LEFT CONTENT */}
          <div className="lg:col-span-2 space-y-6">

            {/* Shipper Card */}
            <div className="bg-[#2D413F] rounded-xl p-[25px] text-white">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <div className="w-[70px] h-[70px] sm:w-[80px] sm:h-[80px] rounded-full flex items-center justify-center bg-[radial-gradient(circle_at_center,#FFD95A_0%,#FFC928_45%,#FFB800_100%)] overflow-hidden">
                    {providerDetail?.provider?.image ? (
                      <img
                        src={`${API_URL}${providerDetail.provider.image}`}
                        alt="Shipper"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-black text-[32px] sm:text-[36px] font-bold">
                        {providerDetail?.businessName?.substring(0, 2).toUpperCase() || "KT"}
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <h4 className="font-bold text-[20px] sm:text-[25px]">
                        {!isPaymentCompleted ? (
                          <span className="flex items-center gap-2">
                            <span style={{ filter: !isPaymentCompleted ? 'blur(5px)' : 'none', transition: 'filter 0.4s ease', userSelect: !isPaymentCompleted ? 'none' : 'auto', cursor: !isPaymentCompleted ? 'not-allowed' : 'auto' }}>
                              {providerDetail?.provider?.firstName || "Provider Name"}
                            </span>

                          </span>
                        ) : (
                          providerDetail?.provider?.firstName
                        )}
                      </h4>
                      {providerDetail && (
                        <div className="flex items-center gap-2 ms-5">
                          {renderStars(providerDetail?.averageRating ?? 0)}
                          <span className="text-white/80 text-sm">
                            {parseFloat(providerDetail?.averageRating || 0).toFixed(1)}
                          </span>
                          <span className="text-white/50 text-xs">
                            ({providerDetail?.totalCompletedBookings || 0} shipments)
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-start gap-2 text-sm text-white mt-1">
                      <span className="ms-5 text-[13px] font-semibold gap-1 flex align-middle">
                        <img src={tick} alt="verified" /> Verified Freight Forwarder
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <h5 className="font-bold text-lg mb-2">Descriptions</h5>
                <p className="text-gray-300 text-md leading-relaxed">
                  {providerDetail?.description || "No description available."}
                </p>
              </div>

              <div className="mt-4 flex flex-wrap gap-10 text-sm text-gray-200 border-1 p-3 px-4 rounded-[10px] border-[#676767]">
                <p><span className="text-white">Delivery Time:</span> {providerDetail?.deliveryTimeline || "3–5 Business Days"}</p>
              </div>
            </div>

            {/* ── Ship Your Own Barrel – Contact & Address Details ── */}
            {!isRequestBarrel && isShipOwn && shipownFormData && (() => {
              const InfoRow = ({ label, value }) => value ? (
                <div className="flex flex-col">
                  <span className="text-white/50 text-xs uppercase tracking-wider mb-1">{label}</span>
                  <span className="text-white font-medium">{value}</span>
                </div>
              ) : null;

              return (
                <div className="space-y-4">
                  {/* Primary Contact */}
                  <div className="bg-[#2D413F] rounded-xl p-5 text-white">
                    <h5 className="font-bold text-lg mb-4 text-yellow-400">Recipient Information</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <InfoRow label="First Name" value={booking?.primary_firstName} />
                      <InfoRow label="Last Name" value={booking?.primary_lastName} />
                      <InfoRow label="Phone" value={booking?.primary_phone_number} />
                      <InfoRow label="Email" value={booking?.primary_email} />
                      <InfoRow label="Address" value={booking?.primary_address} />
                      <InfoRow label="Street Address" value={booking?.primary_streetAddress} />
                      <InfoRow label="City" value={booking?.primary_city} />
                      <InfoRow label="State" value={booking?.primary_state} />
                      <InfoRow label="Apt / Suite (Optional)" value={booking?.primary_suite_apt_building} />
                    </div>
                  </div>

                  {/* Shipper & Delivery Addresses */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-[#2D413F] rounded-xl p-5 text-white">
                      <h5 className="font-bold text-lg mb-4 text-yellow-400">Shipper Address</h5>
                      <div className="space-y-3 text-sm">
                        <InfoRow label="First Name" value={booking?.shiper_firstName} />
                        <InfoRow label="Last Name" value={booking?.shiper_lastName} />
                        <InfoRow label="Email" value={booking?.shiper_email} />
                        <InfoRow label="Phone" value={booking?.shiper_phone_number} />
                        <InfoRow label="Address" value={booking?.shiper_address} />
                        <InfoRow label="Street Address" value={booking?.shiper_streetAddress} />
                        <InfoRow label="City" value={booking?.shiper_city} />
                        <InfoRow label="State" value={booking?.shiper_state} />
                        <InfoRow label="Apt / Suite (Optional)" value={booking?.shiper_suite_apt_building} />
                      </div>
                    </div>
                    <div className="bg-[#2D413F] rounded-xl p-5 text-white">
                      <h5 className="font-bold text-lg mb-4 text-yellow-400">Delivery Address</h5>
                      <div className="space-y-3 text-sm">
                        <InfoRow label="First Name" value={booking?.consignee_firstName} />
                        <InfoRow label="Last Name" value={booking?.consignee_lastName} />
                        <InfoRow label="Email" value={booking?.consignee_email} />
                        <InfoRow label="Phone" value={booking?.consignee_phone_number} />
                        <InfoRow label="Address" value={booking?.consignee_address} />
                        <InfoRow label="Street Address" value={booking?.consignee_streetAddress} />
                        <InfoRow label="City" value={booking?.consignee_city} />
                        <InfoRow label="State" value={booking?.consignee_state} />
                        <InfoRow label="Apt / Suite (Optional)" value={booking?.consignee_suite_apt_building} />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* RIGHT CONTENT */}
          <div className="space-y-6 text-center">

            {/* Order Summary */}
            <div className="bg-white rounded-xl p-5">
              <h4 className="font-bold text-lg mb-3 text-start">Order Summary</h4>
              <div className="text-sm space-y-2">
                <div className="flex justify-between items-start">
                  <div className="text-start">
                    <span className='text-[16px] font-semibold text-black block'>Barrel price</span>
                    {discountApplies && (
                      <span className='text-[11px] font-medium text-black/40 block -mt-1'>
                        (all {quantity} barrels at {discountPercent}% off)
                      </span>
                    )}
                  </div>
                  <span className='text-[14px] font-semibold text-black/80'>${itemPrice.toFixed(2)}</span>
                </div>

                {pricingV2 && (
                  <div className="flex justify-between items-center gap-2">
                    <span className='text-[16px] font-semibold text-black flex items-center gap-2'>
                      Customs &amp; Delivery
                      <select
                        value={selectedParish}
                        onChange={(e) => setSelectedParish(e.target.value)}
                        className="text-[13px] font-normal border border-black/20 rounded-md px-2 py-1 bg-white"
                        aria-label="Destination parish"
                      >
                        <option value="">Select parish…</option>
                        {JAMAICA_PARISHES.map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </span>
                    <span className='text-[14px] font-semibold text-black/80'>
                      {selectedParish ? `$${customsAndHandlingFee.toFixed(2)}` : '—'}
                    </span>
                  </div>
                )}
                {!pricingV2 && customsAndHandlingFee > 0 && shouldAddCustomsFee && (
                  <div className="flex justify-between">
                    <span className='text-[16px] font-semibold text-black'>
                      Customs and handling

                    </span>
                    <span className='text-[14px] font-semibold text-black/80'>${customsAndHandlingFee.toFixed(2)}</span>
                  </div>
                )}

                {isEndUser ? (
                  <>
                    {!pricingV2 && isRequestBarrel && (
                      <div className="flex justify-between">
                        <span className='text-[16px] font-semibold text-black'>Delivery</span>
                        <span className='text-[14px] font-semibold text-black/80'>${deliveryFee.toFixed(2)}</span>
                      </div>
                    )}
                    {(endUserDisplayServiceFeeAmount > 0 || endUserDisplayServiceFeePercent > 0) && (
                      <div className="flex justify-between">
                        <span className='text-[16px] font-semibold text-black'>Service Fee</span>
                        <span className='text-[14px] font-semibold text-black/80'>${endUserDisplayServiceFeeAmount.toFixed(2)}</span>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {!pricingV2 && shouldAddCustomsFee && customsAndHandlingFee > 0 && (
                      <div className="flex justify-between">
                        <span className='text-[16px] font-semibold text-black'>
                          Customs and handling

                        </span>
                        <span className='text-[14px] font-semibold text-black/80'>${customsAndHandlingFee.toFixed(2)}</span>
                      </div>
                    )}
                    {!pricingV2 && isRequestBarrel && (
                      <div className="flex justify-between">
                        <span className='text-[16px] font-semibold text-black'>Delivery Fees</span>
                        <span className='text-[14px] font-semibold text-black/80'>
                          {deliveryFee > 0 ? `$${deliveryFee.toFixed(2)}` : `FREE (within ${barrelPriceObj?.freeMiles || 0} miles)`}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className='text-[16px] font-semibold text-black'>Admin Commission ({actualAdminCommission}%)</span>
                      <span className='text-[14px] font-semibold text-black/80'>${adminPrice.toFixed(2)}</span>
                    </div>
                    {actualServiceFeePercent > 0 && (
                      <div className="flex justify-between">
                        <span className='text-[16px] font-semibold text-black'>Service Fee</span>
                        <span className='text-[14px] font-semibold text-black/80'>${serviceFeeAmount.toFixed(2)}</span>
                      </div>
                    )}
                  </>
                )}
                
                {finalFlatPickupCharge > 0 && (
                  <div className="flex justify-between">
                    <span className='text-[16px] font-semibold text-black'>
                      Pickup Fee
                      
                    </span>
                    <span className='text-[14px] font-semibold text-black/80'>${finalFlatPickupCharge.toFixed(2)}</span>
                  </div>
                )}

                {finalFlatDeliveryCharge > 0 && (
                  <div className="flex justify-between">
                    <span className='text-[16px] font-semibold text-black'>
                      Delivery Fee
                      
                    </span>
                    <span className='text-[14px] font-semibold text-black/80'>${finalFlatDeliveryCharge.toFixed(2)}</span>
                  </div>
                )}

                <div className="flex justify-between mt-2 border-t pt-2">
                  <span className='text-[18px] font-bold text-black'>Total Due</span>
                  <span className='text-[16px] font-bold text-black'>${finalTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <button
              onClick={async () => {
                if (providerDetail && providerDetail.hashAccount !== undefined && String(providerDetail.hashAccount) !== "1") {
                  toast.error("You cannot book this provider due to account restrictions. Please select another provider.", {
                    duration: 4000,
                    position: "top-center"
                  });
                  return;
                }
                if (!booking?.id) {
                  toast.error("Booking information missing.");
                  return;
                }
                if (pricingV2 && !selectedParish) {
                  toast.error("Please select the destination parish so Customs & Delivery can be included.", {
                    position: "top-center",
                  });
                  return;
                }
                setLoading(true);
                try {
                  const response = await createPaymentIntent({
                    amount: paynowamount,
                    currency: "usd",
                    bookingId: booking.id,
                    distance: totalDistance.toFixed(2),
                    deliveryFee: deliveryFee.toFixed(2),
                    flatPickupCharge: finalFlatPickupCharge.toFixed(2),
                    flatDeliveryCharge: finalFlatDeliveryCharge.toFixed(2),
                    serviceFee: isEndUser ? bundledServiceFee.toFixed(2) : adminPrice.toFixed(2),
                    subtotal: subtotal.toFixed(2),
                    barrelDiscount: barrelDiscount.toFixed(2),
                    addonFee: serviceFeeAmount.toFixed(2),
                  });

                  if (response.success) {
                    setClientSecret(response.clientSecret);
                    setStripePromise(loadStripe(response.publishkey));
                    setOpenModal(true);
                  } else {
                    toast.error(response.error || response.message || "Failed to initiate payment.");
                  }
                } catch (error) {
                  console.error("Payment Initiation Error:", error);
                  const errorMsg = error.response?.data?.error || error.response?.data?.message || "Failed to initiate payment.";
                  toast.error(errorMsg);
                } finally {
                  setLoading(false);
                }
              }}
              className="text-[15px] bg-gradient-to-r from-[#FFB800] via-[#FFD24D] to-[#FFE58F] text-black font-semibold px-8 sm:px-20 py-[20px] rounded-full hover:brightness-110 transition"
            >
              {loading ? "Please wait..." : "Review and Pay"}
            </button>
          </div>
        </div>
      </div>

      {openModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-white w-[100%] container rounded-xl !py-8 px-5 mx-[15px] sm:!px-10 relative">
            <div className="flex justify-center items-center mb-6">
              <h3 className="text-[26px] sm:text-[28px] font-bold text-black">Payment Method</h3>
              <button
                onClick={() => setOpenModal(false)}
                className="absolute right-4 top-4 w-[40px] h-[40px] bg-red-500 text-white rounded-full flex items-center justify-center text-sm font-extrabold"
              >
                ✕
              </button>
            </div>
            {clientSecret && stripePromise && (
              <Elements stripe={stripePromise} options={{ clientSecret }}>
                <CheckoutForm
                  amount={paynowamount.toFixed(2)}
                  bookingId={booking.id}
                  onCancel={() => setOpenModal(false)}
                  onSuccess={async (paymentIntent) => {
                    setLoading(true);
                    try {
                      const response = await updateBookingPayment({
                        bookingId: booking.id,
                        pay_now: finalTotal.toFixed(2),
                        pay_later: "0",
                        total: finalTotal.toFixed(2),
                        total_distance: totalDistance.toFixed(2),
                        delivery_fee: deliveryFee.toFixed(2),
                        flat_pickup_charge: finalFlatPickupCharge.toFixed(2),
                        flat_delivery_charge: finalFlatDeliveryCharge.toFixed(2),
                        paymentId: paymentIntent.id,
                        subtotal: subtotal.toFixed(2),
                        serviceFee: serviceFeeAmount.toFixed(2),
                        adminCommissionAmount: adminPrice.toFixed(2),
                        barrelDiscount: barrelDiscount.toFixed(2),
                      });

                      if (response.success) {
                        setOpenModal(false);
                        setOpenSuccessModal(true);
                      } else {
                        toast.error("Payment recorded on Stripe, but failed to update booking. Please contact support.");
                      }
                    } catch (error) {
                      console.error("Booking Update Error:", error);
                      toast.error("Failed to update booking status.");
                    } finally {
                      setLoading(false);
                    }
                  }}
                />
              </Elements>
            )}
          </div>
        </div>
      )}

      {openSuccessModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60">
          <div className="bg-white mx-[15px] rounded-2xl p-8 text-center relative">
            <button
              onClick={() => setOpenSuccessModal(false)}
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
            <p className="text-gray-500 text-md mb-6">Your payment has been completed successfully</p>
            <button
              onClick={() => {
                setOpenSuccessModal(false);
                navigate('/history')
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

export default ShipmentDetailsSection;