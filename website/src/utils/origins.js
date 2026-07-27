// The cities we advertise as ship-from points. This list is the whole universe
// of origins: a forwarder registering can only price a lane out of one of these,
// and the home page offers exactly these.
//
// Coverage is what varies, and it is read from the data, not from a second list.
// A city here that no forwarder has priced shows a "Coming soon" badge and is
// unselectable; the moment someone onboards in that city it becomes bookable on
// the next page load. Adding a city to this array is the only code change needed
// to start advertising a new lane.
export const ADVERTISED_ORIGINS = [
  "Fort Lauderdale, FL",
  "Miami, FL",
  "Pittsburgh, PA",
  "Orlando, FL",
];

// Forwarders' saved pricing rows carry their own city strings, so the same place
// can arrive as both "Orlando, FL" and "Orlando, Fl". Normalise the trailing
// state code to upper case (and collapse whitespace) so one city can't appear
// twice, and so a served city always matches its advertised counterpart.
export const normalizeCity = (value) => {
  const text = String(value || "").trim().replace(/\s+/g, " ");
  if (!text) return "";
  const comma = text.lastIndexOf(",");
  if (comma === -1) return text;
  return `${text.slice(0, comma).trim()}, ${text.slice(comma + 1).trim().toUpperCase()}`;
};
