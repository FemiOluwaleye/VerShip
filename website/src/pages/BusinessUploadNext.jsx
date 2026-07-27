import React, { useState, useEffect } from 'react'
import { man } from "../common/common-assets/assets-images";
import { useNavigate } from 'react-router-dom';
import ProfileMain from '../components/ProfileMain';
import Commonbanner from '../components/Commonbanner';
import { getProviderProfile, completeProfile } from '../api/cms';
import MultiSelect from '../components/MultiSelect';
import { toast } from 'sonner';
import SuccessPopup from '../components/SuccessPopup';
import countries from "world-countries";
import { FaSpinner, FaPlus, FaTrash } from "react-icons/fa";
import { JAMAICA_PARISHES } from '../utils/parishes';
import { ADVERTISED_ORIGINS as ORIGIN_CITIES } from '../utils/origins';
import InfoTip from '../components/InfoTip';

const DESTINATION_CITIES = [
  "Kingston, Jamaica",
];

const CITY_COORDINATES = {
  "Fort Lauderdale, FL": { lat: "26.1224", lng: "-80.1373" },
  "Miami, FL": { lat: "25.7617", lng: "-80.1918" },
  "Pittsburgh, PA": { lat: "40.4387", lng: "-79.9972" },
  "Orlando, FL": { lat: "28.4778279", lng: "-81.2880713" },
};

const TRANSIT_TIME_NUMBERS = ["2", "3", "4"];
const TRANSIT_TIME_NUMBERS_OWN_BARREL = ["14", "21", "30"];
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

const zeroToEmpty = (v) => {
  const s = (v === null || v === undefined) ? "" : String(v);
  return (s === "0" || s === "0.00") ? "" : s;
};

const emptyParishFees = () =>
  JAMAICA_PARISHES.reduce((acc, p) => { acc[p] = { first: "", additional: "" }; return acc; }, {});

// Normalise a stored parishFees value (object or JSON string) into the
// { parish: { first, additional } } shape the form edits, hiding "0" defaults.
// Old scalar entries ("<amount>") are read as { first: amount, additional: "" }.
const hydrateParishFees = (raw) => {
  let src = raw;
  if (typeof src === 'string') {
    try { src = JSON.parse(src); } catch { src = {}; }
  }
  if (!src || typeof src !== 'object' || Array.isArray(src)) src = {};
  return JAMAICA_PARISHES.reduce((acc, p) => {
    const entry = src[p];
    if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      acc[p] = { first: zeroToEmpty(entry.first), additional: zeroToEmpty(entry.additional) };
    } else {
      acc[p] = { first: zeroToEmpty(entry), additional: "" };
    }
    return acc;
  }, {});
};

