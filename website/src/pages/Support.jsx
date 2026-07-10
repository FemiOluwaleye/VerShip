import React, { useState } from "react";
import Commonbanner from "../components/Commonbanner";

const Support = () => {
  const [issueType, setIssueType] = useState("Shipping Delay");

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#2C4736] to-[#09120F]">
      <Commonbanner title="Send us an Email" />

      <div className="flex justify-center items-center py-16 px-4">
        <div className="w-full max-w-[700px] bg-[#2D413F] rounded-2xl p-8 shadow-xl text-white">

          {/* Title */}
          <h3 className="text-center text-[20px] font-semibold mb-6">
            Send us your query and we’ll get back to you
          </h3>
        <div className="max-w-[400px] mx-auto">
          {/* Issue Type */}
          <div className="mb-5">
            <label className="text-sm font-medium mb-2 block">Issue Type</label>
            <div className="border border-[#4E6B5D] rounded-xl p-4 space-y-2">
              {[
                "Shipping Delay",
                "Wrong Delivery",
                "Damaged Package",
                "Refund Request",
                "Account Issue",
                "Other",
              ].map((item, index) => (
                <label
                  key={index}
                  className="flex items-center gap-3 cursor-pointer text-sm"
                >
                  <input
                    type="radio"
                    name="issue"
                    value={item}
                    checked={issueType === item}
                    onChange={() => setIssueType(item)}
                    className="accent-[#FFC928]"
                  />
                  {item}
                </label>
              ))}
            </div>
          </div>

          {/* Subject */}
          <div className="mb-4">
            <label className="text-sm font-medium mb-1 block">Subject</label>
            <input
              type="text"
              placeholder="Package not delivered"
              className="w-full bg-transparent border border-[#4E6B5D] rounded-xl px-4 py-3 text-sm text-white placeholder-gray-400 focus:outline-none"
            />
          </div>

          {/* Message */}
          <div className="mb-4">
            <label className="text-sm font-medium mb-1 block">Message</label>
            <textarea
              rows="4"
              placeholder="Describe your issue here..."
              className="w-full bg-transparent border border-[#4E6B5D] rounded-xl px-4 py-3 text-sm text-white placeholder-gray-400 focus:outline-none resize-none"
            />
          </div>

          {/* Attachment */}
          <div className="mb-6 text-sm text-gray-300 flex items-center gap-2 cursor-pointer">
            <i className="fa-solid fa-paperclip"></i>
            Attachment (Optional)
          </div>

          {/* Submit */}
          <div className="text-center mt-15">
          <button className=" bg-gradient-to-r from-[#FFB800] via-[#FFD24D] to-[#FFE58F] text-black font-semibold py-3 px-20 rounded-full hover:brightness-110 transition">
            Submit
          </button>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Support;
