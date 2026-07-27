import React, { useState, useRef, useLayoutEffect } from "react";

// Small "(i)" affordance that reveals a short explanation. Used on the forwarder
// signup and profile-edit forms, where the option labels alone ("Ship Your Own
// Barrel" vs "Request Barrel Drop-Off") don't tell a new forwarder which one
// describes the service they actually run.
const InfoTip = ({ label, text }) => {
  // Two independent reasons the tip can be showing. Collapsing them into one
  // "open" flag breaks on a real click: the pointer arrives first (hover opens
  // it) and the click then toggles it straight back shut.
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const open = hovered || pinned;

  // The tip hangs to the left of its "i", which on a narrow screen pushes it off
  // the edge when the option sits in the left column. Measure once on open and
  // nudge it back into view. Shift resets to 0 on close, so the measurement is
  // always taken from the unshifted position and can't drift.
  const tipRef = useRef(null);
  const [shift, setShift] = useState(0);
  useLayoutEffect(() => {
    if (!open || !tipRef.current) {
      setShift(0);
      return;
    }
    const gap = 8;
    const rect = tipRef.current.getBoundingClientRect();
    if (rect.left < gap) setShift(gap - rect.left);
    else if (rect.right > window.innerWidth - gap) setShift(window.innerWidth - gap - rect.right);
  }, [open]);

  return (
    <span
      className="relative ml-auto flex items-center"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        type="button"
        aria-label={`About ${label}`}
        aria-expanded={open}
        // Click/Enter/Space pins it open, so touch and keyboard users (who never
        // hover) can read it and dismiss it again. preventDefault keeps a tip
        // that sits next to a checkbox from toggling that checkbox.
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setPinned((v) => !v); }}
        onKeyDown={(e) => { if (e.key === 'Escape') setPinned(false); }}
        className="w-5 h-5 rounded-full border border-white/40 text-white/70 text-[11px] font-bold leading-none flex items-center justify-center hover:border-yellow-400 hover:text-yellow-400 focus:outline-none focus:border-yellow-400 focus:text-yellow-400 transition-colors"
      >
        i
      </button>
      {open && (
        <span
          ref={tipRef}
          role="tooltip"
          onClick={(e) => e.stopPropagation()}
          style={shift ? { transform: `translateX(${shift}px)` } : undefined}
          className="absolute z-50 right-0 top-7 w-64 max-w-[calc(100vw-1rem)] p-3 rounded-lg bg-[#0a1b1d] border border-yellow-400/40 text-white/80 text-xs leading-relaxed shadow-2xl normal-case"
        >
          {text}
        </span>
      )}
    </span>
  );
};

export default InfoTip;
