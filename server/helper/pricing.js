/*
 * Server-side pricing — the source of truth for what a customer is charged.
 *
 * This is a CommonJS port of website/src/utils/pricing.js (the client keeps its
 * copy for display only; server/tests/pricing.test.mjs asserts the two agree on
 * fixtures). Before this module existed the browser computed the total and
 * POSTed it to createPaymentIntent, which charged whatever it was sent.
 *
 * computeQuote() also decides the "Pay as Your Shipment Moves" split:
 *   dueNow = barrels (sea freight after tier discount) + pickup + drop-off add-on
 *            + admin commission + service fee
 *   later  = customs & delivery for the consignee's parish (v2), or the legacy
 *            tiered customs + flat delivery charges
 * Everything the forwarder does before the ship sails is paid up front; what
 * happens after arrival in Jamaica is billed when the forwarder marks the
 * shipment "Arrived".
 */

const PORT_COORDINATES = { lat: 17.966, lng: -76.829 }; // Kingston port (same pin as the client)

const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};
const round2 = (n) => Math.round((num(n) + Number.EPSILON) * 100) / 100;

/** A barrelsprices row uses the v2 model when seaFreightPrice is set. */
const isPricingV2 = (bp) =>
  !!bp && String(bp.seaFreightPrice ?? '').trim() !== '' && parseFloat(bp.seaFreightPrice) > 0;

/** Same card selection rules as the client: route match first, prefer v2 at each level. */
const selectRateCard = (barrelPrices, { type, origin, destination } = {}) => {
  if (!Array.isArray(barrelPrices)) return null;
  const norm = (s) => String(s || '').toLowerCase().trim();
  const t = norm(type);
  const o = norm(origin);
  const d = norm(destination);
  const byType = barrelPrices.filter((bp) => norm(bp.type) === t);
  const routeMatch = (bp) => norm(bp.originCountry) === o && norm(bp.destinationCountry) === d;
  return (
    byType.find((bp) => routeMatch(bp) && isPricingV2(bp)) ||
    byType.find(routeMatch) ||
    byType.find(isPricingV2) ||
    byType[0] ||
    null
  );
};

/** Legacy 25-slot CSV lookup: the Nth slot is the fee for N barrels. Forwarders
 *  may price only the first N barrels; larger orders walk back to the last
 *  entered slot. Non-25-slot values are a single flat fee. */
const getValueForQuantity = (rawVal, qty) => {
  if (!rawVal) return 0;
  const parts = String(rawVal).split(',');
  if (parts.length === 25) {
    const index = Math.min(Math.max(1, parseInt(qty, 10) || 1), 25) - 1;
    for (let i = index; i >= 0; i--) {
      const v = String(parts[i] ?? '').trim();
      if (v !== '') return num(v);
    }
    return 0;
  }
  return num(parts[0]);
};

const v2PerBarrelPrice = (bp, quantity) => {
  const qty = parseInt(quantity, 10) || 0;
  const sea = num(bp?.seaFreightPrice);
  const d59 = num(bp?.discount5to9);
  const d10 = num(bp?.discount10plus);
  const off = qty >= 10 ? d10 : qty >= 5 ? d59 : 0;
  return Math.max(0, sea - off);
};

const calculateBarrelPricingV2 = ({ quantity = 0, barrelPrices: bp }) => {
  const qty = parseInt(quantity, 10) || 0;
  const perBarrel = num(bp?.seaFreightPrice);
  const discountedPerBarrel = v2PerBarrelPrice(bp, qty);
  const listTotal = qty * perBarrel;
  const barrelPrice = qty * discountedPerBarrel;
  return {
    barrelPrice,
    barrelDiscount: Math.max(0, listTotal - barrelPrice),
    discountApplies: discountedPerBarrel < perBarrel,
    listTotal,
    discountedPerBarrel,
    perBarrel,
    quantity: qty,
  };
};

const calculateBarrelPricing = ({ quantity = 0, perBarrelPrice = 0, isVolumeDiscount = false, discountAfter = 0, discountPercent = 0 }) => {
  const qty = parseInt(quantity, 10) || 0;
  const perBarrel = num(perBarrelPrice);
  const after = parseInt(discountAfter, 10) || 0;
  const pct = parseInt(discountPercent, 10) || 0;
  const volumeOn = isVolumeDiscount == 1 || isVolumeDiscount === true;
  const discountApplies = volumeOn && after > 0 && pct > 0 && qty > after;
  const listTotal = qty * perBarrel;
  const discountedPerBarrel = perBarrel * (1 - pct / 100);
  const barrelPrice = discountApplies ? qty * discountedPerBarrel : listTotal;
  return {
    barrelPrice,
    barrelDiscount: Math.max(0, listTotal - barrelPrice),
    discountApplies,
    listTotal,
    discountedPerBarrel,
    perBarrel,
    quantity: qty,
  };
};

