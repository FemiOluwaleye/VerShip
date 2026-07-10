import { useEffect } from "react";

// The admin dashboard is a Bootstrap 5 + jQuery theme. Its CSS (a global reset)
// and vendor scripts must load ONLY while the admin is mounted so they never
// leak onto the Tailwind public site. This component injects them on mount and
// removes them on unmount. jQuery itself is already global (see ./jquery-setup),
// imported before this runs, so the plugin scripts below find window.jQuery.

const VENDOR_CSS = [
  "/vendor/libs/bootstrap/css/bootstrap.min.css",
  "/vendor/libs/select2/select2.min.css",
  "/vendor/libs/metismenu/metisMenu.min.css",
  "/vendor/libs/simplebar/simplebar.min.css",
  "/vendor/css/icons.css",
  "/vendor/css/app.css",
  "/vendor/css/admin-custom.css",
];

// Order matters: Bootstrap (vanilla) first, then the jQuery plugins, then the
// theme's app.js which wires the sidebar/metisMenu against the rendered DOM.
const VENDOR_JS = [
  "/vendor/libs/bootstrap/js/bootstrap.bundle.min.js",
  "/vendor/libs/metismenu/metisMenu.min.js",
  "/vendor/libs/simplebar/simplebar.min.js",
  "/vendor/libs/select2/select2.min.js",
  "/vendor/js/app.js",
];

export default function AdminAssetsLoader({ children }) {
  useEffect(() => {
    const injected = [];
    document.body.classList.add("sidebar-enable");

    for (const href of VENDOR_CSS) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      link.dataset.adminAsset = "true";
      document.head.appendChild(link);
      injected.push(link);
    }

    let cancelled = false;
    (async () => {
      for (const src of VENDOR_JS) {
        if (cancelled) return;
        await new Promise((resolve) => {
          const s = document.createElement("script");
          s.src = src;
          s.dataset.adminAsset = "true";
          s.onload = resolve;
          s.onerror = () => {
            console.warn("[admin] vendor asset failed to load:", src);
            resolve();
          };
          document.body.appendChild(s);
          injected.push(s);
        });
      }
    })();

    return () => {
      cancelled = true;
      injected.forEach((el) => el.remove());
      document.body.classList.remove("sidebar-enable");
    };
  }, []);

  return <div className="admin-root">{children}</div>;
}
