import React from 'react'
import { banner } from "../common/common-assets/assets-images";

const Commonbanner = ({ title }) => {
  return (
    <section
      className="relative w-full h-[220px] md:h-[280px] flex items-center justify-center"
      style={{
        backgroundImage: `url(${banner})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Content */}
      <h1 className="relative z-10 text-white text-[35px] md:text-[40px] lg:text-[45px] text-center font-semibold">
        {title}
      </h1>
    </section>
  )
}

export default Commonbanner
