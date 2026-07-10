import React, { useEffect, useState } from "react";
import Commonbanner from "../components/Commonbanner";
import { useNavigate } from "react-router-dom";
import { getBookings as getBookingsAPI } from "../api/cms";
import { pdf, file as fileIcon } from "../common/common-assets/assets-images";
import { API_URL } from "../api/axios";

const Request = () => {
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adminCommission, setAdminCommission] = useState(0);
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const role = Number(user?.role); // 👈 ensure number
  /* ---------- FETCH BOOKINGS ---------- */
  const fetchBookings = async () => {
    try {
      const res = await getBookingsAPI();
      console.log("Get bookings response:", res.body);

      if (res?.status) {
        const bookingsData = res.body?.bookings || [];
        const filteredRequests = bookingsData.filter(item => String(item.status) === "0");
        setRequests(filteredRequests);
        console.log("adminCommission", res.body?.adminCommission);

        setAdminCommission(res.body?.adminCommission || 0);
      }
    } catch (error) {
      console.error("Get bookings error:", error);
    } finally {
      setLoading(false);
    }
  };

  /* ---------- ROLE CHECK ---------- */
  useEffect(() => {
    if (role === 2) {
      fetchBookings();
    }
  }, [role]);
  useEffect(() => {
    // if user not logged in
    if (!user) {
      navigate("/");
    }
  }, [navigate]);

  /* ---------- BLOCK OTHER ROLES ---------- */
  if (role !== 2) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1f3b2f] to-[#0b1a14]">
      <Commonbanner title="Requests" />

      <div className="py-12">
        <div className="space-y-5 container mx-auto">

          {loading && (
            <p className="text-white text-center">Loading requests...</p>
          )}

          {!loading && requests.length === 0 && (
            <p className="text-white text-center">No requests found</p>
          )}

          {requests.map((item) => {
            const firstName = item?.userbook?.firstName || "";
            const lastName = item?.userbook?.lastName || "";
            const userName = `${firstName}`.trim() || "Unknown User";

            return (
              <div
                key={item.id}
                onClick={() => navigate("/businessdetail", { state: { ...item, adminCommission } })}
                className="bg-[#2D413F] cursor-pointer rounded-xl px-6 py-4 flex items-center justify-between flex-col-reverse lg:flex-row shadow-lg"
              >
                <div className="flex items-center gap-4 w-full">

                  {/* Avatar */}
                  <div className="w-[92px] h-[92px] rounded-full bg-[#FFC928] flex items-center justify-center text-black text-[32px] font-bold overflow-hidden">
                    {/* {item?.userbook?.image ? (
                      <img
                        src={`${API_URL}${item.userbook.image}`}
                        alt={userName}
                        className="w-full h-full object-cover"
                      />
                    ) : ( */}
                    {userName
                      .split(" ")
                      .map(w => w[0])
                      .join("")
                      .slice(0, 2)}
                    {/* )} */}
                  </div>

                  {/* Info */}
                  <div className="flex-1">
                    <div className="flex justify-between items-start flex-wrap gap-2">
                      <h3 className="text-white font-bold text-[20px]">
                        {userName}
                      </h3>
                      <span className="bg-yellow-400/10 border border-yellow-400/50 rounded-lg px-4 py-1 text-yellow-500 text-sm font-bold">
                        {item?.bookingRequest?.items?.[0]?.item_type || "Parcel"}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 mt-3">
                      <p className="text-white/60 text-sm flex items-center gap-2">
                        <span className="text-yellow-400 font-bold uppercase text-[10px] tracking-wider">Origin:</span>
                        <span className="text-white">{item?.bookingRequest?.origin || "N/A"}</span>
                      </p>
                      <p className="text-white/60 text-sm flex items-center gap-2">
                        <span className="text-yellow-400 font-bold uppercase text-[10px] tracking-wider">Dest:</span>
                        <span className="text-white">{item?.bookingRequest?.destination || "N/A"}</span>
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 mt-4">
                      <div className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-xs">
                        <span className="text-white/40 block uppercase text-[8px] mb-1">Quantity</span>
                        <span className="text-white font-bold">{item?.bookingRequest?.quantity || 0}</span>
                      </div>

                      {item?.bookingRequest?.items?.[0]?.sub_type && (
                        <div className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-xs">
                          <span className="text-white/40 block uppercase text-[8px] mb-1">Service</span>
                          <span className="text-white font-bold truncate max-w-[150px]">{item?.bookingRequest?.items?.[0]?.sub_type}</span>
                        </div>
                      )}

                      <div className="ms-auto flex items-center gap-3">
                        <span className="text-white/40 text-xs">Booking Price:</span>
                        <span className="bg-yellow-400 text-black px-4 py-2 rounded-lg font-bold text-lg shadow-[0_0_15px_rgba(255,184,0,0.3)]">
                          ${item?.total_amount || 0}
                        </span>
                      </div>
                    </div>

                    {/* Document Preview */}
                    {/* <div className="mt-4">
                      {item.document ? (
                        <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
                          <div className="w-10 h-10 rounded overflow-hidden flex items-center justify-center bg-black/20 flex-shrink-0">
                            {item.document.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                              <img src={`${API_URL}${item.document}`} alt="Document" className="w-full h-full object-cover" />
                            ) : item.document.endsWith('.pdf') ? (
                              <img src={pdf} alt="PDF" className="w-8 h-8 object-contain" />
                            ) : (
                              <img src={fileIcon} alt="File" className="w-8 h-8 object-contain" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-white/40 block uppercase text-[8px] mb-1">Document</span>
                            <span className="text-white text-xs truncate block">{item.document.split('/').pop()}</span>
                          </div>
                          <a
                            href={`${API_URL}${item.document}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="bg-yellow-400 text-black text-xs px-3 py-1 rounded font-bold flex-shrink-0"
                          >
                            View
                          </a>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 bg-white/5 border border-dashed border-white/10 rounded-lg px-3 py-2">
                          <img src={fileIcon} alt="No document" className="w-8 h-8 opacity-20" />
                          <span className="text-white/30 text-xs">No document uploaded</span>
                        </div>
                      )}
                    </div> */}

                  </div>

                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Request;
