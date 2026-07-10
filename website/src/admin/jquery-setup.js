// Expose jQuery on window BEFORE any jQuery plugin evaluates. The admin's
// components side-effect-import @fancyapps/fancybox (a jQuery plugin that reads
// window.jQuery at module-eval time), and the injected vendor scripts
// (metisMenu, simplebar, select2) also attach to the global jQuery. Importing
// this module first in AdminApp guarantees the global exists before them.
import $ from "jquery";

window.$ = window.jQuery = $;

export default $;
