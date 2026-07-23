export const SERVICE_FEE_ADDON_NAMES = ["Service fee", "Customs Clearance", "Service Fee"];

export const getServiceFeePercentFromAddons = (addons) => {
  if (!Array.isArray(addons)) return 0;
  const match =
    addons.find((addon) =>
      SERVICE_FEE_ADDON_NAMES.some(
        (name) => name.toLowerCase() === String(addon.name || "").toLowerCase()
      )
    ) ||
    addons.find((addon) =>
      /service\s*fee|customs\s*clearance/i.test(String(addon.name || ""))
    );
  return parseFloat(match?.price_in_percent ?? 0) || 0;
};

/** Volume discount on barrels — returns the barrel line total used for % fees */
export const calculateBarrelPricing = ({
  quantity = 0,
  perBarrelPrice = 0,
  isVolumeDiscount = false,
  discountAfter = 0,
  discountPercent = 0,
  storedBarrelDiscount = null,
}) => {
  const qty = parseInt(quantity, 10) || 0;
  const perBarrel = parseFloat(perBarrelPrice) || 0;
  const after = parseInt(discountAfter, 10) || 0;
  const pct = parseInt(discountPercent, 10) || 0;
  const volumeOn = isVolumeDiscount == 1 || isVolumeDiscount === true;

  const discountApplies =
    volumeOn && after > 0 && pct > 0 && qty > after;

  const listTotal = qty * perBarrel;
  const discountedPerBarrel = perBarrel * (1 - pct / 100);
  let barrelPrice = discountApplies ? qty * discountedPerBarrel : listTotal;

  const parsedStoredDiscount = parseFloat(storedBarrelDiscount);
  if (
    !Number.isNaN(parsedStoredDiscount) &&
    parsedStoredDiscount > 0 &&
    listTotal > 0
  ) {
    barrelPrice = Math.max(0, listTotal - parsedStoredDiscount);
  }

  const barrelDiscount = Math.max(0, listTotal - barrelPrice);

  return {
    barrelPrice,
    barrelDiscount,
    discountApplies,
    discountPercent: pct,
    discountAfter: after,
    listTotal,
    discountedPerBarrel,
    perBarrel,
    quantity: qty,
  };
};

/* ---------------- Simplified pricing model (v2) ---------------- */

/** A barrelsprices row uses the v2 model when seaFreightPrice is set. */
export const isPricingV2 = (bp) =>
  bp && String(bp.seaFreightPrice ?? "").trim() !== "" && parseFloat(bp.seaFreightPrice) > 0;

/**
 * Pick the rate card for a quote. Providers accumulate multiple barrelsprices
 * rows (one per origin route, plus stale legacy rows with no seaFreightPrice),
 * and matching on type alone returns whichever row the DB happens to list
 * first — which silently prices the shipment off the wrong (often blank
 * legacy) card. Match the booking's origin/destination like the server-side
 * quote matcher does, preferring a v2 card at each level of specificity.
 */
export const selectRateCard = (barrelPrices, { type, origin, destination } = {}) => {
  if (!Array.isArray(barrelPrices)) return null;
  const norm = (s) => String(s || "").toLowerCase().trim();
  const t = norm(type);
  const o = norm(origin);
  const d = norm(destination);
  const byType = barrelPrices.filter((bp) => norm(bp.type) === t);
  const routeMatch = (bp) =>
    norm(bp.originCountry) === o && norm(bp.destinationCountry) === d;
  return (
    byType.find((bp) => routeMatch(bp) && isPricingV2(bp)) ||
    byType.find(routeMatch) ||
    byType.find(isPricingV2) ||
    byType[0] ||
    null
  );
};

