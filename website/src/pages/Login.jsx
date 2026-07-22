import React from "react";
import { FcGoogle } from "react-icons/fc";
import { TiSocialFacebook } from "react-icons/ti";
import { AiFillApple } from "react-icons/ai";
import { shipp } from "../common/common-assets/assets-images";
import { useNavigate, useLocation } from "react-router-dom";
import { useState } from "react";
import { login, socialLogin, updateDeviceToken, saveBookingRequest, syncUserCookies } from "../api/cms";
import { toast } from "sonner";
import { useGoogleLogin } from '@react-oauth/google';
import AppleLogin from 'react-apple-login';
import { FaSpinner, FaEye, FaEyeSlash } from "react-icons/fa";
// import { requestForToken } from "../firebase";
const requestForToken = async () => null;

const Login = () => {
    const navigate = useNavigate();
    const [form, setForm] = useState({
        email: "",
        password: "",
    });
    const [rememberMe, setRememberMe] = useState(false);
    const [errors, setErrors] = useState({});
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const location = useLocation();
    const role = location.state?.role || "";

    React.useEffect(() => {
        if (location.state?.message) {
            toast.error(location.state.message, { id: 'auth-error' });
            // Clear state to avoid toast on every mount/refresh
            window.history.replaceState({}, document.title);
        }

        const token = localStorage.getItem("token");
        const userStr = localStorage.getItem("user");
        const is_login = localStorage.getItem("is_login");
        if (token && userStr && is_login) {
            try {
                const user = JSON.parse(userStr);
                if (user.role === "2") {
                    navigate("/request", { replace: true });
                } else {
                    navigate("/", { replace: true });
                }
            } catch (e) {
                console.error("Error parsing user for redirect", e);
            }
        }

        const storageKey = `rememberedCredentials_${role}`;
        const savedCreds = localStorage.getItem(storageKey);
        if (savedCreds) {
            setForm(JSON.parse(savedCreds));
            setRememberMe(true);
        } else {
            setForm({ email: "", password: "" });
            setRememberMe(false);
        }
    }, [role, navigate, location.state]);

    const validateField = (name, value) => {
        let error = "";
        switch (name) {
            case "email":
                if (!value.trim()) error = "Email is required";
                else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) error = "Invalid email format";
                break;
            case "password":
                if (!value) error = "Password is required";
                break;
            default:
                break;
        }
        setErrors(prev => ({ ...prev, [name]: error }));
        return error;
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        let formattedValue = value;
        if (name === "email") {
            formattedValue = value.replace(/^\s+/, "");
        }
        setForm({ ...form, [name]: formattedValue });
        validateField(name, formattedValue);
    };

    const handleDeviceToken = async () => {
        /*
        try {
            const token = await requestForToken();
            if (token) {
                await updateDeviceToken({
                    deviceToken: token,
                    deviceType: "web"
                });
            }
        } catch (error) {
            console.error("Error handling device token:", error);
        }
        */
    };
    const handleSubmit = async (e) => {
        e.preventDefault();

        const emailErr = validateField("email", form.email);
        const passErr = validateField("password", form.password);

        // if (emailErr || passErr) {
        //     toast.error("Please fix the errors in the form");
        //     return;
        // }

        setIsLoading(true);
        try {
            let response = await login({ ...form, role });
            if (response.success === true) {
                toast.success(response.message);

                localStorage.removeItem("token");
                localStorage.removeItem("user");

                localStorage.setItem("token", response.body.authtoken);
                localStorage.setItem("user", JSON.stringify(response.body.user));
                localStorage.setItem("is_login", 1);
                window.dispatchEvent(new Event('userUpdated'));

                const storageKey = `rememberedCredentials_${role}`;
                if (rememberMe) {
                    localStorage.setItem(storageKey, JSON.stringify(form));
                } else {
                    localStorage.removeItem(storageKey);
                }
                await handleDeviceToken();
                await syncUserCookies(response.body.user.id);

                const processPendingBooking = async () => {
                    const pendingPayload = localStorage.getItem("pending_booking_payload");
                    if (pendingPayload) {
                        try {
                            const payload = JSON.parse(pendingPayload);
                            const res = await saveBookingRequest(payload);
                            localStorage.removeItem("pending_booking_payload");
                            const isRequestBarrel = payload.items.some(item => (item.sub_type || "").includes("Request Barrel Drop-Off"));
                            if (isRequestBarrel) {
                                navigate(`/barrel-request/${res.body.id}`, { replace: true });
                            } else {
                                navigate("/quotes-shipown", { replace: true });
                            }
                            return true;
                        } catch (error) {
                            console.error("Error saving pending booking:", error);
                            localStorage.removeItem("pending_booking_payload");
                        }
                    }
                    return false;
                };

                const user = response.body.user;
                if (user.role === "1") {
                    const hasProcessedPending = await processPendingBooking();
                    if (hasProcessedPending) return;

                    const pendingRequestId = response.body.pendingRequestId;
                    const isQuotesRedirect = response.body.isQuotesRedirect;
                    const isBookingComplete = response.body.isBookingComplete;
                    const localStoragePendingId = localStorage.getItem("pending_barrel_request_id");
                    console.log("pendingRequestId", pendingRequestId);
                    console.log("isQuotesRedirect", isQuotesRedirect);
                    console.log("isBookingComplete", isBookingComplete);
                    console.log("localStoragePendingId", localStoragePendingId);
                    if (isBookingComplete) {
                        navigate("/", { replace: true });
                    } else if (isQuotesRedirect) {
                        console.log("isQuotesRedirect", response.body.isShipOwn, response.body.isDropOff);
                        if (response.body.isShipOwn) {
                            navigate("/quotes-shipown", { replace: true });
                        } else {
                            navigate("/quotes", { replace: true });
                        }
                    } else if (pendingRequestId) {
                        localStorage.removeItem("pending_barrel_request_id");
                        navigate(`/barrel-request/${pendingRequestId}`, { replace: true });
                    } else if (response.body.user.role === "2") {
                        const user = response.body.user;
                        if (user.isProfileComplete === "1") {
                            navigate("/request", { replace: true });
                        } else {
                            // Redirect to the correct signup step
                            // Consolidated flow: details are captured at signup, so an
                            // incomplete profile resumes at docs (<=3) or pricing (>=4).
                            const stepRoutes = {
                                1: "/businessdoument",
                                2: "/businessdoument",
                                3: "/businessdoument",
                                4: "/businessupload",
                                5: "/businessupload",
                                6: "/businessupload"
                            };
                            const targetRoute = stepRoutes[user.profile_step] || "/businessdoument";
                            navigate(targetRoute, { replace: true });
                        }
                    } else {
                        console.log("User Role in else", response.body.user);
                        navigate("/request", { replace: true });
                    }
                } else {
                    // Check for pending barrel request
                    const pendingBarrelId = localStorage.getItem("pending_barrel_request_id");
                    const isQuotesRedirect = response.body.isQuotesRedirect;
                    const isBookingComplete = response.body.isBookingComplete;

                    if (response.body.user.role === "2") {
                        const user = response.body.user;
                        if (user.isProfileComplete === "1") {
                            navigate("/request", { replace: true });
                        } else {
                            // Redirect to the correct signup step
                            // Consolidated flow: details are captured at signup, so an
                            // incomplete profile resumes at docs (<=3) or pricing (>=4).
                            const stepRoutes = {
                                1: "/businessdoument",
                                2: "/businessdoument",
                                3: "/businessdoument",
                                4: "/businessupload",
                                5: "/businessupload",
                                6: "/businessupload"
                            };
                            const targetRoute = stepRoutes[user.profile_step] || "/businessdoument";
                            navigate(targetRoute, { replace: true });
                        }
                    } else {
                        console.log("User Role in else", response.body.user);
                        navigate("/request", { replace: true });
                    }
                }
            } else {
                console.log("User Role in else", response.message);
                toast.error(response.message || "Login failed. Please try again.");
            }
        } catch (error) {
            const errorMessage = error.response?.data?.message ||
                error.response?.data?.error ||
                error.message ||
                "An unexpected error occurred. Please try again.";
            toast.error(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };
    const googleLogin = useGoogleLogin({
        onSuccess: async (tokenResponse) => {
            try {
                // Fetch user info from Google
                const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                    headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
                });
                const userInfo = await res.json();

                const response = await socialLogin({
                    social_id: userInfo.sub,
                    social_type: 'google',
                    email: userInfo.email,
                    firstName: userInfo.given_name,
                    lastName: userInfo.family_name,
                    image: userInfo.picture,
                });

                if (response.success) {
                    toast.success("Login successful with Google!");
                    localStorage.setItem("token", response.body.authtoken);
                    localStorage.setItem("user", JSON.stringify(response.body.user));
                    window.dispatchEvent(new Event('userUpdated'));

                    await handleDeviceToken();
                    await syncUserCookies(response.body.user.id);

                    const processPendingBooking = async () => {
                        const pendingPayload = localStorage.getItem("pending_booking_payload");
                        if (pendingPayload) {
                            try {
                                const payload = JSON.parse(pendingPayload);
                                const res = await saveBookingRequest(payload);
                                localStorage.removeItem("pending_booking_payload");
                                const isRequestBarrel = payload.items.some(item => (item.sub_type || "").includes("Request Barrel Drop-Off"));
                                if (isRequestBarrel) {
                                    navigate(`/barrel-request/${res.body.id}`, { replace: true });
                                } else {
                                    navigate("/quotes-shipown", { replace: true });
                                }
                                return true;
                            } catch (error) {
                                console.error("Error saving pending booking:", error);
                                localStorage.removeItem("pending_booking_payload");
                            }
                        }
                        return false;
                    };

                    const user = response.body.user;
                    if (user.role === "1") {
                        const hasProcessedPending = await processPendingBooking();
                        if (hasProcessedPending) return;

                        const pendingRequestId = response.body.pendingRequestId;
                        const isQuotesRedirect = response.body.isQuotesRedirect;
                        const isBookingComplete = response.body.isBookingComplete;
                        const localStoragePendingId = localStorage.getItem("pending_barrel_request_id");

                        if (isBookingComplete) {
                            navigate("/", { replace: true });
                        } else if (isQuotesRedirect) {
                            if (res.body.isShipOwn) {
                                navigate("/quotes-shipown", { replace: true });
                            } else {
                                navigate("/quotes", { replace: true });
                            }
                        } else if (pendingRequestId) {
                            localStorage.removeItem("pending_barrel_request_id");
                            navigate(`/barrel-request/${pendingRequestId}`, { replace: true });
                        } else if (localStoragePendingId) {
                            localStorage.removeItem("pending_barrel_request_id");
                            navigate(`/barrel-request/${localStoragePendingId}`, { replace: true });
                        } else {
                            navigate("/", { replace: true });
                        }
                    } else {
                        // Check for pending barrel request
                        const pendingBarrelId = localStorage.getItem("pending_barrel_request_id");
                        const isQuotesRedirect = response.body.isQuotesRedirect;
                        const isBookingComplete = response.body.isBookingComplete;
                        if (isBookingComplete) {
                            navigate("/", { replace: true });
                        } else if (isQuotesRedirect) {
                            if (res.body.isShipOwn) {
                                navigate("/quotes-shipown", { replace: true });
                            } else {
                                navigate("/quotes", { replace: true });
                            }
                        } else if (pendingBarrelId) {
                            localStorage.removeItem("pending_barrel_request_id");
                            navigate(`/barrel-request/${pendingBarrelId}`, { replace: true });
                        } else if (user.role === "2") {
                            if (user.isProfileComplete === "1") {
                                navigate("/request", { replace: true });
                            } else {
                                // Consolidated flow: details are captured at signup, so an
                                // incomplete profile resumes at docs (<=3) or pricing (>=4).
                                const stepRoutes = {
                                    1: "/businessdoument",
                                    2: "/businessdoument",
                                    3: "/businessdoument",
                                    4: "/businessupload",
                                    5: "/businessupload",
                                    6: "/businessupload"
                                };
                                const targetRoute = stepRoutes[user.profile_step] || "/businessdoument";
                                navigate(targetRoute, { replace: true });
                            }
                        } else {
                            navigate("/request", { replace: true });
                        }
                    }
                } else {
                    toast.error(response.message || "Google login failed.");
                }
            } catch (error) {
                console.error("Google login error:", error);
                toast.error("An error occurred during Google login.");
            }
        },
        onError: () => toast.error("Google login failed."),
    });

    const appleResponse = async (response) => {
        if (!response.error) {
            try {
                // Apple response usually contains user info only on first login
                // Here we pass what we get to the backend
                const res = await socialLogin({
                    social_id: response.authorization.id_token, // Or user ID if available
                    social_type: 'apple',
                    email: response.user?.email || "",
                    firstName: response.user?.name?.firstName || "Apple",
                    lastName: response.user?.name?.lastName || "User",
                });

                if (res.success) {
                    toast.success("Login successful with Apple!");
                    localStorage.setItem("token", res.body.authtoken);
                    localStorage.setItem("user", JSON.stringify(res.body.user));
                    window.dispatchEvent(new Event('userUpdated'));

                    await handleDeviceToken();
                    await syncUserCookies(res.body.user.id);

                    const processPendingBooking = async () => {
                        const pendingPayload = localStorage.getItem("pending_booking_payload");
                        if (pendingPayload) {
                            try {
                                const payload = JSON.parse(pendingPayload);
                                const res = await saveBookingRequest(payload);
                                localStorage.removeItem("pending_booking_payload");
                                const isRequestBarrel = payload.items.some(item => (item.sub_type || "").includes("Request Barrel Drop-Off"));
                                if (isRequestBarrel) {
                                    navigate(`/barrel-request/${res.body.id}`, { replace: true });
                                } else {
                                    navigate("/quotes-shipown", { replace: true });
                                }
                                return true;
                            } catch (error) {
                                console.error("Error saving pending booking:", error);
                                localStorage.removeItem("pending_booking_payload");
                            }
                        }
                        return false;
                    };

                    const user = res.body.user;
                    if (user.role === "1") {
                        const hasProcessedPending = await processPendingBooking();
                        if (hasProcessedPending) return;

                        const pendingRequestId = res.body.pendingRequestId;
                        const isQuotesRedirect = res.body.isQuotesRedirect;
                        const isBookingComplete = res.body.isBookingComplete;
                        const localStoragePendingId = localStorage.getItem("pending_barrel_request_id");

                        if (isBookingComplete) {
                            navigate("/", { replace: true });
                        } else if (isQuotesRedirect) {
                            if (res.body.isShipOwn) {
                                navigate("/quotes-shipown", { replace: true });
                            } else {
                                navigate("/quotes", { replace: true });
                            }
                        } else if (pendingRequestId) {
                            localStorage.removeItem("pending_barrel_request_id");
                            navigate(`/barrel-request/${pendingRequestId}`, { replace: true });
                        } else if (localStoragePendingId) {
                            localStorage.removeItem("pending_barrel_request_id");
                            navigate(`/barrel-request/${localStoragePendingId}`, { replace: true });
                        } else {
                            navigate("/", { replace: true });
                        }
                    } else {
                        // Check for pending barrel request
                        const pendingBarrelId = localStorage.getItem("pending_barrel_request_id");
                        const isQuotesRedirect = res.body.isQuotesRedirect;
                        const isBookingComplete = res.body.isBookingComplete;
                        if (isBookingComplete) {
                            navigate("/", { replace: true });
                        } else if (isQuotesRedirect) {
                            if (res.body.isShipOwn) {
                                navigate("/quotes-shipown", { replace: true });
                            } else {
                                navigate("/quotes", { replace: true });
                            }
                        } else if (pendingBarrelId) {
                            localStorage.removeItem("pending_barrel_request_id");
                            navigate(`/barrel-request/${pendingBarrelId}`, { replace: true });
                        } else if (user.role === "2") {
                            if (user.isProfileComplete === "1") {
                                navigate("/request", { replace: true });
                            } else {
                                // Consolidated flow: details are captured at signup, so an
                                // incomplete profile resumes at docs (<=3) or pricing (>=4).
                                const stepRoutes = {
                                    1: "/businessdoument",
                                    2: "/businessdoument",
                                    3: "/businessdoument",
                                    4: "/businessupload",
                                    5: "/businessupload",
                                    6: "/businessupload"
                                };
                                const targetRoute = stepRoutes[user.profile_step] || "/businessdoument";
                                navigate(targetRoute, { replace: true });
                            }
                        } else {
                            navigate("/request", { replace: true });
                        }
                    }
                } else {
                    toast.error(res.message || "Apple login failed.");
                }
            } catch (error) {
                console.error("Apple login error:", error);
                toast.error("An error occurred during Apple login.");
            }
        } else {
            toast.error("Apple login failed.");
        }
    };

    return (
        <div>
            <div
                className="flex items-center justify-center min-h-screen"
                style={{
                    backgroundImage: `url(${shipp})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    width: "100%",
                }}
            >

                <div className=" flex items-center justify-center pt-30">
                    <div className="flex flex-col text-white gap-5 sm:gap-13 items-center justify-center  bg-[#2D413F] backdrop-blur-md
        rounded-[22px]
        shadow-[0_25px_80px_rgba(0,0,0,0.6)] mt-[50px] mb-[50px] w-[90vw] py-10 sm:py-15 px-8 sm:w-[500px]  lg:w-[600px]  2xl:w-[650px]">
                        <h1 className="text-[22px]  sm:text-[26px] lg:text-[28px] xl:text-[35px] font-semibold">
                            Login
                        </h1>
                        <form onSubmit={handleSubmit}
                            action=""
                            className="flex flex-col items-start justify-center gap-4 w-full px-2 sm:px-10"
                        >
                            <div className="flex flex-col gap-1 w-full">
                                <label htmlFor="login-email" className="text-13px sm:text-[14px] xl:text-[18px] font-semibold">
                                    Email
                                </label>
                                <input
                                    id="login-email"
                                    type="email"
                                    className={`text-[13px] sm:text-[14px] xl:text-[16px] text-white rounded-[16px] border ${errors.email ? 'border-red-500' : 'border-[#4E6B5D]'}  py-2 xl:py-3 px-5 w-full focus:outline-none bg-transparent`}
                                    name="email"
                                    value={form.email}
                                    onChange={handleChange}
                                    aria-required="true"
                                    aria-invalid={errors.email ? "true" : "false"}
                                    aria-describedby={errors.email ? "login-email-error" : undefined}
                                    placeholder="Enter your Email"
                                />
                                {errors.email && <p id="login-email-error" role="alert" className="text-red-400 text-xs">{errors.email}</p>}
                            </div>
                            <div className="flex flex-col gap-1 w-full relative">
                                <label htmlFor="login-password" className="text-[13px] sm:text-[14px] xl:text-[18px] font-semibold">
                                    Password
                                </label>
                                <input
                                    id="login-password"
                                    type={showPassword ? "text" : "password"}
                                    className={`text-[13px] sm:text-[14px] xl:text-[16px] text-white border ${errors.password ? 'border-red-500' : 'border-[#4E6B5D]'} rounded-[16px] bg-transparent py-2 xl:py-3 px-5 w-full focus:outline-none`}
                                    name="password"
                                    value={form.password}
                                    onChange={handleChange}
                                    aria-required="true"
                                    aria-invalid={errors.password ? "true" : "false"}
                                    aria-describedby={errors.password ? "login-password-error" : undefined}
                                    placeholder="Enter your Password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                    className="absolute right-4 top-[50%] -translate-y-[50%] mt-4 cursor-pointer text-white/50 hover:text-white"
                                >
                                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                                </button>
                                {errors.password && <p id="login-password-error" role="alert" className="text-red-400 text-xs">{errors.password}</p>}
                            </div>
                            <div className="flex items-start justify-between w-full">
                                <div className="flex items-center justify-center gap-0.5 sm:gap-1">
                                    <input
                                        type="checkbox"
                                        className=" sm:w-[18px] sm:h-[18px] xl:w-[22px] xl:h-[20px] accent-[#FFBF00] rounded-[16px] focus:outline-none"
                                        name="rememberMe"
                                        checked={rememberMe}
                                        onChange={(e) => setRememberMe(e.target.checked)}
                                        id="rememberMe"
                                    />
                                    <label htmlFor="rememberMe" className="text-[12px]  sm:text-[14px] cursor-pointer">
                                        Remember me
                                    </label>
                                </div>
                                <div>
                                    <button type="button" onClick={() => navigate('/forgot')} className="text-[12px]  sm:text-[14px] cursor-pointer hover:text-yellow-400 underline transition">
                                        Forgot Password?
                                    </button>
                                </div>
                            </div>
                            <div className="flex items-center justify-center w-full mt-3 sm:mt-5 xl:mt-10">
                                <button
                                    disabled={isLoading}
                                    type="submit"
                                    className="bg-[linear-gradient(180deg,#FFBF00_0%,#FFD864_100%)]
              text-black font-bold text-[17px] sm:text-[19px]
              rounded-full
              h-[60px] w-[180px] sm:h-[70px] sm:w-[240px]
              transition-all flex items-center justify-center gap-2 disabled:opacity-70 hover:scale-105"
                                >
                                    {isLoading ? <FaSpinner className="animate-spin" /> : null}
                                    {isLoading ? "Logging in..." : "Log In"}
                                </button>
                            </div>
                        </form>
                        {/* <div className="w-full px-2 sm:px-10 mt-2">
                            <p className="text-[13px] sm:text-[14px] lg:text-[16px] font-semibold  text-center mb-4">
                                Login With Social
                            </p>
                            <div className="flex items-center justify-center gap-6">
                                <div
                                    onClick={() => googleLogin()}
                                    className="bg-white flex items-center justify-center rounded-lg w-[40px] h-[40px] xl:w-[50px] xl:h-[50px] cursor-pointer hover:scale-110 transition"
                                >
                                    <FcGoogle className="text-[30px] xl:text-[40px]" />
                                </div>

                                <AppleLogin
                                    clientId="YOUR_APPLE_CLIENT_ID"
                                    redirectURI="YOUR_APPLE_REDIRECT_URI"
                                    usePopup={true}
                                    callback={appleResponse}
                                    render={(props) => (
                                        <div
                                            onClick={props.onClick}
                                            className="bg-white flex items-center justify-center rounded-lg w-[40px] h-[40px] xl:w-[50px] xl:h-[50px] cursor-pointer hover:scale-110 transition"
                                        >
                                            <AiFillApple className="text-[30px] xl:text-[40px] text-black" />
                                        </div>
                                    )}
                                />
                            </div>
                        </div> */}


                        <p className="text-sm text-white/80">
                            Don't have an Account?
                            <button type="button" onClick={() => navigate('/type')} className="text-yellow-400 font-bold cursor-pointer hover:underline ml-1">Sign Up</button>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
