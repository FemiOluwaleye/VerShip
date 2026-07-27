import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Calendar, Info, MapPin, Search, ArrowUpRight, Target, Flag } from "lucide-react";
import { container, profile1, loc, calender, iccon } from "../common/common-assets/assets-images";
import { useNavigate, useLocation } from "react-router-dom";
import { saveBookingRequest, getProviderList } from "../api/cms";
import { toast } from "sonner";
import { API_URL } from "../api/axios";
import { JAMAICA_PARISHES } from "../utils/parishes";
import { ADVERTISED_ORIGINS, normalizeCity } from "../utils/origins";

// NOTE: which origins are *bookable* is never hardcoded. The ship-from options
// are derived from the forwarders who have actually priced a lane (see the
// effect below), so onboarding a forwarder in a city flips it from "Coming soon"
// to selectable on the next page load with no code change.

// We ship to one destination country. The parish is what actually varies, and
// capturing it here (rather than later, in the recipient's address) lets every
// shipment be categorised by parish from the very first step.
const DESTINATION_COUNTRY = "Jamaica";

const CITY_COORDINATES = {
  "Fort Lauderdale, FL": { lat: "26.1224", lng: "-80.1373" },
  "Miami, FL": { lat: "25.7617", lng: "-80.1918" },
  "Pittsburgh, PA": { lat: "40.4387", lng: "-79.9972" },
  "Orlando, FL": { lat: "28.4778279", lng: "-81.2880713" },
  Jamaica: { lat: "18.1096", lng: "-77.2975" },
};

// Parish capital / main town coordinates, used for the shipment's destination
// point so distance-based pricing has something better than the island centroid.
const PARISH_COORDINATES = {
  Kingston: { lat: "17.9714", lng: "-76.7931" },
  "St. Andrew": { lat: "18.0280", lng: "-76.7494" },
  "St. Thomas": { lat: "17.8900", lng: "-76.3500" },
  Portland: { lat: "18.1745", lng: "-76.4500" },
  "St. Mary": { lat: "18.3667", lng: "-76.9333" },
  "St. Ann": { lat: "18.4333", lng: "-77.2000" },
  Trelawny: { lat: "18.4917", lng: "-77.6500" },
  "St. James": { lat: "18.4762", lng: "-77.8939" },
  Hanover: { lat: "18.4000", lng: "-78.1333" },
  Westmoreland: { lat: "18.2200", lng: "-78.1300" },
  "St. Elizabeth": { lat: "18.0500", lng: "-77.7500" },
  Manchester: { lat: "18.0417", lng: "-77.5069" },
  Clarendon: { lat: "17.9833", lng: "-77.2500" },
  "St. Catherine": { lat: "17.9909", lng: "-76.9564" },
};

