import React, { useState, useEffect } from "react";
import Commonbanner from "../components/Commonbanner";
import { delivery } from "../common/common-assets/assets-images";
import { useNavigate } from "react-router-dom";
import api, { API_URL } from "../api/axios";
import { toast } from "sonner";
import { Package, MapPin, Calendar, Star } from "lucide-react";
import { getAvailableQuotes, createBooking } from "../api/cms";
import { selectRateCard, isPricingV2 } from "../utils/pricing";
const Quotes = () => {
  const [activeId, setActiveId] = useState(null);
  const [bookingRequest, setBookingRequest] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [providers, setProviders] = useState([]);
  const [adminCommission, setAdminCommission] = useState("0");
  const [serviceFeePercent, setServiceFeePercent] = useState("0");
  const [userSurvey, setUserSurvey] = useState("");
  const navigate = useNavigate();

  // Selected Providers
  const [selectedProviderIds, setSelectedProviderIds] = useState([]);

  // Form State
  const [addOns, setAddOns] = useState({
    "Customs clearance": false,
    "Insurance": false,
    "Pre-inspection": false
  });

  const [primaryConsignee, setPrimaryConsignee] = useState({
    name: "",
    contact: "",
    email: "",
    address: ""
  });

  const [secondaryConsignee, setSecondaryConsignee] = useState({
    name: "",
    contact: "",
    email: "",
    address: ""
  });

  const [shipper, setShipper] = useState({
    sameAsOrigin: false,
    name: "",
    email: "",
    contact: "",
    address: ""
  });

  const [delivery, setDelivery] = useState({
    sameAsOrigin: false, // Assuming "Same as Origin" checkbox on UI means something, or maybe "Same as Consignee"? UI says "Same as Origin Address" which is weird for Delivery. I'll stick to UI labels.
    name: "",
    email: "",
    contact: "",
    address: ""
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await getAvailableQuotes();
        console.log("getAvailableQuotes=----------->>", response);
        if (response.status) {
          setBookingRequest(response.body.bookingRequest);
          setProviders(response.body.providers);
          setAdminCommission(response.body.adminCommission || "0");
          if (response.body.serviceFeePercent != null) {
            setServiceFeePercent(response.body.serviceFeePercent);
          }
          setUserSurvey(response.body.userSurvey || "");
          if (response.body.providers.length > 0) {
            setActiveId(response.body.providers[0].id);
          } else {
            toast.error("No providers found for your location or shipment type.", { id: "no-providers" });
            navigate("/");
          }
        }
      } catch (error) {
        toast.error(error.response?.data?.message || "Failed to fetch quotes", { id: "no-providers" });
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleProviderSelect = (id) => {
    setSelectedProviderIds(prev => {
      // If already selected, deselect it. Otherwise, select only this one.
      return prev.includes(id) ? [] : [id];
    });
  };

  const handleAddOnChange = (item) => {
    setAddOns(prev => ({ ...prev, [item]: !prev[item] }));
  };

  // Inline errors
  const [errors, setErrors] = useState({});

  const handleInputChange = (section, field, value) => {
    let formattedValue = value.replace(/^\s+/, "");
    if (field === 'phone' || field === 'contact') {
      formattedValue = formattedValue.replace(/[^0-9]/g, "");
    }

    const setters = {
      primaryConsignee: setPrimaryConsignee,
      secondaryConsignee: setSecondaryConsignee,
      shipper: setShipper,
      delivery: setDelivery
    };

    if (setters[section]) {
      setters[section](prev => ({ ...prev, [field]: formattedValue }));
      setErrors(prev => ({ ...prev, [`${section}_${field}`]: "" }));
    }
  };

  const validate = () => {
    const e = {};
    if (selectedProviderIds.length === 0) e.providers = "Please select at least one provider.";


    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) {
      // toast.error("Please fix the errors in the form before continuing.");
      return;
    }

    const payload = {
      booking_request_id: bookingRequest.id,
      providerIds: selectedProviderIds,
      primary_name: primaryConsignee.name,
      primary_phone_number: primaryConsignee.contact,
      primary_email: primaryConsignee.email,
      primary_address: primaryConsignee.address,
      secondary_name: secondaryConsignee.name,
      secondary_phone_number: secondaryConsignee.contact,
      secondary_email: secondaryConsignee.email,
      secondary_address: secondaryConsignee.address,
      shiper_name: shipper.name,
      shiper_phone_number: shipper.contact,
      shiper_email: shipper.email,
      shiper_address: shipper.address,
      consignee_name: delivery.name,
      consignee_phone_number: delivery.contact,
      consignee_email: delivery.email,
      consignee_address: delivery.address,
      addOns: Object.keys(addOns).filter(k => addOns[k]),
      barrel_type: "dropoff",
    };

    try {
      const response = await createBooking(payload);
      if (response.success) {
        toast.success("Booking created successfully!");
        const bookings = Array.isArray(response.body) ? response.body : response.body?.bookings;
        const feePct = Array.isArray(response.body)
          ? serviceFeePercent
          : (response.body?.serviceFeePercent ?? serviceFeePercent);
        const comm = Array.isArray(response.body)
          ? adminCommission
          : (response.body?.adminCommission ?? adminCommission);
        navigate("/detail", {
          state: { bookings, bookingRequest, providers, adminCommission: comm, serviceFeePercent: feePct },
        });
      } else {
        toast.error(response.message || "Failed to create booking.");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "An error occurred.");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a1612] flex items-center justify-center text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-400"></div>
      </div>
    );
  }

  return (
    <div className=" bg-gradient-to-b from-[#243d34] to-[#0a1612]">
      <Commonbanner title="Best Quotes" />

      {/* Shipper Detail Section (Booking Request Summary) */}

      {/* Providers List Section */}
      <div className="container mx-auto">
        <div className="py-15">
          {providers.length === 0 ? (
            <div className="text-center py-20 text-white/50">
              <Package size={48} className="mx-auto mb-4 opacity-20" />
              <p className="text-xl">No shippers match your requirements right now.</p>
              <p className="text-sm mt-2">Try adjusting your load details or origin/destination.</p>
            </div>
          ) : (() => {
            // Providers are pre-sorted by the server based on user's survey preference
            const bestQuotes = providers.filter(p => p.isBestQuote);
            const otherResults = providers.filter(p => !p.isBestQuote);

            // Detailed multi-survey label
            const getSurveyLabel = () => {
              const ids = userSurvey.split(',').map(s => s.trim()).filter(Boolean);
              if (ids.length === 0) return '💰 Sorted by: Lowest Price';

              const labels = ids.map(id => {
                if (id === '1') return '⚡ Fast Delivery';
                if (id === '2') return '🛡️ Safety & Reliability';
                if (id === '3') return '💰 Lowest Price';
                return id;
              });
              return `🎯 Priorities: ${labels.join(' + ')}`;
            };

            const renderProvider = (providerDetail, displayIdx, isBest) => {
              const provider = providerDetail.provider;
              const active = selectedProviderIds.includes(provider.id);

              return (
                <div
                  key={providerDetail.id}
                  onClick={() => handleProviderSelect(provider.id)}
                  className={`
                    relative w-full rounded-xl p-4 sm:p-5 sm:px-10 mb-4 transition-all duration-300 cursor-pointer
                    ${active
                      ? "bg-gradient-to-r from-[#244536] via-[#1b352b] to-[#0b1914] border border-[#fff] shadow-lg"
                      : "bg-[#2D413F]"
                    }
                  `}
                >

                  <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                    {/* Left Side */}
                    <div className="flex flex-col sm:flex-row gap-4 sm:gap-[40px] w-full">
                      {/* Price Badge */}
                      <div className="bg-[#FFC929] text-black font-bold px-5 sm:px-8 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm h-fit whitespace-nowrap">
                        ${(() => {
                          // Route-aware card selection — keeps this card in sync with checkout.
                          const card = selectRateCard(providerDetail.barrelPrices, {
                            type: 'dropoff',
                            origin: bookingRequest?.origin,
                            destination: bookingRequest?.destination,
                          });
                          const price = card
                            ? (isPricingV2(card) ? card.seaFreightPrice : card.basePrice)
                            : null;
                          return parseFloat(price || 0);
                        })()}
                      </div>

                      {/* Content */}
                      <div className="w-full">
                        <div className="flex items-center gap-3">
                          <h3 className="text-white text-[18px] sm:text-[20px] lg:text-[23px] font-bold">
                            {isBest ? "Best Quote" : `Quote ${displayIdx}`}
                          </h3>
                        </div>
                      </div>
                    </div>

                    {/* Right Side (Selection only) */}
                    <div className="flex items-center justify-center w-full lg:w-auto">
                      <div
                        className={`
                          w-5 h-5 sm:w-6 sm:h-6 rounded-md border-2 flex items-center
                          ${active
                            ? "bg-[#FFD233] border-[#FFD233]"
                            : "border-white/30"
                          }
                        `}
                      >
                        {active && (
                          <span className="text-black font-bold text-xs sm:text-sm">✓</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            };

            return (
              <>
                {/* Survey badge */}
                <div className="mb-4">
                  <span className="inline-block bg-[#1b352b] border border-[#9fe0b8]/30 text-[#9fe0b8] text-xs font-medium px-4 py-2 rounded-full shadow-sm">
                    {getSurveyLabel()}
                  </span>
                </div>

                {/* Best Quote Section */}
                <div className="mb-10">
                  {bestQuotes.map((p, i) => renderProvider(p, i + 1, true))}
                </div>

                {/* Other Results Section */}
                {otherResults.length > 0 && (
                  <div className="mt-15">
                    <h3 className="text-white text-[28px] sm:text-[36px] font-bold mb-6">Other Results</h3>
                    {otherResults.map((p, i) => renderProvider(p, bestQuotes.length + i + 1, false))}
                  </div>
                )}
              </>
            );
          })()}
        </div>
      </div>

      <div className="divider h-[1px] bg-[#727272] mb-10"></div>
      <div className="container mx-auto">
        <div className="py-10 pt-0 text-white">
          {/* Add-Ons */}
          {/* 
          <div className="mb-8">
            <h3 className="md:text-[42px] text-[28px] font-semibold">Add-Ons</h3>
            <p className="text-lg font-medium mb-3">Customize Your Shipment</p>

            <div className="space-y-6 ">
              {["Customs clearance", "Insurance", "Pre-inspection"].map(
                (item, i) => (
                  <label key={i} className="flex items-center gap-3 text-[21px] font-medium ">
                    <input
                      type="checkbox"
                      className="w-[30px] h-[30px]
    appearance-none
    rounded-sm
    border-1 border-[#4E6B5D]
    bg-transparent
    cursor-pointer
    relative

    checked:bg-[#FFD233]
    checked:border-[#FFD233]

    after:content-['✓']
    after:absolute
    after:text-black
    after:text-[20px]
    after:font-bold
    after:left-1/2
    after:top-1/2
    after:-translate-x-1/2
    after:-translate-y-1/2
    after:opacity-0

    checked:after:opacity-100 "
                    />
                    <div className="absolute inset-0 z-0 h-0" onClick={(e) => { e.preventDefault(); handleAddOnChange(item); }} />
                    {item}
                  </label>
                )
              )}
            </div>
          </div>
          */}

          {/* Consignee Contact Information */}
          {/* 
          <div>
            <h3 className="md:text-[42px] text-[25px] font-semibold mb-1">
              Consignee Contact Information
            </h3>
            <p className="text-lg font-medium  mb-4">
              Is Consignee a Person or Business
            </p>

            <div className="bg-[#2D413F] rounded-xl p-6 md:px-14 px-10">
              <h4 className="text-[25px] font-semibold mb-3">Primary Contact</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {[
                  { label: "Name", field: "name" },
                  { label: "Contact", field: "contact" },
                  { label: "Email", field: "email" },
                  { label: "Delivery Address", field: "address" }
                ].map((item, i) => (
                  <div key={i}>
                    <label className="text-lg text-white font-medium">{item.label}</label>
                    <input
                      type="text"
                      placeholder="enter"
                      value={primaryConsignee[item.field]}
                      onChange={(e) => handleInputChange('primaryConsignee', item.field, e.target.value)}
                      className="w-full mt-1 bg-transparent border border-[#4E6B5D] rounded-[14px] px-3 py-4 text-sm text-capitalize text-white focus:outline-none focus:border-[#9fe0b8]"
                    />
                  </div>
                ))}
              </div>

              <h4 className="text-[25px] font-semibold mb-3">Secondary Contact</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { label: "Name", field: "name" },
                  { label: "Contact", field: "contact" },
                  { label: "Email", field: "email" },
                  { label: "Delivery Address", field: "address" }
                ].map((item, i) => (
                  <div key={i}>
                    <label className="text-lg text-white font-medium">{item.label}</label>
                    <input
                      type="text"
                      placeholder="enter"
                      value={secondaryConsignee[item.field]}
                      onChange={(e) => handleInputChange('secondaryConsignee', item.field, e.target.value)}
                      className="w-full mt-1 bg-transparent border border-[#4E6B5D] rounded-[14px] px-3 py-4 text-sm text-capitalize text-white focus:outline-none focus:border-[#9fe0b8]"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
          */}

          {/* Address Sections */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
            {/* Add Shipper Address */}
            {/* 
            <div>
              <h4 className="text-[25px] font-semibold mb-2">Add Shipper Address</h4>
              <label className="text-sm text-white block mb-3">
                <input
                  type="checkbox"
                  className="w-[15px] top-[3px] h-[15px] me-3
    appearance-none
    rounded-sm
    border-1 border-[#4E6B5D]
    bg-transparent
    cursor-pointer
    relative

    checked:bg-[#FFD233]
    checked:border-[#FFD233]

    after:content-['✓']
    after:absolute
    after:text-black
    after:text-[20px]
    after:font-bold
    after:left-1/2
    after:top-1/2
    after:-translate-x-1/2
    after:-translate-y-1/2
    after:opacity-0

    checked:after:opacity-100 "
                />
                Same as Origin Address
              </label>

              {["Name", "Email", "Contact", "Address"].map((field, i) => (
                <div key={i} className="mb-3">
                  <label className="text-lg text-white font-medium">{field}</label>
                  <input
                    type="text"
                    placeholder="enter"
                    value={shipper[field.toLowerCase()]}
                    onChange={(e) => handleInputChange('shipper', field.toLowerCase(), e.target.value)}
                    className="w-full mt-1 bg-transparent border border-[#4E6B5D] rounded-[14px] px-3 py-4 text-sm text-capitalize text-white focus:outline-none focus:border-[#9fe0b8]"
                  />
                </div>
              ))}
            </div>
            */}

            {/* Add Delivery Address */}
            {/* <div className="md:col-span-2 max-w-2xl mx-auto w-full">
              <h4 className="text-[25px] font-semibold mb-3">Add Delivery Address</h4>
              <label className="text-sm text-white block mb-3">
                <input type="checkbox"
                  checked={delivery.sameAsOrigin}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setDelivery(prev => ({
                      ...prev,
                      sameAsOrigin: checked,
                      address: checked ? (bookingRequest?.drop_off_address || "") : prev.address
                    }));
                  }}
                  className="w-[15px] top-[3px] h-[15px] me-3
    appearance-none
    rounded-sm
    border-1 border-[#4E6B5D]
    bg-transparent
    cursor-pointer
    relative

    checked:bg-[#FFD233]
    checked:border-[#FFD233]

    after:content-['✓']
    after:absolute
    after:text-black
    after:text-[20px]
    after:font-bold
    after:left-1/2
    after:top-1/2
    after:-translate-x-1/2
    after:-translate-y-1/2
    after:opacity-0

    checked:after:opacity-100" />
                Same as Origin Address
              </label>

              {["Name", "Email", "Contact", "Address"].map((field, i) => (
                <div key={i} className="mb-3">
                  <label className="text-lg text-white font-medium">{field}</label>
                  <input
                    type="text"
                    placeholder="enter"
                    value={delivery[field.toLowerCase()]}
                    onChange={(e) => handleInputChange('delivery', field.toLowerCase(), e.target.value)}
                    className="w-full mt-1 bg-transparent border border-[#4E6B5D] rounded-[14px] px-3 py-4 text-sm text-capitalize text-white focus:outline-none focus:border-[#9fe0b8]"
                  />
                </div>
              ))}
            </div> */}
          </div>

          {/* Button */}
          <div className="flex justify-center mt-10">
            <button
              onClick={handleSubmit}
              disabled={selectedProviderIds.length === 0}
              className={`text-md font-semibold px-20 py-[20px] rounded-full transition ${providers.length === 0
                ? "bg-gray-600 text-gray-400 cursor-not-allowed opacity-50"
                : "bg-gradient-to-r from-[#FFB800] via-[#FFD24D] to-[#FFE58F] text-black hover:brightness-110"
                }`}
            >
              Review & Order
            </button>
          </div>
        </div>
      </div>


    </div>
  );
};

export default Quotes;
