import React, { useState, useEffect } from "react";
import Commonbanner from "../components/Commonbanner";
import { green } from "../common/common-assets/assets-images";
import { getEarnings } from "../api/cms";
import moment from "moment";
import { Loader2 } from "lucide-react";

const Earning = () => {
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState([]);
  const [stats, setStats] = useState({
    grossEarning: 0,
    totalPayout: 0
  });

  useEffect(() => {
    const fetchEarnings = async () => {
      try {
        const res = await getEarnings();
        if (res?.status) {
          const fetchedBookings = res.body || [];
          setBookings(fetchedBookings);

          // Calculate stats based on amount
          const gross = fetchedBookings.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
          setStats({
            grossEarning: gross,
            totalPayout: gross // Assuming total payout for now is the same as gross
          });
        }
      } catch (error) {
        console.error("Error fetching earnings:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchEarnings();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#1f3b2f] to-[#0b1a14] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-yellow-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1f3b2f] to-[#0b1a14]">
      <Commonbanner title="Payment & Earning" />
      <div className="md:px-4 px-0 py-10">
        <div className="container mx-auto">
          <div className="bg-[#2D413F] rounded-3xl p-4 md:p-8 grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* LEFT SIDE */}
            <div>
              <div className="w-full lg:max-w-[440px]">
                <div className="bg-white rounded-2xl p-6 mb-6">
                  <p className="md:text-[25px] text-[20px] text-black font-semibold text-center">Gross Earning</p>
                  <h2 className="md:text-[55px] text-[25px] font-semibold text-center text-[#FCC604] mt-2">
                    ${stats.grossEarning.toFixed(2)}
                  </h2>
                </div>
                <div className="grid md:grid-cols-2 grid-cols-1 gap-4">
                  <div className="bg-[#354e48] rounded-xl p-4 text-center">
                    <p className="text-lg text-white/70">Total Transactions</p>
                    <p className="text-white font-semibold mt-2 md:text-[24px] text-[18px]">{bookings.length}</p>
                  </div>

                  <div className="bg-[#354e48] rounded-xl p-4 text-center">
                    <p className="text-lg text-white/70">Total Payout</p>
                    <p className="text-white font-semibold mt-2 md:text-[24px] text-[18px]">${stats.totalPayout.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT SIDE */}
            <div>
              <h3 className="text-white text-[23px] font-semibold mb-4">Transactions</h3>

              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                {bookings.length > 0 ? (
                  bookings.map((item) => (
                    <div key={item.id} className="flex items-center justify-between border-b border-white/10 pb-4 md:px-7 px-2">
                      <div className="flex items-start gap-3">
                        <div className="flex items-center justify-center flex-col">
                          <img src={green} alt="success" />
                          <p className="m-0 text-[8px] text-white mt-1 font-medium">
                            {moment(item.createdAt).format("DD MMM YYYY")}
                          </p>
                        </div>
                        <div>
                          <p className="text-white font-medium text-lg mt-1">Paid Online</p>
                          <p className="text-xs text-white/60">
                            Order ID: {item.booking?.orderId}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-white font-semibold md:text-lg text-md">
                          ${parseFloat(item.amount || 0).toFixed(2)}
                        </p>
                        <p className="text-xs text-white/60">Credit</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-10 opacity-50">
                    <p className="text-white">No transactions found</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Earning;
