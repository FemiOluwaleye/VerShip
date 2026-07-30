import React, { useState, useEffect } from "react";
import { man, file } from "../common/common-assets/assets-images";
import { useNavigate } from "react-router-dom";
import ProfileMain from "../components/ProfileMain";
import Commonbanner from "../components/Commonbanner";
import { getProviderProfile, completeProfile } from "../api/cms";
import { toast } from "sonner";
import { FaSpinner, FaFilePdf, FaCloudUploadAlt } from "react-icons/fa";
import { API_URL } from "../api/axios";
import { resolveFileUrl } from "../utils/fileUrl";

const EditNextDocument = () => {
  const navigate = useNavigate();
  const userStr = localStorage.getItem("user");
  const user = userStr ? JSON.parse(userStr) : {};

  const [isLoading, setIsLoading] = useState(false);
  const [files, setFiles] = useState({
    certificateOfIncorporation: null,
    validBusinessId: null,
    addressProof: null,
  });
  const [previews, setPreviews] = useState({
    certificateOfIncorporation: "",
    validBusinessId: "",
    addressProof: "",
  });
  const [fileTypes, setFileTypes] = useState({
    certificateOfIncorporation: "",
    validBusinessId: "",
    addressProof: "",
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user.id) return;
      try {
        const response = await getProviderProfile(user.id);
        if (response.success && response.body.businessInfo) {
          const info = response.body.businessInfo;
          setPreviews({
            certificateOfIncorporation: info.certificateOfIncorporation || "",
            validBusinessId: info.ValidBusinessId || "",
            addressProof: info.AddressProof || "",
          });
          setFileTypes({
            certificateOfIncorporation: info.certificateOfIncorporation?.toLowerCase().endsWith('.pdf') ? 'pdf' : 'image',
            validBusinessId: info.ValidBusinessId?.toLowerCase().endsWith('.pdf') ? 'pdf' : 'image',
            addressProof: info.AddressProof?.toLowerCase().endsWith('.pdf') ? 'pdf' : 'image',
          });
        }
      } catch (error) {
        console.error("Failed to fetch profile:", error);
      }
    };
    fetchProfile();
  }, [user.id]);

  const validateField = (name, value, hasPreview) => {
    let error = "";
    if (!value && !hasPreview) {
      switch (name) {
        case "certificateOfIncorporation":
          error = "Certificate of Incorporation is required";
          break;
        case "validBusinessId":
          error = "Tax/EIN ID Document is required";
          break;
        case "addressProof":
          error = "Government ID of Owner is required";
          break;
        default:
          break;
      }
    }
    setErrors(prev => ({ ...prev, [name]: error }));
    return error;
  };

  const handleFileChange = (e, field) => {
    const fileItem = e.target.files[0];
    if (fileItem) {
      const isImage = fileItem.type.startsWith('image/');
      const isPDF = fileItem.type === 'application/pdf';

      if (!isImage && !isPDF) {
        toast.error("Please select an image file (JPG, PNG) or PDF file");
        e.target.value = ''; 
        return;
      }

      const maxSize = 100 * 1024 * 1024; 
      if (fileItem.size > maxSize) {
        toast.error(`File size should be less than 100MB. Current size: ${(fileItem.size / (1024 * 1024)).toFixed(2)}MB`);
        e.target.value = ''; 
        return;
      }

      setFiles((prev) => ({ ...prev, [field]: fileItem }));

      const fileExtension = isPDF ? 'pdf' : 'image';
      setFileTypes(prev => ({ ...prev, [field]: fileExtension }));

      if (previews[field] && previews[field].startsWith('blob:')) {
        URL.revokeObjectURL(previews[field]);
      }

      if (isImage) {
        const objectUrl = URL.createObjectURL(fileItem);
        setPreviews((prev) => ({ ...prev, [field]: objectUrl }));
      } else {
        setPreviews((prev) => ({ ...prev, [field]: fileItem }));
      }

      setErrors(prev => ({ ...prev, [field]: "" }));
      toast.success(`${fileItem.name} selected successfully`);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const newErrors = {};
    Object.keys(files).forEach(key => {
      const error = validateField(key, files[key], !!previews[key]);
      if (error) newErrors[key] = error;
    });

    if (Object.values(newErrors).some(err => err)) {
      setErrors(newErrors);
      toast.error("Please ensure all required documents are provided");
      return;
    }

    setIsLoading(true);
    try {
      const data = new FormData();
      data.append("providerId", user.id);

      if (files.certificateOfIncorporation) {
        data.append("certificateOfIncorporation", files.certificateOfIncorporation);
      }
      if (files.validBusinessId) {
        data.append("ValidBusinessId", files.validBusinessId);
      }
      if (files.addressProof) {
        data.append("AddressProof", files.addressProof);
      }

      const response = await completeProfile(data);
      if (response.success) {
        toast.success("Documents updated!");
        navigate("/businesstimeedit");
      } else {
        toast.error(response.message || "Failed to upload documents");
      }
    } catch (error) {
      console.error("Document update error:", error);
      toast.error(error.response?.data?.message || "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const PDFPreview = ({ file, previewUrl, field }) => {
    const [pdfUrl, setPdfUrl] = useState(null);
    const [fileName, setFileName] = useState("");

    useEffect(() => {
      if (file && file instanceof File) {
        const url = URL.createObjectURL(file);
        setPdfUrl(url);
        const name = file.name.replace(/\.pdf$/i, '');
        setFileName(name.length > 30 ? name.substring(0, 27) + '...' : name);
        return () => {
          if (url) URL.revokeObjectURL(url);
        };
      } else if (previewUrl && typeof previewUrl === 'string' && previewUrl !== '') {
        const name = previewUrl.split('/').pop()?.replace(/\.pdf$/i, '') || "Document";
        setFileName(name.length > 30 ? name.substring(0, 27) + '...' : name);
        setPdfUrl(resolveFileUrl(previewUrl, API_URL));
      }
    }, [file, previewUrl]);

    return (
      <div className="text-center flex flex-col items-center gap-2 p-4">
        <div className="relative">
          <FaFilePdf className="text-7xl text-red-500 drop-shadow-xl" />
          <div className="absolute -top-2 -right-3 bg-red-500 rounded-full px-2 py-0.5 text-[10px] font-bold text-white shadow-lg">
            PDF
          </div>
        </div>
        <p className="text-sm text-yellow-500 font-bold">
          {files[field] ? "New File Selected" : "Current File"}
        </p>
        <p className="text-xs text-white/70 truncate max-w-[200px] bg-black/30 px-2 py-1 rounded-full">
          📄 {fileName}
        </p>
        {pdfUrl && (
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-yellow-400 text-xs mt-1 hover:text-yellow-300 transition-colors flex items-center gap-1"
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

  const ImagePreview = ({ previewUrl, field }) => {
    const fullPreviewUrl = resolveFileUrl(previewUrl, API_URL);

    return (
      <div className="text-center flex flex-col items-center gap-2">
        <img 
          src={fullPreviewUrl} 
          alt="Preview" 
          className="w-[150px] h-[120px] object-cover rounded-md border-2 border-yellow-400/50 shadow-lg" 
        />
        <p className="text-sm text-yellow-500 font-bold">
          {files[field] ? "New File Selected" : "Current File"}
        </p>
        <p className="text-[10px] text-white/50 truncate max-w-[200px]">
          {files[field] ? files[field].name : (previewUrl.split('/').pop())}
        </p>
      </div>
    );
  };

  const renderFileUpload = (label, field) => {
    const preview = previews[field];
    const fileType = fileTypes[field];
    const isPdf = fileType === 'pdf' || (preview && preview instanceof File) || (preview && typeof preview === 'string' && preview.toLowerCase().endsWith('.pdf'));
    const isImage = !isPdf && preview && preview !== '';

    return (
      <div className="w-full text-left transform transition-all duration-300 hover:scale-[1.01]">
        <label className="text-lg font-medium mb-3 block bg-gradient-to-r from-yellow-400 to-yellow-600 bg-clip-text text-transparent">
          {label}
        </label>
        <div className={`relative border-2 border-dashed ${errors[field] ? 'border-red-400' : 'border-white/20'} rounded-[18px] min-h-[180px] py-4 flex flex-col items-center justify-center bg-white/5 backdrop-blur-sm group hover:border-yellow-400 transition-all duration-300 hover:bg-white/10`}>
          <input
            type="file"
            onChange={(e) => handleFileChange(e, field)}
            className="absolute inset-0 opacity-0 cursor-pointer z-10"
            accept=".pdf,.jpg,.jpeg,.png"
          />
          {preview ? (
            isPdf ? (
              <PDFPreview 
                file={preview instanceof File ? preview : null} 
                previewUrl={typeof preview === 'string' ? preview : null}
                field={field}
              />
            ) : isImage ? (
              <ImagePreview previewUrl={preview} field={field} />
            ) : (
              <div className="text-center flex flex-col items-center gap-2">
                <div className="w-[100px] h-[80px] flex items-center justify-center bg-white/10 rounded-md border border-white/20">
                  <FaFilePdf className="text-5xl text-red-400" />
                </div>
                <p className="text-sm text-yellow-500 font-bold">Document</p>
              </div>
            )
          ) : (
            <div className="flex flex-col items-center justify-center transform transition-transform duration-300 group-hover:scale-105">
              <div className="bg-white/10 rounded-full p-4 mb-2 group-hover:bg-white/20 transition-colors">
                <FaCloudUploadAlt className="text-4xl text-yellow-400" />
              </div>
              <p className="text-white/70 text-[14px] font-medium">Click to upload or drag & drop</p>
              <p className="text-white/40 text-[11px] mt-1">PDF, PNG, JPG (max. 100MB)</p>
            </div>
          )}
        </div>
        {errors[field] && (
          <p className="text-red-400 text-sm mt-1 flex items-center gap-1">
            <span>⚠️</span> {errors[field]}
          </p>
        )}
      </div>
    );
  };

  return (
    <>
      <Commonbanner title="Edit Profile" />

      <div className="bg-gradient-to-r from-[#244536] via-[#1b352b] to-[#0b1914] py-20">
        <div className="container mx-auto flex flex-col lg:flex-row justify-center items-start pb-[20px] py-10 gap-5">
          <div className="w-full lg:w-[30%]">
            <ProfileMain show={false} />
          </div>

          <div className="w-full shadow-sm bg-[#2D413F] rounded-[18px] lg:w-[70%] p-6 lg:p-10 text-center">
            <div className="w-full max-w-[480px] mb-10 mx-auto">
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5, 6].map((step) => (
                  <div
                    key={step}
                    className={`h-[4px] w-full rounded-full transition-all duration-300 ${step <= 3 ? "bg-gradient-to-r from-yellow-400 to-yellow-600" : "bg-white/30"
                      }`}
                  />
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-10 items-start">
              <form onSubmit={handleSubmit} className="w-full sm:w-[60%] flex flex-col gap-6 text-white">
                {renderFileUpload("Certificate of Incorporation/Business Registration", "certificateOfIncorporation")}
                {renderFileUpload("TAX/EIN ID Document", "validBusinessId")}
                {renderFileUpload("Government ID of Owner", "addressProof")}

                <div className="flex justify-start mt-4">
                  <button
                    disabled={isLoading}
                    type="submit"
                    className="bg-gradient-to-r from-yellow-400 to-yellow-600
                        text-black font-bold text-[17px] sm:text-[19px]
                        rounded-full h-[60px] w-[200px] sm:h-[70px] sm:w-[260px]
                        transition-all flex items-center justify-center gap-2
                        hover:scale-105 hover:shadow-lg active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
                  >
                    {isLoading ? <FaSpinner className="animate-spin" /> : "Next →"}
                  </button>
                </div>
              </form>

              <div className="hidden sm:flex w-[40%] items-center justify-center">
                <img src={man} alt="Business Professional" className="w-full max-w-[320px] object-contain" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default EditNextDocument;