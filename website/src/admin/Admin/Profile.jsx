import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast, ToastContainer } from "react-toastify";
import { axiosInstance, BASE_URL } from "../Config";
import { Pencil } from "lucide-react";

const SERVICE_FEE_LEGACY_NAMES = ["Customs Clearance", "Service fee"];

const pickServiceFeeAddon = (addons) => {
  const found = addons?.find((addon) =>
    SERVICE_FEE_LEGACY_NAMES.some(
      (name) => name.toLowerCase() === addon.name?.toLowerCase()
    )
  );
  if (found) {
    return { ...found, name: "Service fee" };
  }
  return {
    id: 1,
    name: "Service fee",
    price_in_percent: "5.00",
    status: 1,
  };
};

const Profile = () => {
  const [data, setData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phoneNumber: "",
    image: "",
    countryCode: "",
    adminCommission: "",
  });
  const [serviceFee, setServiceFee] = useState({
    id: 1,
    name: "Service fee",
    price_in_percent: "5.00",
    status: 1,
  });
  const [imagePreview, setImagePreview] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [errors, setErrors] = useState({});
  const [initialEmail, setInitialEmail] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const fetchProfileData = async () => {
      try {
        const response = await axiosInstance.get(`/profile`, {});

        if (response.data && response.data.body) {
          const profileData = response.data.body;

          if (profileData.name) {
            const nameParts = profileData.name.trim().split(' ');
            const firstName = nameParts[0] || '';
            const lastName = nameParts.slice(1).join(' ') || '';

            setData({
              ...profileData,
              firstName,
              lastName
            });
          } else {
            setData(profileData);
          }

          setInitialEmail(profileData.email || "");

          const imageUrl = profileData.image && profileData.image.startsWith("http")
            ? profileData.image
            : `${BASE_URL}/${profileData.image}`;
          setImagePreview(imageUrl);

          if (profileData.addons && profileData.addons.length > 0) {
            setServiceFee(pickServiceFeeAddon(profileData.addons));
          }
        }
      } catch (error) {
        toast.error("Error fetching profile data");
      }
    };

    fetchProfileData();
  }, []);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const validateFirstName = (firstName) => {
    if (!firstName.trim()) return "First name is required";
    if (firstName.startsWith(" ")) return "First name cannot start with a space";
    if (firstName.length < 2 || firstName.length > 20)
      return "First name must be between 2 and 20 characters";
    if (!/^[a-zA-Z\s'-]+$/.test(firstName))
      return "First name can only contain letters, spaces, hyphens, and apostrophes";
    return "";
  };

  const validateLastName = (lastName) => {
    if (lastName.trim() === "") return "";

    if (lastName.startsWith(" ")) return "Last name cannot start with a space";
    if (lastName.length > 20)
      return "Last name must be less than 20 characters";
    if (!/^[a-zA-Z\s'-]+$/.test(lastName))
      return "Last name can only contain letters, spaces, hyphens, and apostrophes";
    return "";
  };

  const validateEmail = (email) => {
    const trimmed = email.trim();
    if (!trimmed) return "Email is required";
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) return "Please enter a valid email address";
    return "";
  };

  const handleEmailChange = (e) => {
    const { value } = e.target;
    setData((prevData) => ({ ...prevData, email: value }));
    const emailError = validateEmail(value);
    setErrors((prevErrors) => ({ ...prevErrors, email: emailError }));
  };

  const validatePhone = (phoneNumber) => {
    const phoneRegex = /^[0-9]+$/;
    if (!phoneNumber) return "Phone number is required";
    if (phoneNumber.length < 8 || phoneNumber.length > 15)
      return "Phone number must be between 8 and 15 digits";
    if (!phoneRegex.test(phoneNumber))
      return "Phone number must contain only numbers";
    return "";
  };

  const validateAdminCommission = (commission) => {
    if (!commission && commission !== 0) return "Admin Commission is required";

    const numberRegex = /^[0-9]+$/;
    if (!numberRegex.test(commission))
      return "Admin Commission must contain only numbers";

    const commissionNum = parseInt(commission, 10);
    if (isNaN(commissionNum)) return "Admin Commission must be a valid number";
    if (commissionNum <= 0) return "Admin Commission must be greater than 0";
    if (commissionNum > 99)
      return "Admin Commission must be between 1 and 99";

    return "";
  };

  const handleFirstNameChange = (e) => {
    const { value } = e.target;
    setData((prevData) => ({ ...prevData, firstName: value }));
    const firstNameError = validateFirstName(value);
    setErrors((prevErrors) => ({ ...prevErrors, firstName: firstNameError }));
  };

  const handleLastNameChange = (e) => {
    const { value } = e.target;
    setData((prevData) => ({ ...prevData, lastName: value }));
    const lastNameError = validateLastName(value);
    setErrors((prevErrors) => ({ ...prevErrors, lastName: lastNameError }));
  };

  const handlePhoneChange = (e) => {
    const { value } = e.target;
    setData((prevData) => ({ ...prevData, phoneNumber: value }));
    const phoneError = validatePhone(value);
    setErrors((prevErrors) => ({ ...prevErrors, phoneNumber: phoneError }));
  };

  const handleAdminCommissionChange = (e) => {
    const { value } = e.target;

    const cleanedValue = value.replace(/\s/g, "");

    if (cleanedValue === "" || /^[0-9]+$/.test(cleanedValue)) {
      setData((prevData) => ({ ...prevData, adminCommission: cleanedValue }));
      const commissionError = validateAdminCommission(cleanedValue);
      setErrors((prevErrors) => ({
        ...prevErrors,
        adminCommission: commissionError,
      }));
    }
  };


  const handleSubmit = async (e) => {
    e.preventDefault();

    console.log("Form submitted");

    let formErrors = {};

    

    const firstNameError = validateFirstName(data.firstName);
    const lastNameError = validateLastName(data.lastName);
    const emailError = validateEmail(data.email);
    const phoneError = validatePhone(data.phoneNumber);
    const commissionError = validateAdminCommission(data.adminCommission);

    if (firstNameError) formErrors.firstName = firstNameError;
    if (lastNameError) formErrors.lastName = lastNameError;
    if (emailError) formErrors.email = emailError;
    if (phoneError) formErrors.phoneNumber = phoneError;
    if (commissionError) formErrors.adminCommission = commissionError;

    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors);
      return;
    }
 console.log("Validation passed, proceeding to API call");
    const token = localStorage.getItem("admin_token");
    console.log("Token exists:", token);
    if (!token) {
      toast.error("No token found. Please log in again.");
      return;
    }

    const formData = new FormData();
    formData.append("firstName", data.firstName);
    formData.append("lastName", data.lastName);
    formData.append("email", data.email);
    formData.append("phoneNumber", data.phoneNumber);
    formData.append("adminCommission", data.adminCommission);
    if (selectedImage) {
      formData.append("image", selectedImage);
    }
    formData.append("addOns", JSON.stringify([serviceFee]));

    try {
      const response = await axiosInstance.post(`/updateprofile`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });

      const updatedData = response.data.body;
      const emailChanged = Boolean(
        updatedData.emailChanged ||
        data.email.trim().toLowerCase() !== initialEmail.trim().toLowerCase()
      );

      if (emailChanged) {
        localStorage.removeItem("admin_token");
        localStorage.removeItem("admin_userData");
        toast.success("Email updated successfully. Please log in with your new email.");
        navigate("/admin/", {
          replace: true,
          state: { email: updatedData.email || data.email.trim() },
        });
        return;
      }

      if (updatedData.name) {
        const nameParts = updatedData.name.trim().split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        setData(prev => ({
          ...prev,
          ...updatedData,
          firstName,
          lastName
        }));
      } else {
        setData(prev => ({
          ...prev,
          ...updatedData,
          lastName: updatedData.lastName || ""
        }));
      }

      if (updatedData.image) {
        const imageUrl = updatedData.image.startsWith("http")
          ? updatedData.image
          : `${BASE_URL}/${updatedData.image}`;
        setImagePreview(imageUrl);
      }

      if (updatedData.addons && updatedData.addons.length > 0) {
        setServiceFee(pickServiceFeeAddon(updatedData.addons));
      }

      toast.success("Profile updated successfully");
      navigate("/admin/profile", { state: { updated: true } });
    } catch (error) {
      console.error("Update error:", error);

      if (error.response) {
        if (error.response.status === 400) {
          toast.error("Invalid data. Please check your inputs.");
        } else if (error.response.status === 401) {
          toast.error("Session expired. Please log in again.");
        } else {
          toast.error(`Error updating profile: ${error.response.data?.message || 'Unknown error'}`);
        }
      } else {
        toast.error("Network error. Please check your connection.");
      }
    }
  };

  return (
    <>
      <ToastContainer autoClose={8182} />

      <div id="layout-wrapper">
        <div className="main-content">
          <div className="page-content">
            <div className="container-fluid">
              <div className="title-box mb-3 pb-1">
                <h4 className="mb-0 page-title">Edit Profile</h4>
              </div>
              <div className="row justify-content-center">
                <div className="col-lg-12">
                  <div className="card">
                    <div className="card-body">
                      <div className="text-center mb-4">
                        <div className="position-relative d-inline-block">
                          <img
                            src={imagePreview || ""}
                            style={{
                              width: 200,
                              height: 200,
                              objectFit: "cover",
                              borderRadius: "20%",
                            }}
                            alt="Profile"
                          />
                          <input
                            type="file"
                            accept="image/*"
                            id="fileInput"
                            style={{ display: "none" }}
                            onChange={handleImageChange}
                          />
                          <label
                            htmlFor="fileInput"
                            className="position-absolute bottom-0 end-0 bg-primary text-white rounded-circle p-2"
                            style={{ cursor: "pointer" }}
                          >
                            <Pencil size={20} />
                          </label>
                        </div>
                      </div>
                      <form onSubmit={handleSubmit}>
                        <div className="row">
                          <div className="mb-3 col-6">
                            <label className="mb-1 fw-medium">First Name*</label>
                            <input
                              type="text"
                              className="form-control"
                              name="firstName"
                              value={data.firstName}
                              onChange={handleFirstNameChange}
                              maxLength={20}
                              placeholder="Enter first name"
                            />
                            {errors.firstName && (
                              <div className="text-danger">{errors.firstName}</div>
                            )}
                          </div>

                          <div className="mb-3 col-6">
                            <label className="mb-1 fw-medium">Last Name (Optional)*</label>
                            <input
                              type="text"
                              className="form-control"
                              name="lastName"
                              value={data.lastName}
                              onChange={handleLastNameChange}
                              maxLength={20}
                              placeholder="Enter last name (optional)"
                            />
                            {errors.lastName && (
                              <div className="text-danger">{errors.lastName}</div>
                            )}
                          </div>
                        </div>

                        <div className="row">
                          <div className="mb-3 col-12">
                            <label className="mb-1 fw-medium">Email</label>
                            <input
                              type="email"
                              className="form-control"
                              name="email"
                              value={data.email}
                              onChange={handleEmailChange}
                              placeholder="Enter email address"
                            />
                            {errors.email && (
                              <div className="text-danger">{errors.email}</div>
                            )}
                          </div>
                        </div>

                        <div className="mb-3 row">
                          <div className="col-2">
                            <label className="mb-1 fw-medium">
                              Country Code
                            </label>
                            <input
                              type="text"
                              className="form-control"
                              name="countryCode"
                              value={data.countryCode}
                              disabled
                            />
                          </div>
                          <div className="col-10">
                            <label className="mb-1 fw-medium">Phone*</label>
                            <input
                              type="text"
                              className="form-control"
                              name="phoneNumber"
                              value={data.phoneNumber}
                              onChange={handlePhoneChange}
                              placeholder="Enter phone number"
                            />
                            {errors.phoneNumber && (
                              <div className="text-danger">
                                {errors.phoneNumber}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="row">
                          <div className="col-md-6" style={{ marginBottom: "16px" }}>
                            <label htmlFor="adminCommission" className="mb-1 fw-medium">
                              Admin Commission*
                            </label>
                            <div className="input-group">
                              <input
                                type="text"
                                className="form-control"
                                name="adminCommission"
                                value={data.adminCommission}
                                onChange={handleAdminCommissionChange}
                                placeholder="Enter commission between 0-99"
                                maxLength={2}
                              />
                              <span className="input-group-text">%</span>
                            </div>
                            {errors.adminCommission && (
                              <div className="text-danger">
                                {errors.adminCommission}
                              </div>
                            )}
                          </div>
                          
                        </div>
                        <div className="form-text mb-3">
                          Commission must be a number between 1 and 99 (no
                          spaces or special characters allowed)
                        </div>

                        <div className="mt-4 mb-4">
                          <h5 className="mb-3">Fees Setting</h5>
                          <div className="row">
                            <div className="col-md-4 mb-3">
                              <label className="mb-1 fw-medium">Service fee (%)*</label>
                              <div className="input-group">
                                <input
                                  type="text"
                                  className="form-control"
                                  value={serviceFee.price_in_percent}
                                  onChange={(e) => {
                                    const newValue = e.target.value.replace(/[^\d.]/g, "");
                                    setServiceFee((prev) => ({
                                      ...prev,
                                      price_in_percent: newValue,
                                    }));
                                  }}
                                  placeholder="0.00"
                                />
                                <span className="input-group-text">%</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="text-end mb-2">
                          <button
                            type="submit"
                            className="btn btn-primary px-4"
                          >
                            Update
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Profile;