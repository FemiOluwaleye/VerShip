// Resolving the URL of a user-uploaded file (profile images, verification
// documents, banners, product photos).
//
// Uploads are stored with a leading slash — helper.fileUpload returns
// `/images/<uuid>.<ext>` — and served from the /images mount (see
// server/shipone.js). Joining that onto a base with a naive `${base}/${path}`
// produces `//images/x.png`, which breaks in two different ways:
//
//   * website (API_URL === '' for same-origin): `//images/x.png` is a
//     protocol-relative URL, so the browser treats `images` as a hostname and
//     the request dies with ERR_NAME_NOT_RESOLVED.
//   * admin (BASE_URL === '/admin'): `/admin//images/x.png` has an empty path
//     segment, which the express static mount at /admin/images never matches.
//
// Older rows store the same path *without* the leading slash, so both shapes
// have to keep working. Route every uploaded path through this helper rather
// than interpolating it directly.
//
// Note: absolute URLs are returned untouched, which also covers the blob:/data:
// object URLs the edit forms use for a local preview before upload.
export const resolveFileUrl = (filePath, base = '') => {
  if (!filePath) return null;
  const raw = String(filePath).trim();
  if (!raw) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return raw;
  return `${String(base).replace(/\/+$/, '')}/${raw.replace(/^\/+/, '')}`;
};

// Same thing, with a cache-busting query so a freshly uploaded replacement image
// is not served from the browser cache under its old URL.
export const resolveFileUrlFresh = (filePath, base = '') => {
  const url = resolveFileUrl(filePath, base);
  if (!url || /^(blob|data):/i.test(url)) return url;
  return `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`;
};
