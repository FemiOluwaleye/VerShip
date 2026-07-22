import { ADMIN_BASE } from "./adminBase";
import React from "react";
import { Navigate } from "react-router-dom";

const PrivateRoute = ({ element, requiredRole = null }) => {
  const isAuthenticated = localStorage.getItem("admin_token");
  
  if (!isAuthenticated) {
    return <Navigate to={`${ADMIN_BASE}/login`} replace />;
  }

  if (requiredRole !== null) {
    const userData = JSON.parse(localStorage.getItem("admin_userData") || "{}");
    if (userData.role !== requiredRole) {
      return <Navigate to={`${ADMIN_BASE}/dashboard`} replace />;
    }
  }

  return element;
};

export default PrivateRoute;