/** Pickup under v2: flat charge + $/mile beyond the free radius. */
const v2PickupCharge = (bp, pickupMiles) => {
  const flat = num(bp?.pickupCharge);
  const radius = num(bp?.pickupRadius);
  const perMile = num(bp?.extraMileageCost);
  const miles = Math.max(0, num(pickupMiles));
  const extraMiles = Math.max(0, miles - radius);
  const extra = extraMiles * perMile;
  return { flat, radius, perMile, extraMiles, extra, total: flat + extra };
};

const parseParishFees = (fees) => {
  if (typeof fees === 'string') {
    try { return JSON.parse(fees); } catch { return null; }
  }
  return fees && typeof fees === 'object' ? fees : null;
};

const v2ParishEntry = (bp, parish) => {
  if (!bp || !parish) return null;
  const fees = parseParishFees(bp.parishFees);
  const raw = fees ? fees[parish] : undefined;
  if (raw === undefined || raw === null || raw === '') return null;
  if (typeof raw === 'object') return { first: num(raw.first), additional: num(raw.additional) };
  return { first: num(raw), additional: 0 };
};

const v2ParishFee = (bp, parish, quantity = 1) => {
  const entry = v2ParishEntry(bp, parish);
  if (!entry) return 0;
  const qty = Math.max(1, parseInt(quantity, 10) || 1);
  return entry.first + (qty - 1) * entry.additional;
};

/** Commission & service fee are % of the discounted barrel line. */
const calculateBarrelBasedFees = (barrelPrice, commissionPercent, serviceFeePercent) => {
  const barrel = num(barrelPrice);
  return {
    commissionAmount: barrel * (num(commissionPercent) / 100),
    serviceFeeAmount: barrel * (num(serviceFeePercent) / 100),
  };
};

/** Straight-line miles. The client prefers Google road miles when available; the
 *  server charges on Haversine so the number is deterministic and reproducible. */
const haversineMiles = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  const R = 3958.8;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/**
 * Full quote for one provider.
 *
 * @param {object} p
 * @param {object[]} p.barrelPrices   provider's rate cards
 * @param {'own'|'dropoff'} p.type     shipment type
 * @param {string} p.origin            request origin (e.g. "Pittsburgh, PA")
 * @param {string} p.destination       request destination ("Kingston, Jamaica")
 * @param {number} p.quantity
 * @param {string} p.parish            consignee parish (v2 customs & delivery)
 * @param {number} p.pickupMiles       provider → shipper miles (own only)
 * @param {number} p.deliveryMiles     port → consignee miles (legacy only)
 * @param {boolean} p.dropoffAddon     "deliver empty barrels first" add-on
 * @param {number} p.adminCommissionPct
 * @param {number} p.serviceFeePct
 */