/** Per-barrel price after the tier discount: 1-4 full, 5-9 minus discount5to9, 10+ minus discount10plus. */
export const v2PerBarrelPrice = (bp, quantity) => {
  const qty = parseInt(quantity, 10) || 0;
  const sea = parseFloat(bp?.seaFreightPrice) || 0;
  const d59 = parseFloat(bp?.discount5to9) || 0;
  const d10 = parseFloat(bp?.discount10plus) || 0;
  const off = qty >= 10 ? d10 : qty >= 5 ? d59 : 0;
  return Math.max(0, sea - off);
};

/** Barrel line under v2 — same return shape as calculateBarrelPricing so callers can swap in. */
export const calculateBarrelPricingV2 = ({ quantity = 0, barrelPrices: bp, storedBarrelDiscount = null }) => {
  const qty = parseInt(quantity, 10) || 0;
  const perBarrel = parseFloat(bp?.seaFreightPrice) || 0;
  const discountedPerBarrel = v2PerBarrelPrice(bp, qty);
  const listTotal = qty * perBarrel;
  let barrelPrice = qty * discountedPerBarrel;

  const parsedStoredDiscount = parseFloat(storedBarrelDiscount);
  if (!Number.isNaN(parsedStoredDiscount) && parsedStoredDiscount > 0 && listTotal > 0) {
    barrelPrice = Math.max(0, listTotal - parsedStoredDiscount);
  }

  return {
    barrelPrice,
    barrelDiscount: Math.max(0, listTotal - barrelPrice),
    discountApplies: discountedPerBarrel < perBarrel,
    discountPercent: 0,
    discountAfter: 0,
    listTotal,
    discountedPerBarrel,
    perBarrel,
    quantity: qty,
  };
};

/** Pickup under v2: flat charge + $/mile beyond the free radius. Drop-off orders pay no pickup. */
export const v2PickupCharge = (bp, pickupMiles) => {
  const flat = parseFloat(bp?.pickupCharge) || 0;
  const radius = parseFloat(bp?.pickupRadius) || 0;
  const perMile = parseFloat(bp?.extraMileageCost) || 0;
  const miles = Math.max(0, parseFloat(pickupMiles) || 0);
  const extra = Math.max(0, miles - radius) * perMile;
  return { flat, radius, perMile, extraMiles: Math.max(0, miles - radius), extra, total: flat + extra };
};

/**
 * Combined Customs & Delivery fee for the consignee's parish.
 * Each parish entry is { first, additional }: the 1st barrel pays `first`,
 * every extra barrel adds `additional`.
 *   fee = first + (qty - 1) * additional
 * Legacy scalar entries (auto-migrated rows) are a flat per-order fee:
 * treated as { first: value, additional: 0 }.
 */
export const v2ParishEntry = (bp, parish) => {
  if (!bp || !parish) return null;
  let fees = bp.parishFees;
  if (typeof fees === "string") {
    try { fees = JSON.parse(fees); } catch { fees = null; }
  }
  const raw = fees && typeof fees === "object" ? fees[parish] : undefined;
  if (raw === undefined || raw === null || raw === "") return null;
  if (typeof raw === "object") {
    return {
      first: parseFloat(raw.first) || 0,
      additional: parseFloat(raw.additional) || 0,
    };
  }
  return { first: parseFloat(raw) || 0, additional: 0 };
};

export const v2ParishFee = (bp, parish, quantity = 1) => {
  const entry = v2ParishEntry(bp, parish);
  if (!entry) return 0;
  const qty = Math.max(1, parseInt(quantity, 10) || 1);
  return entry.first + (qty - 1) * entry.additional;
};

/** Commission & service fee are always % of discounted barrel price (barrel line total) */
export const calculateBarrelBasedFees = (barrelPrice, commissionPercent, serviceFeePercent) => {
  const barrel = parseFloat(barrelPrice) || 0;
  const commPct = parseFloat(commissionPercent) || 0;
  const feePct = parseFloat(serviceFeePercent) || 0;
  return {
    commissionAmount: barrel * (commPct / 100),
    serviceFeeAmount: barrel * (feePct / 100),
  };
};