const createBarrelConfigNext = () => ({
  originCountry: "",
  destinationCountry: "",
  basePrice: "",
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

// Hydrate a config returned by /get-profile (v2 fields when present,
// otherwise fall back to the legacy basePrice for the sea freight input).
const hydrateConfigNext = (config) => {
  const seaFreight = zeroToEmpty(config.seaFreightPrice) || zeroToEmpty(config.basePrice);
  return {
    ...createBarrelConfigNext(),
    originCountry: config.originCountry || "",
    destinationCountry: config.destinationCountry || "",
    originLat: config.originLat || "",
    originLong: config.originLong || "",
    destinationLat: config.destinationLat || "",
    destinationLong: config.destinationLong || "",
    transitTime: config.transitTime || "",
    shipmentContents: config.shipmentContents || "",
    basePrice: seaFreight,
    pickupCharge: zeroToEmpty(config.pickupCharge),
    pickupRadius: zeroToEmpty(config.pickupRadius),
    extraMileageCost: zeroToEmpty(config.extraMileageCost),
    seaFreightPrice: seaFreight,
    discount5to9: zeroToEmpty(config.discount5to9),
    discount10plus: zeroToEmpty(config.discount10plus),
    parishFees: hydrateParishFees(config.parishFees),
  };
};

const BusinessUploadNext = () => {
  const navigate = useNavigate();
  const userStr = localStorage.getItem("user");
  const user = userStr ? JSON.parse(userStr) : {};

  const [isLoading, setIsLoading] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);

  const [formData, setFormData] = useState({
    basePrice: "",
    pricePerMile: "",
    pricePerPound: "",
    originLat: "",
    originLong: "",
    destinationLat: "",
    destinationLong: "",
    shipmentType: "",
    originCountry: "",
    destinationCountry: "",
    transitTime: "",
    shipmentContents: ""
  });

  const [ownBarrelConfigs, setOwnBarrelConfigs] = useState([]);
  const [dropOffBarrelConfigs, setDropOffBarrelConfigs] = useState([]);

  const [selectedSubTypes, setSelectedSubTypes] = useState([]);
  const [errors, setErrors] = useState({});
  const [applyAllFees, setApplyAllFees] = useState({});

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user.id) return;
      try {
        const response = await getProviderProfile(user.id);
        if (response.success && response.body.businessInfo) {
          const info = response.body.businessInfo;
          setFormData({
            basePrice: info.basePrice || "",
            pricePerMile: info.pricePerMile || "",
            pricePerPound: info.pricePerPound || "",
            originLat: info.originLat || "",
            originLong: info.originLong || "",
            destinationLat: info.destinationLat || "",
            destinationLong: info.destinationLong || "",
            shipmentType: info.shipmentType || "",
            originCountry: info.originCountry || "",
            destinationCountry: info.destinationCountry || "",
            transitTime: info.transitTime || "",
            shipmentContents: info.shipmentContents || ""
          });

          if (info.shipmentItemTypes) {
            const subTypes = info.shipmentItemTypes.map(t => t.item_type);
            setSelectedSubTypes(subTypes);

            if (subTypes.includes("Ship Your Own Barrel")) {
              if (info.barrelOptions?.ownBarrel && Array.isArray(info.barrelOptions.ownBarrel) && info.barrelOptions.ownBarrel.length > 0) {
                setOwnBarrelConfigs(info.barrelOptions.ownBarrel.map(hydrateConfigNext));
              } else {
                setOwnBarrelConfigs([createBarrelConfigNext()]);
              }
            } else {
              setOwnBarrelConfigs([]);
            }

            if (subTypes.includes("Request Barrel Drop-Off")) {
              if (info.barrelOptions?.dropOffBarrel && Array.isArray(info.barrelOptions.dropOffBarrel) && info.barrelOptions.dropOffBarrel.length > 0) {
                setDropOffBarrelConfigs(info.barrelOptions.dropOffBarrel.map(hydrateConfigNext));
              } else {
                setDropOffBarrelConfigs([createBarrelConfigNext()]);
              }
            } else {
              setDropOffBarrelConfigs([]);
            }
          }
        }
      } catch (error) {
        console.error("Failed to fetch profile:", error);
      }
    };
    fetchProfile();
  }, [user.id]);

  const validateField = (name, value, type = 'main') => {
    let error = "";
    const strValue = (value !== null && value !== undefined) ? String(value) : "";

    if (type === 'main') {
      switch (name) {
        case "basePrice":
          if (!strValue) error = "Base Price is required";
          else if (Number(strValue) === 0) error = "Price must be greater than 0";
          break;
        case "pricePerMile":
          if (!strValue) error = "Price Per Mile is required";
          else if (Number(strValue) === 0) error = "Price must be greater than 0";
          break;
        case "shipmentType":
          if (!strValue) error = "Shipment Type is required";
          break;
        case "sub_shipment_type":
          const subOptions = getSubOptions();
          if (subOptions.length > 0 && (!value || value.length === 0)) {
            error = "At least one sub-type must be selected";
          }
          break;
        case "originCountry":
          if (!strValue) error = "Origin Country is required";
          break;
        case "destinationCountry":
          if (!strValue) error = "Destination Country is required";
          break;
        case "transitTime":
          if (!strValue) error = "Transit Time is required";
          break;
        default:
          break;
      }
    }

    if (type.startsWith('ownBarrel_') || type.startsWith('dropOffBarrel_')) {
      const parts = type.split('_');
      const typePrefix = parts[0];
      const configIndex = parseInt(parts[1]);

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
      setErrors(prev => ({ ...prev, [name]: error }));
    }

    return error;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    let formattedValue = value;

    if (name !== 'shipmentContents') {
      formattedValue = value.replace(/^\s+/, "");
    }

    const priceFields = ["basePrice", "pricePerMile"];

    if (priceFields.includes(name)) {
      formattedValue = formattedValue.replace(/[^0-9.]/g, "");
    }

    if (name === "shipmentType") {
      setSelectedSubTypes([]);
      setErrors(prev => ({ ...prev, sub_shipment_type: "" }));
      setOwnBarrelConfigs([]);
      setDropOffBarrelConfigs([]);
    }

    setFormData(prev => {
      const updated = { ...prev, [name]: formattedValue };
      if ((name === "originCountry" || name === "destinationCountry") && CITY_COORDINATES[formattedValue]) {
        const prefix = name === "originCountry" ? "origin" : "destination";
        updated[`${prefix}Lat`] = CITY_COORDINATES[formattedValue].lat;
        updated[`${prefix}Long`] = CITY_COORDINATES[formattedValue].lng;
      }
      return updated;
    });
    validateField(name, formattedValue);
  };

  const CONFIG_PRICE_FIELDS = ["seaFreightPrice", "discount5to9", "discount10plus", "pickupCharge", "pickupRadius", "extraMileageCost"];

  const handleOwnBarrelChange = (index, e) => {
    const { name, value } = e.target;
    let formattedValue = value.replace(/^\s+/, "");
    if (CONFIG_PRICE_FIELDS.includes(name)) {
      formattedValue = sanitizeMoney(formattedValue);
    }
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
    (isOwn ? setOwnBarrelConfigs : setDropOffBarrelConfigs)(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], parishFees: filled };
      return updated;
    });
  };

  const addOwnBarrelConfig = () => {
    setOwnBarrelConfigs(prev => [...prev, createBarrelConfigNext()]);
  };

  const removeOwnBarrelConfig = (index) => {
    if (ownBarrelConfigs.length > 1) {
      setOwnBarrelConfigs(prev => prev.filter((_, i) => i !== index));
    }
  };

  const addDropOffBarrelConfig = () => {
    setDropOffBarrelConfigs(prev => [...prev, createBarrelConfigNext()]);
  };

  const removeDropOffBarrelConfig = (index) => {
    if (dropOffBarrelConfigs.length > 1) {
      setDropOffBarrelConfigs(prev => prev.filter((_, i) => i !== index));
    }
  };

  const toggleSubType = (typeId) => {
    setSelectedSubTypes(prev => {
      const isAdding = !prev.includes(typeId);
      const next = isAdding
        ? [...prev, typeId]
        : prev.filter(t => t !== typeId);

      if (isAdding) {
        if (typeId === "Ship Your Own Barrel") {
          setOwnBarrelConfigs(curr => curr.length === 0 ? [createBarrelConfigNext()] : curr);
        } else if (typeId === "Request Barrel Drop-Off") {
          setDropOffBarrelConfigs(curr => curr.length === 0 ? [createBarrelConfigNext()] : curr);
        }
      } else {
        if (!next.includes("Ship Your Own Barrel")) {
          setOwnBarrelConfigs([]);
        }
        if (!next.includes("Request Barrel Drop-Off")) {
          setDropOffBarrelConfigs([]);
        }
      }

      validateField("sub_shipment_type", next);
      return next;
    });
  };

  const getSubOptions = () => {
    switch (formData.shipmentType) {
      case "barrel":
        return [
          {
            id: "Ship Your Own Barrel",
            label: "Ship Your Own Barrel",
            info: "The customer already has their own packed barrel. You collect it from them (or they drop it at your warehouse), then ship and deliver it. Pick this if you only handle barrels the customer supplies.",
          },
          {
            id: "Request Barrel Drop-Off",
            label: "Request Barrel Drop-Off",
            info: "You deliver an empty barrel to the customer first. They fill it at home, you collect it later, then ship and deliver it. Pick this if you can supply and drop off empty barrels.",
          }
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
          <label className="text-sm mb-2 text-white/80 block">Pickup Barrel Charge ($)</label>
          <input
            name="pickupCharge"
            value={data.pickupCharge}
            onChange={(e) => handleChange(index, e)}
            placeholder="65"
            inputMode="decimal"
            className="w-full bg-transparent border border-white/20 text-white placeholder:text-white/40 rounded-md px-4 py-2.5 focus:outline-none focus:border-yellow-400"
            type="text"
          />
          {errors[`${errPrefix}_${index}_pickupCharge`] && (
            <p className="text-red-400 text-xs mt-1">{errors[`${errPrefix}_${index}_pickupCharge`]}</p>
          )}
        </div>
        <div>
          <label className="text-sm mb-2 text-white/80 block">Pickup Radius (miles)</label>
          <input
            name="pickupRadius"
            value={data.pickupRadius}
            onChange={(e) => handleChange(index, e)}
            placeholder="15"
            inputMode="decimal"
            className="w-full bg-transparent border border-white/20 text-white placeholder:text-white/40 rounded-md px-4 py-2.5 focus:outline-none focus:border-yellow-400"
            type="text"
          />
          {errors[`${errPrefix}_${index}_pickupRadius`] && (
            <p className="text-red-400 text-xs mt-1">{errors[`${errPrefix}_${index}_pickupRadius`]}</p>
          )}
        </div>
        <div>
          <label className="text-sm mb-2 text-white/80 block">Extra Mileage Cost ($/mile)</label>
          <input
            name="extraMileageCost"
            value={data.extraMileageCost}
            onChange={(e) => handleChange(index, e)}
            placeholder="0.10"
            inputMode="decimal"
            className="w-full bg-transparent border border-white/20 text-white placeholder:text-white/40 rounded-md px-4 py-2.5 focus:outline-none focus:border-yellow-400"
            type="text"
          />
          {errors[`${errPrefix}_${index}_extraMileageCost`] && (
            <p className="text-red-400 text-xs mt-1">{errors[`${errPrefix}_${index}_extraMileageCost`]}</p>
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
        <label className="text-sm mb-2 text-white/80 block">Barrels 1&ndash;4 price ($)</label>
        <input
          name="seaFreightPrice"
          value={data.seaFreightPrice}
          onChange={(e) => handleChange(index, e)}
          placeholder="80.30"
          inputMode="decimal"
          className="w-full bg-transparent border border-white/20 text-white placeholder:text-white/40 rounded-md px-4 py-2.5 focus:outline-none focus:border-yellow-400"
          type="text"
        />
        {errors[`${errPrefix}_${index}_seaFreightPrice`] && (
          <p className="text-red-400 text-xs mt-1">{errors[`${errPrefix}_${index}_seaFreightPrice`]}</p>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-sm mb-2 text-white/80 block">Barrels 5&ndash;9 discount ($ off per barrel)</label>
          <input
            name="discount5to9"
            value={data.discount5to9}
            onChange={(e) => handleChange(index, e)}
            placeholder="10"
            inputMode="decimal"
            className="w-full bg-transparent border border-white/20 text-white placeholder:text-white/40 rounded-md px-4 py-2.5 focus:outline-none focus:border-yellow-400"
            type="text"
          />
          {discountedHint(data, 'discount5to9')}
          {errors[`${errPrefix}_${index}_discount5to9`] && (
            <p className="text-red-400 text-xs mt-1">{errors[`${errPrefix}_${index}_discount5to9`]}</p>
          )}
        </div>
        <div>
          <label className="text-sm mb-2 text-white/80 block">Barrels 10+ discount ($ off per barrel)</label>
          <input
            name="discount10plus"
            value={data.discount10plus}
            onChange={(e) => handleChange(index, e)}
            placeholder="25"
            inputMode="decimal"
            className="w-full bg-transparent border border-white/20 text-white placeholder:text-white/40 rounded-md px-4 py-2.5 focus:outline-none focus:border-yellow-400"
            type="text"
          />
          {discountedHint(data, 'discount10plus')}
          {errors[`${errPrefix}_${index}_discount10plus`] && (
            <p className="text-red-400 text-xs mt-1">{errors[`${errPrefix}_${index}_discount10plus`]}</p>
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
            <label className="text-[11px] text-white/50 mb-1 block">1 Barrel ($)</label>
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
            <label className="text-[11px] text-white/50 mb-1 block">Additional Barrel ($)</label>
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
    if (configs.length === 0) return null;

    const originCities = ORIGIN_CITIES;
    const destCities = DESTINATION_CITIES;
    const errPrefix = isOwnBarrel ? 'ownBarrel' : 'dropOffBarrel';

    const transitTimeNumbers = isOwnBarrel ? TRANSIT_TIME_NUMBERS_OWN_BARREL : TRANSIT_TIME_NUMBERS;

    return (
      <div className="mt-8 space-y-8 text-left">
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
                <label className="text-sm mb-2 text-white/80 block">Origin city</label>
                <select name="originCountry" value={data.originCountry} onChange={(e) => handleChange(index, e)} className="w-full border border-white/20 text-white rounded-md px-4 py-2.5 bg-transparent focus:outline-none focus:border-yellow-400">
                  <option value="" disabled hidden>Select origin city</option>
                  {originCities.map(city => (
                    <option key={city} value={city} className="text-black">
                      {city}
                    </option>
                  ))}
                </select>
                {errors[`${errPrefix}_${index}_originCountry`] && (
                  <p className="text-red-400 text-xs mt-1">{errors[`${errPrefix}_${index}_originCountry`]}</p>
                )}
              </div>
              <div>
                <label className="text-sm mb-2 text-white/80 block">Destination city</label>
                <select name="destinationCountry" value={data.destinationCountry} onChange={(e) => handleChange(index, e)} className="w-full border border-white/20 text-white rounded-md px-4 py-2.5 bg-transparent focus:outline-none focus:border-yellow-400">
                  <option value="" disabled hidden>Select destination city</option>
                  {destCities.map(city => <option key={city} value={city} className="text-black">{city}</option>)}
                </select>
                {errors[`${errPrefix}_${index}_destinationCountry`] && (
                  <p className="text-red-400 text-xs mt-1">{errors[`${errPrefix}_${index}_destinationCountry`]}</p>
                )}
              </div>

              {isOwnBarrel && renderPickupSection(data, index, handleChange, errPrefix)}

              {renderSeaFreightSection(data, index, handleChange, errPrefix)}

              {renderParishFeesSection(data, index, isOwnBarrel)}

              <div>
                <label className="text-sm mb-2 text-white/80 block">Transit Time</label>
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
                    {transitTimeNumbers.map(n => <option key={n} value={n} className="text-black">{n}</option>)}
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
                  <p className="text-red-400 text-xs mt-1">{errors[`${errPrefix}_${index}_transitTime`]}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const OWN_CONFIG_FIELDS = ["originCountry", "destinationCountry", "seaFreightPrice", "discount5to9", "discount10plus", "pickupCharge", "pickupRadius", "extraMileageCost", "transitTime"];
  const DROPOFF_CONFIG_FIELDS = ["originCountry", "destinationCountry", "seaFreightPrice", "discount5to9", "discount10plus", "transitTime"];

  // Map a config to the API shape: v2 simplified pricing plus zeroed legacy
  // fields so old readers don't crash.
  const buildConfigPayload = (config, isDropOff) => ({
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log("Handle submit triggered");

    const newErrors = {};

    if (formData.shipmentType !== 'barrel') {
      Object.keys(formData).forEach(key => {
        if (['originLat', 'originLong', 'destinationLat', 'destinationLong'].includes(key)) return;
        if (['basePrice', 'pricePerMile', 'originCountry', 'destinationCountry', 'transitTime', 'shipmentContents'].includes(key)) return;
        const error = validateField(key, formData[key]);
        if (error) newErrors[key] = error;
      });
    } else {
      const error = validateField('shipmentType', formData.shipmentType);
      if (error) newErrors.shipmentType = error;
    }

    const subTypeError = validateField("sub_shipment_type", selectedSubTypes);
    if (subTypeError) newErrors.sub_shipment_type = subTypeError;

    if (formData.shipmentType === 'barrel') {
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
    }

    if (Object.values(newErrors).some(err => err)) {
      setErrors(newErrors);
      console.log("Validation errors:", newErrors);
      toast.error("Please fill in all required fields");
      return;
    }

    setIsLoading(true);
    try {
      const firstOwn = ownBarrelConfigs[0];
      const firstDropOff = dropOffBarrelConfigs[0];
      const barrelDetails = formData.shipmentType === 'barrel'
        ? (selectedSubTypes.includes("Ship Your Own Barrel") ? firstOwn : (selectedSubTypes.includes("Request Barrel Drop-Off") ? firstDropOff : null))
        : null;

      const payload = {
        ...formData,
        providerId: user.id,
        isFinalStep: "true",
        sub_shipment_type: selectedSubTypes,
        basePrice: barrelDetails?.seaFreightPrice || formData.basePrice || "0",
        pricePerPound: formData.pricePerPound || "0",
        transitTime: barrelDetails?.transitTime || formData.transitTime || "",
        shipmentContents: barrelDetails?.shipmentContents || formData.shipmentContents || "",
        originCountry: barrelDetails?.originCountry || formData.originCountry || "",
        destinationCountry: barrelDetails?.destinationCountry || formData.destinationCountry || "",
        originLat: barrelDetails?.originLat || (barrelDetails?.originCountry ? CITY_COORDINATES[barrelDetails.originCountry]?.lat : "") || formData.originLat || "",
        originLong: barrelDetails?.originLong || (barrelDetails?.originCountry ? CITY_COORDINATES[barrelDetails.originCountry]?.lng : "") || formData.originLong || "",
        destinationLat: barrelDetails?.destinationLat || (barrelDetails?.destinationCountry ? CITY_COORDINATES[barrelDetails.destinationCountry]?.lat : "") || formData.destinationLat || "",
        destinationLong: barrelDetails?.destinationLong || (barrelDetails?.destinationCountry ? CITY_COORDINATES[barrelDetails.destinationCountry]?.lng : "") || formData.destinationLong || "",
        pricePerMile: "0",
        customsAndHandling: "0",
        freeMiles: "0",
        flatPickupCharge: "0",
        pickupFreeMiles: "0",
        pickupPerMileCharge: "0",
        flatDeliveryCharge: "0",
        deliveryFreeMiles: "0",
        deliveryPerMileCharge: "0",
        barrelOptions: formData.shipmentType === 'barrel' ? {
          ownBarrel: selectedSubTypes.includes("Ship Your Own Barrel")
            ? ownBarrelConfigs.map(config => buildConfigPayload(config, false))
            : null,
          dropOffBarrel: selectedSubTypes.includes("Request Barrel Drop-Off")
            ? dropOffBarrelConfigs.map(config => buildConfigPayload(config, true))
            : null,
        } : null
      };

      const response = await completeProfile(payload);
      if (response.success) {
        const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
        const updatedUser = { ...currentUser, ...response.body, isProfileComplete: 1 };
        localStorage.setItem("user", JSON.stringify(updatedUser));
        toast.success("Profile updated successfully!");
        navigate("/request");
      } else {
        toast.error(response.message || "Failed to update profile");
      }
    } catch (error) {
      console.error("Profile finish update error:", error);
      toast.error(error.response?.data?.message || "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Commonbanner title="Edit Profile" />

      <div className='bg-gradient-to-r from-[#244536] via-[#1b352b] to-[#0b1914] py-10'>
        <div className='container mx-auto flex flex-col lg:flex-row justify-center items-start pb-[20px] gap-5'>
          <div className='w-full lg:w-[30%]'><ProfileMain show={false} /></div>

          <div className='w-full shadow-sm bg-[#2D413F] rounded-[18px] lg:w-[70%] p-6 lg:p-10'>
            <div className="w-full max-w-[480px] mb-10 mx-auto">
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5, 6].map((step) => (
                  <div
                    key={step}
                    className={`h-[4px] w-full rounded-full transition-all duration-300 ${step <= 6 ? "bg-yellow-400" : "bg-white/30"}`}
                  />
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start gap-10">
              <form onSubmit={handleSubmit} className="w-full sm:w-[60%] flex flex-col gap-5 text-white text-left">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Shipment Type</label>
                    <select name="shipmentType" value={formData.shipmentType} onChange={handleInputChange} className="w-full bg-[#2D413F] border border-white/20 rounded-lg px-3 py-2 focus:border-yellow-400 outline-none">
                      <option value="" disabled hidden>Select</option>
                      <option className="text-black" value="barrel">Barrel</option>
                    </select>
                    {errors.shipmentType && (
                      <p className="text-red-400 text-xs mt-1">{errors.shipmentType}</p>
                    )}
                  </div>
                </div>

                {getSubOptions().length > 0 && (
                  <div>
                    <label className="text-sm font-medium mb-3 block">Sub-shipment Type (Select multiple)</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {getSubOptions().map((opt) => (
                        <div
                          key={opt.id}
                          onClick={() => toggleSubType(opt.id)}
                          className={`
                            border border-white/20 rounded-lg px-4 py-2 cursor-pointer transition-all
                            flex items-center gap-3
                            ${selectedSubTypes.includes(opt.id) ? 'bg-yellow-400/10 border-yellow-400' : 'hover:border-white/40'}
                          `}
                        >
                          <div className={`
                            w-4 h-4 rounded border flex items-center justify-center transition-all
                            ${selectedSubTypes.includes(opt.id) ? 'bg-yellow-400 border-yellow-400' : 'border-white/30'}
                          `}>
                            {selectedSubTypes.includes(opt.id) && <span className="text-black text-[10px] font-bold">✓</span>}
                          </div>
                          <span className={`${selectedSubTypes.includes(opt.id) ? 'text-yellow-400' : 'text-white/70'} text-sm`}>
                            {opt.label}
                          </span>
                          {opt.info && (
                            <InfoTip label={opt.label} text={opt.info} />
                          )}
                        </div>
                      ))}
                    </div>
                    {errors.sub_shipment_type && (
                      <p className="text-red-400 text-xs mt-1">{errors.sub_shipment_type}</p>
                    )}
                  </div>
                )}

                {formData.shipmentType === 'barrel' && (
                  <>
                    {renderBarrelForm("Ship Your Own Barrel", ownBarrelConfigs, handleOwnBarrelChange, "Ship Your Own Barrel Details", true)}
                    {renderBarrelForm("Request Barrel Drop-Off", dropOffBarrelConfigs, handleDropOffBarrelChange, "Request Barrel Drop-Off Details", false)}
                  </>
                )}

                <button
                  disabled={isLoading}
                  type="submit"
                  className="bg-[linear-gradient(180deg,#FFBF00_0%,#FFD864_100%)] text-black font-bold py-3 rounded-full mt-4 flex items-center justify-center gap-2 hover:scale-105 transition-all disabled:opacity-50"
                >
                  {isLoading ? <FaSpinner className="animate-spin" /> : "Finish"}
                </button>
              </form>

              <div className="hidden sm:flex w-[40%] items-center justify-center">
                <img src={man} alt="Business" className="w-full object-contain" />
              </div>
            </div>
          </div>
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
        buttonText="Logout"
      />
    </>
  );
};

export default BusinessUploadNext;