const computeQuote = (p) => {
  const type = p.type === 'dropoff' ? 'dropoff' : 'own';
  const quantity = Math.max(1, parseInt(p.quantity, 10) || 1);
  const card = selectRateCard(p.barrelPrices, { type, origin: p.origin, destination: p.destination });
  if (!card) return null;
  const v2 = isPricingV2(card);
  const isRequestBarrel = type === 'dropoff';

  // Barrel line
  const barrels = v2
    ? calculateBarrelPricingV2({ quantity, barrelPrices: card })
    : calculateBarrelPricing({
        quantity,
        perBarrelPrice: card.barrelPrice,
        isVolumeDiscount: card.isVolumeDiscount,
        discountAfter: card.discountAfter,
        discountPercent: card.discountPercent,
      });

  // Pickup (own-barrel only)
  let pickup = 0;
  let pickupDetail = null;
  if (!isRequestBarrel) {
    if (v2) {
      pickupDetail = v2PickupCharge(card, p.pickupMiles);
      pickup = pickupDetail.total;
    } else {
      const flat = getValueForQuantity(card.flatPickupCharge, quantity);
      const freeMiles = num(card.pickupFreeMiles);
      const perMile = num(card.pickupPerMileCharge);
      const miles = num(p.pickupMiles);
      const extra = miles > freeMiles ? (miles - freeMiles) * perMile : 0;
      pickup = flat + extra;
      pickupDetail = { flat, radius: freeMiles, perMile, extraMiles: Math.max(0, miles - freeMiles), extra, total: pickup };
    }
  }

  // Customs & delivery (the "later" milestone)
  let customsDelivery = 0;
  let deliveryLegacy = 0;
  if (v2) {
    customsDelivery = v2ParishFee(card, p.parish, quantity);
  } else {
    customsDelivery = getValueForQuantity(card.customsAndHandling, quantity);
    if (!isRequestBarrel) {
      const flat = getValueForQuantity(card.flatDeliveryCharge, quantity);
      const freeMiles = num(card.deliveryFreeMiles);
      const perMile = num(card.deliveryPerMileCharge);
      const miles = num(p.deliveryMiles);
      deliveryLegacy = flat + (miles > freeMiles ? (miles - freeMiles) * perMile : 0);
      deliveryLegacy += num(card.pricePerMile); // legacy flat "Delivery ($)" line
    }
  }

  // Drop-off add-on (own shipment that also wants empty barrels delivered first)
  let dropoffAddon = 0;
  if (p.dropoffAddon && !isRequestBarrel) {
    const dropCard = selectRateCard(p.barrelPrices, { type: 'dropoff', origin: p.origin, destination: p.destination });
    if (dropCard) {
      const perDrop = isPricingV2(dropCard) ? v2PerBarrelPrice(dropCard, quantity) : num(dropCard.basePrice || dropCard.barrelPrice);
      dropoffAddon = perDrop * quantity;
    }
  }

  const { commissionAmount, serviceFeeAmount } = calculateBarrelBasedFees(
    barrels.barrelPrice, p.adminCommissionPct, p.serviceFeePct
  );

  const dueNowLines = [
    { key: 'barrels', label: `Sea freight (${quantity} × $${round2(barrels.discountedPerBarrel).toFixed(2)})`, amount: round2(barrels.barrelPrice) },
  ];
  if (pickup > 0) dueNowLines.push({ key: 'pickup', label: 'Pickup', amount: round2(pickup) });
  if (dropoffAddon > 0) dueNowLines.push({ key: 'dropoff_addon', label: 'Barrel drop-off (add-on)', amount: round2(dropoffAddon) });
  // The customer sees one "Service fee" line: platform commission + the
  // service-fee add-on, both % of the barrel line (the old checkout bundled
  // them the same way). Each part is still reported separately below.
  const platformLine = round2(commissionAmount + serviceFeeAmount);
  if (platformLine > 0) dueNowLines.push({ key: 'service_fee', label: 'Service fee', amount: platformLine });

  const laterLines = [];
  if (customsDelivery > 0) {
    laterLines.push({
      key: 'customs_delivery',
      label: v2 ? `Customs & delivery${p.parish ? ` (${p.parish})` : ''}` : 'Customs & handling',
      amount: round2(customsDelivery),
    });
  }
  if (deliveryLegacy > 0) laterLines.push({ key: 'delivery', label: 'Delivery', amount: round2(deliveryLegacy) });

  const sum = (ls) => round2(ls.reduce((a, l) => a + l.amount, 0));
  const dueNow = sum(dueNowLines);
  const later = sum(laterLines);

  return {
    card,
    pricingV2: v2,
    type,
    quantity,
    parish: p.parish || null,
    barrels: {
      perBarrel: round2(barrels.perBarrel),
      discountedPerBarrel: round2(barrels.discountedPerBarrel),
      lineTotal: round2(barrels.barrelPrice),
      discount: round2(barrels.barrelDiscount),
    },
    pickup: pickupDetail,
    commissionPct: num(p.adminCommissionPct),
    serviceFeePct: num(p.serviceFeePct),
    commissionAmount: round2(commissionAmount),
    serviceFeeAmount: round2(serviceFeeAmount),
    customsDelivery: round2(customsDelivery),
    dropoffAddon: round2(dropoffAddon),
    dueNow: { lines: dueNowLines, total: dueNow },
    later: { lines: laterLines, total: later, needsParish: v2 && !p.parish },
    total: round2(dueNow + later),
    currency: 'usd',
  };
};

module.exports = {
  PORT_COORDINATES,
  round2,
  isPricingV2,
  selectRateCard,
  getValueForQuantity,
  v2PerBarrelPrice,
  calculateBarrelPricingV2,
  calculateBarrelPricing,
  v2PickupCharge,
  v2ParishEntry,
  v2ParishFee,
  calculateBarrelBasedFees,
  haversineMiles,
  computeQuote,
};
