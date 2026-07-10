import React, { useRef, useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { axiosInstance, BASE_URL } from "../../Config";
import Swal from "sweetalert2";
import { Lock, LogOut } from "react-feather";

function Navbar({ toggleSidebar }) {
  const location = useLocation();
  const [image, setImage] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const bodyRef = useRef(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    bodyRef.current = document.body;
  }, []);

  useEffect(() => {
    const fetchProfile = async () => {
      const token = localStorage.getItem("token");

      try {
        const response = await axiosInstance.get(`/profile`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        console.log("Profile response:", response);
        if (response.data && response.data.body) {
          const { image, firstName, lastName, email } = response.data.body;
          setImage(`${BASE_URL}/${image}`);
          setFirstName(firstName || "");
          setLastName(lastName || "");
          setEmail(email || "");
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
      }
    };

    fetchProfile();

    if (location.state?.updated) {
      fetchProfile();
    }
  }, [location.state]);

  const getFullName = () => {
    return `${firstName || ""} ${lastName || ""}`.trim();
  };

  const getShortName = () => {
    if (!firstName && !lastName) return "User";
    return `${firstName || ""} ${lastName ? lastName.charAt(0) + "." : ""}`.trim();
  };

  const truncateText = (text, maxLength = 15) => {
    if (!text) return "";
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  const getTruncatedFullName = (maxLength = 15) => {
    const fullName = getFullName();
    return truncateText(fullName, maxLength);
  };

  const handleClick = () => {
    toggleSidebar();

    if (bodyRef.current) {
      const body = bodyRef.current;
      body.classList.toggle("sidebar-enable");

      body.classList.remove("hovered");

      if (window.innerWidth >= 1200) {
        body.classList.toggle("vertical-collapsed");
      } else {
        body.classList.remove("vertical-collapsed");
      }
    }
  };

  const closeDropdown = () => {
    if (dropdownRef.current) {
      const dropdown = window.bootstrap.Dropdown.getInstance(
        dropdownRef.current
      );
      if (dropdown) {
        dropdown.hide();
      }
    }
  };

  const handleProfileClick = () => {
    closeDropdown();
    navigate("/profile");
  };

  const navigate = useNavigate();

  const logout = async () => {
    const result = await Swal.fire({
      title: "Are you sure?",
      text: "You will be logged out of your account.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#1e3308",
      cancelButtonColor: "#d33",
      confirmButtonText: "Yes, log out!",
    });

    if (result.isConfirmed) {
      try {
        await axiosInstance.post(`/logout`);
        localStorage.removeItem("token");
        toast.success("Logged out successfully!");
        setTimeout(() => {
          navigate("/");
        }, 1500);
      } catch (error) {
        console.error("Logout error:", error);
      }
    }
  };

  return (
    <>
      <header id="page-topbar">
        <div className="navbar-header">
          <div className="d-flex align-items-center">
            <div className="d-flex align-items-center" id="nav-first">
              <button
                type="button"
                className="btn btn-sm vertical-menu-btn"
                onClick={handleClick}
              >
                <i className="fe-menu"></i>
              </button>

              <Link to="/dashboard" className="new-logo">
                <img src="./src/assets/images/logo-new.png" alt="" />
              </Link>
            </div>
          </div>
          <div className="d-flex align-items-center">
            {/* Profile */}
            <div className="dropdown d-inline-block">
              <button
                ref={dropdownRef}
                type="button"
                className="btn header-item waves-effect d-flex align-items-center"
                id="page-header-user-dropdown"
                data-bs-toggle="dropdown"
                aria-haspopup="true"
                aria-expanded="false"
              >
                {/* <img
                  className="header-profile-user"
                  src={image || "assets/images/users/avatar-4.jpg"}
                  alt="Profile Avatar"
                /> */}
                <img
                  className="header-profile-user"
                  src={image ? image : "/assets/images/download.jpeg"}
                  alt="Profile Avatar"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = "/assets/images/download.jpeg";
                  }}
                />
                <div className="text-start d-none d-xl-inline-block ms-2 me-2">
                  <span className="fw-medium font-size-15 nsuser">
                    <span className="text-truncate d-inline-block" style={{ maxWidth: "95px" }}>
                      {getShortName()}
                    </span>
                    <i className="uil-angle-down namearr" />
                  </span>
                </div>
              </button>
              <div className="dropdown-menu pt-3 pb-2 dropdown-menu-end dropdown-profile">
                <div className="innerdrop">
                  <div
                    className="px-3 pb-1"
                    style={{ cursor: "pointer" }}
                    onClick={handleProfileClick}
                  >
                    <div
                      className="font-size-14 text-muted mb-2"
                      style={{ display: "flex", alignItems: "baseline" }}
                    >
                      <span className="fw-medium me-1">Welcome</span>{" "}
                      <small
                        className="font-size-13 text-truncate"
                        style={{
                          maxWidth: 200,
                          display: "inline-block",
                          overflow: "hidden",
                          whiteSpace: "nowrap",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {getFullName()}
                      </small>
                    </div>
                    <div className="d-flex align-items-center">
                      <img
                        src={image || "assets/images/users/avatar-4.jpg"}
                        alt=""
                        width={70}
                        height={70}
                        style={{ borderRadius: "50%" }}
                      />
                      <div
                        className="ms-3"
                        style={{ maxWidth: "calc(100% - 80px)" }}
                      >
                        <div
                          className="fw-semibold usprname text-truncate"
                          style={{
                            lineHeight: "1.3",
                            maxWidth: "100%",
                            overflow: "hidden",
                            whiteSpace: "nowrap",
                            textOverflow: "ellipsis",
                          }}
                          title={getFullName()} // Shows full name on hover
                        >
                          {getTruncatedFullName(20)} {/* Adjust max length as needed */}
                        </div>
                        <div
                          className="text-lowdark pb-1 usprmail text-truncate"
                          style={{
                            maxWidth: "100%",
                            overflow: "hidden",
                            whiteSpace: "nowrap",
                            textOverflow: "ellipsis",
                          }}
                          title={email} // Shows full email on hover
                        >
                          {truncateText(email, 25)}
                        </div>
                        <Link
                          to="/profile"
                          onClick={(e) => {
                            e.stopPropagation();
                            closeDropdown();
                            navigate("/profile");
                          }}
                        >
                          Edit Profile
                        </Link>
                      </div>
                    </div>
                  </div>
                  <div className="dropplink font-size-15 mt-2">

                    <Link
                      to="/password"
                      className="d-block text-lowdark pb-2 ps-3 pt-2"
                      style={{ borderTop: "1px solid #e9ecf0" }}
                      onClick={closeDropdown}
                    >
                      <Lock className="align-middle font-size-10 me-1" />
                      <span>Password</span>
                    </Link>
                    <Link
                      to="/"
                      className="d-block text-danger ps-3 pt-2"
                      style={{ borderTop: "1px solid #e9ecf0" }}
                      onClick={(e) => {
                        e.preventDefault();
                        closeDropdown();
                        logout();
                      }}
                    >
                      <LogOut
                        className="align-middle me-1"
                        style={{ fontSize: "10px" }}
                      />
                      <span className="font-size-15">Logout</span>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>
    </>
  );
}

export default Navbar;