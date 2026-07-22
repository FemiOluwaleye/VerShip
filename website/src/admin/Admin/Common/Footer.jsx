import { ADMIN_BASE } from "../../adminBase";
import React from "react";
import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <footer
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",

        backgroundColor: "#f5f5f5",
        color: "#666",
        textAlign: "center",
        fontSize: "14px",
      }}
    >
      <span>
        Copyright © 2025 Designed by{" "}
        <Link
          to={`${ADMIN_BASE}/dashboard`}
          rel="nofollow noopener noreferrer"
          title="VerShip"
          style={{ textDecoration: "none", color: "#1e3308" }}
        >
          VerShip
        </Link>
        . All rights reserved.
      </span>
    </footer>
  );
};

export default Footer;
