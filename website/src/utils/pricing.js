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
