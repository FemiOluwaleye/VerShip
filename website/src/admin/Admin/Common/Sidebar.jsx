import { ADMIN_BASE } from "../../adminBase";
import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Activity,
  CheckSquare,
  File,
  Info,
  Star,
  Shield,
  Database,
  RotateCcw,
} from "react-feather";

function Sidebar({ isOpen }) {
  const [isHovered, setHovered] = useState(false);
  const [activeMenu, setActiveMenu] = useState(null);
  const [showButton, setShowButton] = useState(true);
  const location = useLocation();
  const { pathname } = location;

  const handleMouseEnter = () => {
    if (!isOpen) {
      setHovered(true);
      setShowButton(true);
    }
  };
  const handleMouseLeave = () => {
    if (!isOpen) {
      setHovered(false);
      setShowButton(false);
    }
  };

  const isSidebarExpanded = isOpen || isHovered;

  const toggleMenu = (key) => {
    setActiveMenu((prev) => (prev === key ? null : key));
  };

  const isActive = (path) => {
    return pathname === path || pathname.startsWith(path);
  };

  const handleLinkClick = () => {
    const width = window.innerWidth;
    if (width <= 1200) {
      document.body.classList.remove("sidebar-enable");
    }
  };

  useEffect(() => {
    if (pathname.includes("/userlist")) {
      setActiveMenu("providers");
    } else if (
      pathname === "/driverlist" ||
      pathname.startsWith("/driverrides") ||
      pathname.startsWith("/documentlist") ||
      pathname.startsWith("/updatetutorial")
    ) {
      setActiveMenu("seekers");
    } else if (
      pathname === "/bannerlist" ||
      pathname.startsWith("/bannerlist") ||
      pathname.startsWith("/addbanner") ||
      pathname.startsWith("/updatebanner")
    ) {
      setActiveMenu("banner");
    } else if (pathname === "/teamlist") {
      setActiveMenu("teamManagement");
    } else if (
      pathname === "/ridelist" ||
      pathname.startsWith("/activeridelist")
    ) {
      setActiveMenu("booking");
    } else if (
      pathname === "/bookinglist" ||
      pathname === "/bookingcompleted"
    ) {
      setActiveMenu("transaction");
    } else if (pathname === "/requestlist") {
      setActiveMenu("request");
    } else if (pathname === "/ratinglist") {
      setActiveMenu("rating");
    } else if (pathname === "/reportlist") {
      setActiveMenu("report");
    } else if (pathname === "/leaguelist") {
      setActiveMenu("league");
    } else if (pathname === "/bannerlist") {
      setActiveMenu("banner");
    } else if (
      pathname.includes("/contactlist") ||
      pathname.includes("/faqlist") ||
      pathname.startsWith("/addfaq") ||
      pathname.startsWith("/updatefaq") ||
      pathname.startsWith("/cookielist") ||
      pathname.startsWith("/addcookie") ||
      pathname.startsWith("/updatecookie")
    ) {
      setActiveMenu("support");
    } else if (
      pathname.includes("/prepackedorders") ||
      pathname.includes("/prepacked/")
    ) {
      setActiveMenu("prepacked");
    } else if (
      pathname.includes("/providerlist") ||
      pathname.includes("/pricing")
    ) {
      // Pricing deep-links (/pricing/:id) are followed from the listing, so the
      // submenu has to open on direct navigation too, not just on click.
      setActiveMenu("providersMenu");
    } else if (pathname.includes("/password")) {
      setActiveMenu("settings");
    } else {
      setActiveMenu(null);
    }
  }, [pathname]);

  return (
    <div
      className={`vertical-menu ${isSidebarExpanded ? "hovered" : "collapsed"}`}
      onMouseEnter={() => {
        handleMouseEnter();
        document.body.classList.add("hovered");
      }}
      onMouseLeave={() => {
        handleMouseLeave();
        document.body.classList.remove("hovered");
      }}
    >
      <div className="navbar-brand-box">
        <Link to={`${ADMIN_BASE}/dashboard`} className="logo" onClick={handleLinkClick}>
          <span className="logo-lg">
            <img src="/vendor/images/shipone.png" alt="" height={20} />
          </span>
        </Link>
        {/* <button
          type="button"
          className="btn btn-sm hide-menu-btn"
          onClick={() => {
            const body = document.body;
            body.classList.toggle("sidebar-enable");
            body.classList.remove("hovered");
            setHovered(false);
            setShowButton(false);

            if (window.innerWidth >= 1200) {
              body.classList.toggle("vertical-collapsed");
            } else {
              body.classList.remove("vertical-collapsed");
            }
          }}
          style={{
            display: isSidebarExpanded && showButton ? "block" : "none",
          }}
        >
          <i className="fe-x"></i>
        </button> */}
      </div>
      <div data-simplebar="" className="sidebar-menu-scroll mt-1">
        <div id="sidebar-menu">
          <ul className="metismenu list-unstyled" id="side-menu">
            <li className={isActive("/dashboard") ? "mm-active" : ""}>
              <Link to={`${ADMIN_BASE}/dashboard`} onClick={handleLinkClick}>
                <i className="ri-pie-chart-2-fill" />
                <span>Dashboard</span>
              </Link>
            </li>

            <li className={activeMenu === "providers" ? "mm-active" : ""}>
              <Link
                className="has-arrow waves-effect"
                onClick={() => toggleMenu("providers")}
              >
                <i className="uil-user-square" />
                <span>Users</span>
              </Link>
              {isSidebarExpanded && activeMenu === "providers" && (
                <ul className="sub-menu mm-show">
                  <li>
                    <Link
                      className={isActive("/userlist") ? "active" : ""}
                      to={`${ADMIN_BASE}/userlist`}
                      onClick={handleLinkClick}
                    >
                      User listings
                    </Link>
                  </li>
                </ul>
              )}
            </li>
            <li className={activeMenu === "providersMenu" ? "mm-active" : ""}>
              <Link
                className="has-arrow waves-effect"
                onClick={() => toggleMenu("providersMenu")}
              >
                <i className="uil-store" />
                <span>Providers</span>
              </Link>

              {isSidebarExpanded && activeMenu === "providersMenu" && (
                <ul className="sub-menu mm-show">
                  <li>
                    <Link
                      className={isActive("/providerlist") ? "active" : ""}
                      to={`${ADMIN_BASE}/providerlist`}
                      onClick={handleLinkClick}
                    >
                      Providers listings
                    </Link>
                  </li>
                  <li>
                    <Link
                      className={isActive("/pricing") ? "active" : ""}
                      to={`${ADMIN_BASE}/pricing`}
                      onClick={handleLinkClick}
                    >
                      Pricing
                    </Link>
                  </li>
                </ul>
              )}
            </li>

            <li className={activeMenu === "Bookings" ? "mm-active" : ""}>
              <Link
                className="has-arrow waves-effect"
                onClick={() => toggleMenu("Bookings")}
              >
                <i className="uil-transaction" />
                <span>Bookings</span>
              </Link>
              {isSidebarExpanded && activeMenu === "Bookings" && (
                <ul className="sub-menu mm-show">
                  <li>
                    <Link
                      className={isActive("/bookinglist") ? "active" : ""}
                      to={`${ADMIN_BASE}/bookinglist`}
                      onClick={handleLinkClick}
                    >
                      Booking List
                    </Link>
                  </li>
                  {/* <li>
                    <Link
                      className={isActive("/BookingCompleted") ? "active" : ""}
                      to={`${ADMIN_BASE}/BookingCompleted`}
                      onClick={handleLinkClick}
                    >
                      Completed Bookings
                    </Link>
                  </li> */}
                </ul>
              )}
            </li>



            <li className={activeMenu === "rating" ? "mm-active" : ""}>
              <Link
                className="has-arrow waves-effect"
                onClick={() => toggleMenu("rating")}
              >
                <Star />
                <span>Ratings</span>
              </Link>
              {isSidebarExpanded && activeMenu === "rating" && (
                <ul className="sub-menu mm-show">
                  <li>
                    <Link
                      className={isActive("/ratinglist") ? "active" : ""}
                      to={`${ADMIN_BASE}/ratinglist`}
                      onClick={handleLinkClick}
                    >
                      Rating list
                    </Link>
                  </li>
                </ul>
              )}
            </li>
            {/* <li className={activeMenu === "report" ? "mm-active" : ""}>
              <Link
                className="has-arrow waves-effect"
                onClick={() => toggleMenu("report")}
              >
                <Activity />
                <span>Reports</span>
              </Link>
              {isSidebarExpanded && activeMenu === "report" && (
                <ul className="sub-menu mm-show">
                  <li>
                    <Link
                      className={isActive("/reportlist") ? "active" : ""}
                      to={`${ADMIN_BASE}/reportlist`}
                      onClick={handleLinkClick}
                    >
                      Report list
                    </Link>
                  </li>
                </ul>
              )}
            </li> */}
            {/* <li className={activeMenu === "banner" ? "mm-active" : ""}>
              <Link
                className="has-arrow waves-effect"
                onClick={() => toggleMenu("banner")}
              >
                <Image />
                <span>Banners</span>
              </Link>
              {isSidebarExpanded && activeMenu === "banner" && (
                <ul className="sub-menu mm-show">
                  <li>
                    <Link
                      className={isActive("/bannerlist") ? "active" : ""}
                      to={`${ADMIN_BASE}/bannerlist`}
                      onClick={handleLinkClick}
                    >
                      Banner list
                    </Link>
                  </li>
                </ul>
              )}
            </li> */}

            <li className={activeMenu === "support" ? "mm-active" : ""}>
              <Link
                className="has-arrow waves-effect"
                onClick={() => toggleMenu("support")}
              >
                <i className="ri-customer-service-2-line" />
                <span>Support Center</span>
              </Link>
              {isSidebarExpanded && activeMenu === "support" && (
                <ul className="sub-menu mm-show">
                  <li>
                    <Link
                      className={isActive("/contactlist") ? "active" : ""}
                      to={`${ADMIN_BASE}/contactlist`}
                      onClick={handleLinkClick}
                    >
                      Contact List
                    </Link>
                  </li>
                  <li>
                    <Link
                      className={isActive("/faqlist") ? "active" : ""}
                      to={`${ADMIN_BASE}/faqlist`}
                      onClick={handleLinkClick}
                    >
                      FAQ's List
                    </Link>
                  </li>
                  <li>
                    <Link
                      className={isActive("/cookielist") ? "active" : ""}
                      to={`${ADMIN_BASE}/cookielist`}
                      onClick={handleLinkClick}
                    >
                      Cookies List
                    </Link>
                  </li>
                </ul>
              )}
            </li>

            <li className={activeMenu === "prepacked" ? "mm-active" : ""}>
              <Link
                className="has-arrow waves-effect"
                onClick={() => toggleMenu("prepacked")}
              >
                <i className="ri-archive-2-line" />
                <span>Pre-Packed Barrels</span>
              </Link>
              {isSidebarExpanded && activeMenu === "prepacked" && (
                <ul className="sub-menu mm-show">
                  <li>
                    <Link
                      className={isActive("/prepacked/") ? "active" : ""}
                      to={`${ADMIN_BASE}/prepacked/list`}
                      onClick={handleLinkClick}
                    >
                      Barrels
                    </Link>
                  </li>
                  <li>
                    <Link
                      className={isActive("/prepackedorders") ? "active" : ""}
                      to={`${ADMIN_BASE}/prepackedorders`}
                      onClick={handleLinkClick}
                    >
                      Orders
                    </Link>
                  </li>
                </ul>
              )}
            </li>

            {/* <li className={activeMenu === "settings" ? "mm-active" : ""}>
              <Link
                className="has-arrow waves-effect"
                onClick={() => toggleMenu("settings")}
              >
                <i className="ri-settings-3-line" />
                <span>Settings</span>
              </Link>
              {isSidebarExpanded && activeMenu === "settings" && (
                <ul className="sub-menu mm-show">
                  <li>
                    <Link
                      className={isActive("/password") ? "active" : ""}
                      to={`${ADMIN_BASE}/password`}
                      onClick={handleLinkClick}
                    >
                      Change Password
                    </Link>
                  </li>
                </ul>
              )}
            </li> */}

            <li className={isActive("/aboutus") ? "mm-active" : ""}>
              <Link to={`${ADMIN_BASE}/aboutus`} onClick={handleLinkClick}>
                <Info />
                <span>About Us</span>
              </Link>
            </li>

            <li className={isActive("/privacypolicy") ? "mm-active" : ""}>
              <Link to={`${ADMIN_BASE}/privacypolicy`} onClick={handleLinkClick}>
                <File />
                <span>Privacy Policy</span>
              </Link>
            </li>

            <li className={isActive("/termsConditions") ? "mm-active" : ""}>
              <Link to={`${ADMIN_BASE}/termsConditions`} onClick={handleLinkClick}>
                <CheckSquare />
                <span>Terms & Conditions</span>
              </Link>
            </li>
            <li className={isActive("/cookiepolicy") ? "mm-active" : ""}>
              <Link to={`${ADMIN_BASE}/cookiepolicy`} onClick={handleLinkClick}>
                <Database size={18} />
                <span>Cookie Policy</span>
              </Link>
            </li>
            <li className={isActive("/freightforwarder") ? "mm-active" : ""}>
              <Link to={`${ADMIN_BASE}/freightforwarder`} onClick={handleLinkClick}>
                <Shield size={18} />
                <span>Freight Forwarder Agreement</span>
              </Link>
            </li>
            <li className={isActive("/refundpolicy") ? "mm-active" : ""}>
              <Link to={`${ADMIN_BASE}/refundpolicy`} onClick={handleLinkClick}>
                <RotateCcw size={18} />
                <span>Refund Policy</span>
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default Sidebar;
