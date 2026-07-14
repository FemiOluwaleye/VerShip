import DOMPurify from "dompurify";

// Sanitize CMS-authored HTML before injecting it via dangerouslySetInnerHTML.
// Strips scripts/event handlers/javascript: URLs while preserving the formatting
// the CMS editor produces (styled spans, links, lists, images).
export const sanitizeHtml = (html) =>
  DOMPurify.sanitize(html || "", { ADD_ATTR: ["target"] });

export default sanitizeHtml;
