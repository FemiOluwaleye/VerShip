import React, { useState, useEffect } from "react";
import { shipp, submit, time } from "../common/common-assets/assets-images";
import { useNavigate } from "react-router-dom";
import { completeProfile, createStripeAccount } from "../api/cms";
import MultiSelect from "../components/MultiSelect";
import { toast } from "sonner";
import { FaSpinner, FaPlus, FaTrash } from "react-icons/fa";
import SuccessPopup from "../components/SuccessPopup";

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

const MAX_CUSTOMS = 999999999.99;

// Validate a 25-slot per-barrel price string. Entries are optional (a freight
// user may price only the first N barrels), but whatever is entered must be
// filled sequentially from Barrel 1 with no gaps. Returns "" when valid.
const validateSequentialBarrelPrices = (value) => {
  const parts = String(value ?? "").split(",").map(v => (v ?? "").trim());
  const lastFilled = parts.reduce((acc, v, i) => (v !== "" ? i : acc), -1);
  if (lastFilled < 0) return ""; // fully optional: no entries is allowed
  const upto = parts.slice(0, lastFilled + 1);
  if (upto.some(v => v === "")) return "Enter barrel prices in order, with no gaps";
  if (upto.some(v => isNaN(v) || Number(v) < 0)) return "Enter a valid price";
  if (upto.some(v => Number(v) > MAX_CUSTOMS)) return `Price cannot exceed ${MAX_CUSTOMS.toLocaleString()}`;
  if (upto.some(v => { const d = v.split('.')[1]; return d && d.length > 2; })) return "Max 2 decimal places allowed";
  return "";
};

const normCustoms = (val) => {
  const str = String(val ?? "");
  const parts = str.split(",");
  if (parts.length === 25) return str;
  return Array(25).fill("").join(",");
};

const customsDisplay = (raw, n) => {
  if (!raw) return "";
  const v = String(raw).split(",")[n - 1] ?? "";
  return v === "" || v === "0" || v === "0.00" ? "" : v;
};

