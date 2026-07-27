import React, { useState, useEffect } from 'react'
import { checkk } from "../common/common-assets/assets-images";
import { useNavigate } from 'react-router-dom';
import ProfileMain from '../components/ProfileMain';
import Commonbanner from '../components/Commonbanner';
import { getProviderProfile, createStripeAccount } from '../api/cms';
import { toast } from 'sonner';
import { API_URL } from '../api/axios';
import { JAMAICA_PARISHES } from '../utils/parishes';

const BussinessProfile = () => {
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isStripeConnecting, setIsStripeConnecting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const user = JSON.parse(localStorage.getItem('user'));
        if (!user || !user.id) {
          toast.error("User not found. Please login again.");
          return;
        }

        const response = await getProviderProfile(user.id);
        if (response.success) {
          setProfileData(response.body);
        } else {
          toast.error(response.message || "Failed to fetch profile");
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
        toast.error(error.response?.data?.message || "Something went wrong!");
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const handleStripeConnect = async () => {
    setIsStripeConnecting(true);
    try {
      const response = await createStripeAccount();
      if (response.success) {
        const url = response.body?.url || response.url;
        if (url) {
          window.location.href = url;
          return;
        }
      }
      toast.error(response.message || 'Failed to start Stripe Connect.');
    } catch (error) {
      console.error('Stripe connect error:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Unable to start Stripe Connect.';
      toast.error(errorMessage);
    } finally {
      setIsStripeConnecting(false);
    }
  };

  const localUser = JSON.parse(localStorage.getItem('user') || '{}');
  const localHashAccount = localUser?.hashAccount || localUser?.user?.hashAccount;
  const isStripeConnected = profileData?.hashAccount === '1' || localHashAccount === '1';

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a1612] flex items-center justify-center text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-400"></div>
      </div>
    );
  }

  const businessInfo = profileData?.businessInfo || {};
  console.log("businessInfo------->>>>>", businessInfo);

  const getDocUrl = (path) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    return `${API_URL}/${path}`;
  };

  const isPdf = (path) => path && path.toLowerCase().endsWith('.pdf');

  const renderDocPreview = (label, path) => {
    if (!path) return null;
    const url = getDocUrl(path);
    const pdf = isPdf(path);
    return (
      <div className='flex items-start justify-between mb-3 gap-2 sm:gap-5'>
        <p className='font-medium text-white/70 shrink-0'>{label}</p>
        <div className='flex flex-col items-end gap-1'>
          {pdf ? (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className='text-yellow-400 text-sm underline hover:text-yellow-300 transition-colors'
            >
              View PDF
            </a>
          ) : (
            <a href={url} target="_blank" rel="noopener noreferrer">
              <img
                src={url}
                alt={label}
                className='w-[80px] h-[60px] object-cover rounded-md border border-white/20 hover:opacity-80 transition-opacity cursor-pointer'
              />
            </a>
          )}
        </div>
      </div>
    );
  };

  const Row = ({ label, value }) => (
    <div className='flex items-start justify-between mb-3 gap-2 sm:gap-5'>
      <p className='font-medium text-white/70 shrink-0'>{label}</p>
      <p className='font-medium text-end text-white'>{value || 'N/A'}</p>
    </div>
  );

  const renderMultiFieldCharges = (value, label, bgColor = 'white/5', borderColor = 'white/10') => {
    if (!value) return <Row label={label} value="N/A" />;
    
    const parts = value.split(",");
    if (parts.length !== 25) {
      return <Row label={label} value={`$${value}`} />;
    }
    
    const hasValues = parts.some(v => v && v !== '0' && v !== '0.00');
    if (!hasValues) return <Row label={label} value="N/A" />;
    
    return (
      <div className="mt-3 p-3 bg-white/5 rounded-lg border border-white/10 mb-3">
        <p className="text-white/70 font-semibold mb-2 text-sm">{label} (1–25 barrels)</p>
        <div className="grid grid-cols-5 gap-2 text-center text-xs">
          {parts.map((val, idx) => (
            <div key={idx} className="bg-white/5 p-1.5 rounded">
              <span className="text-[10px] text-white/40 block">Qty {idx + 1}</span>
              <span className="text-white font-medium">${val || '0'}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderPickupCharges = (config) => {
    const hasPickupCharges = config.flatPickupCharge || config.pickupFreeMiles || config.pickupPerMileCharge;

    if (!hasPickupCharges) return null;

    return (
      <div className="mt-3 p-3 bg-blue-900/20 rounded-lg border border-blue-500/20">
        <p className="text-blue-400 font-semibold mb-2 text-sm">📦 Pickup Charges</p>
        <div className="space-y-2">
          {config.flatPickupCharge && (
            <div className='flex items-start justify-between gap-2'>
              <p className='text-white/60 text-sm'>Flat Pickup Charge:</p>
              <p className='text-white text-sm font-medium'>${config.flatPickupCharge}</p>
            </div>
          )}
          {config.pickupFreeMiles && (
            <div className='flex items-start justify-between gap-2'>
              <p className='text-white/60 text-sm'>Pickup Free Miles:</p>
              <p className='text-white text-sm font-medium'>{config.pickupFreeMiles} miles</p>
            </div>
          )}
          {config.pickupPerMileCharge && (
            <div className='flex items-start justify-between gap-2'>
              <p className='text-white/60 text-sm'>Pickup Per Mile Charge:</p>
              <p className='text-white text-sm font-medium'>${config.pickupPerMileCharge}</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderDeliveryCharges = (config) => {
    const hasDeliveryCharges = config.flatDeliveryCharge || config.deliveryFreeMiles || config.deliveryPerMileCharge;

    if (!hasDeliveryCharges) return null;

    return (
      <div className="mt-3 p-3 bg-green-900/20 rounded-lg border border-green-500/20">
        <p className="text-green-400 font-semibold mb-2 text-sm">🚚 Delivery Charges</p>
        <div className="space-y-2">
          {config.flatDeliveryCharge && (
            <div className='flex items-start justify-between gap-2'>
              <p className='text-white/60 text-sm'>Flat Delivery Charge:</p>
              <p className='text-white text-sm font-medium'>${config.flatDeliveryCharge}</p>
            </div>
          )}
          {config.deliveryFreeMiles && (
            <div className='flex items-start justify-between gap-2'>
              <p className='text-white/60 text-sm'>Delivery Free Miles:</p>
              <p className='text-white text-sm font-medium'>{config.deliveryFreeMiles} miles</p>
            </div>
          )}
          {config.deliveryPerMileCharge && (
            <div className='flex items-start justify-between gap-2'>
              <p className='text-white/60 text-sm'>Delivery Per Mile Charge:</p>
              <p className='text-white text-sm font-medium'>${config.deliveryPerMileCharge}</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderCustomsCharges = (customsAndHandling) => {
    if (!customsAndHandling) return <Row label="Customs and handling" value="N/A" />;
    const parts = customsAndHandling.split(",");
    if (parts.length !== 25) {
      return <Row label="Customs and handling" value={`$${customsAndHandling}`} />;
    }
    
    const hasValues = parts.some(v => v && v !== '0' && v !== '0.00');
    if (!hasValues) return <Row label="Customs and handling" value="N/A" />;
    
    return (
      <div className="mt-3 p-3 bg-white/5 rounded-lg border border-white/10 mb-3">
        <p className="text-white/70 font-semibold mb-2 text-sm">📋 Customs &amp; Handling (1–25 barrels)</p>
        <div className="grid grid-cols-5 gap-2 text-center text-xs">
          {parts.map((val, idx) => (
            <div key={idx} className="bg-white/5 p-1.5 rounded">
              <span className="text-[10px] text-white/40 block">Qty {idx + 1}</span>
              <span className="text-white font-medium">${val || '0'}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderFlatPickupCharge = (value) => {
    if (!value) return <Row label="Flat Pickup Charge" value="N/A" />;
    const parts = value.split(",");
    if (parts.length !== 25) {
      return <Row label="Flat Pickup Charge" value={`$${value}`} />;
    }
    
    const hasValues = parts.some(v => v && v !== '0' && v !== '0.00');
    if (!hasValues) return <Row label="Flat Pickup Charge" value="N/A" />;
    
    return (
      <div className="mt-3 p-3 bg-blue-900/20 rounded-lg border border-blue-500/20 mb-3">
        <p className="text-blue-400 font-semibold mb-2 text-sm">📦 Flat Pickup Charge (1–25 barrels)</p>
        <div className="grid grid-cols-5 gap-2 text-center text-xs">
          {parts.map((val, idx) => (
            <div key={idx} className="bg-blue-950/30 p-1.5 rounded">
              <span className="text-[10px] text-blue-400/60 block">Qty {idx + 1}</span>
              <span className="text-white font-medium">${val || '0'}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderFlatDeliveryCharge = (value) => {
    if (!value) return <Row label="Flat Delivery Charge" value="N/A" />;
    const parts = value.split(",");
    if (parts.length !== 25) {
      return <Row label="Flat Delivery Charge" value={`$${value}`} />;
    }
    
    const hasValues = parts.some(v => v && v !== '0' && v !== '0.00');
    if (!hasValues) return <Row label="Flat Delivery Charge" value="N/A" />;
    
    return (
      <div className="mt-3 p-3 bg-green-900/20 rounded-lg border border-green-500/20 mb-3">
        <p className="text-green-400 font-semibold mb-2 text-sm">🚚 Flat Delivery Charge (1–25 barrels)</p>
        <div className="grid grid-cols-5 gap-2 text-center text-xs">
          {parts.map((val, idx) => (
            <div key={idx} className="bg-green-950/30 p-1.5 rounded">
              <span className="text-[10px] text-green-400/60 block">Qty {idx + 1}</span>
              <span className="text-white font-medium">${val || '0'}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ── Simplified pricing (v2) display ──
  // A config is "v2" when it carries a non-zero seaFreightPrice; legacy
  // configs fall back to the old 25-slot renderers below.
  const hasV2Pricing = (config) => {
    const v = parseFloat(config?.seaFreightPrice);
    return !isNaN(v) && v > 0;
  };

  const fmtMoney = (v) => {
    const n = parseFloat(v);
    return isNaN(n) ? '0.00' : n.toFixed(2);
  };

  const renderV2Pricing = (config, isOwn) => {
    const sea = parseFloat(config.seaFreightPrice) || 0;
    const d59 = parseFloat(config.discount5to9) || 0;
    const d10 = parseFloat(config.discount10plus) || 0;

    let parishFees = config.parishFees;
    if (typeof parishFees === 'string') {
      try { parishFees = JSON.parse(parishFees); } catch { parishFees = {}; }
    }
    if (!parishFees || typeof parishFees !== 'object' || Array.isArray(parishFees)) parishFees = {};

    // Entries are { first, additional }; legacy scalar values read as
    // { first: value, additional: 0 }.
    const parishEntry = (v) => {
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        return { first: parseFloat(v.first) || 0, additional: parseFloat(v.additional) || 0 };
      }
      return { first: parseFloat(v) || 0, additional: 0 };
    };

    const pickupCharge = parseFloat(config.pickupCharge) || 0;
    const pickupRadius = parseFloat(config.pickupRadius) || 0;
    const extraMileage = parseFloat(config.extraMileageCost) || 0;
    const hasPickup = isOwn && (pickupCharge > 0 || pickupRadius > 0 || extraMileage > 0);
    const hasParishFees = JAMAICA_PARISHES.some(p => {
      const e = parishEntry(parishFees[p]);
      return e.first > 0 || e.additional > 0;
    });

    return (
      <>
        {hasPickup && (
          <div className="mt-3 p-3 bg-blue-900/20 rounded-lg border border-blue-500/20 mb-3">
            <p className="text-blue-400 font-semibold mb-2 text-sm">📦 Pickup</p>
            <p className="text-white text-sm font-medium">
              ${fmtMoney(pickupCharge)} pickup · {pickupRadius} mi radius · ${fmtMoney(extraMileage)}/mi after
            </p>
          </div>
        )}

        <div className="mt-3 p-3 bg-white/5 rounded-lg border border-white/10 mb-3">
          <p className="text-white/70 font-semibold mb-2 text-sm">🚢 Sea Freight (per barrel)</p>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="bg-white/5 p-1.5 rounded">
              <span className="text-[10px] text-white/40 block">1-4 barrels</span>
              <span className="text-white font-medium">${fmtMoney(sea)}</span>
            </div>
            <div className="bg-white/5 p-1.5 rounded">
              <span className="text-[10px] text-white/40 block">5-9 barrels</span>
              <span className="text-white font-medium">${fmtMoney(Math.max(sea - d59, 0))}</span>
            </div>
            <div className="bg-white/5 p-1.5 rounded">
              <span className="text-[10px] text-white/40 block">10+ barrels</span>
              <span className="text-white font-medium">${fmtMoney(Math.max(sea - d10, 0))}</span>
            </div>
          </div>
        </div>

        {hasParishFees && (
          <div className="mt-3 p-3 bg-green-900/20 rounded-lg border border-green-500/20 mb-3">
            <p className="text-green-400 font-semibold mb-2 text-sm">🚚 Customs &amp; Delivery (per parish)</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {JAMAICA_PARISHES.map(parish => {
                const entry = parishEntry(parishFees[parish]);
                return (
                  <div key={parish} className="bg-green-950/30 p-1.5 rounded flex items-center justify-between gap-2">
                    <span className="text-[10px] text-green-400/60 truncate">{parish}</span>
                    <span className="text-white font-medium shrink-0">
                      ${fmtMoney(entry.first)} first · ${fmtMoney(entry.additional)}/additional
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </>
    );
  };

  return (
    <>
      <Commonbanner title="My Profile" />

      <div className='bg-gradient-to-r from-[#244536] via-[#1b352b] to-[#0b1914] py-20'>
        <div className='container mx-auto flex flex-col lg:flex-row justify-center pb-[20px] py-20 gap-5'>
          <div className='w-full lg:w-[30%]'><ProfileMain show={false} /></div>

          <div className='w-full shadow-sm bg-[#2D413F] rounded-[18px] lg:w-[70%]'>
            <div className='w-full xl:mt-0 container mx-auto px-5 py-5 text-[14px] sm:text-[16px] md:text-[18px]'>
              <p className='text-[17px] sm:text-[19px] font-bold my-5 text-white text-start'>My Profile</p>

              {!isStripeConnected ? (
                <div className='mb-6 rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-4'>
                  <p className='text-sm text-yellow-100 mb-3'>You can't be paid yet. Set up payments with Stripe to receive money from customers and appear in booking quotes.</p>
                  <button
                    type='button'
                    onClick={handleStripeConnect}
                    disabled={isStripeConnecting}
                    className='inline-flex items-center justify-center rounded-full bg-yellow-400 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-yellow-500 disabled:cursor-not-allowed disabled:opacity-60'
                  >
                    {/* Names the outcome, not the vendor — forwarders understand
                        "start collecting payments" far quicker than "Connect Stripe". */}
                    {isStripeConnecting ? 'Setting up...' : 'Start Collecting Payments'}
                  </button>
                </div>
              ) : (
                <div className='mb-6 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-emerald-100'>
                  <p className='text-sm'>Stripe is connected. Your account is eligible to receive payments and bookable by users.</p>
                </div>
              )}

              {/* ── Personal Info ── */}
              <Row label="Contact Name" value={`${profileData?.firstName || ''} ${profileData?.lastName || ''}`.trim()} />

              {/* ── Business Info ── */}
              <Row label="Business Name" value={businessInfo.businessName} />
              <Row label="Company Email" value={businessInfo.email || profileData?.email} />
              <Row label="Phone Number" value={businessInfo.phone || profileData?.phoneNumber} />
              <Row label="Primary Contact Person First Name" value={businessInfo.primaryContactPersonFirstName} />
              <Row label="Primary Contact Person Last Name" value={businessInfo.primaryContactPersonLastName} />
              <Row label="Registration Number (FMC)" value={businessInfo.registerationNumber} />
              <Row label="Country of Registration" value={businessInfo.countryOfRegistration} />

              {/* Address Information Section */}
              <div className="mt-4 mb-2">
                <p className="text-[15px] sm:text-[17px] font-bold text-yellow-400 mb-3 text-start">Address Information</p>
              </div>

              <Row label="Business Address" value={businessInfo.businessAddress} />
              <Row label="City" value={businessInfo.city} />
              <Row label="State" value={businessInfo.state} />

              <Row label="Doing Business As" value={profileData?.working_as} />
              <Row label="Shipment Type" value={businessInfo.shipmentType} />

              {(businessInfo.shipmentType?.toLowerCase() === 'barrel' || businessInfo.barrelOptions) && (
                <div className="mt-6 border-t border-white/10 pt-4">
                  <p className="text-[16px] font-bold text-yellow-400 mb-4">Barrel Configuration Details</p>

                  {Array.isArray(businessInfo.barrelOptions?.ownBarrel) && businessInfo.barrelOptions.ownBarrel.length > 0 && (
                    <div className="mb-6">
                      <p className="font-bold text-white mb-3 text-[16px]">Ship Your Own Barrel Configurations</p>
                      {businessInfo.barrelOptions.ownBarrel.map((config, index) => (
                        <div key={index} className="mb-4 p-4 bg-white/5 rounded-lg border border-white/5">
                          <p className="text-yellow-400/80 font-semibold mb-2 text-sm uppercase">Configuration {index + 1}</p>

                          {/* Basic Info */}
                          <Row label="Origin" value={config.originCountry} />
                          <Row label="Destination" value={config.destinationCountry} />

                          {hasV2Pricing(config) ? (
                            <>
                              {renderV2Pricing(config, true)}
                              <Row label="Transit Time" value={config.transitTime} />
                            </>
                          ) : (
                            <>
                              <Row label="Base Price" value={`$${config.basePrice}`} />

                              {/* Customs & Handling - 25 fields */}
                              {renderCustomsCharges(config.customsAndHandling)}

                              <Row label="Transit Time" value={config.transitTime} />

                              {/* Flat Pickup Charge - 25 fields */}
                              {renderFlatPickupCharge(config.flatPickupCharge)}

                              <Row label="Pickup Free Miles" value={config.pickupFreeMiles ? `${config.pickupFreeMiles} miles` : 'N/A'} />
                              <Row label="Pickup Per Mile Charge" value={config.pickupPerMileCharge ? `$${config.pickupPerMileCharge}` : 'N/A'} />

                              {/* Flat Delivery Charge - 25 fields */}
                              {renderFlatDeliveryCharge(config.flatDeliveryCharge)}

                              <Row label="Delivery Free Miles" value={config.deliveryFreeMiles ? `${config.deliveryFreeMiles} miles` : 'N/A'} />
                              <Row label="Delivery Per Mile Charge" value={config.deliveryPerMileCharge ? `$${config.deliveryPerMileCharge}` : 'N/A'} />

                              {/* Quantity Prices */}
                              <div className="mt-3 pt-3 border-t border-white/10">
                                <div className="flex justify-between mb-2">
                                  <p className="text-white/70">Quantity Prices</p>
                                  <div className="text-right">
                                    {config.barrelPrices?.map((p, idx) => (
                                      <p key={idx} className="text-white text-xs">
                                        {p.quantity} Barrel: ${p.price} {p.discount && p.discount !== '0' ? `(${p.discount}% OFF)` : ''}
                                      </p>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {Array.isArray(businessInfo.barrelOptions?.dropOffBarrel) && businessInfo.barrelOptions.dropOffBarrel.length > 0 && (
                    <div className="mb-6">
                      <p className="font-bold text-white mb-3 text-[16px]">Request Barrel Drop-Off Configurations</p>
                      {businessInfo.barrelOptions.dropOffBarrel.map((config, index) => (
                        <div key={index} className="mb-4 p-4 bg-white/5 rounded-lg border border-white/5">
                          <p className="text-yellow-400/80 font-semibold mb-2 text-sm uppercase">Configuration {index + 1}</p>

                          {/* Basic Info */}
                          <Row label="Origin" value={config.originCountry} />
                          <Row label="Destination" value={config.destinationCountry} />

                          {hasV2Pricing(config) ? (
                            <>
                              {renderV2Pricing(config, false)}
                              <Row label="Transit Time" value={config.transitTime} />
                            </>
                          ) : (
                            <>
                              <Row label="Base Price" value={`$${config.basePrice}`} />
                              <Row label="Delivery" value={`$${config.pricePerMile}`} />

                              {/* Customs & Handling - 25 fields */}
                              {renderCustomsCharges(config.customsAndHandling)}

                              <Row label="Transit Time" value={config.transitTime} />

                              {/* Quantity Prices */}
                              <div className="mt-3 pt-3 border-t border-white/10">
                                <div className="flex justify-between mb-2">
                                  <p className="text-white/70">Quantity Prices</p>
                                  <div className="text-right">
                                    {config.barrelPrices?.map((p, idx) => (
                                      <p key={idx} className="text-white text-xs">
                                        {p.quantity} Barrel: ${p.price} {p.discount && p.discount !== '0' ? `(${p.discount}% OFF)` : ''}
                                      </p>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {(!businessInfo.barrelOptions?.ownBarrel?.length && !businessInfo.barrelOptions?.dropOffBarrel?.length) && (
                    <p className="text-white/50 text-sm italic">No barrel configurations added yet.</p>
                  )}
                </div>
              )}

              {businessInfo.shipmentType !== 'barrel' && (
                <>
                  <Row label="Price Per Mile" value={businessInfo.pricePerMile ? `$${businessInfo.pricePerMile}` : null} />
                  <Row label="Delivery Time" value={businessInfo.deliveryTimeline} />
                </>
              )}

              {/* ── Description ── */}
              <div className='flex items-start justify-between mb-3 gap-2 sm:gap-5'>
                <p className='font-medium text-white/70 shrink-0'>Description</p>
                <p className='font-medium text-white text-end max-w-[500px]'>
                  {businessInfo.description || 'No description provided.'}
                </p>
              </div>

              {/* ── Documents ── */}
              {(businessInfo.certificateOfIncorporation || businessInfo.ValidBusinessId || businessInfo.AddressProof) && (
                <>
                  <p className='text-[15px] sm:text-[17px] font-bold mt-6 mb-3 text-white/80 text-start border-t border-white/10 pt-4'>
                    Documents
                  </p>
                  {renderDocPreview("Certificate of Incorporation/Business Registration", businessInfo.certificateOfIncorporation)}
                  {renderDocPreview("TAX/EIN ID Document", businessInfo.ValidBusinessId)}
                  {renderDocPreview("Government ID of Owner", businessInfo.AddressProof)}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default BussinessProfile;