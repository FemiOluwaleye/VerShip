import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { axiosInstance } from "../Config";

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (location.state?.email) {
      setEmail(location.state.email);
    }
  }, [location.state]);

  const validateEmail = (email) => {
    setEmailError(email ? "" : "Please enter your email");
  };

  const validatePassword = (password) => {
    setPasswordError(password ? "" : "Please enter your password");
  };

  const handleEmailChange = (e) => {
    const value = e.target.value;
    setEmail(value);
    validateEmail(value);
  };

  const handlePasswordChange = (e) => {
    const value = e.target.value;
    setPassword(value);
    validatePassword(value);
  };

  const togglePasswordVisibility = () => {
    setShowPassword((prev) => !prev);
  };

  const handleLogin = async (e) => {
    e.preventDefault();

    if (loading) return;

    setFormError("");
    validateEmail(email);
    validatePassword(password);

    setLoading(true);

    try {
      const response = await axiosInstance.post("/login", {
        email,
        password,
      });
      toast.success("Login successful!");

      setTimeout(() => {
        localStorage.setItem("token", response.data.body.token);
        localStorage.setItem("userData", JSON.stringify(response.data.body));
        navigate("/dashboard", { replace: true });
      }, 1500);
    } catch (error) {
      if (error.response) {
        toast.error(error.response.data.message || "Invalid email or password");
      } else {
        toast.error("Something went wrong. Please try again.");
      }
      setLoading(false);
    }
  };
  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      handleLogin(e);
    }
  };

  return (
    <>
      <div id="auth-wrapper">
        <div className="left-auth">
          {/* 
          <img
            // src="assets/images/auth.png"
            src="/dev/shipone/website/dist/assets/logo-8tXBiyx4.png"
            alt="Logo"
            style={{ width: "100%", height: "100%" }}
          /> */}


        </div>
        <div className="right-auth">
          <div className="flex-grow-1">
            <div className="authtitle mb-2">
              <img src="assets/images/shipone.png" width={240} alt="Logo" />
            </div>
            <div className="font-size-18 fw-medium text-white mt-5">Login</div>

            {formError && <div className="alert alert-danger">{formError}</div>}

            <div className="mb-3 pt-2">
              <input
                type="email"
                value={email}
                onChange={handleEmailChange}
                onKeyPress={handleKeyPress}
                className={`form-control logform ${emailError ? "is-invalid" : ""
                  }`}
                placeholder="Email address"
                autoComplete="email"
                style={{ paddingRight: "15px" }}
              />
              {emailError && (
                <div className="invalid-feedback d-block">{emailError}</div>
              )}
            </div>

            <div className="mb-3">
              <div className="position-relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={handlePasswordChange}
                  onKeyPress={handleKeyPress}
                  className={`form-control logform ${passwordError ? "is-invalid" : ""
                    }`}
                  placeholder="Password"
                  autoComplete="current-password"
                  style={{ paddingRight: "45px" }}
                />
                <button
                  type="button"
                  className="btn btn-link position-absolute border-0 bg-transparent"
                  onClick={togglePasswordVisibility}
                  style={{
                    top: "50%",
                    right: "12px",
                    transform: "translateY(-50%)",
                    cursor: "pointer",
                    padding: "4px 8px",
                    color: "#6c757d",
                    textDecoration: "none",
                    zIndex: 5,
                  }}
                >
                  <i
                    className={showPassword ? "ri-eye-line" : "ri-eye-off-line"}
                    style={{ fontSize: "18px" }}
                  />
                </button>
              </div>
              {passwordError && (
                <div className="invalid-feedback d-block">{passwordError}</div>
              )}
            </div>

            <button
              onClick={handleLogin}
              id="login"
              className="btn btn-primary w-100 mt-3"
            >
              LOG IN
            </button>


          </div>
        </div>
      </div>
      <ToastContainer autoClose={8182} />
    </>
  );
};

export default Login;
