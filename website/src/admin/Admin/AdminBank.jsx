import { ADMIN_BASE } from "../adminBase";
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast, ToastContainer } from "react-toastify";
import { axiosInstance } from "../Config";

const AdminBank = () => {
  const [data, setData] = useState({
    accountType: "1",
    bankName: "",
    accountCountry: "",
    currency: "",
    sortCode: "",
    accountNumber: "",
    accountOwnerInfo: "1",
    holderName: "",
    city: "",
    address: "",
    postalCode: "",
    isDefault: "0",
  });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchBankData = async () => {
      setLoading(true);
      const token = localStorage.getItem("admin_token");
      if (!token) {
        toast.error("No token found. Please log in again.");
        setLoading(false);
        return;
      }

      try {
        const response = await axiosInstance.get(`/bankdetails`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.data && response.data.body) {
          const bankData = response.data.body.bankuser || {};

          const stringifiedBankData = Object.fromEntries(
            Object.entries(bankData).map(([key, value]) => [
              key,
              value !== null && value !== undefined ? String(value) : "",
            ])
          );

          setData((prevData) => ({
            ...prevData,
            ...stringifiedBankData,
          }));
        }
      } catch (error) {
        toast.error("Error fetching bank details");
      }
      setLoading(false);
    };

    fetchBankData();
  }, []);

  const safeTrim = (value) => {
    if (typeof value === "string") {
      return value.trim();
    }
    if (value === null || value === undefined) {
      return "";
    }
    return String(value).trim();
  };

  const validateField = (name, value) => {
    const stringValue = String(value);
    const trimmedValue = safeTrim(stringValue);

    if (["accountType", "accountOwnerInfo", "isDefault"].includes(name)) {
      return "";
    }

    if (!trimmedValue) {
      return `${name
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (str) => str.toUpperCase())} is required`;
    }

    if (/^\s+$/.test(stringValue)) {
      return "Only spaces are not allowed. Please enter valid text";
    }

    if (stringValue.length > 60) {
      return `Maximum 60 characters allowed`;
    }

    switch (name) {
      case "bankName":
        if (trimmedValue.length < 2)
          return "Bank name must be at least 2 characters";
        return "";

      case "accountNumber":
        if (!/^\d+$/.test(trimmedValue))
          return "Account number must contain only numbers";
        if (trimmedValue.length < 5 || trimmedValue.length > 20)
          return "Account number must be between 5 and 20 digits";
        return "";

      case "holderName":
        if (trimmedValue.length < 2)
          return "Holder name must be at least 2 characters";
        return "";

      case "sortCode":
        if (!/^[A-Za-z0-9]+$/.test(trimmedValue))
          return "Sort code must be alphanumeric";
        return "";

      case "postalCode":
        if (trimmedValue.length < 3)
          return "Postal code must be at least 3 characters";
        return "";

      case "accountCountry":
        if (trimmedValue.length < 2)
          return "Country must be at least 2 characters";
        return "";

      case "currency":
        if (trimmedValue.length !== 3)
          return "Currency must be 3 characters (e.g., USD, EUR)";
        if (!/^[A-Z]{3}$/.test(trimmedValue))
          return "Currency must be 3 uppercase letters (e.g., USD, EUR)";
        return "";

      case "city":
        if (trimmedValue.length < 2)
          return "City must be at least 2 characters";
        return "";

      case "address":
        if (trimmedValue.length < 5)
          return "Address must be at least 5 characters";
        return "";

      default:
        return "";
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (value.length > 60 && !["accountNumber", "postalCode"].includes(name)) {
      return;
    }

    setData((prevData) => ({
      ...prevData,
      [name]: value,
    }));

    if (touched[name] || errors[name]) {
      const error = validateField(name, value);
      setErrors((prevErrors) => ({
        ...prevErrors,
        [name]: error,
      }));
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;

    setTouched((prevTouched) => ({
      ...prevTouched,
      [name]: true,
    }));

    const error = validateField(name, value);
    setErrors((prevErrors) => ({
      ...prevErrors,
      [name]: error,
    }));
  };

  const handleKeyPress = (e) => {
    if (e.key === " " && !e.target.value.trim()) {
      e.preventDefault();
    }
  };



  const handleSubmit = async (e) => {
    e.preventDefault();

    const token = localStorage.getItem("admin_token");
    if (!token) {
      toast.error("No token found. Please log in again.");
      return;
    }

    try {
      setLoading(true);
      await axiosInstance.post(`/updatebank`, data, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      toast.success("Bank details updated successfully");
      navigate(`${ADMIN_BASE}/bankdetail`);
    } catch (error) {
      toast.error("Error updating bank details");
    }
    setLoading(false);
  };

  const shouldShowError = (fieldName) => {
    return touched[fieldName] && errors[fieldName];
  };

  return (
    <>
      <ToastContainer autoClose={3000} />

      <div id="layout-wrapper">
        <div className="main-content">
          <div className="page-content">
            <div className="container-fluid">
              <div className="title-box mb-3 pb-1">
                <h4 className="mb-0 page-title">Admin Bank Details</h4>
              </div>
              <div className="row justify-content-center">
                <div className="col-lg-12">
                  <div className="card">
                    <div className="card-body">
                      <form onSubmit={handleSubmit} noValidate>
                        <div className="row">
                          <div className="col-md-4 mb-3">
                            <label className="mb-1 fw-medium">
                              Account Type
                            </label>
                            <select
                              className="form-select"
                              name="accountType"
                              value={data.accountType}
                              onChange={handleChange}
                            >
                              <option value="1">Saving Account</option>
                              <option value="0">Current Account</option>
                            </select>
                          </div>

                          <div className="col-md-4 mb-3">
                            <label className="mb-1 fw-medium">Bank Name</label>
                            <input
                              type="text"
                              className={`form-control ${
                                shouldShowError("bankName") ? "is-invalid" : ""
                              }`}
                              name="bankName"
                              value={data.bankName}
                              onChange={handleChange}
                              onBlur={handleBlur}
                              onKeyPress={handleKeyPress}
                              maxLength={60}
                              placeholder="Enter bank name (max 60 characters)"
                            />
                            {shouldShowError("bankName") && (
                              <div className="invalid-feedback d-block">
                                {errors.bankName}
                              </div>
                            )}
                            <div className="text-end small text-muted">
                              {data.bankName.length}/60
                            </div>
                          </div>

                          <div className="col-md-4 mb-3">
                            <label className="mb-1 fw-medium">
                              Account Country
                            </label>
                            <input
                              type="text"
                              className={`form-control ${
                                shouldShowError("accountCountry")
                                  ? "is-invalid"
                                  : ""
                              }`}
                              name="accountCountry"
                              value={data.accountCountry}
                              onChange={handleChange}
                              onBlur={handleBlur}
                              onKeyPress={handleKeyPress}
                              maxLength={60}
                              placeholder="Enter country (max 60 characters)"
                            />
                            {shouldShowError("accountCountry") && (
                              <div className="invalid-feedback d-block">
                                {errors.accountCountry}
                              </div>
                            )}
                            <div className="text-end small text-muted">
                              {data.accountCountry.length}/60
                            </div>
                          </div>
                        </div>

                        <div className="row">
                          <div className="col-md-6 mb-3">
                            <label className="mb-1 fw-medium">Currency</label>
                            <input
                              type="text"
                              className={`form-control ${
                                shouldShowError("currency") ? "is-invalid" : ""
                              }`}
                              name="currency"
                              value={data.currency}
                              onChange={handleChange}
                              onBlur={handleBlur}
                              onKeyPress={handleKeyPress}
                              maxLength={3}
                              placeholder="USD, EUR, etc. (3 characters)"
                              style={{ textTransform: "uppercase" }}
                            />
                            {shouldShowError("currency") && (
                              <div className="invalid-feedback d-block">
                                {errors.currency}
                              </div>
                            )}
                            <div className="text-end small text-muted">
                              {data.currency.length}/3
                            </div>
                          </div>

                          <div className="col-md-6 mb-3">
                            <label className="mb-1 fw-medium">Sort Code</label>
                            <input
                              type="text"
                              className={`form-control ${
                                shouldShowError("sortCode") ? "is-invalid" : ""
                              }`}
                              name="sortCode"
                              value={data.sortCode}
                              onChange={handleChange}
                              onBlur={handleBlur}
                              onKeyPress={handleKeyPress}
                              maxLength={60}
                              placeholder="Enter sort code (max 60 characters)"
                            />
                            {shouldShowError("sortCode") && (
                              <div className="invalid-feedback d-block">
                                {errors.sortCode}
                              </div>
                            )}
                            <div className="text-end small text-muted">
                              {data.sortCode.length}/60
                            </div>
                          </div>
                        </div>

                        <div className="row">
                          <div className="col-md-4 mb-3">
                            <label className="mb-1 fw-medium">
                              Account Number
                            </label>
                            <input
                              type="text"
                              className={`form-control ${
                                shouldShowError("accountNumber")
                                  ? "is-invalid"
                                  : ""
                              }`}
                              name="accountNumber"
                              value={data.accountNumber}
                              onChange={handleChange}
                              onBlur={handleBlur}
                              onKeyPress={handleKeyPress}
                              maxLength={20}
                              placeholder="Enter account number"
                            />
                            {shouldShowError("accountNumber") && (
                              <div className="invalid-feedback d-block">
                                {errors.accountNumber}
                              </div>
                            )}
                            <div className="text-end small text-muted">
                              {data.accountNumber.length}/20
                            </div>
                          </div>

                          <div className="col-md-4 mb-3">
                            <label className="mb-1 fw-medium">
                              Account Holder Name
                            </label>
                            <input
                              type="text"
                              className={`form-control ${
                                shouldShowError("holderName")
                                  ? "is-invalid"
                                  : ""
                              }`}
                              name="holderName"
                              value={data.holderName}
                              onChange={handleChange}
                              onBlur={handleBlur}
                              onKeyPress={handleKeyPress}
                              maxLength={60}
                              placeholder="Enter holder name (max 60 characters)"
                            />
                            {shouldShowError("holderName") && (
                              <div className="invalid-feedback d-block">
                                {errors.holderName}
                              </div>
                            )}
                            <div className="text-end small text-muted">
                              {data.holderName.length}/60
                            </div>
                          </div>

                          <div className="col-md-4 mb-3">
                            <label className="mb-1 fw-medium">City</label>
                            <input
                              type="text"
                              className={`form-control ${
                                shouldShowError("city") ? "is-invalid" : ""
                              }`}
                              name="city"
                              value={data.city}
                              onChange={handleChange}
                              onBlur={handleBlur}
                              onKeyPress={handleKeyPress}
                              maxLength={60}
                              placeholder="Enter city (max 60 characters)"
                            />
                            {shouldShowError("city") && (
                              <div className="invalid-feedback d-block">
                                {errors.city}
                              </div>
                            )}
                            <div className="text-end small text-muted">
                              {data.city.length}/60
                            </div>
                          </div>
                        </div>

                        <div className="row">
                          <div className="col-md-6 mb-3">
                            <label className="mb-1 fw-medium">Address</label>
                            <input
                              type="text"
                              className={`form-control ${
                                shouldShowError("address") ? "is-invalid" : ""
                              }`}
                              name="address"
                              value={data.address}
                              onChange={handleChange}
                              onBlur={handleBlur}
                              onKeyPress={handleKeyPress}
                              maxLength={60}
                              placeholder="Enter address (max 60 characters)"
                            />
                            {shouldShowError("address") && (
                              <div className="invalid-feedback d-block">
                                {errors.address}
                              </div>
                            )}
                            <div className="text-end small text-muted">
                              {data.address.length}/60
                            </div>
                          </div>

                          <div className="col-md-6 mb-3">
                            <label className="mb-1 fw-medium">
                              Postal Code
                            </label>
                            <input
                              type="text"
                              className={`form-control ${
                                shouldShowError("postalCode")
                                  ? "is-invalid"
                                  : ""
                              }`}
                              name="postalCode"
                              value={data.postalCode}
                              onChange={handleChange}
                              onBlur={handleBlur}
                              onKeyPress={handleKeyPress}
                              maxLength={20}
                              placeholder="Enter postal code"
                            />
                            {shouldShowError("postalCode") && (
                              <div className="invalid-feedback d-block">
                                {errors.postalCode}
                              </div>
                            )}
                            <div className="text-end small text-muted">
                              {data.postalCode.length}/20
                            </div>
                          </div>
                        </div>

                        <div className="text-end mb-2">
                          <button
                            type="submit"
                            className="btn btn-primary px-4"
                            disabled={loading}
                          >
                            {loading ? "Updating..." : "Update Bank Details"}
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

export default AdminBank;
