import React from "react";
import { useNavigate } from "react-router-dom";
import { logoFooter ,Group  , instagram12 } from "../common/common-assets/assets-images.jsx";
import { Mail, Phone, Facebook, Instagram, } from "lucide-react";
import MoveBusinessForward from "./MoveBusinessForward";

const Footer = () => {
  const navigate = useNavigate();
  const scrollToSection = (id) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    } else {
      navigate("/", { state: { scrollTo: id } });
    }
  };

  return (
    <>
      {/* Global CTA Section matching Footer background */}
      <MoveBusinessForward variant="footer" />

      <footer className="bg-[#040b0c] text-white overflow-hidden pt-8 md:pt-12">
        <div className="container mx-auto px-4 md:px-6 relative z-10 max-w-[1326px]">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-8 lg:gap-12 mb-16 md:mb-24">
            
            {/* Left Column - Description & Social */}
            <div className="md:col-span-6 lg:col-span-5 flex flex-col gap-6 md:gap-8 mx-6">
              <p className="text-[12px] md:text-[14px] font-medium text-white/50 leading-relaxed max-w-[400px]">
               VerShip is changing the way people ship freight from the USA to Jamaica. 
                <br className="hidden md:block" /><br className="hidden md:block" />
                Compare rates from trusted shipping companies, book online in minutes, and enjoy a faster, more transparent shipping experience.
              </p>
              
              {/* Social Icons */}
              <div className="flex gap-4">
                <a href="#" aria-label="VerShip on Facebook" className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-[#1A1F1D] flex items-center justify-center hover:bg-[#C1A35E] hover:text-[#0A0D0C] transition-all text-white/50">
                  <img src={Group} alt="" width={18} />
                </a>
                <a href="#" aria-label="VerShip on Instagram" className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-[#1A1F1D] flex items-center justify-center hover:bg-[#C1A35E] hover:text-[#0A0D0C] transition-all text-white/50">
                  <img src={instagram12} alt="" width={18} />
                </a>
                {/* <a href="#" className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-[#1A1F1D] flex items-center justify-center hover:bg-[#C1A35E] hover:text-[#0A0D0C] transition-all text-white/50">
                  <img src={twitters} alt="Twitter" width={18} />
                </a> */}
              </div>
            </div>

            {/* Middle Column - MAIN */}
            <div className="md:col-span-2 lg:col-span-2 mx-8">
              <h4 className="text-[10px] md:text-[11px] font-bold text-white/30 uppercase tracking-[2px] mb-6 md:mb-8">Main</h4>
              <ul className="flex flex-col gap-3 md:gap-4">
                <li className="cursor-pointer text-[12px] md:text-[13px] font-medium text-white/60 hover:text-[#C1A35E] transition-colors" onClick={() => navigate("/about")}>About us</li>
                <li className="cursor-pointer text-[12px] md:text-[13px] font-medium text-white/60 hover:text-[#C1A35E] transition-colors" onClick={() => scrollToSection("how-it-works")}>How it works</li>
                <li className="cursor-pointer text-[12px] md:text-[13px] font-medium text-white/60 hover:text-[#C1A35E] transition-colors" onClick={() => navigate("/contact")}>Contact us</li>
                <li className="cursor-pointer text-[12px] md:text-[13px] font-medium text-white/60 hover:text-[#C1A35E] transition-colors" onClick={() => navigate("/login")}>Login</li>
              </ul>
            </div>

            {/* Support Column */}
            <div className="md:col-span-2 lg:col-span-2 mx-8">
              <h4 className="text-[10px] md:text-[11px] font-bold text-white/30 uppercase tracking-[2px] mb-6 md:mb-8">Support</h4>
              <ul className="flex flex-col gap-3 md:gap-4">
                <li className="cursor-pointer text-[12px] md:text-[13px] font-medium text-white/60 hover:text-[#C1A35E] transition-colors" onClick={() => navigate("/faqs")}>FAQs</li>
                <li className="cursor-pointer text-[12px] md:text-[13px] font-medium text-white/60 hover:text-[#C1A35E] transition-colors" onClick={() => navigate("/cookie-policy")}>Cookies policy</li>
                <li className="cursor-pointer text-[12px] md:text-[13px] font-medium text-white/60 hover:text-[#C1A35E] transition-colors" onClick={() => navigate("/refund-policy")}>Refund policy</li>
              </ul>
            </div>

            {/* Contact Column */}
            <div className="md:col-span-2 lg:col-span-3">
              <h4 className="text-[10px] md:text-[11px] font-bold text-white/30 uppercase tracking-[2px] mb-6 md:mb-8">Contact</h4>
              <ul className="flex flex-col gap-4 md:gap-5">
                <li className="flex items-center gap-3">
                  <div className="text-[#C1A35E] opacity-70"><Mail size={16} /></div>
                  <a href="mailto:info@vershipgo.com" className="text-[12px] md:text-[13px] font-medium text-white/60 hover:text-white transition-colors">info@vershipgo.com</a>
                </li>
                <li className="flex items-center gap-3">
                  <div className="text-[#C1A35E] opacity-70"><Phone size={16} /></div>
                  <a href="tel:814-232-4537" className="text-[12px] md:text-[13px] font-medium text-white/60 hover:text-white transition-colors">814-232-4537</a>
                </li>
              </ul>
            </div>

          </div>

          {/* Bottom Bar */}
          <div className="flex flex-col md:flex-row items-center justify-between pt-8 mt-8 text-[10px] md:text-[12px] font-medium text-white/40 border-t border-white/5 gap-4 md:gap-0">
            <p>Copyright © {new Date().getFullYear()} VerShip. All rights reserved.</p>
            <div className="flex gap-4 md:gap-6">
              <span onClick={() => navigate("/terms")} className="cursor-pointer hover:text-white transition-colors">Terms & conditions</span>
              <span className="hidden md:block w-1 h-1 rounded-full bg-white/20 my-auto"></span>
              <span onClick={() => navigate("/privacy")} className="cursor-pointer hover:text-white transition-colors">Privacy policy</span>
            </div>
          </div>

        </div>

        {/* Massive Bottom Logo */}
        <div className="w-full flex justify-center mt-6 md:mt-8 opacity-80 pointer-events-none select-none px-4">
          <img
            src={logoFooter}
            alt=""
            aria-hidden="true"
            className="w-full max-w-[320px] md:max-w-[1200px] h-auto object-contain object-bottom"
          />
        </div>
      </footer>
    </>
  );
};

export default Footer;
