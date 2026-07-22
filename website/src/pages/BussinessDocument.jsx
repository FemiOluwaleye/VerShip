import React, { useState, useEffect } from "react";
import { shipp, submit } from "../common/common-assets/assets-images";
import { useNavigate } from "react-router-dom";
import { completeProfile } from "../api/cms";
import { toast } from "sonner";
import { FaSpinner, FaFilePdf, FaImage } from "react-icons/fa";

const BusinessDocument = () => {
  const [showModal, setShowModal] = useState(false);
  const [files, setFiles] = useState({
    certificateOfIncorporation: null,
    validId: null,
    utilityBill: null,
  });
  const [previews, setPreviews] = useState({
    certificateOfIncorporation: "",
    validId: "",
    utilityBill: "",
  });
  const [fileTypes, setFileTypes] = useState({
    certificateOfIncorporation: "",
    validId: "",
    utilityBill: "",
  });
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState(null);
  const [errors, setErrors] = useState({});

  const navigate = useNavigate();

  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        if (user && user.id) {
          setUserId(user.id);
        }
      } catch (e) {
        console.error("Error parsing user from localStorage", e);
      }
    }
  }, []);

  const validateField = (name, value) => {
    let error = "";
    switch (name) {
      case "certificateOfIncorporation":
        if (!value) error = "Certificate of Incorporation is required";
        break;
      case "validId":
        if (!value) error = "Tax/EIN ID Document is required";
        break;
      case "utilityBill":
        if (!value) error = "Government ID of Owner is required";
        break;
      default:
        break;
    }
    setErrors(prev => ({ ...prev, [name]: error }));
    return error;
  };

  const getPDFIcon = () => (
    <div className="relative">
      <FaFilePdf className="text-7xl text-red-500 mb-2 drop-shadow-lg" />
      <div className="absolute -top-1 -right-2 bg-white rounded-full px-1.5 py-0.5 text-[10px] font-bold text-red-500 shadow-md">
        PDF
      </div>
    </div>
  );

  const getUploadIcon = () => (
    <div className="relative">
      <div className="bg-white/10 rounded-full p-4 mb-2">
        <FaImage className="text-5xl text-yellow-400" />
      </div>
      <span className="text-white text-[22px] mt-2">Upload</span>
    </div>
  );

  const handleFileChange = (e, field) => {
    const fileItem = e.target.files[0];
    if (fileItem) {
      const isImage = fileItem.type.startsWith('image/');
      const isPDF = fileItem.type === 'application/pdf';

      if (!isImage && !isPDF) {
        toast.error("Please select an image file (JPG, PNG) or PDF file");
        return;
      }

      if (fileItem.size > 100 * 1024 * 1024) {
        toast.error("File size should be less than 100MB");
        return;
      }

      setFiles((prev) => ({ ...prev, [field]: fileItem }));

      const fileExtension = isPDF ? 'pdf' : 'image';
      setFileTypes(prev => ({ ...prev, [field]: fileExtension }));

      if (isImage) {
        if (previews[field] && previews[field].startsWith('blob:')) {
          URL.revokeObjectURL(previews[field]);
        }
        setPreviews((prev) => ({ ...prev, [field]: URL.createObjectURL(fileItem) }));
      } else {
        setPreviews((prev) => ({ ...prev, [field]: fileItem }));
      }

      setErrors(prev => ({ ...prev, [field]: "" }));
      toast.success(`${fileItem.name} selected`);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const newErrors = {};
    Object.keys(files).forEach(key => {
      const error = validateField(key, files[key]);
      if (error) newErrors[key] = error;
    });

    if (Object.values(newErrors).some(err => err)) {
      setErrors(newErrors);
      toast.error("Please upload all required documents");
      return;
    }

    setLoading(true);
    try {
      const form = new FormData();
      form.append("providerId", userId);
      form.append("certificateOfIncorporation", files.certificateOfIncorporation);
      form.append("ValidBusinessId", files.validId);
      form.append("AddressProof", files.utilityBill);
      // Consolidated flow: docs are the 2nd-to-last step; 6 resumes at pricing.
      form.append("profile_step", 6);

      const response = await completeProfile(form);
      if (response.status === 200 || response.status === "1") {
        if (response.body && response.body.user) {
          localStorage.setItem("user", JSON.stringify(response.body.user));
          window.dispatchEvent(new Event('userUpdated'));
        }
        setShowModal(true);
      } else {
        toast.error(response.message || "Something went wrong");
      }
    } catch (error) {
      console.error("Document upload error:", error);
      toast.error(error.response?.data?.message || "Failed to upload documents");
    } finally {
      setLoading(false);
    }
  };

  const PDFPreview = ({ file, field }) => {
    const [pdfUrl, setPdfUrl] = useState(null);
    const [fileName, setFileName] = useState("");

    useEffect(() => {
      if (file && file instanceof File) {
        const url = URL.createObjectURL(file);
        setPdfUrl(url);
        // Get file name without extension for better display
        const name = file.name.replace(/\.pdf$/i, '');
        setFileName(name.length > 30 ? name.substring(0, 27) + '...' : name);
        return () => {
          if (url) URL.revokeObjectURL(url);
        };
      }
    }, [file]);

    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-gradient-to-br from-red-50/10 to-red-100/5">
        <div className="relative mb-3">
          <FaFilePdf className="text-8xl text-red-500 drop-shadow-xl" />
          <div className="absolute -top-2 -right-3 bg-red-500 rounded-full px-2 py-0.5 text-[10px] font-bold text-white shadow-lg animate-pulse">
            PDF
          </div>
        </div>
        <span className="text-white text-sm font-medium mt-2 text-center break-all px-4 bg-black/30 rounded-full py-1">
          📄 {fileName || "Document"}
        </span>
        {pdfUrl && (
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-yellow-400 text-xs mt-3 hover:text-yellow-300 transition-colors duration-200 flex items-center gap-1 bg-black/20 px-3 py-1 rounded-full"
            onClick={(e) => e.stopPropagation()}
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Preview PDF
          </a>
        )}
      </div>
    );
  };

  const renderUploadBox = (label, field, fileKey) => (
    <div className="transform transition-all duration-300 hover:scale-[1.02]">
      <label className="md:text-[29px] text-[20px] font-medium mb-3 block text-left bg-gradient-to-r from-yellow-400 to-yellow-600 bg-clip-text text-transparent">
        {label}
      </label>
      <label
        className={`border-2 border-dashed ${
          previews[fileKey] 
            ? fileTypes[fileKey] === 'pdf' 
              ? 'border-red-500 bg-red-500/5' 
              : 'border-yellow-400 bg-yellow-400/5'
            : 'border-white/40 hover:border-yellow-400'
        } rounded-2xl
        h-[260px] flex flex-col items-center justify-center relative
        cursor-pointer transition-all duration-300 overflow-hidden
        backdrop-blur-sm group`}
      >
        <input
          type="file"
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
          accept="image/jpeg,image/png,image/jpg,application/pdf"
          onChange={(e) => handleFileChange(e, fileKey)}
        />
        {previews[fileKey] ? (
          fileTypes[fileKey] === 'pdf' ? (
            <PDFPreview file={previews[fileKey]} field={fileKey} />
          ) : (
            <div className="relative w-full h-full group">
              <img src={previews[fileKey]} alt="Preview" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                <span className="text-white text-sm font-medium">Click to change</span>
              </div>
            </div>
          )
        ) : (
          <div className="flex flex-col items-center justify-center transform transition-transform duration-300 group-hover:scale-105">
            <div className="bg-white/10 rounded-full p-5 mb-3 group-hover:bg-white/20 transition-colors duration-300">
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                className="text-yellow-400"
              >
                <path
                  d="M12 16V4M12 4L7 9M12 4L17 9"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path d="M4 16V20H20V16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <span className="text-white text-2xl font-medium">Upload</span>
            <span className="text-white/50 text-sm mt-2">(JPG, PNG, or PDF)</span>
            <span className="text-white/30 text-xs mt-1">Max size: 100MB</span>
          </div>
        )}
      </label>
      {errors[fileKey] && (
        <p className="text-red-400 text-sm mt-2 text-left flex items-center gap-1">
          <span className="text-red-400">⚠️</span> {errors[fileKey]}
        </p>
      )}
    </div>
  );

  return (
    <div>
      <div
        className="min-h-screen flex items-center justify-center relative"
        style={{
          backgroundImage: ` url(${shipp})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div
          className="flex flex-col items-center text-white gap-6
          bg-[#2D413F] backdrop-blur-md
          rounded-[22px]
          shadow-[0_25px_80px_rgba(0,0,0,0.6)]
          w-[90vw] sm:w-[500px] lg:w-[800px]
          px-6 sm:px-15 py-10 mb-20 md:mt-35 mt-15"
        >
          <h1 className="text-[22px] lg:text-[32px] font-semibold bg-gradient-to-r from-yellow-400 to-yellow-600 bg-clip-text text-transparent">
            Create Your Account
          </h1>
          <p className="text-lg text-white/80 -mt-3">
            Please enter required details
          </p>

          <div className="w-full max-w-[480px] mt-4">
            <div className="flex items-center gap-2">
              {[1, 2].map((step) => (
                <div
                  key={step}
                  className={`h-[4px] w-full rounded-full transition-all duration-300 ${step <= 1 ? "bg-gradient-to-r from-yellow-400 to-yellow-600" : "bg-white/30"
                    }`}
                />
              ))}
            </div>
          </div>

          <form className="w-full max-w-[600px] flex flex-col gap-4">
            <div className="flex flex-col gap-6">
              {renderUploadBox("Certificate of Incorporation/Business Registration", "certificateOfIncorporation", "certificateOfIncorporation")}
              {renderUploadBox("TAX/EIN ID Document", "validId", "validId")}
              {renderUploadBox("Government ID of Owner", "utilityBill", "utilityBill")}
            </div>

            <div className="flex justify-center mt-4">
              <button
                disabled={loading}
                type="button"
                onClick={handleSubmit}
                className="bg-gradient-to-r from-yellow-400 to-yellow-600
                text-black font-bold text-[17px] sm:text-[19px]
                rounded-full
                h-[60px] w-[180px] sm:h-[70px] sm:w-[240px]
                transition-all flex items-center justify-center gap-2
                hover:scale-105 hover:shadow-lg
                disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {loading ? <FaSpinner className="animate-spin" /> : "Next →"}
              </button>
            </div>
          </form>
        </div>

        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn">
            <div
              className="bg-white rounded-2xl max-w-[340px] px-6 py-8 text-center
              shadow-[0_10px_40px_rgba(0,0,0,0.4)] transform animate-scaleUp"
            >
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-r from-yellow-400 to-yellow-600 flex items-center justify-center animate-bounce">
                  <img src={submit} alt="Success" className="w-8 h-8" />
                </div>
              </div>

              <h2 className="text-2xl font-semibold text-black mb-2">Verification</h2>

              <p className="text-gray-600 text-sm mb-6">Document will be verified by admin.</p>

              <button
                onClick={() => {
                  setShowModal(false);
                  // Consolidated flow: pricing is the only remaining step.
                  navigate("/businessupload");
                }}
                className="bg-gradient-to-r from-yellow-400 to-yellow-600
                text-black font-bold py-3 rounded-full px-[70px]
                hover:scale-105 transition-transform duration-200"
              >
                Ok
              </button>
            </div>
          </div>
        )}
      </div>
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleUp {
          from { transform: scale(0.9); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
        .animate-scaleUp {
          animation: scaleUp 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default BusinessDocument;