const createBarrelConfig = ({
  pricePerMile = "",
  freeMiles = "",
  customsAndHandling = "",
  flatPickupCharge = "",
  pickupFreeMiles = "",
  pickupPerMileCharge = "",
  flatDeliveryCharge = "",
  deliveryFreeMiles = "",
  deliveryPerMileCharge = ""
} = {}) => ({
  originCountry: "",
  destinationCountry: "",
  basePrice: "",
  pricePerMile,
  customsAndHandling,
  validFrom: "",
  validTo: "",
  transitTime: "",
  shipmentContents: "",
  freeMiles,
  originLat: "",
  originLong: "",
  destinationLat: "",
  destinationLong: "",
  isVolumeDiscount: false,
  discountAfter: 5,
  discountPercent: 10,
  barrelPrices: [{ quantity: 1, price: "", discount: "0" }],
  flatPickupCharge,
  pickupFreeMiles,
  pickupPerMileCharge,
  flatDeliveryCharge,
  deliveryFreeMiles,
  deliveryPerMileCharge
});

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
  const [customsOpen, setCustomsOpen] = useState({});
  const [flatPickupOpen, setFlatPickupOpen] = useState({});
  const [flatDeliveryOpen, setFlatDeliveryOpen] = useState({});
  
  const toggleCustoms = (k) => setCustomsOpen(p => ({ ...p, [k]: !p[k] }));
  const toggleFlatPickup = (k) => setFlatPickupOpen(p => ({ ...p, [k]: !p[k] }));
  const toggleFlatDelivery = (k) => setFlatDeliveryOpen(p => ({ ...p, [k]: !p[k] }));

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

  const validateDecimalPlaces = (value) => {
    if (!value || value === "") return true;
    const strValue = String(value);
    if (strValue.includes('.')) {
      const decimalPart = strValue.split('.')[1];
      if (decimalPart && decimalPart.length > 2) {
        return false;
      }
    }
    return true;
  };

  const validateField = (name, value, type = 'main') => {
    let error = "";

    const priceFields = ["basePrice", "pricePerMile", "customsAndHandling", "flatPickupCharge", 
                         "pickupPerMileCharge", "flatDeliveryCharge", "deliveryPerMileCharge"];
    if (priceFields.includes(name) && value && !validateDecimalPlaces(value)) {
      error = "Cannot have more than 2 decimal places";
    }

    if (type === 'main') {
      switch (name) {
        case "basePrice":
          if (!value.trim()) error = "Base Price is required";
          else if (Number(value) === 0) error = "Price must be greater than 0";
          break;
        case "pricePerMile":
          if (!value.trim()) error = "Delivery is required";
          else if (Number(value) === 0) error = "Price must be greater than 0";
          break;
        case "pricePerPound":
          if (!value.trim()) error = "Price per pound is required";
          else if (Number(value) === 0) error = "Price must be greater than 0";
          break;
        case "shipmentType":
          if (!value) error = "Shipment type is required";
          break;
        default:
          break;
      }
    }

    if (type.startsWith('ownBarrel') || type.startsWith('dropOffBarrel')) {
      const [typePrefix, configIndexStr] = type.split('_');
      const configIndex = parseInt(configIndexStr);
      const isDropOff = typePrefix === 'dropOffBarrel';
      const skipFields = ['flatPickupCharge', 'pickupFreeMiles', 'pickupPerMileCharge', 'flatDeliveryCharge', 'deliveryFreeMiles', 'deliveryPerMileCharge'];

      if (isDropOff && skipFields.includes(name)) {
        return error;
      }

      switch (name) {
        case "originCountry":
          if (!value) error = "Origin city is required";
          break;
        case "destinationCountry":
          if (!value) error = "Destination city is required";
          break;
        case "basePrice":
          if (!value.trim()) error = "Base price is required";
          else if (Number(value) === 0) error = "Price must be greater than 0";
          break;
        case "pricePerMile":
          if (type.startsWith('dropOffBarrel')) {
            if (value === undefined || value === null || value === "") error = "Delivery is required";
          }
          break;
        case "customsAndHandling": {
          error = validateSequentialBarrelPrices(value);
          break;
        }
        case "flatPickupCharge": {
          if (!isDropOff) error = validateSequentialBarrelPrices(value);
          break;
        }
        case "flatDeliveryCharge": {
          if (!isDropOff) error = validateSequentialBarrelPrices(value);
          break;
        }
        case "transitTime":
          if (!value) error = "Transit time is required";
          break;
        case "pickupFreeMiles":
          if (!isDropOff) {
            if (value === undefined || value === null || value === "") error = "Pickup free miles is required";
            else if (Number(value) < 0) error = "Cannot be negative";
            else if (Number(value) > 30) error = "Cannot exceed 30 miles";
          }
          break;
        case "pickupPerMileCharge":
          if (!isDropOff) {
            if (value === undefined || value === null || value === "") error = "Pickup per mile charge is required";
            else if (Number(value) <= 0) error = "Must be greater than 0";
          }
          break;
        case "deliveryFreeMiles":
          if (!isDropOff) {
            if (value === undefined || value === null || value === "") error = "Delivery free miles is required";
            else if (Number(value) < 0) error = "Cannot be negative";
            else if (Number(value) > 50) error = "Cannot exceed 50 miles";
          }
          break;
        case "deliveryPerMileCharge":
          if (!isDropOff) {
            if (value === undefined || value === null || value === "") error = "Delivery per mile charge is required";
            else if (Number(value) <= 0) error = "Must be greater than 0";
          }
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

  const validateBarrelPrices = (barrelPrices, typePrefix, configIndex) => {
    const item = barrelPrices[0];
    if (!item) return true;
    const priceVal = Number(item.price);
    const hasError = isNaN(priceVal) || priceVal <= 0;
    if (hasError) {
      logBusinessUpload("validation.barrelPrices.error", { typePrefix, configIndex, price: item.price });
    }
    return hasError;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    let formattedValue = value.replace(/^\s+/, "");

    const priceFields = ["basePrice", "pricePerMile", "customsAndHandling"];
    if (priceFields.includes(name)) {
      formattedValue = formattedValue.replace(/[^0-9.]/g, "");
      const parts = formattedValue.split('.');
      if (parts.length > 2) {
        formattedValue = parts[0] + '.' + parts.slice(1).join('');
      }
    }

    if (name === "shipmentType") {
      logBusinessUpload("input.shipmentType.resettingState", {
        previousShipmentType: formData.shipmentType,
        nextShipmentType: formattedValue,
      });
      setSelectedSubTypes([]);
      setShowBarrelForms(false);
      setErrors(prev => ({ ...prev, main_sub_shipment_type: "" }));
      setOwnBarrelConfigs([createBarrelConfig({ pricePerMile: "0", freeMiles: "0" })]);
      setDropOffBarrelConfigs([createBarrelConfig({ pricePerMile: "0", freeMiles: "0" })]);
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

    const priceFields = ["basePrice", "customsAndHandling", "freeMiles",
      "flatPickupCharge", "pickupFreeMiles", "pickupPerMileCharge",
      "flatDeliveryCharge", "deliveryFreeMiles", "deliveryPerMileCharge"];
    if (priceFields.includes(name)) {
      formattedValue = formattedValue.replace(/[^0-9.]/g, "");
      const parts = formattedValue.split('.');
      if (parts.length > 2) {
        formattedValue = parts[0] + '.' + parts.slice(1).join('');
      }
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

    if (name === "basePrice") {
      updateVolumePrices(index, 'own', formattedValue);
    }
    validateField(name, formattedValue, `ownBarrel_${index}`);
  };

  const handleMultiFieldChange = (index, isOwn, fieldName, barrelNum, val) => {
    let fv = val.replace(/^\s+/, "").replace(/[^0-9.]/g, "");
    const pts = fv.split('.');
    if (pts.length > 2) fv = pts[0] + '.' + pts.slice(1).join('');
    if (fv !== "" && fv !== ".") {
      const n = parseFloat(fv);
      if (!isNaN(n) && n > MAX_CUSTOMS) fv = MAX_CUSTOMS.toFixed(2);
    }
    const dec = fv.split('.')[1];
    if (dec && dec.length > 2) fv = fv.split('.')[0] + '.' + dec.slice(0, 2);

    const configs = isOwn ? ownBarrelConfigs : dropOffBarrelConfigs;
    const arr = (configs[index][fieldName] || "").split(",");
    while (arr.length < 25) arr.push("");
    arr[barrelNum - 1] = fv;
    const newVal = arr.join(",");

    (isOwn ? setOwnBarrelConfigs : setDropOffBarrelConfigs)(prev => {
      const u = [...prev];
      u[index] = { ...u[index], [fieldName]: newVal };
      return u;
    });
    validateField(fieldName, newVal, isOwn ? `ownBarrel_${index}` : `dropOffBarrel_${index}`);
  };

  const handleDropOffBarrelChange = (index, e) => {
    const { name, value } = e.target;
    let formattedValue = value.replace(/^\s+/, "");

    // Only format allowed price fields for dropOff
    const allowedPriceFields = ["basePrice", "customsAndHandling"];
    if (allowedPriceFields.includes(name)) {
      formattedValue = formattedValue.replace(/[^0-9.]/g, "");
      const parts = formattedValue.split('.');
      if (parts.length > 2) {
        formattedValue = parts[0] + '.' + parts.slice(1).join('');
      }
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
    if (name === "basePrice") {
      updateVolumePrices(index, 'dropoff', formattedValue);
    }
    validateField(name, formattedValue, `dropOffBarrel_${index}`);
  };

  const updateVolumePrices = (configIndex, type, basePrice) => {
    const setter = type === 'own' ? setOwnBarrelConfigs : setDropOffBarrelConfigs;
    setter(prev => {
      const updated = [...prev];
      const bPrice = parseFloat(basePrice) || 0;
      updated[configIndex] = {
        ...updated[configIndex],
        barrelPrices: [{ quantity: 1, price: bPrice.toFixed(2), discount: "0" }],
      };
      logBusinessUpload("volumePricing.recalculated", {
        type,
        configIndex,
        basePrice: bPrice,
      });
      return updated;
    });
  };

  const handleVolumeToggle = (configIndex, type, enabled) => {
    logBusinessUpload("volumePricing.toggle", { configIndex, type, enabled });
    const setter = type === 'own' ? setOwnBarrelConfigs : setDropOffBarrelConfigs;
    setter(prev => {
      const updated = [...prev];
      updated[configIndex] = { ...updated[configIndex], isVolumeDiscount: enabled };
      return updated;
    });
    const configs = type === 'own' ? ownBarrelConfigs : dropOffBarrelConfigs;
    updateVolumePrices(configIndex, type, configs[configIndex].basePrice);
  };

  const handleVolumeChange = (configIndex, type, field, value) => {
    logBusinessUpload("volumePricing.change", { configIndex, type, field, value });
    const setter = type === 'own' ? setOwnBarrelConfigs : setDropOffBarrelConfigs;
    setter(prev => {
      const updated = [...prev];
      updated[configIndex] = { ...updated[configIndex], [field]: Number(value) };
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
        const fieldsToValidate = [
          "originCountry", "destinationCountry", "basePrice",
          "customsAndHandling", "transitTime", "shipmentContents",
          "flatPickupCharge", "pickupFreeMiles", "pickupPerMileCharge",
          "flatDeliveryCharge", "deliveryFreeMiles", "deliveryPerMileCharge"
        ];
        fieldsToValidate.forEach(key => {
          const error = validateField(key, config[key], `ownBarrel_${index}`);
          if (error) newErrors[`ownBarrel_${index}_${key}`] = error;
        });

        if (validateBarrelPrices(config.barrelPrices, "ownBarrel", index, newErrors)) {
          if (!newErrors[`ownBarrel_${index}_basePrice`]) {
            newErrors[`ownBarrel_${index}_basePrice`] = "Please enter a valid base price to generate barrel rates";
          }
        }
      });
    }

    if (selectedSubTypes.includes("Request Barrel Drop-Off")) {
      dropOffBarrelConfigs.forEach((config, index) => {
        // Skip pickup/delivery fields for dropOff
        const skipFields = ['flatPickupCharge', 'pickupFreeMiles', 'pickupPerMileCharge', 'flatDeliveryCharge', 'deliveryFreeMiles', 'deliveryPerMileCharge'];
        const fieldsToValidate = [
          "originCountry", "destinationCountry", "basePrice",
          "pricePerMile", "customsAndHandling", "transitTime", "shipmentContents"
        ];
        fieldsToValidate.forEach(key => {
          const error = validateField(key, config[key], `dropOffBarrel_${index}`);
          if (error) newErrors[`dropOffBarrel_${index}_${key}`] = error;
        });

        if (validateBarrelPrices(config.barrelPrices, "dropOffBarrel", index, newErrors)) {
          if (!newErrors[`dropOffBarrel_${index}_basePrice`]) {
            newErrors[`dropOffBarrel_${index}_basePrice`] = "Please enter a valid base price to generate barrel rates";
          }
        }
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

      const buildBarrelPayload = (config, isDropOff = false) => ({
        basePrice: config.basePrice || "0",
        pricePerMile: config.pricePerMile || "0",
        customsAndHandling: config.customsAndHandling || "0",
        freeMiles: config.freeMiles || "0",
        originCountry: config.originCountry || "",
        destinationCountry: config.destinationCountry || "",
        originLat: config.originLat || (CITY_COORDINATES[config.originCountry]?.lat || ""),
        originLong: config.originLong || (CITY_COORDINATES[config.originCountry]?.lng || ""),
        destinationLat: config.destinationLat || (CITY_COORDINATES[config.destinationCountry]?.lat || ""),
        destinationLong: config.destinationLong || (CITY_COORDINATES[config.destinationCountry]?.lng || ""),
        transitTime: config.transitTime || "",
        shipmentContents: config.shipmentContents || "",
        isVolumeDiscount: Boolean(config.isVolumeDiscount),
        discountAfter: Number(config.discountAfter || 0),
        discountPercent: Number(config.discountPercent || 0),
        barrelPrices: [{ quantity: 1, price: config.basePrice || "0", discount: "0" }],
        flatPickupCharge: isDropOff ? "0" : (config.flatPickupCharge || "0"),
        pickupFreeMiles: isDropOff ? "0" : (config.pickupFreeMiles || "0"),
        pickupPerMileCharge: isDropOff ? "0" : (config.pickupPerMileCharge || "0"),
        flatDeliveryCharge: isDropOff ? "0" : (config.flatDeliveryCharge || "0"),
        deliveryFreeMiles: isDropOff ? "0" : (config.deliveryFreeMiles || "0"),
        deliveryPerMileCharge: isDropOff ? "0" : (config.deliveryPerMileCharge || "0")
      });

      const payload = {
        providerId: userId,
        pricePerPound: formData.pricePerPound,
        shipmentType: formData.shipmentType,
        sub_shipment_type: selectedSubTypes,
        basePrice: barrelDetails?.basePrice || "0",
        transitTime: barrelDetails?.transitTime || "",
        shipmentContents: barrelDetails?.shipmentContents || "",
        originCountry: barrelDetails?.originCountry || "",
        destinationCountry: barrelDetails?.destinationCountry || "",
        originLat: barrelDetails?.originLat || (barrelDetails?.originCountry ? CITY_COORDINATES[barrelDetails.originCountry]?.lat : "") || "",
        originLong: barrelDetails?.originLong || (barrelDetails?.originCountry ? CITY_COORDINATES[barrelDetails.originCountry]?.lng : "") || "",
        destinationLat: barrelDetails?.destinationLat || (barrelDetails?.destinationCountry ? CITY_COORDINATES[barrelDetails.destinationCountry]?.lat : "") || "",
        destinationLong: barrelDetails?.destinationLong || (barrelDetails?.destinationCountry ? CITY_COORDINATES[barrelDetails.destinationCountry]?.lng : "") || "",
        pricePerMile: barrelDetails?.pricePerMile || "0",
        customsAndHandling: barrelDetails?.customsAndHandling || "0",
        freeMiles: barrelDetails?.freeMiles || "0",
        flatPickupCharge: barrelDetails?.flatPickupCharge || "0",
        pickupFreeMiles: barrelDetails?.pickupFreeMiles || "0",
        pickupPerMileCharge: barrelDetails?.pickupPerMileCharge || "0",
        flatDeliveryCharge: barrelDetails?.flatDeliveryCharge || "0",
        deliveryFreeMiles: barrelDetails?.deliveryFreeMiles || "0",
        deliveryPerMileCharge: barrelDetails?.deliveryPerMileCharge || "0",
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

  const renderBarrelPrices = (type, config, configIndex) => {
    const isOwn = type === 'ownBarrel';
    const typeLabel = isOwn ? 'own' : 'dropoff';

    return (
      <div className="mt-4 p-5 bg-white/5 border border-white/10 rounded-xl">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-yellow-400 font-bold text-lg">Volume Discount</h4>
        </div>

        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={config.isVolumeDiscount}
                onChange={(e) => handleVolumeToggle(configIndex, typeLabel, e.target.checked)}
              />
              <div className="w-11 h-6 bg-white/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-400"></div>
            </label>
            <span className="text-white font-medium">Apply discount for larger orders</span>
          </div>
        </div>

        {config.isVolumeDiscount && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6 transition-all duration-300">
            <div>
              <label className="text-sm text-white/60 block mb-2">Apply discount after how many barrels?</label>
              <select
                value={config.discountAfter}
                onChange={(e) => handleVolumeChange(configIndex, typeLabel, 'discountAfter', e.target.value)}
                className="w-full bg-white/5 border border-white/20 text-white rounded-lg px-4 h-[45px] focus:border-yellow-400 focus:outline-none"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                  <option key={n} value={n} className="text-black">After {n} barrels</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-white/60 block mb-2">Discount per barrel (%)</label>
              <select
                value={config.discountPercent}
                onChange={(e) => handleVolumeChange(configIndex, typeLabel, 'discountPercent', e.target.value)}
                className="w-full bg-white/5 border border-white/20 text-white rounded-lg px-4 h-[45px] focus:border-yellow-400 focus:outline-none"
              >
                {[10, 20, 30, 40, 50].map(p => (
                  <option key={p} value={p} className="text-black">{p}% off</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {config.basePrice && (
          <div className="space-y-3">
            <span className="text-sm text-white/60">Price preview per barrel</span>
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 10 }, (_, i) => {
                const qty = i + 1;
                const bPrice = parseFloat(config.basePrice) || 0;
                const hasDiscount = config.isVolumeDiscount && qty > config.discountAfter;
                const discount = hasDiscount ? config.discountPercent : 0;
                const price = (bPrice * (1 - discount / 100)).toFixed(2);
                return (
                  <div
                    key={i}
                    className={`flex-1 min-w-[70px] p-2 rounded-lg border text-center transition-all ${hasDiscount
                      ? 'bg-yellow-400/10 border-yellow-400/50'
                      : 'bg-white/5 border-white/10'
                      }`}
                  >
                    <div className="text-[10px] text-white/40 uppercase mb-1">{qty} bbl</div>
                    <div className="text-sm font-bold text-white">${price}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  // New component for 25-field accordion
  const renderMultiFieldAccordion = ({
    isOpen,
    onToggle,
    value,
    onChange,
    label,
    subLabel,
    fieldName,
    configIndex,
    isOwn,
    errorKey,
    error
  }) => {
    const displayValue = (raw, n) => {
      if (!raw) return "";
      const v = String(raw).split(",")[n - 1] ?? "";
      return v === "" || v === "0" || v === "0.00" ? "" : v;
    };

    return (
      <div className="relative" style={{ zIndex: isOpen ? 40 : 'auto' }}>
        <button
          type="button"
          onClick={onToggle}
          className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-white/20 bg-white/5 hover:bg-white/10 transition-colors"
        >
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="text-sm font-semibold text-white/90 whitespace-nowrap">{label}</h3>
            <span className="text-[11px] text-white/40 whitespace-nowrap">(1–25 barrels)</span>
          </div>
          <svg
            className={`w-4 h-4 text-white/50 transition-transform duration-200 shrink-0 ml-2 ${isOpen ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isOpen && (
          <div
            className="absolute left-0 right-0 mt-1 p-4 rounded-lg border border-white/20 shadow-2xl"
            style={{ background: '#152b20', top: '100%', zIndex: 50 }}
          >
            <p className="text-[11px] text-white/40 mb-3">Optional — enter prices starting at Barrel 1 with no gaps. You can stop at any barrel; any order larger than your last entry is charged at your last entered price.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
              {Array.from({ length: 25 }, (_, i) => {
                const bn = i + 1;
                return (
                  <div key={bn} className="flex flex-col">
                    <label className="text-[10px] text-white/50 mb-1">Barrel {bn}</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="Enter"
                      value={displayValue(value, bn)}
                      onChange={(e) => onChange(configIndex, isOwn, fieldName, bn, e.target.value)}
                      className="w-full bg-white/5 border border-white/20 text-white placeholder:text-white/20 rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:border-yellow-400"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {error && (
          <p className="text-red-400 text-xs mt-1 font-medium">{error}</p>
        )}
      </div>
    );
  };

  const renderBarrelForm = (type, configs, handleChange, title, isOwnBarrel) => {
    if (!selectedSubTypes.includes(type)) return null;

    const transitTimeOptions = isOwnBarrel ? TRANSIT_TIME_NUMBERS_OWN : TRANSIT_TIME_NUMBERS_DROPOFF;

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
                {errors[`${isOwnBarrel ? 'ownBarrel' : 'dropOffBarrel'}_${index}_originCountry`] && (
                  <p className="text-red-400 text-sm mt-1">
                    {errors[`${isOwnBarrel ? 'ownBarrel' : 'dropOffBarrel'}_${index}_originCountry`]}
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
                {errors[`${isOwnBarrel ? 'ownBarrel' : 'dropOffBarrel'}_${index}_destinationCountry`] && (
                  <p className="text-red-400 text-sm mt-1">
                    {errors[`${isOwnBarrel ? 'ownBarrel' : 'dropOffBarrel'}_${index}_destinationCountry`]}
                  </p>
                )}
              </div>

              <div>
                <h3 className="text-sm mb-2 text-white/80">Base Price ($)</h3>
                <input
                  name="basePrice"
                  value={data.basePrice}
                  onChange={(e) => handleChange(index, e)}
                  placeholder="Enter"
                  className="w-full bg-transparent border border-white/20
                    text-white placeholder:text-white/40
                    rounded-md px-4 py-2.5
                    focus:outline-none focus:border-yellow-400"
                  type="text" />
                {errors[`${isOwnBarrel ? 'ownBarrel' : 'dropOffBarrel'}_${index}_basePrice`] && (
                  <p className="text-red-400 text-sm mt-1">
                    {errors[`${isOwnBarrel ? 'ownBarrel' : 'dropOffBarrel'}_${index}_basePrice`]}
                  </p>
                )}
              </div>

              {/* Only show Delivery ($) field for Request Barrel Drop-Off (not for Ship Your Own Barrel) */}
              {!isOwnBarrel && (
                <div>
                  <h3 className="text-sm mb-2 text-white/80">Delivery ($)</h3>
                  <input
                    name="pricePerMile"
                    value={data.pricePerMile}
                    onChange={(e) => handleChange(index, e)}
                    placeholder="Enter"
                    className="w-full bg-transparent border border-white/20
                      text-white placeholder:text-white/40
                      rounded-md px-4 py-2.5
                      focus:outline-none focus:border-yellow-400"
                    type="text" />
                  {errors[`${isOwnBarrel ? 'ownBarrel' : 'dropOffBarrel'}_${index}_pricePerMile`] && (
                    <p className="text-red-400 text-sm mt-1">
                      {errors[`${isOwnBarrel ? 'ownBarrel' : 'dropOffBarrel'}_${index}_pricePerMile`]}
                    </p>
                  )}
                </div>
              )}

              {/* ── Customs & Handling 25-barrel accordion ── */}
              {renderMultiFieldAccordion({
                isOpen: customsOpen[`${isOwnBarrel ? 'own' : 'do'}_${index}`],
                onToggle: () => toggleCustoms(`${isOwnBarrel ? 'own' : 'do'}_${index}`),
                value: data.customsAndHandling,
                onChange: handleMultiFieldChange,
                label: "Customs & Handling ($)",
                fieldName: "customsAndHandling",
                configIndex: index,
                isOwn: isOwnBarrel,
                errorKey: `${isOwnBarrel ? 'ownBarrel' : 'dropOffBarrel'}_${index}_customsAndHandling`,
                error: errors[`${isOwnBarrel ? 'ownBarrel' : 'dropOffBarrel'}_${index}_customsAndHandling`]
              })}

              {/* Only show pickup/delivery fields for Ship Your Own Barrel */}
              {isOwnBarrel && (
                <>
                  {/* ── Flat Pickup Charge 25-barrel accordion ── */}
                  {renderMultiFieldAccordion({
                    isOpen: flatPickupOpen[`own_${index}`],
                    onToggle: () => toggleFlatPickup(`own_${index}`),
                    value: data.flatPickupCharge,
                    onChange: handleMultiFieldChange,
                    label: "Flat Pickup Charge ($)",
                    fieldName: "flatPickupCharge",
                    configIndex: index,
                    isOwn: true,
                    errorKey: `ownBarrel_${index}_flatPickupCharge`,
                    error: errors[`ownBarrel_${index}_flatPickupCharge`]
                  })}

                  <div>
                    <h3 className="text-sm mb-2 text-white/80">Pickup Free Miles</h3>
                    <input
                      name="pickupFreeMiles"
                      value={data.pickupFreeMiles}
                      onChange={(e) => handleChange(index, e)}
                      placeholder="Enter pickup free miles"
                      className="w-full bg-transparent border border-white/20
                        text-white placeholder:text-white/40
                        rounded-md px-4 py-2.5
                        focus:outline-none focus:border-yellow-400"
                      type="text" />
                    {errors[`${isOwnBarrel ? 'ownBarrel' : 'dropOffBarrel'}_${index}_pickupFreeMiles`] && (
                      <p className="text-red-400 text-sm mt-1">
                        {errors[`${isOwnBarrel ? 'ownBarrel' : 'dropOffBarrel'}_${index}_pickupFreeMiles`]}
                      </p>
                    )}
                  </div>

                  <div>
                    <h3 className="text-sm mb-2 text-white/80">Pickup Per Mile Charge ($)</h3>
                    <input
                      name="pickupPerMileCharge"
                      value={data.pickupPerMileCharge}
                      onChange={(e) => handleChange(index, e)}
                      placeholder="Enter pickup per mile charge"
                      className="w-full bg-transparent border border-white/20
                        text-white placeholder:text-white/40
                        rounded-md px-4 py-2.5
                        focus:outline-none focus:border-yellow-400"
                      type="text" />
                    {errors[`${isOwnBarrel ? 'ownBarrel' : 'dropOffBarrel'}_${index}_pickupPerMileCharge`] && (
                      <p className="text-red-400 text-sm mt-1">
                        {errors[`${isOwnBarrel ? 'ownBarrel' : 'dropOffBarrel'}_${index}_pickupPerMileCharge`]}
                      </p>
                    )}
                  </div>

                  {/* ── Flat Delivery Charge 25-barrel accordion ── */}
                  {renderMultiFieldAccordion({
                    isOpen: flatDeliveryOpen[`own_${index}`],
                    onToggle: () => toggleFlatDelivery(`own_${index}`),
                    value: data.flatDeliveryCharge,
                    onChange: handleMultiFieldChange,
                    label: "Flat Delivery Charge ($)",
                    fieldName: "flatDeliveryCharge",
                    configIndex: index,
                    isOwn: true,
                    errorKey: `ownBarrel_${index}_flatDeliveryCharge`,
                    error: errors[`ownBarrel_${index}_flatDeliveryCharge`]
                  })}

                  <div>
                    <h3 className="text-sm mb-2 text-white/80">Delivery Free Miles</h3>
                    <input
                      name="deliveryFreeMiles"
                      value={data.deliveryFreeMiles}
                      onChange={(e) => handleChange(index, e)}
                      placeholder="Enter delivery free miles"
                      className="w-full bg-transparent border border-white/20
                        text-white placeholder:text-white/40
                        rounded-md px-4 py-2.5
                        focus:outline-none focus:border-yellow-400"
                      type="text" />
                    {errors[`${isOwnBarrel ? 'ownBarrel' : 'dropOffBarrel'}_${index}_deliveryFreeMiles`] && (
                      <p className="text-red-400 text-sm mt-1">
                        {errors[`${isOwnBarrel ? 'ownBarrel' : 'dropOffBarrel'}_${index}_deliveryFreeMiles`]}
                      </p>
                    )}
                  </div>

                  <div>
                    <h3 className="text-sm mb-2 text-white/80">Delivery Per Mile Charge ($)</h3>
                    <input
                      name="deliveryPerMileCharge"
                      value={data.deliveryPerMileCharge}
                      onChange={(e) => handleChange(index, e)}
                      placeholder="Enter delivery per mile charge"
                      className="w-full bg-transparent border border-white/20
                        text-white placeholder:text-white/40
                        rounded-md px-4 py-2.5
                        focus:outline-none focus:border-yellow-400"
                      type="text" />
                    {errors[`${isOwnBarrel ? 'ownBarrel' : 'dropOffBarrel'}_${index}_deliveryPerMileCharge`] && (
                      <p className="text-red-400 text-sm mt-1">
                        {errors[`${isOwnBarrel ? 'ownBarrel' : 'dropOffBarrel'}_${index}_deliveryPerMileCharge`]}
                      </p>
                    )}
                  </div>
                </>
              )}

              {renderBarrelPrices(
                isOwnBarrel ? 'ownBarrel' : 'dropOffBarrel',
                data,
                index
              )}

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
                {errors[`${isOwnBarrel ? 'ownBarrel' : 'dropOffBarrel'}_${index}_transitTime`] && (
                  <p className="text-red-400 text-sm mt-1">
                    {errors[`${isOwnBarrel ? 'ownBarrel' : 'dropOffBarrel'}_${index}_transitTime`]}
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
              {[1, 2, 3, 4, 5, 6].map((step) => (
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
                                setDropOffBarrelConfigs(curr => curr.length === 0 ? [createBarrelConfig({ pricePerMile: "0", freeMiles: "0" })] : curr);
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