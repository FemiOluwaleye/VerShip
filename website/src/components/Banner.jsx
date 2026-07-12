import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Calendar, Info, MapPin, Search, ArrowUpRight, Target, Flag } from "lucide-react";
import { container, profile1, loc, calender, iccon } from "../common/common-assets/assets-images";
import { useNavigate, useLocation } from "react-router-dom";
import { saveBookingRequest, getProviderList } from "../api/cms";
import { toast } from "sonner";
import { API_URL } from "../api/axios";

const ORIGINS = [
  "Fort Lauderdale, FL",
  "Miami, FL",
  "Pittsburgh, PA",
  "Orlando, FL",
];

const DESTINATIONS = [
  "Kingston, Jamaica",
];

const CITY_COORDINATES = {
  "Fort Lauderdale, FL": { lat: "26.1224", lng: "-80.1373" },
  "Miami, FL": { lat: "25.7617", lng: "-80.1918" },
  "Pittsburgh, PA": { lat: "40.4387", lng: "-79.9972" },
  "Orlando, FL": { lat: "28.4778279", lng: "-81.2880713" },
  "Kingston, Jamaica": { lat: "17.9854994", lng: "-76.8078474" },
};

// Always available origins - these will always be shown regardless of API
const ALWAYS_AVAILABLE_ORIGINS = ["Pittsburgh, PA"];

