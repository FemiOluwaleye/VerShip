import React from "react";
import { logout } from "../common/common-assets/assets-images";
import { Modal, Box, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { logoutAPI } from "../api/cms";

const style = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: "90%",
  maxWidth: 400,
  bgcolor: "#fff",
  borderRadius: "35px",
  boxShadow: 24,
  p: 4,
  outline: "none",
};

const Logout = ({ isLogoutOpen, onClose }) => {

  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logoutAPI();
    } catch (error) {
      console.error("Logout API failed:", error);
    } finally {
      localStorage.clear();
      onClose();
      console.log("Logout successful, redirecting to home...");
      // Hard redirect to the app root to ensure all state is cleared
      const homePath = window.location.pathname.includes("/dev/shipone/website/dist")
        ? "/dev/shipone/website/dist/"
        : "/";
      window.location.href = homePath;
    }
  }
  return (
    <Modal
      open={isLogoutOpen}        // ✅ FIXED
      onClose={onClose}    // ✅ FIXED
      sx={{
        backdropFilter: "blur(2px)",
        backgroundColor: "rgba(0,0,0,0.7)",
      }}
    >
      <Box sx={style} className="flex flex-col items-center">
        <img src={logout} className="mb-4 w-[80px] h-[80px]" alt="logout" />

        <Typography variant="h6" fontWeight="bold" mb={1}>
          Logout
        </Typography>

        <Typography
          variant="body2"
          textAlign="center"
          color="text.secondary"
        >
          Are you sure you want to Log out of this account?
        </Typography>

        <div className="flex items-center justify-center w-full mt-3 sm:mt-5 xl:mt-10 gap-3">
          <button onClick={handleLogout}
            type="submit"
            className="bg-[linear-gradient(180deg,#FFBF00_0%,#FFD864_100%)]
              text-black font-bold text-[17px] sm:text-[19px]
              rounded-full
              h-[60px] w-full
              transition-all"
          >
            Yes
          </button>
          <button onClick={() => onClose()}
            type="submit"
            className="bg-black/10
              text-black font-bold text-[17px] sm:text-[19px]
              rounded-full
              h-[60px] w-full
              transition-all"
          >
            No
          </button>
        </div>
      </Box>
    </Modal>
  );
};

export default Logout;
