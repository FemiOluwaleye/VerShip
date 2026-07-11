import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Menu, X, Bell, ChevronDown, ArrowUpRight } from "lucide-react";
import { bell, newLogo as logo } from "../common/common-assets/assets-images";
import Logout from "./Logout";
import { API_URL } from "../api/axios";
import {
  profile,
  profile1,
  edit,
  reset,
  creditCard,
  deleteAccount,
  camera,
} from "../common/common-assets/assets-images";

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const token = localStorage.getItem("token");
  const is_login = localStorage.getItem("is_login");
  const storedRole = localStorage.getItem("role");
  const [user, setUser] = useState(JSON.parse(localStorage.getItem("user") || "{}"));
  const role = token ? (user.role === "1" ? "user" : "business") : storedRole;
  const homePath = role === "business" && token ? "/request" : "/";

  const navigate = useNavigate();
  const location = useLocation();

  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleUserUpdate = () => {
      setUser(JSON.parse(localStorage.getItem("user") || "{}"));
    };
    window.addEventListener('userUpdated', handleUserUpdate);
    return () => window.removeEventListener('userUpdated', handleUserUpdate);
  }, []);

  useEffect(() => {
    setShowDropdown(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const userData = user?.user || user;
  const userName = userData.firstName;
  const timestamp = new Date().getTime();
  const userImage = userData.image
    ? (userData.image.startsWith("http") ? userData.image : `${API_URL}/${userData.image}?t=${timestamp}`)
    : profile1;

  const authHiddenRoutes = ["/signup", "/login", "/otp", "/forgot", "/type", "/verification", "/businessSignup", "/businessverification", "/verified", "/businessCreateAccount", "/businesscontact", "/businessdoument", "/businesspolicies", "/businesstime", "/businessupload"];
  const isSignupOnlyNavbar = authHiddenRoutes.includes(location.pathname);
  const [isLogoutOpen, setIsLogoutOpen] = useState(false);

  return (
    <div className="w-full relative z-50 bg-white">
      <nav aria-label="Main" className="w-full border-b border-[#E5E7EB]">
        <div className=" mx-auto flex items-stretch">

          {/* Mobile View Toggle & Logo */}
          <div className="lg:hidden w-full flex items-center justify-between px-4 py-4">
            <img
              src={logo}
              alt="VerShip home"
              className="h-12 cursor-pointer"
              onClick={() => navigate(homePath)}
            />
            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              aria-label={isOpen ? "Close menu" : "Open menu"}
              aria-expanded={isOpen}
              aria-controls="mobile-menu"
            >
              {isOpen ? <X className="w-8 h-8" /> : <Menu className="w-8 h-8" />}
            </button>
          </div>

          {/* Desktop View */}
          {!isSignupOnlyNavbar && (
            <div className="hidden lg:grid grid-cols-3 w-full items-stretch divide-x divide-[#E5E7EB]">
              {/* Left Column: Navigation Links */}
              <div className="flex items-stretch divide-x divide-[#E5E7EB]">
                <div
                  onClick={() => navigate("/about")}
                  className="flex-1 flex items-center justify-center py-4.5 bg-[#F8FAFA] hover:bg-gray-50 transition-colors cursor-pointer text-[#1A1A1A] font-medium text-lg"
                >
                  About
                </div>
                <div
                  onClick={() => {
                    if (location.pathname === "/") {
                      document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" });
                    } else {
                      navigate("/", { state: { scrollTo: "how-it-works" } });
                    }
                  }}
                  className="flex-1 flex items-center justify-center py-4.5 bg-[#F8FAFA] hover:bg-gray-50 transition-colors cursor-pointer text-[#1A1A1A] font-medium text-lg"
                >
                  How it works
                </div>
                <div
                  onClick={() => navigate("/contact")}
                  className="flex-1 flex items-center justify-center py-4.5 bg-[#F8FAFA] hover:bg-gray-50 transition-colors cursor-pointer text-[#1A1A1A] font-medium text-lg"
                >
                  Contact
                </div>
              </div>

              {/* Center Column: Logo */}
              <div className="flex items-center justify-center py-2 px-12 bg-[#F8FAFA]">
                <img
                  src={logo}
                  alt="VerShip home"
                  className="h-[44px] cursor-pointer"
                  onClick={() => navigate(homePath)}
                />
              </div>

              {/* Right Column: Auth/Profile */}
              <div className="flex items-stretch divide-x divide-[#E5E7EB]">
                {!is_login ? (
                  <>
                    <div
                      onClick={() => navigate("/type", { state: { mode: "login" } })}
                      className="flex-1 flex items-center justify-center py-4.5 bg-[#F8FAFA] hover:bg-gray-50 transition-colors cursor-pointer text-[#1A1A1A] font-medium text-lg group"
                    >
                      Login <ArrowUpRight className="ml-2 w-5 h-5 text-[#FFBF00] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    </div>
                    <div
                      onClick={() => navigate("/type", { state: { mode: "signup" } })}
                      className="flex-1 flex items-center justify-center py-4.5 bg-[#0D4D4D] hover:bg-[#0A3D3D] transition-colors cursor-pointer text-white font-medium text-lg group"
                    >
                      Get started <ArrowUpRight className="ml-2 w-5 h-5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center py-4 bg-[#F8FAFA] relative" ref={dropdownRef}>
                    <div
                      onClick={() => setShowDropdown(!showDropdown)}
                      className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
                    >
                      {userData.image && userData.image.trim() !== "" ? (
                        <img
                          src={userData.image.startsWith("http") ? userData.image : `${API_URL}/${userData.image}?t=${new Date().getTime()}`}
                          className="w-10 h-10 rounded-full object-cover border border-gray-200"
                          alt="profile"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-[#0D4D4D] flex items-center justify-center text-white font-bold border border-[#0D4D4D]/10">
                          {userName ? userName[0].toUpperCase() : "U"}
                        </div>
                      )}
                      <div className="flex flex-col text-left">
                        <span className="font-semibold text-sm text-[#1A1A1A]">{userName}</span>
                        <span className="text-xs text-gray-500">Profile</span>
                      </div>
                      <ChevronDown className={`w-4 h-4 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
                    </div>

                    {showDropdown && (
                      <div className="absolute top-full right-0 mt-1 bg-white shadow-2xl rounded-xl w-[200px] py-3 z-[60] border border-gray-100">
                        {role === "user" ? (
                          <>
                            <div onClick={() => { navigate("/profile"); setShowDropdown(false); }} className="px-4 py-3 hover:bg-gray-50 cursor-pointer text-[#1A1A1A] text-sm font-medium">My Profile</div>
                            <div onClick={() => { navigate("/history"); setShowDropdown(false); }} className="px-4 py-3 hover:bg-gray-50 cursor-pointer text-[#1A1A1A] text-sm font-medium">My History</div>
                          </>
                        ) : (
                          <>
                            <div onClick={() => { navigate("/businessProfile"); setShowDropdown(false); }} className="px-4 py-3 hover:bg-gray-50 cursor-pointer text-[#1A1A1A] text-sm font-medium">My Profiles</div>
                            <div onClick={() => { navigate("/history"); setShowDropdown(false); }} className="px-4 py-3 hover:bg-gray-50 cursor-pointer text-[#1A1A1A] text-sm font-medium">My History</div>
                            <div onClick={() => { navigate("/earning"); setShowDropdown(false); }} className="px-4 py-3 hover:bg-gray-50 cursor-pointer text-[#1A1A1A] text-sm font-medium">Payment & Earning</div>
                          </>
                        )}
                        <div className="h-[1px] bg-gray-100 my-2 mx-4"></div>
                        <div onClick={() => setIsLogoutOpen(true)} className="px-4 py-3 hover:bg-red-50 cursor-pointer text-red-500 text-sm font-semibold">Logout</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Logo Only Navbar (e.g. signup routes) */}
          {isSignupOnlyNavbar && (
            <div className="w-full flex justify-center py-6 bg-[#F8FAFA]">
              <img
                src={logo}
                alt="VerShip"
                className="h-20"
              />
            </div>
          )}
        </div>
      </nav>

      {/* Mobile Menu */}
      {isOpen && !isSignupOnlyNavbar && (
        <div id="mobile-menu" className="lg:hidden absolute top-full left-0 w-full bg-white border-b border-gray-200 shadow-xl py-6 px-6 space-y-6 animate-in slide-in-from-top duration-300">
          <div className="flex flex-col space-y-4">
            <div onClick={() => { navigate("/about"); setIsOpen(false); }} className="text-xl font-medium text-[#1A1A1A] py-2 border-b border-gray-100">About</div>
            <div onClick={() => {
              if (location.pathname === "/") {
                document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" });
              } else {
                navigate("/", { state: { scrollTo: "how-it-works" } });
              }
              setIsOpen(false);
            }} className="text-xl font-medium text-[#1A1A1A] py-2 border-b border-gray-100">How it works</div>
            <div onClick={() => { navigate("/contact"); setIsOpen(false); }} className="text-xl font-medium text-[#1A1A1A] py-2 border-b border-gray-100">Contact</div>
          </div>

          {!is_login ? (
            <div className="flex flex-col gap-4">
              <button
                onClick={() => { navigate("/type", { state: { mode: "login" } }); setIsOpen(false); }}
                className="w-full py-4 rounded-xl border-2 border-[#E5E7EB] text-[#1A1A1A] font-bold text-lg"
              >
                Log In
              </button>
              <button
                onClick={() => { navigate("/type", { state: { mode: "signup" } }); setIsOpen(false); }}
                className="w-full py-4 rounded-xl bg-[#0D4D4D] text-white font-bold text-lg"
              >
                Get Started
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl">
                {userData.image && userData.image.trim() !== "" ? (
                  <img
                    src={userImage}
                    className="w-12 h-12 rounded-full object-cover"
                    alt="profile"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-[#0D4D4D] flex items-center justify-center text-white font-bold">
                    {userName ? userName[0].toUpperCase() : "U"}
                  </div>
                )}
                <div>
                  <div className="font-bold text-lg">{userName}</div>
                  <div className="text-sm text-gray-500">View Profile</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => { navigate(role === "user" ? "/profile" : "/businessProfile"); setIsOpen(false); }} className="p-4 bg-gray-50 rounded-xl text-center font-semibold">Profile</button>
                <button onClick={() => { navigate("/history"); setIsOpen(false); }} className="p-4 bg-gray-50 rounded-xl text-center font-semibold">History</button>
                {role === "business" && <button onClick={() => { navigate("/earning"); setIsOpen(false); }} className="p-4 bg-gray-50 rounded-xl text-center font-semibold">Earnings</button>}
                <button onClick={() => { setIsLogoutOpen(true); setIsOpen(false); }} className="p-4 bg-red-50 text-red-500 rounded-xl text-center font-bold col-span-2">Logout</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Logout Modal */}
      <Logout isLogoutOpen={isLogoutOpen} onClose={() => setIsLogoutOpen(false)} />
    </div>
  );
}
