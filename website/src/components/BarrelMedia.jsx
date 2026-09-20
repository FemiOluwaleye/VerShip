import React from 'react';
import prepackedBarrelImg from '../assets/prepacked-barrel.png';

// A barrel's media can be a still image or a video/animation (e.g. an uploaded
// .mp4). Detect by extension so we can render the right element.
export const isVideoUrl = (url) => /\.(mp4|webm|ogg|mov)(\?|#|$)/i.test(url || '');

// Renders a barrel's media: a looping muted video for animations, an <img> for
// stills, and the bundled placeholder when there's nothing (or the media fails
// to load). `mediaClass` styles the loaded media; `placeholderClass` the
// centered-placeholder wrapper.
//
// Shared by the pre-packed barrel page and the landing hero so both always show
// the same media for the product — change it in the admin form / seed once.
const BarrelMedia = ({ src, alt, mediaClass, placeholderClass }) => {
    if (src && isVideoUrl(src)) {
        // An animation must always play and show in full wherever it renders
        // (detail view AND the multi-barrel card grid). Force object-contain on a
        // white backdrop so it's never cropped, and autoplay/loop so it's never a
        // frozen frame. `!` overrides any object-cover passed by the caller.
        return (
            <video
                src={src}
                className={`${mediaClass} !object-contain bg-white`}
                autoPlay
                loop
                muted
                playsInline
                preload="auto"
                aria-label={alt}
            />
        );
    }
    if (src) {
        return (
            <img
                src={src}
                alt={alt}
                className={mediaClass}
                onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = prepackedBarrelImg; }}
            />
        );
    }
    return (
        <div className={placeholderClass}>
            <img src={prepackedBarrelImg} alt={alt} className="h-full w-auto object-contain" />
        </div>
    );
};

export default BarrelMedia;
