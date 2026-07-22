import React, { useState, useEffect } from "react";
import { shipp, submit, time } from "../common/common-assets/assets-images";
import { useNavigate } from "react-router-dom";
import { completeProfile, createStripeAccount } from "../api/cms";
import MultiSelect from "../components/MultiSelect";
import { toast } from "sonner";
import { FaSpinner, FaPlus, FaTrash } from "react-icons/fa";
import SuccessPopup from "../components/SuccessPopup";
import { JAMAICA_PARISHES } from "../utils/parishes";

const ORIGIN_CITIES = [
  "Fort Lauderdale, FL",
  "Miami, FL",
  "Pittsburgh, PA",
  "Orlando, FL",
];

const DESTINATION_CITIES = [
  "Kingston, Jamaica",
];

const CITY_COORDINATES = {
  "Fort Lauderdale, FL": { lat: "26.1224", lng: "-80.1373" },
  "Miami, FL": { lat: "25.7617", lng: "-80.1918" },
  "Pittsburgh, PA": { lat: "40.4387", lng: "-79.9972" },
  "Orlando, FL": { lat: "28.4778279", lng: "-81.2880713" },
};

const TRANSIT_TIME_NUMBERS_OWN = ["14", "21", "30"];
const TRANSIT_TIME_NUMBERS_DROPOFF = ["2", "3", "4"];
const TRANSIT_TIME_UNITS = ["days"];

const SHIPMENT_CONTENTS_OPTIONS = [
  "Food",
  "Household items",
  "Electronics & small appliances",
  "Clothes",
  "Toiletries",
  "Goods for resale"
];

const MAX_PRICE = 999999999.99;

// Sanitize a money-style text input: digits + single dot, max 2 decimals, capped.
const sanitizeMoney = (value) => {
  let fv = String(value ?? "").replace(/^\s+/, "").replace(/[^0-9.]/g, "");
  const pts = fv.split('.');
  if (pts.length > 2) fv = pts[0] + '.' + pts.slice(1).join('');
  const dec = fv.split('.')[1];
  if (dec && dec.length > 2) fv = fv.split('.')[0] + '.' + dec.slice(0, 2);
  if (fv !== "" && fv !== ".") {
    const n = parseFloat(fv);
    if (!isNaN(n) && n > MAX_PRICE) fv = MAX_PRICE.toFixed(2);
  }
  return fv;
};

const emptyParishFees = () =>
  JAMAICA_PARISHES.reduce((acc, p) => { acc[p] = { first: "", additional: "" }; return acc; }, {});

const createBarrelConfig = () => ({
  originCountry: "",
  destinationCountry: "",
  basePrice: "",
  validFrom: "",
  validTo: "",
  transitTime: "",
  shipmentContents: "",
  originLat: "",
  originLong: "",
  destinationLat: "",
  destinationLong: "",
  // Simplified pricing (v2)
  pickupCharge: "",
  pickupRadius: "",
  extraMileageCost: "",
  seaFreightPrice: "",
  discount5to9: "",
  discount10plus: "",
  parishFees: emptyParishFees(),
});

const CONFIG_PRICE_FIELDS = ["seaFreightPrice", "discount5to9", "discount10plus", "pickupCharge", "pickupRadius", "extraMileageCost"];

const OWN_CONFIG_FIELDS = ["originCountry", "destinationCountry", "seaFreightPrice", "discount5to9", "discount10plus", "pickupCharge", "pickupRadius", "extraMileageCost", "transitTime"];
const DROPOFF_CONFIG_FIELDS = ["originCountry", "destinationCountry", "seaFreightPrice", "discount5to9", "discount10plus", "transitTime"];

