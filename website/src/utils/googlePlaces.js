import { useEffect, useState } from "react";

/**
 * Loads the Google Maps Places script once and reports when it is usable.
 * Extracted from QuotesShipown so the checkout page can share it.
 */
export const useGooglePlaces = () => {
  const [apiLoaded, setApiLoaded] = useState(
    () => !!(window.google && window.google.maps && window.google.maps.places)
  );
  useEffect(() => {
    if (apiLoaded) return undefined;
    const check = () => {
      if (window.google && window.google.maps && window.google.maps.places) {
        setApiLoaded(true);
        return true;
      }
      return false;
    };
    if (check()) return undefined;
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    let script = document.getElementById("google-maps-script");
    if (!script && apiKey) {
      script = document.createElement("script");
      script.id = "google-maps-script";
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    const timer = setInterval(() => { if (check()) clearInterval(timer); }, 300);
    return () => clearInterval(timer);
  }, [apiLoaded]);
  return apiLoaded;
};

/** Flatten a Places result into the address fields the forms use. */
export const extractAddressComponents = (place) => {
  const c = {};
  if (!place || !place.address_components) return c;
  place.address_components.forEach((component) => {
    const t = component.types;
    if (t.includes("street_number")) c.streetNumber = component.long_name;
    if (t.includes("route")) c.route = component.long_name;
    if (t.includes("locality")) c.city = component.long_name;
    if (t.includes("administrative_area_level_1")) c.state = component.short_name;
    if (t.includes("administrative_area_level_2")) c.county = component.long_name;
    if (t.includes("postal_code")) c.postalCode = component.long_name;
    if (t.includes("country")) c.country = component.long_name;
    if (t.includes("sublocality") || t.includes("neighborhood")) c.sublocality = c.sublocality || component.long_name;
  });
  c.street = [c.streetNumber, c.route].filter(Boolean).join(" ");
  if (place.geometry?.location) {
    c.lat = typeof place.geometry.location.lat === "function" ? place.geometry.location.lat() : place.geometry.location.lat;
    c.lng = typeof place.geometry.location.lng === "function" ? place.geometry.location.lng() : place.geometry.location.lng;
  }
  return c;
};