const Banner = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const originRef = useRef(null);
  const destinationRef = useRef(null);
  const pickupDateRef = useRef(null);
  const deliveryDateRef = useRef(null);
  const formRef = useRef(null);

  // Single "Start a Shipment" flow — always Ship Your Own; barrel drop-off is an add-on.
  const [activeSubTab] = useState("Ship Your Own Barrel");
  const [dropoffAddon, setDropoffAddon] = useState(false);
  const [openOrigin, setOpenOrigin] = useState(false);
  const [openDestination, setOpenDestination] = useState(false);
  const [origin, setOrigin] = useState(""); // Empty by default - no auto-selection
  // Destination is always Jamaica; the parish is what the shopper picks. It stays
  // empty until they choose so nothing is assumed on their behalf.
  const [destinationParish, setDestinationParish] = useState("");
  const destination = destinationParish ? DESTINATION_COUNTRY : "";
  const [quantity, setQuantity] = useState("");
  
  const [availableOrigins, setAvailableOrigins] = useState([]);
  // [{ name, available, comingSoon }] — what the origin dropdown renders.
  const [originOptions, setOriginOptions] = useState([]);
  // City -> {lat,lng} learned from the forwarders' own saved pricing rows.
  const [originCoords, setOriginCoords] = useState({});
  const [providersList, setProvidersList] = useState([]);
  // Until the forwarder list has come back we can't tell "no coverage" from
  // "not asked yet", and guessing would flash every city as "Coming soon".
  const [providersLoaded, setProvidersLoaded] = useState(false);

  useEffect(() => {
    if (!providersLoaded) return;

    const isOwn = activeSubTab === "Ship Your Own Barrel";
    const targetType = isOwn ? "own" : "dropoff";

    // Every city a forwarder has actually priced for this shipment type, plus the
    // coordinates they saved with it — so a brand-new city still gets a real
    // origin lat/lng for distance-based pickup pricing without anyone editing
    // the hardcoded CITY_COORDINATES table.
    const servedSet = new Set();
    const coords = {};
    providersList.forEach(provider => {
      if (provider.businessInfo && Array.isArray(provider.businessInfo.barrelPrices)) {
        provider.businessInfo.barrelPrices.forEach(bp => {
          if (bp.type === targetType && bp.originCountry) {
            const city = normalizeCity(bp.originCountry);
            servedSet.add(city);
            if (!coords[city] && bp.originLat && bp.originLong) {
              coords[city] = { lat: String(bp.originLat), lng: String(bp.originLong) };
            }
          }
        });
      }
    });
    setOriginCoords(coords);

    // Every city we advertise is listed whether or not anyone can fulfil it, so
    // visitors can see the roadmap. Coverage decides the rest: no forwarder has
    // priced this lane -> "Coming soon" and unselectable. A city a forwarder
    // priced but we don't advertise still shows up, and is bookable.
    const advertised = new Set(ADVERTISED_ORIGINS.map(normalizeCity));
    const names = Array.from(new Set([...advertised, ...servedSet])).filter(Boolean).sort();

    const options = names.map((name) => ({
      name,
      available: servedSet.has(name),
      comingSoon: !servedSet.has(name),
    }));
    setOriginOptions(options);

    const selectable = options.filter((o) => o.available).map((o) => o.name);
    setAvailableOrigins(selectable);

    // Drop a selection that is no longer offered (e.g. its forwarder withdrew).
    if (origin && !selectable.includes(origin)) {
      setOrigin("");
    }
  }, [activeSubTab, providersList, providersLoaded, origin]);

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
    } finally {
      // Even on failure we stop waiting, so the dropdown shows the advertised
      // cities as "Coming soon" rather than spinning on "Loading origins…".
      setProvidersLoaded(true);
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
    if (!destinationParish) return toast.error("Please select the destination parish in Jamaica");
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
      // Captured at the very first step so the shipment is categorised by parish
      // from the outset; it also pre-fills the recipient's address later on.
      parish: destinationParish,
      pickup_date: isRequestBarrel ? null : pickupDate,
      delivery_date: isRequestBarrel ? null : deliveryDate,
      dropoff_addon: dropoffAddon ? 1 : 0,
      items: finalItems,
      // Prefer the forwarder's own saved coordinates so cities added by onboarding
      // are located correctly; fall back to the built-in table.
      origin_lat: (originCoords[origin] || CITY_COORDINATES[origin])?.lat || "",
      origin_long: (originCoords[origin] || CITY_COORDINATES[origin])?.lng || "",
      destination_lat: (PARISH_COORDINATES[destinationParish] || CITY_COORDINATES[destination])?.lat || "",
      destination_long: (PARISH_COORDINATES[destinationParish] || CITY_COORDINATES[destination])?.lng || "",
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
      <section className="bg-[#F8FAFA] pt-4 md:pt-5 pb-2 md:pb-3 px-4 md:px-6 flex flex-col items-center overflow-hidden relative">

        {/* Container Image (Layered on top) */}
        <div className="relative mt-0 md:mt-[-28px] mb-1 md:mb-2 z-30 w-full max-w-[400px] flex justify-center">
          <img
            src={container}
            alt="VerShip — shipping barrels to Jamaica made easy"
            className="w-full object-contain drop-shadow-[0_16px_18px_rgba(0,0,0,0.15)]"
          />
        </div>

        {/* Brand copy & social proof */}
        <div className="flex flex-col items-center gap-2 md:gap-2.5 relative z-40 max-w-2xl text-center px-4">
          {/* Eyebrow / context kicker */}
          <span className="inline-flex items-center gap-2 text-[11px] md:text-xs font-semibold uppercase tracking-[0.18em] text-[#0D4D4D]/80">
            <span className="w-1.5 h-1.5 rounded-full bg-[#C1A35E]" aria-hidden="true" />
            Door-to-door delivery to Jamaica
          </span>

          {/* Headline — the hero artwork above already reads "Shipping Barrels to
              Jamaica Made Easy", so showing a second version of the same line here
              just repeated the message. The text lives on as a visually-hidden h1
              so search engines and screen readers still get a real page heading
              (the artwork's words are baked-in pixels they can't read). */}
          <h1 className="sr-only">Shipping Barrels to Jamaica Made Easy</h1>

          {/* Supporting copy */}
          <p className="text-[#595d5e] text-sm md:text-[17px] leading-snug font-normal">
            Compare rates from trusted shipping companies, book the best option, and ship your barrel — all on one platform.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-0.5">
            <button
              onClick={() => navigate("/prepacked-barrel")}
              className="bg-[#C1A35E] text-[#071618] px-6 h-[42px] rounded-full font-bold text-sm md:text-base hover:bg-[#E5C78A] transition-all flex items-center justify-center shadow-[0_8px_16px_rgba(193,163,94,0.25)]"
            >
              Order VerShip Pre-Packed Barrel Now
            </button>
            {/* Sits next to "Order VerShip Pre-Packed Barrel Now", so it names the
                other choice — ship your own barrel — instead of the mechanism.
                "Get quotes" now lives on the form's submit button below, which is
                where quoting actually happens. Width is auto: the longer label no
                longer fits the old fixed 168px. */}
            <button
              onClick={scrollToForm}
              className="bg-[#0D4D4D] text-white px-6 h-[42px] rounded-full font-bold text-sm md:text-base hover:bg-[#0A3D3D] transition-all flex items-center justify-center whitespace-nowrap"
            >
              Ship My Own Barrel
            </button>
          </div>
        </div>
      </section>

      {/* Form Section */}
      <section id="booking-form" ref={formRef} className="bg-[#071618] pt-4 pb-6 md:pt-5 md:pb-8 px-4 md:px-6">
        <div className="max-w-[1326px] mx-auto">
          {/* Single entry point: one shipment flow; barrel drop-off is an add-on below. */}
          <div className="flex justify-center mb-[-1px] relative z-20">
            <div className="relative">
              <span className="px-8 md:px-12 py-3 md:py-4 font-medium text-sm md:text-[20px] text-[#D4B97C] relative z-10 inline-block">
                Start a Shipment
              </span>
              <div className="absolute inset-0 border-t border-l-0 border-r-0 border-white/10 rounded-t-[24px] bg-[#051111] -z-10" />
              <div className="absolute -left-[24px] bottom-0 w-[24px] h-[24px] overflow-hidden pointer-events-none">
                <div className="absolute top-0 right-0 w-full h-full border-b border-r-0 border-white/10 rounded-br-[24px] bg-transparent shadow-[10px_10px_0_0_#051111]" />
              </div>
              <div className="absolute -right-[24px] bottom-0 w-[24px] h-[24px] overflow-hidden pointer-events-none">
                <div className="absolute top-0 left-0 w-full h-full border-b border-l-0 border-white/10 rounded-bl-[24px] bg-transparent shadow-[-10px_10px_0_0_#051111]" />
              </div>
            </div>
          </div>

          {/* Form Container */}
          <div className="bg-[#051111] border border-white/10 rounded-[16px] md:rounded-[20px] p-5 md:p-7 pb-6 md:pb-8 shadow-2xl relative z-10">
            {/* Top Row: Origin & Destination */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
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
                    {originOptions.length === 0 && (
                      <li className="px-6 py-3 text-white/30 text-sm">Loading origins…</li>
                    )}
                    {originOptions.map(({ name, available, comingSoon }) => (
                      <li key={name} role="option" aria-selected={origin === name} aria-disabled={!available}>
                        <button
                          type="button"
                          disabled={!available}
                          onClick={() => {
                            setOrigin(name);
                            setOpenOrigin(false);
                          }}
                          className={`w-full text-left px-6 py-3 font-medium transition-colors text-sm md:text-base flex items-center justify-between gap-3
                          ${!available
                              ? "text-white/25 cursor-not-allowed"
                              : "text-white/80 hover:bg-[#C1A35E] hover:text-black cursor-pointer"
                            }`}
                        >
                          <span>{name}</span>
                          {comingSoon && (
                            <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-[#D4B97C] border border-[#D4B97C]/40 rounded-full px-2 py-0.5">
                              Coming soon
                            </span>
                          )}
                        </button>
                      </li>
                    ))}
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
                  {/* The country is fixed, so it is stated up front and the control
                      is really a parish picker. */}
                  <span className="flex items-baseline gap-2 min-w-0">
                    <span className="text-sm md:text-base text-white/70">{DESTINATION_COUNTRY}</span>
                    <span className={`text-sm md:text-base truncate ${destinationParish ? 'text-white/70' : 'text-white/30'}`}>
                      {destinationParish ? `· ${destinationParish}` : '· Select parish'}
                    </span>
                  </span>
                  <img
                    src={iccon}
                    alt=""
                    className="w-5 h-5 object-contain shrink-0"
                  />
                </button>
                {openDestination && (
                  <ul role="listbox" aria-label="Destination" className="absolute top-full left-0 w-full mt-2 bg-[#121A19] border border-white/10 rounded-lg shadow-2xl overflow-hidden z-50 max-h-60 overflow-y-auto">
                    {JAMAICA_PARISHES.map((item) => (
                      <li key={item} role="option" aria-selected={destinationParish === item}>
                        <button
                          type="button"
                          onClick={() => { setDestinationParish(item); setOpenDestination(false); }}
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
            <div className="flex flex-col md:flex-row gap-4 mb-4 md:mb-6">
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
                    aria-label="Number of barrels"
                    placeholder="Enter number of barrels e.g. 2"
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

            {/* Barrel drop-off add-on — priced from each forwarder's drop-off rate at checkout */}
            <label className="flex items-start sm:items-center justify-center gap-3 mt-4 cursor-pointer select-none group">
              <input
                type="checkbox"
                checked={dropoffAddon}
                onChange={(e) => setDropoffAddon(e.target.checked)}
                className="mt-1 sm:mt-0 w-5 h-5 rounded accent-[#D4B97C] cursor-pointer"
              />
              <span className="text-white/80 text-sm md:text-base group-hover:text-white transition-colors">
                Also request barrel drop-off
                <span className="text-white/50"> — we deliver empty barrels to you first (add-on)</span>
              </span>
            </label>

            <div className="flex justify-center mt-2 md:mt-4">
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