const BuisnessUpload = () => {
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [stripeModalOpen, setStripeModalOpen] = useState(false);
  const [isStripeProcessing, setIsStripeProcessing] = useState(false);
  const [formData, setFormData] = useState({
    pricePerPound: "20",
    shipmentType: "",
    originCountry: "",
    destinationCountry: "",
    basePrice: "",
    pricePerMile: "",
    validFrom: "",
    validTo: "",
    transitTime: "",
    shipmentContents: "",
  });

  const [ownBarrelConfigs, setOwnBarrelConfigs] = useState([createBarrelConfig()]);

  const [dropOffBarrelConfigs, setDropOffBarrelConfigs] = useState([createBarrelConfig()]);

  const [selectedSubTypes, setSelectedSubTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState(null);
  const [errors, setErrors] = useState({});
  const [showBarrelForms, setShowBarrelForms] = useState(false);
  const [applyAllFees, setApplyAllFees] = useState({});

  const navigate = useNavigate();

  const logBusinessUpload = (step, payload) => {
    console.log(`[BusinessUpload] ${step}`, payload);
  };

  useEffect(() => {
    const userStr = localStorage.getItem("user");
    logBusinessUpload("init.localStorage.user.raw", userStr);
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        logBusinessUpload("init.localStorage.user.parsed", user);
        if (user && user.id) {
          setUserId(user.id);
          logBusinessUpload("init.userId.set", user.id);
        }
      } catch (e) {
        console.error("Error parsing user from localStorage", e);
      }
    } else {
      logBusinessUpload("init.localStorage.user.missing", null);
    }
  }, []);

  const handleStripeConnect = async () => {
    setIsStripeProcessing(true);
    try {
      const response = await createStripeAccount();
      if (response.success) {
        const url = response.body?.url || response.url;
        if (url) {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          console.log("Token and user removed - redirecting to Stripe");

          window.location.href = url;
          return;
        }
      }
      toast.error(response.message || "Failed to start Stripe Connect.");
    } catch (error) {
      console.error("Stripe connect error:", error);
      const errorMessage = error.response?.data?.message || error.message || "Unable to start Stripe Connect.";
      toast.error(errorMessage);
    } finally {
      setIsStripeProcessing(false);
    }
  };

  useEffect(() => {
    if (formData.shipmentType === "barrel" && selectedSubTypes.length > 0) {
      setShowBarrelForms(true);
    } else {
      setShowBarrelForms(false);
    }
    logBusinessUpload("state.barrelFormVisibility", {
      shipmentType: formData.shipmentType,
      selectedSubTypes,
      willShow: formData.shipmentType === "barrel" && selectedSubTypes.length > 0,
    });
  }, [selectedSubTypes, formData.shipmentType]);

  const validateField = (name, value, type = 'main') => {
    let error = "";
    const strValue = (value !== null && value !== undefined) ? String(value) : "";

    if (type === 'main') {
      switch (name) {
        case "shipmentType":
          if (!strValue) error = "Shipment type is required";
          break;
        default:
          break;
      }
    }

    if (type.startsWith('ownBarrel') || type.startsWith('dropOffBarrel')) {
      const [typePrefix, configIndexStr] = type.split('_');
      const configIndex = parseInt(configIndexStr);
      const isDropOff = typePrefix === 'dropOffBarrel';
      // Pickup fields only apply to own-barrel configs
      const pickupFields = ['pickupCharge', 'pickupRadius', 'extraMileageCost'];

      if (isDropOff && pickupFields.includes(name)) {
        return error;
      }

      switch (name) {
        case "originCountry":
          if (!strValue) error = "Origin city is required";
          break;
        case "destinationCountry":
          if (!strValue) error = "Destination city is required";
          break;
        case "seaFreightPrice":
          if (!strValue.trim()) error = "Sea freight price is required";
          else if (isNaN(strValue) || Number(strValue) <= 0) error = "Price must be greater than 0";
          break;
        case "discount5to9":
        case "discount10plus":
          if (strValue && (isNaN(strValue) || Number(strValue) < 0)) error = "Enter a valid discount";
          break;
        case "pickupCharge":
        case "extraMileageCost":
          if (strValue && (isNaN(strValue) || Number(strValue) < 0)) error = "Enter a valid amount";
          break;
        case "pickupRadius":
          if (strValue && (isNaN(strValue) || Number(strValue) < 0)) error = "Enter a valid distance";
          break;
        case "transitTime":
          if (!strValue) error = "Transit time is required";
          break;
        default:
          break;
      }
      setErrors(prev => ({ ...prev, [`${typePrefix}_${configIndex}_${name}`]: error }));
    } else {
      setErrors(prev => ({ ...prev, [`${type}_${name}`]: error }));
    }

    if (error) {
      logBusinessUpload("validation.field.error", { type, name, value, error });
    }

    return error;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    let formattedValue = value.replace(/^\s+/, "");

    if (name === "shipmentType") {
      logBusinessUpload("input.shipmentType.resettingState", {
        previousShipmentType: formData.shipmentType,
        nextShipmentType: formattedValue,
      });
      setSelectedSubTypes([]);
      setShowBarrelForms(false);
      setErrors(prev => ({ ...prev, main_sub_shipment_type: "" }));
      setOwnBarrelConfigs([createBarrelConfig()]);
      setDropOffBarrelConfigs([createBarrelConfig()]);
    }

    logBusinessUpload("input.main.change", {
      name,
      rawValue: value,
      formattedValue,
    });
    setFormData((prev) => ({ ...prev, [name]: formattedValue }));
    validateField(name, formattedValue, 'main');
  };

  const handleOwnBarrelChange = (index, e) => {
    const { name, value } = e.target;
    let formattedValue = value.replace(/^\s+/, "");

    if (CONFIG_PRICE_FIELDS.includes(name)) {
      formattedValue = sanitizeMoney(formattedValue);
    }

    logBusinessUpload("input.ownBarrel.change", {
      index,
      name,
      rawValue: value,
      formattedValue,
    });

    setOwnBarrelConfigs(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [name]: formattedValue };
      // basePrice mirrors the 1-4 barrel sea freight price so legacy quote
      // badges keep working.
      if (name === "seaFreightPrice") {
        updated[index].basePrice = formattedValue;
      }
      if (name === "originCountry" && CITY_COORDINATES[formattedValue]) {
        updated[index].originLat = CITY_COORDINATES[formattedValue].lat;
        updated[index].originLong = CITY_COORDINATES[formattedValue].lng;
      }
      if (name === "destinationCountry" && CITY_COORDINATES[formattedValue]) {
        updated[index].destinationLat = CITY_COORDINATES[formattedValue].lat;
        updated[index].destinationLong = CITY_COORDINATES[formattedValue].lng;
      }
      return updated;
    });

    validateField(name, formattedValue, `ownBarrel_${index}`);
  };

  const handleDropOffBarrelChange = (index, e) => {
    const { name, value } = e.target;
    let formattedValue = value.replace(/^\s+/, "");

    if (CONFIG_PRICE_FIELDS.includes(name)) {
      formattedValue = sanitizeMoney(formattedValue);
    }

    logBusinessUpload("input.dropOffBarrel.change", {
      index,
      name,
      rawValue: value,
      formattedValue,
    });

    setDropOffBarrelConfigs(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [name]: formattedValue };
      if (name === "seaFreightPrice") {
        updated[index].basePrice = formattedValue;
      }
      if (name === "originCountry" && CITY_COORDINATES[formattedValue]) {
        updated[index].originLat = CITY_COORDINATES[formattedValue].lat;
        updated[index].originLong = CITY_COORDINATES[formattedValue].lng;
      }
      if (name === "destinationCountry" && CITY_COORDINATES[formattedValue]) {
        updated[index].destinationLat = CITY_COORDINATES[formattedValue].lat;
        updated[index].destinationLong = CITY_COORDINATES[formattedValue].lng;
      }
      return updated;
    });
    validateField(name, formattedValue, `dropOffBarrel_${index}`);
  };

  const handleParishFeeChange = (index, isOwn, parish, field, value) => {
    const fv = sanitizeMoney(value);
    (isOwn ? setOwnBarrelConfigs : setDropOffBarrelConfigs)(prev => {
      const updated = [...prev];
      const fees = updated[index].parishFees || {};
      const entry = (fees[parish] && typeof fees[parish] === 'object') ? fees[parish] : { first: "", additional: "" };
      updated[index] = {
        ...updated[index],
        parishFees: { ...fees, [parish]: { ...entry, [field]: fv } }
      };
      return updated;
    });
  };

  const handleApplyAllParishFees = (index, isOwn) => {
    const key = `${isOwn ? 'own' : 'do'}_${index}`;
    const pair = applyAllFees[key] || {};
    const first = sanitizeMoney(pair.first || "");
    const additional = sanitizeMoney(pair.additional || "");
    if ((first === "" || first === ".") && (additional === "" || additional === ".")) {
      toast.error("Enter an amount to apply to all parishes");
      return;
    }
    const filled = JAMAICA_PARISHES.reduce((acc, p) => {
      acc[p] = { first, additional };
      return acc;
    }, {});
    logBusinessUpload("parishFees.applyAll", { index, isOwn, first, additional });
    (isOwn ? setOwnBarrelConfigs : setDropOffBarrelConfigs)(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], parishFees: filled };
      return updated;
    });
  };

  const addOwnBarrelConfig = () => {
    logBusinessUpload("ownBarrel.config.add", {
      currentCount: ownBarrelConfigs.length,
      nextCount: ownBarrelConfigs.length + 1,
    });
    setOwnBarrelConfigs(prev => [...prev, createBarrelConfig()]);
  };

  const removeOwnBarrelConfig = (index) => {
    logBusinessUpload("ownBarrel.config.remove.attempt", {
      index,
      currentCount: ownBarrelConfigs.length,
    });
    if (ownBarrelConfigs.length > 1) {
      setOwnBarrelConfigs(prev => prev.filter((_, i) => i !== index));
    }
  };

  const addDropOffBarrelConfig = () => {
    logBusinessUpload("dropOffBarrel.config.add", {
      currentCount: dropOffBarrelConfigs.length,
      nextCount: dropOffBarrelConfigs.length + 1,
    });
    setDropOffBarrelConfigs(prev => [...prev, createBarrelConfig()]);
  };

  const removeDropOffBarrelConfig = (index) => {
    logBusinessUpload("dropOffBarrel.config.remove.attempt", {
      index,
      currentCount: dropOffBarrelConfigs.length,
    });
    if (dropOffBarrelConfigs.length > 1) {
      setDropOffBarrelConfigs(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    logBusinessUpload("submit.start", {
      userId,
      formData,
      selectedSubTypes,
      ownBarrelConfigs,
      dropOffBarrelConfigs,
    });
    const newErrors = {};

    const shipmentTypeError = validateField("shipmentType", formData.shipmentType, 'main');
    if (shipmentTypeError) newErrors.main_shipmentType = shipmentTypeError;

    if (["barrel", "box", "container"].includes(formData.shipmentType) && selectedSubTypes.length === 0) {
      newErrors.main_sub_shipment_type = "At least one sub-type is required";
    }

    if (selectedSubTypes.includes("Ship Your Own Barrel")) {
      ownBarrelConfigs.forEach((config, index) => {
        OWN_CONFIG_FIELDS.forEach(key => {
          const error = validateField(key, config[key], `ownBarrel_${index}`);
          if (error) newErrors[`ownBarrel_${index}_${key}`] = error;
        });
      });
    }

    if (selectedSubTypes.includes("Request Barrel Drop-Off")) {
      dropOffBarrelConfigs.forEach((config, index) => {
        DROPOFF_CONFIG_FIELDS.forEach(key => {
          const error = validateField(key, config[key], `dropOffBarrel_${index}`);
          if (error) newErrors[`dropOffBarrel_${index}_${key}`] = error;
        });
      });
    }

    logBusinessUpload("submit.validation.completed", {
      newErrors,
      hasBlockingErrors: Object.values(newErrors).some(err => err),
    });

    if (Object.values(newErrors).some(err => err)) {
      logBusinessUpload("submit.validation.failed", {
        newErrors,
        formData,
        selectedSubTypes,
      });
      setErrors(newErrors);
      toast.error("Please fix the errors in the form");
      return;
    }

    setLoading(true);
    logBusinessUpload("submit.validation.passed", {
      userId,
      shipmentType: formData.shipmentType,
      selectedSubTypes,
    });
    logBusinessUpload("submit.apiCall.preparing", {
      providerId: userId,
      shipmentType: formData.shipmentType,
      sub_shipment_type: selectedSubTypes
    });
    try {
      const firstOwn = ownBarrelConfigs[0];
      const firstDropOff = dropOffBarrelConfigs[0];
      const barrelDetails = selectedSubTypes.includes("Ship Your Own Barrel") ? firstOwn : (selectedSubTypes.includes("Request Barrel Drop-Off") ? firstDropOff : null);

      logBusinessUpload("submit.barrelDetails.selected", {
        selectedSubTypes,
        firstOwn,
        firstDropOff,
        barrelDetails,
      });

      // Map a config to the API shape: v2 simplified pricing plus zeroed
      // legacy fields so old readers don't crash.
      const buildBarrelPayload = (config, isDropOff = false) => ({
        // v2 simplified pricing
        pickupCharge: isDropOff ? "0" : (config.pickupCharge || "0"),
        pickupRadius: isDropOff ? "0" : (config.pickupRadius || "0"),
        extraMileageCost: isDropOff ? "0" : (config.extraMileageCost || "0"),
        seaFreightPrice: config.seaFreightPrice || "0",
        discount5to9: config.discount5to9 || "0",
        discount10plus: config.discount10plus || "0",
        parishFees: JAMAICA_PARISHES.reduce((acc, p) => {
          const entry = config.parishFees?.[p];
          acc[p] = {
            first: (entry && typeof entry === 'object' ? entry.first : entry) || "0",
            additional: (entry && typeof entry === 'object' ? entry.additional : "") || "0",
          };
          return acc;
        }, {}),
        // legacy fields still consumed elsewhere
        basePrice: config.seaFreightPrice || "0",
        pricePerMile: "0",
        customsAndHandling: "0",
        freeMiles: "0",
        originCountry: config.originCountry || "",
        destinationCountry: config.destinationCountry || "",
        originLat: config.originLat || (CITY_COORDINATES[config.originCountry]?.lat || ""),
        originLong: config.originLong || (CITY_COORDINATES[config.originCountry]?.lng || ""),
        destinationLat: config.destinationLat || (CITY_COORDINATES[config.destinationCountry]?.lat || ""),
        destinationLong: config.destinationLong || (CITY_COORDINATES[config.destinationCountry]?.lng || ""),
        transitTime: config.transitTime || "",
        shipmentContents: config.shipmentContents || "",
        isVolumeDiscount: false,
        discountAfter: 0,
        discountPercent: 0,
        barrelPrices: [{ quantity: 1, price: config.seaFreightPrice || "0", discount: "0" }],
        flatPickupCharge: "0",
        pickupFreeMiles: "0",
        pickupPerMileCharge: "0",
        flatDeliveryCharge: "0",
        deliveryFreeMiles: "0",
        deliveryPerMileCharge: "0"
      });

      const payload = {
        providerId: userId,
        pricePerPound: formData.pricePerPound,
        shipmentType: formData.shipmentType,
        sub_shipment_type: selectedSubTypes,
        basePrice: barrelDetails?.seaFreightPrice || "0",
        transitTime: barrelDetails?.transitTime || "",
        shipmentContents: barrelDetails?.shipmentContents || "",
        originCountry: barrelDetails?.originCountry || "",
        destinationCountry: barrelDetails?.destinationCountry || "",
        originLat: barrelDetails?.originLat || (barrelDetails?.originCountry ? CITY_COORDINATES[barrelDetails.originCountry]?.lat : "") || "",
        originLong: barrelDetails?.originLong || (barrelDetails?.originCountry ? CITY_COORDINATES[barrelDetails.originCountry]?.lng : "") || "",
        destinationLat: barrelDetails?.destinationLat || (barrelDetails?.destinationCountry ? CITY_COORDINATES[barrelDetails.destinationCountry]?.lat : "") || "",
        destinationLong: barrelDetails?.destinationLong || (barrelDetails?.destinationCountry ? CITY_COORDINATES[barrelDetails.destinationCountry]?.lng : "") || "",
        pricePerMile: "0",
        customsAndHandling: "0",
        freeMiles: "0",
        flatPickupCharge: "0",
        pickupFreeMiles: "0",
        pickupPerMileCharge: "0",
        flatDeliveryCharge: "0",
        deliveryFreeMiles: "0",
        deliveryPerMileCharge: "0",
        barrelOptions: {
          ownBarrel: selectedSubTypes.includes("Ship Your Own Barrel")
            ? ownBarrelConfigs.map(config => buildBarrelPayload(config, false))
            : null,
          dropOffBarrel: selectedSubTypes.includes("Request Barrel Drop-Off")
            ? dropOffBarrelConfigs.map(config => buildBarrelPayload(config, true))
            : null,
        },
        profile_step: 6,
        isFinalStep: true,
      };
      const response = await completeProfile(payload);
      logBusinessUpload("submit.apiCall.response", response);
      if (response.status === 200 || response.status === "1") {
        logBusinessUpload("submit.success", {
          status: response.status,
          message: response.message,
          hasUser: Boolean(response.body && response.body.user),
        });
        if (response.body && response.body.user) {
          localStorage.setItem("user", JSON.stringify(response.body.user));
          window.dispatchEvent(new Event('userUpdated'));
        }
        toast.success("Account created successfully. Please connect your Stripe account to receive payments.");
        setStripeModalOpen(true);
        return;
      } else {
        logBusinessUpload("submit.nonSuccessResponse", response);
        toast.error(response.message || "Something went wrong");
      }
    } catch (error) {
      logBusinessUpload("submit.apiCall.error", {
        message: error?.message,
        status: error?.response?.status,
        data: error?.response?.data,
        stack: error?.stack,
      });
      console.error("Upload update error:", error);
      toast.error(error.response?.data?.message || "Failed to update pricing details");
    } finally {
      setLoading(false);
      logBusinessUpload("submit.finally", { loading: false });
    }
  };

  const getSubOptions = () => {
    switch (formData.shipmentType) {
      case "barrel":
        return [
          { id: "Ship Your Own Barrel", label: "Ship Your Own Barrel" },
          { id: "Request Barrel Drop-Off", label: "Request Barrel Drop-Off" }
        ];
      case "box":
        return [
          { id: "Small Box", label: "Small Box" },
          { id: "Large Box", label: "Large Box" }
        ];
      case "container":
        return [
          { id: "20FT FCL", label: "20FT FCL" },
          { id: "20FT LCL", label: "20FT LCL" },
          { id: "40FT FCL", label: "40FT FCL" },
          { id: "40FT LCL", label: "40FT LCL" }
        ];
      default:
        return [];
    }
  };

  const discountedHint = (config, discountField) => {
    const sea = parseFloat(config.seaFreightPrice);
    if (isNaN(sea) || sea <= 0) return null;
    const disc = parseFloat(config[discountField]) || 0;
    const per = Math.max(sea - disc, 0);
    return (
      <p className="text-[11px] text-white/40 mt-1">= ${per.toFixed(2)}/barrel</p>
    );
  };

  const renderPickupSection = (data, index, handleChange, errPrefix) => (
    <div className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-4">
      <h4 className="text-yellow-400 font-bold text-base">Pickup</h4>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <h3 className="text-sm mb-2 text-white/80">Pickup Barrel Charge ($)</h3>
          <input
            name="pickupCharge"
            value={data.pickupCharge}
            onChange={(e) => handleChange(index, e)}
            placeholder="65"
            inputMode="decimal"
            className="w-full bg-transparent border border-white/20
              text-white placeholder:text-white/40
              rounded-md px-4 py-2.5
              focus:outline-none focus:border-yellow-400"
            type="text" />
          {errors[`${errPrefix}_${index}_pickupCharge`] && (
            <p className="text-red-400 text-sm mt-1">{errors[`${errPrefix}_${index}_pickupCharge`]}</p>
          )}
        </div>
        <div>
          <h3 className="text-sm mb-2 text-white/80">Pickup Radius (miles)</h3>
          <input
            name="pickupRadius"
            value={data.pickupRadius}
            onChange={(e) => handleChange(index, e)}
            placeholder="15"
            inputMode="decimal"
            className="w-full bg-transparent border border-white/20
              text-white placeholder:text-white/40
              rounded-md px-4 py-2.5
              focus:outline-none focus:border-yellow-400"
            type="text" />
          {errors[`${errPrefix}_${index}_pickupRadius`] && (
            <p className="text-red-400 text-sm mt-1">{errors[`${errPrefix}_${index}_pickupRadius`]}</p>
          )}
        </div>
        <div>
          <h3 className="text-sm mb-2 text-white/80">Extra Mileage Cost ($/mile)</h3>
          <input
            name="extraMileageCost"
            value={data.extraMileageCost}
            onChange={(e) => handleChange(index, e)}
            placeholder="0.10"
            inputMode="decimal"
            className="w-full bg-transparent border border-white/20
              text-white placeholder:text-white/40
              rounded-md px-4 py-2.5
              focus:outline-none focus:border-yellow-400"
            type="text" />
          {errors[`${errPrefix}_${index}_extraMileageCost`] && (
            <p className="text-red-400 text-sm mt-1">{errors[`${errPrefix}_${index}_extraMileageCost`]}</p>
          )}
        </div>
      </div>
      <p className="text-[11px] text-white/40">Pickup within the radius is covered by the flat charge; each extra mile adds the per-mile cost.</p>
    </div>
  );

  const renderSeaFreightSection = (data, index, handleChange, errPrefix) => (
    <div className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-4">
      <h4 className="text-yellow-400 font-bold text-base">Sea Freight (per barrel)</h4>
      <div>
        <h3 className="text-sm mb-2 text-white/80">Barrels 1&ndash;4 price ($)</h3>
        <input
          name="seaFreightPrice"
          value={data.seaFreightPrice}
          onChange={(e) => handleChange(index, e)}
          placeholder="80.30"
          inputMode="decimal"
          className="w-full bg-transparent border border-white/20
            text-white placeholder:text-white/40
            rounded-md px-4 py-2.5
            focus:outline-none focus:border-yellow-400"
          type="text" />
        {errors[`${errPrefix}_${index}_seaFreightPrice`] && (
          <p className="text-red-400 text-sm mt-1">{errors[`${errPrefix}_${index}_seaFreightPrice`]}</p>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <h3 className="text-sm mb-2 text-white/80">Barrels 5&ndash;9 discount ($ off per barrel)</h3>
          <input
            name="discount5to9"
            value={data.discount5to9}
            onChange={(e) => handleChange(index, e)}
            placeholder="10"
            inputMode="decimal"
            className="w-full bg-transparent border border-white/20
              text-white placeholder:text-white/40
              rounded-md px-4 py-2.5
              focus:outline-none focus:border-yellow-400"
            type="text" />
          {discountedHint(data, 'discount5to9')}
          {errors[`${errPrefix}_${index}_discount5to9`] && (
            <p className="text-red-400 text-sm mt-1">{errors[`${errPrefix}_${index}_discount5to9`]}</p>
          )}
        </div>
        <div>
          <h3 className="text-sm mb-2 text-white/80">Barrels 10+ discount ($ off per barrel)</h3>
          <input
            name="discount10plus"
            value={data.discount10plus}
            onChange={(e) => handleChange(index, e)}
            placeholder="25"
            inputMode="decimal"
            className="w-full bg-transparent border border-white/20
              text-white placeholder:text-white/40
              rounded-md px-4 py-2.5
              focus:outline-none focus:border-yellow-400"
            type="text" />
          {discountedHint(data, 'discount10plus')}
          {errors[`${errPrefix}_${index}_discount10plus`] && (
            <p className="text-red-400 text-sm mt-1">{errors[`${errPrefix}_${index}_discount10plus`]}</p>
          )}
        </div>
      </div>
    </div>
  );

  const renderParishFeesSection = (data, index, isOwn) => {
    const key = `${isOwn ? 'own' : 'do'}_${index}`;
    return (
      <div className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h4 className="text-yellow-400 font-bold text-base">Customs &amp; Delivery</h4>
          <span className="text-[11px] text-white/40">One price per parish</span>
        </div>
        <div className="flex items-end gap-2 flex-wrap">
          <div className="flex-1 min-w-[110px]">
            <h3 className="text-[11px] mb-1 text-white/50">1 Barrel ($)</h3>
            <input
              type="text"
              inputMode="decimal"
              placeholder="Enter"
              value={applyAllFees[key]?.first || ""}
              onChange={(e) => setApplyAllFees(prev => ({ ...prev, [key]: { ...(prev[key] || {}), first: sanitizeMoney(e.target.value) } }))}
              className="w-full bg-white/5 border border-white/20 text-white placeholder:text-white/20 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-yellow-400"
            />
          </div>
          <div className="flex-1 min-w-[110px]">
            <h3 className="text-[11px] mb-1 text-white/50">Additional Barrel ($)</h3>
            <input
              type="text"
              inputMode="decimal"
              placeholder="Enter"
              value={applyAllFees[key]?.additional || ""}
              onChange={(e) => setApplyAllFees(prev => ({ ...prev, [key]: { ...(prev[key] || {}), additional: sanitizeMoney(e.target.value) } }))}
              className="w-full bg-white/5 border border-white/20 text-white placeholder:text-white/20 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-yellow-400"
            />
          </div>
          <button
            type="button"
            onClick={() => handleApplyAllParishFees(index, isOwn)}
            className="bg-yellow-400 text-black px-4 py-2 rounded-md font-bold text-xs hover:bg-yellow-500 transition-all shrink-0"
          >
            Apply to all
          </button>
        </div>
        <div className="grid grid-cols-[minmax(0,1.1fr)_1fr_1fr] gap-x-2.5 gap-y-2 items-center">
          <span className="text-[10px] text-white/50 font-semibold uppercase">Parish</span>
          <span className="text-[10px] text-white/50 font-semibold uppercase">1 Barrel ($)</span>
          <span className="text-[10px] text-white/50 font-semibold uppercase">Additional Barrel ($)</span>
          {JAMAICA_PARISHES.map(parish => (
            <React.Fragment key={parish}>
              <label className="text-xs text-white/70">{parish}</label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="Enter Cost"
                value={data.parishFees?.[parish]?.first ?? ""}
                onChange={(e) => handleParishFeeChange(index, isOwn, parish, 'first', e.target.value)}
                className="w-full bg-white/5 border border-white/20 text-white placeholder:text-white/20 rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:border-yellow-400"
              />
              <input
                type="text"
                inputMode="decimal"
                placeholder="Enter Cost"
                value={data.parishFees?.[parish]?.additional ?? ""}
                onChange={(e) => handleParishFeeChange(index, isOwn, parish, 'additional', e.target.value)}
                className="w-full bg-white/5 border border-white/20 text-white placeholder:text-white/20 rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:border-yellow-400"
              />
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  };

  const renderBarrelForm = (type, configs, handleChange, title, isOwnBarrel) => {
    if (!selectedSubTypes.includes(type)) return null;

    const transitTimeOptions = isOwnBarrel ? TRANSIT_TIME_NUMBERS_OWN : TRANSIT_TIME_NUMBERS_DROPOFF;
    const errPrefix = isOwnBarrel ? 'ownBarrel' : 'dropOffBarrel';

    return (
      <div className="mt-8 space-y-8">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold text-yellow-400">{title}</h3>
          <button
            type="button"
            onClick={isOwnBarrel ? addOwnBarrelConfig : addDropOffBarrelConfig}
            className="flex items-center gap-2 bg-yellow-400 text-black px-4 py-2 rounded-full font-bold text-sm hover:bg-yellow-500 transition-all"
          >
            <FaPlus size={12} /> Add More
          </button>
        </div>

        {configs.map((data, index) => (
          <div key={index} className="p-6 border border-yellow-400/30 rounded-lg bg-white/5 relative">
            {configs.length > 1 && (
              <button
                type="button"
                onClick={() => isOwnBarrel ? removeOwnBarrelConfig(index) : removeDropOffBarrelConfig(index)}
                className="absolute top-4 right-4 text-red-400 hover:text-red-300 transition-colors"
              >
                <FaTrash size={20} />
              </button>
            )}

            <div className="space-y-4">
              <div>
                <h3 className="text-sm mb-2 text-white/80">Origin city</h3>
                <div className="relative">
                  <select
                    name="originCountry"
                    value={data.originCountry}
                    onChange={(e) => handleChange(index, e)}
                    className="w-full appearance-none border border-white/20
        text-white rounded-md px-4 pr-10 h-[45px] bg-transparent focus:outline-none focus:border-yellow-400"
                  >
                    <option value="" disabled hidden>Select origin city</option>
                    {ORIGIN_CITIES.map((city) => (
                      <option key={city} value={city} className="text-black">
                        {city}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                    <svg className="w-4 h-4 text-white/60" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
                {errors[`${errPrefix}_${index}_originCountry`] && (
                  <p className="text-red-400 text-sm mt-1">
                    {errors[`${errPrefix}_${index}_originCountry`]}
                  </p>
                )}
              </div>

              <div>
                <h3 className="text-sm mb-2 text-white/80">Destination city</h3>
                <div className="relative">
                  <select
                    name="destinationCountry"
                    value={data.destinationCountry}
                    onChange={(e) => handleChange(index, e)}
                    className="w-full appearance-none border border-white/20
                      text-white rounded-md px-4 pr-10 py-2.5 bg-transparent focus:outline-none focus:border-yellow-400"
                  >
                    <option value="" disabled hidden>Select destination city</option>
                    {DESTINATION_CITIES.map((city) => (
                      <option key={city} value={city} className="text-black">
                        {city}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                    <svg className="w-4 h-4 text-white/60" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
                {errors[`${errPrefix}_${index}_destinationCountry`] && (
                  <p className="text-red-400 text-sm mt-1">
                    {errors[`${errPrefix}_${index}_destinationCountry`]}
                  </p>
                )}
              </div>

              {/* Pickup pricing only applies to Ship Your Own Barrel */}
              {isOwnBarrel && renderPickupSection(data, index, handleChange, errPrefix)}

              {renderSeaFreightSection(data, index, handleChange, errPrefix)}

              {renderParishFeesSection(data, index, isOwnBarrel)}

              <div>
                <h3 className="text-sm mb-2 text-white/80">Transit Time</h3>
                <div className="flex gap-2">
                  <select
                    value={data.transitTime ? data.transitTime.split(" ")[0] : ""}
                    onChange={(e) => {
                      const unit = data.transitTime ? (data.transitTime.split(" ")[1] || "days") : "days";
                      handleChange(index, { target: { name: "transitTime", value: `${e.target.value} ${unit}` } });
                    }}
                    className="w-1/2 bg-transparent border border-white/20 text-white rounded-md px-4 h-[45px] focus:outline-none focus:border-yellow-400"
                  >
                    <option value="" disabled hidden>Select</option>
                    {transitTimeOptions.map(n => <option key={n} value={n} className="text-black">{n}</option>)}
                  </select>
                  <select
                    value={data.transitTime ? (data.transitTime.split(" ")[1] || "days") : "days"}
                    onChange={(e) => {
                      const num = data.transitTime ? (data.transitTime.split(" ")[0] || "") : "";
                      handleChange(index, { target: { name: "transitTime", value: `${num} ${e.target.value}` } });
                    }}
                    className="w-1/2 bg-transparent border border-white/20 text-white rounded-md px-4 h-[45px] focus:outline-none focus:border-yellow-400"
                  >
                    {TRANSIT_TIME_UNITS.map(u => <option key={u} value={u} className="text-black">{u}</option>)}
                  </select>
                </div>
                {errors[`${errPrefix}_${index}_transitTime`] && (
                  <p className="text-red-400 text-sm mt-1">
                    {errors[`${errPrefix}_${index}_transitTime`]}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div>
      {stripeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
            <h2 className="text-2xl font-semibold mb-4 text-slate-900">Connect your Stripe account</h2>
            <p className="text-sm text-slate-600 mb-6">
              To receive payments as a freight forwarder, please connect your Stripe account.
            </p>
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={handleStripeConnect}
                disabled={isStripeProcessing}
                className="inline-flex items-center justify-center rounded-full bg-yellow-400 px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-yellow-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isStripeProcessing ? "Connecting..." : "Connect to Stripe"}
              </button>
              <button
                type="button"
                onClick={() => {
                  localStorage.removeItem("token");
                  localStorage.removeItem("user");

                  setStripeModalOpen(false);

                  const userStr = localStorage.getItem("user");
                  let isProvider = false;

                  if (userStr) {
                    try {
                      const user = JSON.parse(userStr);
                      isProvider = user?.role === "2" || user?.role === "provider";
                    } catch (e) {
                      console.error("Error parsing user", e);
                    }
                  }

                  if (isProvider) {
                    navigate("/request", { replace: true });
                  } else {
                    navigate("/", { replace: true });
                  }
                }}
                className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Continue without connecting
              </button>
            </div>
          </div>
        </div>
      )}
      <div
        className="min-h-screen flex items-center justify-center relative"
        style={{
          backgroundImage: ` url(${shipp})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div
          className="flex flex-col items-center text-white gap-6
                  bg-[#2D413F] backdrop-blur-md
                  rounded-[22px]
                  shadow-[0_25px_80px_rgba(0,0,0,0.6)]
                  w-[90vw] sm:w-[500px] lg:w-[800px]
                  px-6 sm:px-15 py-10 mb-20 md:mt-35 mt-15"
        >
          <h1 className="text-[22px] lg:text-[32px] font-semibold">
            Delivery Timelines And Policies
          </h1>
          <p className="text-lg text-white -mt-3">
            Please enter required details.
          </p>

          <div className="w-full max-w-[480px] mt-4">
            <div className="flex items-center gap-2">
              {[1, 2].map((step) => (
                <div
                  key={step}
                  className={`h-[4px] w-full rounded-full transition-all duration-300 ${step <= 6 ? "bg-yellow-400" : "bg-white/30"
                    }`}
                />
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="w-full max-w-[600px] mx-auto flex flex-col gap-5 text-white">

            <div>
              <h3 className="text-sm mb-2 text-white/80">Shipment Type</h3>
              <div className="relative">
                <select
                  name="shipmentType"
                  value={formData.shipmentType}
                  onChange={handleInputChange}
                  className="w-full appearance-none border border-white/20
                  text-white rounded-md px-4 pr-10 h-[45px] bg-transparent focus:outline-none focus:border-yellow-400"
                >
                  <option value="" disabled hidden>Select</option>
                  <option className="text-black" value="barrel">Barrel</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                  <svg className="w-4 h-4 text-white/60" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
              {errors.main_shipmentType && (
                <p className="text-red-400 text-sm mt-1">{errors.main_shipmentType}</p>
              )}
            </div>

            {getSubOptions().length > 0 && (
              <div>
                <h3 className="text-sm mb-4 text-white/80">Sub shipment type (Select multiple)</h3>
                <div className="grid grid-cols-2 gap-4">
                  {getSubOptions().map((type) => (
                    <label key={type.id} className="flex items-center gap-3 cursor-pointer group">
                      <div className={`
                        w-5 h-5 rounded border flex items-center justify-center transition-all
                        ${selectedSubTypes.includes(type.id)
                          ? "bg-yellow-400 border-yellow-400"
                          : "border-white/30 group-hover:border-white/50"}
                      `}>
                        {selectedSubTypes.includes(type.id) && (
                          <span className="text-black text-xs font-bold">✓</span>
                        )}
                      </div>
                      <input
                        type="checkbox"
                        className="hidden"
                        checked={selectedSubTypes.includes(type.id)}
                        onChange={() => {
                          setSelectedSubTypes(prev => {
                            const isAdding = !prev.includes(type.id);
                            const next = isAdding
                              ? [...prev, type.id]
                              : prev.filter(t => t !== type.id);

                            logBusinessUpload("input.subShipmentType.toggle", {
                              clickedType: type.id,
                              isAdding,
                              previous: prev,
                              next,
                            });

                            if (isAdding) {
                              if (type.id === "Ship Your Own Barrel") {
                                setOwnBarrelConfigs(curr => curr.length === 0 ? [createBarrelConfig()] : curr);
                              } else if (type.id === "Request Barrel Drop-Off") {
                                setDropOffBarrelConfigs(curr => curr.length === 0 ? [createBarrelConfig()] : curr);
                              }
                            }

                            setErrors(prev => ({ ...prev, main_sub_shipment_type: "" }));
                            return next;
                          });
                        }}
                      />
                      <span className="text-sm">{type.label}</span>
                    </label>
                  ))}
                </div>
                {errors.main_sub_shipment_type && (
                  <p className="text-red-400 text-sm mt-1">{errors.main_sub_shipment_type}</p>
                )}
              </div>
            )}

            {showBarrelForms && (
              <>
                {renderBarrelForm(
                  "Ship Your Own Barrel",
                  ownBarrelConfigs,
                  handleOwnBarrelChange,
                  "Ship Your Own Barrel Details",
                  true
                )}

                {renderBarrelForm(
                  "Request Barrel Drop-Off",
                  dropOffBarrelConfigs,
                  handleDropOffBarrelChange,
                  "Request Barrel Drop-Off Details",
                  false
                )}
              </>
            )}

            <div className="flex justify-center mt-4">
              <button
                disabled={loading}
                type="submit"
                className="bg-gradient-to-b from-[#FFC400] to-[#FFD95A]
                text-black font-semibold text-[16px]
                rounded-full
                h-[52px] w-[180px]
                active:scale-95 transition-all flex items-center justify-center gap-2
                disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? <FaSpinner className="animate-spin" /> : "Next"}
              </button>
            </div>
          </form>
        </div>
      </div>

      <SuccessPopup
        isOpen={isSuccessModalOpen}
        onClose={() => {
          setIsSuccessModalOpen(false);
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          navigate("/");
        }}
        title="Pending Verification"
        message="Congratulations, your profile is complete. Your account is now pending admin verification. You will be able to login once your documents are verified."
        buttonText="Ok"
      />
    </div>
  );
};

export default BuisnessUpload;