const Banner = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const originRef = useRef(null);
  const destinationRef = useRef(null);
  const pickupDateRef = useRef(null);
  const deliveryDateRef = useRef(null);
  const formRef = useRef(null);

  const [activeSubTab, setActiveSubTab] = useState("Ship Your Own Barrel");
  const [openOrigin, setOpenOrigin] = useState(false);
  const [openDestination, setOpenDestination] = useState(false);
  const [origin, setOrigin] = useState(""); // Empty by default - no auto-selection
  const [destination, setDestination] = useState(""); // Empty by default - no auto-selection
  const [quantity, setQuantity] = useState("");
  
  const [availableOrigins, setAvailableOrigins] = useState([]);
  const [providersList, setProvidersList] = useState([]);

  useEffect(() => {
    const isOwn = activeSubTab === "Ship Your Own Barrel";
    const targetType = isOwn ? "own" : "dropoff";
    
    const originsSet = new Set(ALWAYS_AVAILABLE_ORIGINS);
    
    providersList.forEach(provider => {
      if (provider.businessInfo && Array.isArray(provider.businessInfo.barrelPrices)) {
        provider.businessInfo.barrelPrices.forEach(bp => {
          if (bp.type === targetType && bp.originCountry) {
            originsSet.add(bp.originCountry);
          }
        });
      }
    });
    
    const finalOrigins = Array.from(originsSet);
    setAvailableOrigins(finalOrigins);
    
    // Reset selected origin if it is not in the new available origins list
    if (origin && !finalOrigins.includes(origin)) {
      setOrigin("");
    }
  }, [activeSubTab, providersList, origin]);

  const getMinPickupDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split("T")[0];
  };

  const [pickupDate, setPickupDate] = useState(getMinPickupDate());
  const [deliveryDate, setDeliveryDate] = useState(() => {
    const minPickup = getMinPickupDate();
    const deliveryDate = new Date(minPickup);
    deliveryDate.setDate(deliveryDate.getDate() + 14);
    return deliveryDate.toISOString().split("T")[0];
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // REMOVED the auto-selection useEffect - no automatic selection

  useEffect(() => {
    fetchProviders();
  }, []);

  const fetchProviders = async () => {
    try {
      const response = await getProviderList();
      
      // Check both possible response structures
      let providers = [];
      if (response && response.body && Array.isArray(response.body)) {
        providers = response.body;
      } else if (response && response.data && Array.isArray(response.data)) {
        providers = response.data;
      } else if (Array.isArray(response)) {
        providers = response;
      }
      
      setProvidersList(providers);
    } catch (error) {
      console.error("Failed to fetch providers:", error);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "Select Date";
    const [y, m, d] = dateString.split("-");
    return `${m}/${d}/${y}`;
  };

  const scrollToForm = () => {
    formRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const getMinDeliveryDate = () => {
    if (!pickupDate) return getMinPickupDate();
    const minDate = new Date(pickupDate);
    minDate.setDate(minDate.getDate() + 14);
    return minDate.toISOString().split("T")[0];
  };

  const handlePickupDateChange = (e) => {
    const selectedDate = e.target.value;
    const minPickupDate = getMinPickupDate();

    if (selectedDate < minPickupDate) {
      toast.error("Pickup date cannot be today. Please select tomorrow or later");
      return;
    }

    setPickupDate(selectedDate);

    const newDeliveryDate = new Date(selectedDate);
    newDeliveryDate.setDate(newDeliveryDate.getDate() + 14);
    setDeliveryDate(newDeliveryDate.toISOString().split("T")[0]);
  };

  const handleDeliveryDateChange = (e) => {
    const selectedDate = e.target.value;
    const minDeliveryDate = getMinDeliveryDate();

    if (selectedDate < minDeliveryDate) {
      toast.error("Delivery date must be at least 14 days after pickup date");
      return;
    }
    setDeliveryDate(selectedDate);
  };

  const handleSubmit = async () => {
    if (!origin) return toast.error("Please select an origin location");
    if (!destination) return toast.error("Please select a destination location");
    if (!quantity || parseInt(quantity) === 0) return toast.error("Please enter a valid quantity");

    const finalItems = [{
      item_type: "Barrel",
      sub_type: activeSubTab,
      quantity: quantity,
      weight: "",
      dimensions: "",
      description: "",
    }];

    const isRequestBarrel = activeSubTab === "Request Barrel Drop-Off";

    if (!isRequestBarrel) {
      const pickupDateTime = new Date(pickupDate).getTime();
      const deliveryDateTime = new Date(deliveryDate).getTime();
      const daysDifference = (deliveryDateTime - pickupDateTime) / (1000 * 3600 * 24);

      if (daysDifference < 14) {
        return toast.error("Delivery date must be at least 14 days after pickup date");
      }
    }

    const payload = {
      origin,
      origin_city: "",
      destination,
      pickup_date: isRequestBarrel ? null : pickupDate,
      delivery_date: isRequestBarrel ? null : deliveryDate,
      items: finalItems,
      origin_lat: CITY_COORDINATES[origin]?.lat || "",
      origin_long: CITY_COORDINATES[origin]?.lng || "",
      destination_lat: CITY_COORDINATES[destination]?.lat || "",
      destination_long: CITY_COORDINATES[destination]?.lng || "",
    };

    const userStr = localStorage.getItem("user");
    if (!userStr) {
      localStorage.setItem("pending_booking_payload", JSON.stringify(payload));
      toast.info("Please login to proceed with your request");
      navigate("/login");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await saveBookingRequest(payload);
      if (isRequestBarrel) {
        toast.success("Shipment request saved successfully!");
        navigate(`/barrel-request/${res.body.id}`);
      } else {
        navigate("/quotes-shipown");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to save request");
    } finally {
      setIsSubmitting(false);
    }
  };

  const scrollToTestimonials = () => {
    const testimonialsSection = document.getElementById('testimonials');
    if (testimonialsSection) {
      testimonialsSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="w-full">
      {/* Hero Section */}
      <section className="bg-[#F8FAFA] pt-6 md:pt-8 pb-3 md:pb-4 px-4 md:px-6 flex flex-col items-center overflow-hidden relative">

        {/* Container Image (Layered on top) */}
        <div className="relative mt-0 md:mt-[-40px] mb-3 md:mb-4 z-30 w-full max-w-[560px] flex justify-center">
          <img
            src={container}
            alt="VerShip — shipping barrels to Jamaica made easy"
            className="w-full md:w-[560px] object-contain drop-shadow-[0_20px_20px_rgba(0,0,0,0.15)] md:drop-shadow-[0_30px_30px_rgba(0,0,0,0.15)]"
          />
        </div>

        {/* Brand copy & social proof */}
        <div className="flex flex-col items-center gap-3 md:gap-4 relative z-40 max-w-2xl text-center px-4">
          {/* Eyebrow / context kicker */}
          <span className="inline-flex items-center gap-2 text-[11px] md:text-xs font-semibold uppercase tracking-[0.18em] text-[#0D4D4D]/80">
            <span className="w-1.5 h-1.5 rounded-full bg-[#C1A35E]" aria-hidden="true" />
            USA to Jamaica · Door to door
          </span>

          {/* Headline */}
          <h1 className="text-[#071618] font-bold tracking-tight text-[26px] leading-[1.15] md:text-[40px] md:leading-[1.1]">
            Barrel shipping to Jamaica,{" "}
            <span className="text-[#0D4D4D]">simplified.</span>
          </h1>

          {/* Supporting copy */}
          <p className="text-[#595d5e] text-base md:text-[19px] leading-snug font-normal">
            Compare rates from trusted shipping companies, book the best option, and ship your barrel — all on one platform.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-1">
            <button
              onClick={() => navigate("/prepacked-barrel")}
              className="bg-[#C1A35E] text-[#071618] px-6 h-[46px] rounded-full font-bold text-base md:text-lg hover:bg-[#E5C78A] transition-all flex items-center justify-center shadow-[0_8px_16px_rgba(193,163,94,0.25)]"
            >
              Order VerShip Pre-Packed Barrel Now
            </button>
            <button
              onClick={scrollToForm}
              className="bg-[#0D4D4D] text-white w-[168px] h-[46px] rounded-full font-bold text-base md:text-lg hover:bg-[#0A3D3D] transition-all flex items-center justify-center"
            >
              Get quotes
            </button>
          </div>
        </div>
      </section>

      {/* Form Section */}
      <section id="booking-form" ref={formRef} className="bg-[#071618] pt-6 pb-8 md:pt-8 md:pb-14 px-4 md:px-6">
        <div className="max-w-[1326px] mx-auto">
          {/* Tabs */}
          <div className="flex justify-center mb-[-1px] relative z-20">
            <div className="flex items-center gap-4 md:gap-8">
              <div className="relative">
                <button
                  onClick={() => setActiveSubTab("Ship Your Own Barrel")}
                  className={`px-8 md:px-12 py-4 md:py-5 font-medium text-sm md:text-[22px] transition-all relative z-10 ${activeSubTab === "Ship Your Own Barrel"
                    ? "text-[#D4B97C]"
                    : "text-white hover:text-white/80"
                    }`}
                >
                  Ship Your Own Barrel
                </button>
                {activeSubTab === "Ship Your Own Barrel" && (
                  <>
                    <div className="absolute inset-0 border-t border-l-0 border-r-0 border-white/10 rounded-t-[24px] bg-[#051111] -z-10" />
                    <div className="absolute -left-[24px] bottom-0 w-[24px] h-[24px] overflow-hidden pointer-events-none">
                      <div className="absolute top-0 right-0 w-full h-full border-b border-r-0 border-white/10 rounded-br-[24px] bg-transparent shadow-[10px_10px_0_0_#051111]" />
                    </div>
                    <div className="absolute -right-[24px] bottom-0 w-[24px] h-[24px] overflow-hidden pointer-events-none">
                      <div className="absolute top-0 left-0 w-full h-full border-b border-l-0 border-white/10 rounded-bl-[24px] bg-transparent shadow-[-10px_10px_0_0_#051111]" />
                    </div>
                  </>
                )}
              </div>

              <div className="relative">
                <button
                  onClick={() => setActiveSubTab("Request Barrel Drop-Off")}
                  className={`px-8 md:px-12 py-4 md:py-5 font-medium text-sm md:text-[22px] transition-all relative z-10 ${activeSubTab === "Request Barrel Drop-Off"
                    ? "text-[#D4B97C]"
                    : "text-white hover:text-white/80"
                    }`}
                >
                  Request Barrel Drop-Off
                </button>
                {activeSubTab === "Request Barrel Drop-Off" && (
                  <>
                    <div className="absolute inset-0 border-t border-l-0 border-r-0 border-white/10 rounded-t-[24px] bg-[#051111] -z-10" />
                    <div className="absolute -left-[24px] bottom-0 w-[24px] h-[24px] overflow-hidden pointer-events-none">
                      <div className="absolute top-0 right-0 w-full h-full border-b border-r border-white/10 rounded-br-[24px] bg-transparent shadow-[10px_10px_0_0_#051111]" />
                    </div>
                    <div className="absolute -right-[24px] bottom-0 w-[24px] h-[24px] overflow-hidden pointer-events-none">
                      <div className="absolute top-0 left-0 w-full h-full border-b border-l border-white/10 rounded-bl-[24px] bg-transparent shadow-[-10px_10px_0_0_#051111]" />
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Form Container */}
          <div className="bg-[#051111] border border-white/10 rounded-[16px] md:rounded-[20px] p-6 md:p-10 pb-10 md:pb-12 shadow-2xl relative z-10">
            {/* Top Row: Origin & Destination */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div ref={originRef} className="relative">
                <button
                  type="button"
                  onClick={() => setOpenOrigin(!openOrigin)}
                  aria-haspopup="listbox"
                  aria-expanded={openOrigin}
                  aria-label="Select origin"
                  className="w-full text-left bg-[#0a1b1d] border border-white/5 rounded-xl p-4 cursor-pointer hover:border-[#D4B97C]/30 transition-all flex items-center justify-between"
                >
                  <span className={`text-sm md:text-base ${origin ? 'text-white/70' : 'text-white/30'}`}>
                    {origin || "Select origin"}
                  </span>
                  <img
                    src={loc}
                    alt=""
                    className="w-5 h-5 object-contain"
                  />
                </button>
                {openOrigin && (
                  <ul role="listbox" aria-label="Origin" className="absolute top-full left-0 w-full mt-2 bg-[#121A19] border border-white/10 rounded-lg shadow-2xl overflow-hidden z-50 max-h-60 overflow-y-auto">
                    {ORIGINS.map((item) => {
                      // Check if this origin is available from any provider OR is always available
                      const isAvailable = availableOrigins.includes(item) || ALWAYS_AVAILABLE_ORIGINS.includes(item);

                      return (
                        <li key={item} role="option" aria-selected={origin === item} aria-disabled={!isAvailable}>
                          <button
                            type="button"
                            disabled={!isAvailable}
                            onClick={() => {
                              setOrigin(item);
                              setOpenOrigin(false);
                            }}
                            className={`w-full text-left px-6 py-3 font-medium transition-colors text-sm md:text-base
                          ${!isAvailable
                                ? "text-white/25 cursor-not-allowed"
                                : "text-white/80 hover:bg-[#C1A35E] hover:text-black cursor-pointer"
                              }`}
                          >
                            {item}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div ref={destinationRef} className="relative">
                <button
                  type="button"
                  onClick={() => setOpenDestination(!openDestination)}
                  aria-haspopup="listbox"
                  aria-expanded={openDestination}
                  aria-label="Select destination"
                  className="w-full text-left bg-[#0a1b1d] border border-white/5 rounded-xl p-4 cursor-pointer hover:border-[#D4B97C]/30 transition-all flex items-center justify-between"
                >
                  <span className={`text-sm md:text-base ${destination ? 'text-white/70' : 'text-white/30'}`}>
                    {destination || "Select destination"}
                  </span>
                  <img
                    src={iccon}
                    alt=""
                    className="w-5 h-5 object-contain"
                  />
                </button>
                {openDestination && (
                  <ul role="listbox" aria-label="Destination" className="absolute top-full left-0 w-full mt-2 bg-[#121A19] border border-white/10 rounded-lg shadow-2xl overflow-hidden z-50 max-h-60 overflow-y-auto">
                    {DESTINATIONS.map((item) => (
                      <li key={item} role="option" aria-selected={destination === item}>
                        <button
                          type="button"
                          onClick={() => { setDestination(item); setOpenDestination(false); }}
                          className="w-full text-left px-6 py-3 text-white/80 hover:bg-[#C1A35E] hover:text-black cursor-pointer font-medium transition-colors text-sm md:text-base"
                        >
                          {item}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Bottom Row: Quantity & Dates */}
            <div className="flex flex-col md:flex-row gap-4 mb-6 md:mb-10">
              {/* Quantity Field - No label for both tabs */}
              <div className="flex-grow md:w-[20%]">
                <div className="bg-[#0a1b1d] border border-white/5 rounded-xl p-4">
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^0-9]/g, "");
                      const numValue = parseInt(value, 10);
                      if (value === "" || numValue <= 25) {
                        setQuantity(value);
                      }
                      if (numValue > 25) {
                        toast.error("Maximum quantity is 25 barrels");
                      }
                    }}
                    className="bg-transparent text-white/70 text-sm md:text-base outline-none w-full placeholder-white/30"
                    aria-label="Barrel quantity"
                    placeholder="Enter barrel quantity e.g. 2"
                    min="1"
                    max="25"
                  />
                </div>
              </div>

              {/* Conditional rendering based on active tab */}
              {activeSubTab === "Ship Your Own Barrel" ? (
                <>
                  {/* Pickup Date Field with Label */}
                  <div className="flex-grow md:w-[40%]">
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => pickupDateRef.current?.showPicker()}
                        aria-label={`Choose pickup date${pickupDate ? `, currently ${formatDate(pickupDate)}` : ""}`}
                        className="w-full text-left bg-[#0a1b1d] border border-white/5 rounded-xl p-4 flex items-center justify-between cursor-pointer hover:border-[#D4B97C]/30 transition-all"
                      >
                        <span className={`text-sm md:text-base ${pickupDate ? 'text-white/70' : 'text-white/30'}`}>
                          {pickupDate ? formatDate(pickupDate) : "Select pickup date"}
                        </span>
                        <img
                          src={calender}
                          alt=""
                          className="w-5 h-5 object-contain"
                        />
                      </button>
                      <input
                        type="date"
                        aria-label="Pickup date"
                        ref={pickupDateRef}
                        value={pickupDate}
                        min={getMinPickupDate()}
                        onChange={handlePickupDateChange}
                        className="w-0 h-0 invisible absolute"
                      />
                    </div>
                    <label className="block text-white/70 text-sm mb-2">
                      <span className="text-red-500">*</span>  When would you like us to pick up?
                    </label>
                  </div>

                  {/* Delivery Date Field with Label */}
                  <div className="flex-grow md:w-[40%]">
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => deliveryDateRef.current?.showPicker()}
                        aria-label={`Choose delivery date${deliveryDate ? `, currently ${formatDate(deliveryDate)}` : ""}`}
                        className="w-full text-left bg-[#0a1b1d] border border-white/5 rounded-xl p-4 flex items-center justify-between cursor-pointer hover:border-[#D4B97C]/30 transition-all"
                      >
                        <span className={`text-sm md:text-base ${deliveryDate ? 'text-white/70' : 'text-white/30'}`}>
                          {deliveryDate ? formatDate(deliveryDate) : "Select delivery date"}
                        </span>
                        <Calendar className="text-[#D4B97C] w-5 h-5" aria-hidden="true" />
                      </button>
                      <input
                        type="date"
                        aria-label="Delivery date"
                        ref={deliveryDateRef}
                        value={deliveryDate}
                        min={getMinDeliveryDate()}
                        onChange={handleDeliveryDateChange}
                        className="w-0 h-0 invisible absolute"
                      />
                    </div>
                    <label className="block text-white/70 text-sm mb-2">
                      <span className="text-red-500">*</span> Estimated delivery date
                    </label>
                  </div>
                </>
              ) : (
                <>
                  {/* Pickup Date Field - No label for Request Barrel Drop-Off */}
                  <div className="flex-grow md:w-[40%]">
                    <div className="bg-[#0a1b1d] border border-white/5 rounded-xl p-4 flex items-center justify-between opacity-30 cursor-not-allowed">
                      <span className="text-white/30 text-sm md:text-base">
                        Shipment date
                      </span>
                      <img
                        src={calender}
                        alt=""
                        className="w-5 h-5 object-contain opacity-50"
                      />
                    </div>
                  </div>

                  {/* Delivery Date Field - No label for Request Barrel Drop-Off */}
                  <div className="flex-grow md:w-[40%]">
                    <div className="bg-[#0a1b1d] border border-white/5 rounded-xl p-4 flex items-center justify-between opacity-30 cursor-not-allowed">
                      <span className="text-white/30 text-sm md:text-base">
                        Delivery date
                      </span>
                      <Calendar className="text-[#D4B97C] w-5 h-5 opacity-50" />
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-center mt-4 md:mt-8">
              <div className="p-2 bg-[#DCD5C5]/5 rounded-2xl md:rounded-[14px]">
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="bg-[#c1a35e] hover:bg-[#E5C78A] text-[#071618] 
                  px-6 md:px-8
                  py-1.5 md:py-2 
                  rounded-[12px]
                  font-medium text-20 text-base md:text-lg 
                  transition-all 
                  shadow-[0_8px_16px_rgba(212,185,124,0.2)] 
                  w-auto tracking-wide"
                >
                  {isSubmitting ? "Processing..." : "Get quotes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Banner;