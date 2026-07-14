import React from "react";
import { Helmet } from "react-helmet-async";

const SITE_URL = "https://vershipgo.com";
const SITE_NAME = "VerShip";
const DEFAULT_DESC =
  "VerShip lets you compare rates from trusted freight forwarders, book the best option, and ship your barrel from the USA to Jamaica — all door to door on one platform.";

/**
 * Per-page metadata. Renders a unique <title>, description, canonical, and
 * Open Graph/Twitter tags per route so each page is indexed distinctly instead
 * of inheriting the homepage's static tags.
 *
 * Props:
 *  - title: page title (site name is appended automatically)
 *  - description: meta description (falls back to the site default)
 *  - path: route path for the canonical/OG url, e.g. "/about"
 *  - noindex: set true for pages that should not be indexed (e.g. 404)
 */
export default function Seo({ title, description, path = "", noindex = false }) {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} — Compare & Book Barrel Shipping from the USA to Jamaica`;
  const desc = description || DEFAULT_DESC;
  const url = `${SITE_URL}${path}`;

  return (
    <Helmet prioritizeSeoTags>
      <title>{fullTitle}</title>
      <meta name="description" content={desc} />
      <link rel="canonical" href={url} />
      {noindex && <meta name="robots" content="noindex, nofollow" />}

      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={desc} />
      <meta property="og:url" content={url} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={desc} />
    </Helmet>
  );
}
