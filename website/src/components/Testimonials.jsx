import React from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation } from "swiper/modules";
import { FaStar } from "react-icons/fa";
import { BsQuote } from "react-icons/bs";
import { ArrowLeft, ArrowRight } from "lucide-react";


import "swiper/css";
import "swiper/css/navigation";
import { comma } from "../common/common-assets/assets-images";

const testimonials = [
  {
    name: "Kathleen Smith",
    company: "Fuel Company",
    image: "https://randomuser.me/api/portraits/women/44.jpg",
    bg: "bg-white",
    text: "text-[#6B7280]",
    stars: "text-[#FFC107]",
  },
  {
    name: "John Martin",
    company: "Restoration Company",
    image: "https://randomuser.me/api/portraits/men/32.jpg",
    bg: "bg-[#4F6F5F]",
    text: "text-white/80",
    stars: "text-white",
  },
  {
    name: "Kathleen Smith",
    company: "Fuel Company",
    image: "https://randomuser.me/api/portraits/women/44.jpg",
    bg: "bg-white",
    text: "text-[#6B7280]",
    stars: "text-[#FFC107]",
  },
  {
    name: "John Martin",
    company: "Restoration Company",
    image: "https://randomuser.me/api/portraits/men/32.jpg",
    bg: "bg-[#4F6F5F]",
    text: "text-white/80",
    stars: "text-white",
  },
  {
    name: "Kathleen Smith",
    company: "Fuel Company",
    image: "https://randomuser.me/api/portraits/women/44.jpg",
    bg: "bg-white",
    text: "text-[#6B7280]",
    stars: "text-[#FFC107]",
  },
  {
    name: "John Martin",
    company: "Restoration Company",
    image: "https://randomuser.me/api/portraits/men/32.jpg",
    bg: "bg-[#4F6F5F]",
    text: "text-white/80",
    stars: "text-white",
  },
  {
    name: "Kathleen Smith",
    company: "Fuel Company",
    image: "https://randomuser.me/api/portraits/women/44.jpg",
    bg: "bg-white",
    text: "text-[#6B7280]",
    stars: "text-[#FFC107]",
  },
  {
    name: "John Martin",
    company: "Restoration Company",
    image: "https://randomuser.me/api/portraits/men/32.jpg",
    bg: "bg-[#4F6F5F]",
    text: "text-white/80",
    stars: "text-white",
  },


];

const groupedTestimonials = [];
for (let i = 0; i < testimonials.length; i += 2) {
  groupedTestimonials.push(testimonials.slice(i, i + 2));
}


const Testimonials = () => {
  return (
    <section className="bg-[#0D1412] py-20 text-white">
      <div className="container mx-auto px-4">

        {/* Header */}
        <div className="flex items-center justify-between mb-12">
          <div>
            <span className="bg-white border-3 border-l-yellow-300 border-transparent text-black px-3 py-1 text-sm font-medium rounded">
              Testimonial
            </span>
            <h2 className="text-[23px] sm:text-[30px] md:text-[35px] font-semibold text-white mt-4">
              What Our Customer Say
            </h2>
          </div>

          {/* Navigation */}
          <div className="flex gap-3">
            <div className="swiper-button-prev-custom w-10 h-10 rounded-full bg-yellow-400 flex items-center justify-center cursor-pointer">
              <ArrowLeft size={18} className="text-black" />
            </div>
            <div className="swiper-button-next-custom w-10 h-10 rounded-full bg-white flex items-center justify-center cursor-pointer">
              <ArrowRight size={18} className="text-black" />
            </div>
          </div>
        </div>

        {/* Slider */}
        <Swiper
          modules={[Navigation]}
          navigation={{
            nextEl: ".swiper-button-next-custom",
            prevEl: ".swiper-button-prev-custom",
          }}
          slidesPerView={1}
          spaceBetween={30}
          className="overflow-hidden rounded-xl"
        >
          {groupedTestimonials.map((group, slideIndex) => (
            <SwiperSlide key={slideIndex}>
              <div className="grid md:grid-cols-2 gap-2">
                {group.map((item, index) => (
                  <div
                    key={index}
                    className={`bg-[#1B2625] border border-white/5 px-6 pb-10 py-14 sm:p-10 relative rounded-xl`}
                  >
                    {/* Quote Icon */}
                    <div className="absolute top-3 right-3 sm:top-6 sm:right-6 w-[50px] h-[50px] sm:w-[55px] sm:h-[55px] lg:w-[72px] lg:h-[72px] flex items-center justify-center">
                      <img src={comma} alt="" />
                    </div>

                    {/* Profile */}
                    <div className="flex items-center gap-4 mb-6">
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-14 h-14 rounded-full object-cover"
                      />
                      <div>
                        <h4 className={`font-semibold text-[18px] sm:text-[20px] text-white`}>
                          {item.name}
                        </h4>
                        <p className={`text-[16px] font-medium text-white/50`}>
                          {item.company}
                        </p>
                      </div>
                    </div>

                    {/* Text */}
                    <p className={`text-white/70 leading-relaxed mb-8`}>
                      <i>
                        Leverage agile frameworks to provide a robust synopsis for strategy foster collaborative thinking to further the overall value proposition. Organically grow the holistic world view of disruptive innovation via workplace diversity and empowerment.
                      </i>

                    </p>

                    {/* Stars */}
                    <div className="flex gap-1">
                      {[...Array(5)].map((_, i) => (
                        <FaStar key={i} className="text-[#FFC107]" style={{ fontSize: '24px' }} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </SwiperSlide>
          ))}
        </Swiper>

      </div>
    </section>
  );
};

export default Testimonials;
