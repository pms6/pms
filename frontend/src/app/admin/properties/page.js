"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Plus, MapPin, Search, X, UploadCloud, UserRound, Loader2 } from "lucide-react";
import { PageHeader, Badge } from "../../Shared/ui";
import { RENTAL_TYPES, TENANT_TYPES, img } from "../_data/dummy";
import uploadToCloudinary from "@/app/utils/uploadToCloudinary";
import api from "@/app/api/api";

const typeMeta = (v) => RENTAL_TYPES.find((t) => t.v === v);
const typeTone = (v) => typeMeta(v)?.tone || "gray";

const FIELD = "w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#F47C3C] focus:bg-white outline-none transition-all text-sm font-medium text-[#0F253B]";
const LABEL = "block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5";

function SectionTitle({ children }) {
  return <p className="text-[11px] font-bold uppercase tracking-widest text-[#F47C3C] pt-1">{children}</p>;
}

function TextField({ label, ...props }) {
  return <div><label className={LABEL}>{label}</label><input className={FIELD} {...props} /></div>;
}

function TextAreaField({ label, ...props }) {
  return <div><label className={LABEL}>{label}</label><textarea className={`${FIELD} min-h-[80px] resize-y`} {...props} /></div>;
}

function SelectField({ label, value, onChange, options }) {
  return (
    <div>
      <label className={LABEL}>{label}</label>
      <select className={FIELD} value={value} onChange={onChange}>
        {options.map((o) => <option key={o.value || o} value={o.value || o}>{o.label || o}</option>)}
      </select>
    </div>
  );
}

function Segmented({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button key={o} type="button" onClick={() => onChange(o)}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${value === o ? "bg-[#0F253B] text-white border-[#0F253B]" : "bg-gray-50 text-gray-600 border-gray-100 hover:bg-gray-100"}`}>
          {o}
        </button>
      ))}
    </div>
  );
}

// API Service
const apiService = {
  async getProperties(params = {}) {
    try {
      const queryParams = new URLSearchParams({
        page: params.page || 1,
        limit: params.limit || 100,
        search: params.search || "",
        ...(params.rentalType && { rentalType: params.rentalType }),
        ...(params.tenantType && { tenantType: params.tenantType }),
        ...(params.status && { status: params.status }),
      });

      // Use axios instance instead of fetch
      const response = await api.get(`/properties?${queryParams}`);
      return response.data;
    } catch (error) {
      console.error('API Error:', error);
      throw error.response?.data || error;
    }
  },

  async createProperty(data) {
    try {
      // Use axios instance
      const response = await api.post('/properties', data);
      return response.data;
    } catch (error) {
      console.error('Create property error:', error);
      throw error.response?.data || error;
    }
  },

  async updateProperty(id, data) {
    try {
      const response = await api.put(`/properties/${id}`, data);
      return response.data;
    } catch (error) {
      console.error('Update property error:', error);
      throw error.response?.data || error;
    }
  },

  async deleteProperty(id) {
    try {
      const response = await api.delete(`/properties/${id}`);
      return response.data;
    } catch (error) {
      console.error('Delete property error:', error);
      throw error.response?.data || error;
    }
  },

  async getPropertyStats() {
    try {
      const response = await api.get('/properties/stats');
      return response.data;
    } catch (error) {
      console.error('Get stats error:', error);
      throw error.response?.data || error;
    }
  },

  async restoreProperty(id) {
    try {
      const response = await api.patch(`/properties/${id}/restore`);
      return response.data;
    } catch (error) {
      console.error('Restore property error:', error);
      throw error.response?.data || error;
    }
  },

  async updatePropertyStatus(id, status) {
    try {
      const response = await api.patch(`/properties/${id}/status`, { status });
      return response.data;
    } catch (error) {
      console.error('Update property status error:', error);
      throw error.response?.data || error;
    }
  },

  async getPropertyById(id) {
    try {
      const response = await api.get(`/properties/${id}`);
      return response.data;
    } catch (error) {
      console.error('Get property by ID error:', error);
      throw error.response?.data || error;
    }
  }
};

function PropertyModal({ onClose, onCreate }) {
  // Form state
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [postcode, setPostcode] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [rentalType, setRentalType] = useState("HMO");
  const [tenantType, setTenantType] = useState("ANY");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("ACTIVE");

  // Location search states
  const [suggestions, setSuggestions] = useState([]);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [coordinates, setCoordinates] = useState(null);

  // Image states
  const [coverImage, setCoverImage] = useState("");
  const [galleryImages, setGalleryImages] = useState([]);
  const [images, setImages] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const inputRef = useRef(null);
  
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Location search function
  const fetchLocationSuggestions = async (query) => {
    if (!query || query.length < 3) {
      setSuggestions([]);
      return;
    }

    setLoadingLocation(true);
    try {
      const res = await fetch(
        `https://api.locationiq.com/v1/autocomplete?key=${process.env.NEXT_PUBLIC_LOCATIONIQ_KEY}&q=${encodeURIComponent(query)}&limit=5&countrycodes=gb&format=json`
      );

      if (!res.ok) {
        throw new Error('Location search failed');
      }

      const data = await res.json();
      setSuggestions(data || []);
    } catch (err) {
      console.error("LocationIQ error:", err);
      setSuggestions([]);
    } finally {
      setLoadingLocation(false);
    }
  };

  // Get coordinates for selected location
  const fetchCoordinates = async (query) => {
    try {
      const res = await fetch(
        `https://api.locationiq.com/v1/search?key=${process.env.NEXT_PUBLIC_LOCATIONIQ_KEY}&q=${encodeURIComponent(query)}&format=json&limit=1`
      );

      if (!res.ok) {
        throw new Error('Geocoding failed');
      }

      const data = await res.json();

      if (data && data.length > 0) {
        const { lat, lon } = data[0];
        const coords = { lat: parseFloat(lat), lng: parseFloat(lon) };
        setCoordinates(coords);
        return coords;
      }
      return null;
    } catch (err) {
      console.error("Geocode error:", err);
      return null;
    }
  };

  // Handle address selection from suggestions
  const handleAddressSelect = async (suggestion) => {
    const selectedAddress = suggestion.display_name || suggestion.address?.address_line1 || suggestion.address?.name;
    setAddress(selectedAddress);
    setSuggestions([]);
    
    // Fetch coordinates for the selected address
    const coords = await fetchCoordinates(selectedAddress);
    if (coords) {
      // Extract city from suggestion
      const cityName = suggestion.address?.city || suggestion.address?.town || suggestion.address?.village || "";
      setCity(cityName);
      
      // Extract postcode
      const postcodeVal = suggestion.address?.postcode || "";
      setPostcode(postcodeVal);
      
      // Set name to the address if not already set
      if (!name) {
        setName(selectedAddress);
      }
    }
  };

  // Handle address input change with debounce
  const handleAddressChange = (e) => {
    const value = e.target.value;
    setAddress(value);
    
    // Debounce location search
    const timeoutId = setTimeout(() => {
      fetchLocationSuggestions(value);
    }, 300);
    
    return () => clearTimeout(timeoutId);
  };

  // Enhanced image upload handler with Cloudinary
  const handleImageUpload = async (files) => {
    if (!files || files.length === 0) return;
    
    setUploadingImages(true);
    const uploadedUrls = [];
    const uploadedImages = [];

    try {
      for (const file of Array.from(files)) {
        // Validate file type
        if (!file.type.startsWith("image/")) {
          continue;
        }

        // Validate file size (10MB max)
        if (file.size > 10 * 1024 * 1024) {
          setError(`File ${file.name} exceeds 10MB limit`);
          continue;
        }

        // Upload to Cloudinary
        const result = await uploadToCloudinary(file);
        uploadedUrls.push(result.url);
        
        // Also keep the local preview
        const reader = new FileReader();
        reader.onload = (ev) => {
          uploadedImages.push(ev.target.result);
        };
        reader.readAsDataURL(file);
      }

      // Wait for all file readers to complete
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Set cover image if not already set
      if (uploadedUrls.length > 0 && !coverImage) {
        setCoverImage(uploadedUrls[0]);
      }
      
      // Set gallery images (all except first if cover is set)
      if (uploadedUrls.length > 1) {
        setGalleryImages(prev => [...prev, ...uploadedUrls.slice(1)]);
      }
      
      setImages(prev => [...prev, ...uploadedImages]);
      
    } catch (err) {
      setError(err.message || 'Failed to upload images');
    } finally {
      setUploadingImages(false);
    }
  };

  const readFiles = (fileList) => {
    handleImageUpload(fileList);
  };

  const onDrop = (e) => { 
    e.preventDefault(); 
    setDragging(false); 
    readFiles(e.dataTransfer.files); 
  };

  const removeImage = (index) => {
    setImages((prev) => prev.filter((_, idx) => idx !== index));
    setGalleryImages((prev) => prev.filter((_, idx) => idx !== index));
    if (index === 0) {
      setCoverImage(galleryImages[0] || "");
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Validate required fields
      if (!address.trim()) {
        setError("Property address is required");
        setLoading(false);
        return;
      }

      // Build address object
      const addressObj = {
        line1: address || name,
        city: city || "",
        postcode: postcode || "",
        country: "United Kingdom",
      };

      // Add coordinates if available
      if (coordinates) {
        addressObj.coordinates = coordinates;
      }

      // Prepare property data matching the backend controller
      const propertyData = {
        name: name || address,
        rentalType: rentalType,
        tenantType: tenantType,
        ownerName: ownerName || "",
        address: addressObj,
        location: coordinates ? {
          type: "Point",
          coordinates: [coordinates.lng, coordinates.lat]
        } : undefined,
        description: description || "",
        coverImage: coverImage || "",
        gallery: galleryImages || [],
        status: status
      };

      console.log('Submitting property data:', propertyData);

      // Call API to create property
      const response = await apiService.createProperty(propertyData);
      
      console.log('Property created:', response);
      
      // Transform response for frontend display
      const enhancedProperty = {
        id: response.data._id,
        name: response.data.name,
        addressLine1: response.data.address?.line1 || response.data.name,
        area: response.data.address?.city || "",
        city: response.data.address?.city || "",
        postcode: response.data.address?.postcode || "",
        image: response.data.coverImage || img(response.data.name),
        images: response.data.gallery || [],
        type: response.data.rentalType === "SINGLE_LET" ? "Single Let" : response.data.rentalType,
        tenantType: response.data.tenantType || "Any",
        owner: response.data.ownerName || "Unassigned",
        status: response.data.status?.toLowerCase() || "active",
        totalRooms: 0,
        occupied: 0,
        _apiData: response.data
      };
      
      // Call parent onCreate with the enhanced property
      if (onCreate) {
        onCreate(enhancedProperty);
      }
      
      setLoading(false);
      onClose();
    } catch (err) {
      console.error('Submit error:', err);
      setError(err.message || 'Failed to create property');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl p-7 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-xl font-bold text-[#0F253B]">New Property</h3>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500"><X size={20} /></button>
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs font-bold rounded">{error}</div>}

        <form onSubmit={submit} className="space-y-5">
          {/* Property Details */}
          <SectionTitle>Property Details</SectionTitle>
          
          {/* Property Name */}
          <TextField 
            label="Property Name" 
            value={name} 
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Melrose House" 
            required 
          />

          {/* Address with autocomplete */}
          <div className="relative">
            <label className={LABEL}>Property Address *</label>
            <input 
              className={FIELD} 
              value={address} 
              onChange={handleAddressChange}
              placeholder="Start typing address..." 
              required 
            />
            
            {/* Location suggestions */}
            {suggestions.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                {suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleAddressSelect(suggestion)}
                    className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 transition-colors flex items-start gap-2 border-b border-gray-50 last:border-0"
                  >
                    <MapPin size={16} className="text-gray-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-[#0F253B]">
                        {suggestion.address?.name || suggestion.address?.address_line1 || suggestion.display_name?.split(',')[0] || 'Unknown'}
                      </p>
                      <p className="text-xs text-gray-400">
                        {suggestion.address?.city || suggestion.address?.town || suggestion.address?.village || ''}
                        {suggestion.address?.postcode && `, ${suggestion.address.postcode}`}
                      </p>
                    </div>
                  </button>
                ))}
                {loadingLocation && (
                  <div className="px-4 py-3 text-center">
                    <Loader2 size={16} className="animate-spin inline-block mr-2" />
                    <span className="text-sm text-gray-400">Searching...</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* City and Postcode */}
          <div className="grid grid-cols-2 gap-3">
            <TextField 
              label="City" 
              value={city} 
              onChange={(e) => setCity(e.target.value)} 
              placeholder="e.g., London" 
            />
            <TextField 
              label="Postcode" 
              value={postcode} 
              onChange={(e) => setPostcode(e.target.value)} 
              placeholder="e.g., NW2 4LX" 
            />
          </div>

          {/* Show coordinates if available */}
          {coordinates && (
            <div className="text-xs text-gray-400 bg-gray-50 p-2 rounded-lg">
              📍 Coordinates: {coordinates.lat.toFixed(6)}, {coordinates.lng.toFixed(6)}
            </div>
          )}

          {/* Description */}
          <TextAreaField 
            label="Description (optional)" 
            value={description} 
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add any additional details about the property..." 
          />

          {/* Owner */}
          <SectionTitle>Owner</SectionTitle>
          <TextField 
            label="Owner Name (optional)" 
            value={ownerName} 
            onChange={(e) => setOwnerName(e.target.value)}
            placeholder="e.g., John Smith" 
          />

          {/* Photos with Cloudinary upload */}
          <SectionTitle>Photos</SectionTitle>
          <div>
            <label className={LABEL}>Upload Images {uploadingImages && <Loader2 size={14} className="inline animate-spin ml-2" />}</label>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all ${dragging ? "border-[#F47C3C] bg-orange-50" : "border-gray-200 hover:border-[#F47C3C] hover:bg-gray-50"}`}
            >
              <div className="w-10 h-10 mx-auto rounded-xl bg-orange-50 text-[#F47C3C] flex items-center justify-center mb-2">
                {uploadingImages ? <Loader2 size={20} className="animate-spin" /> : <UploadCloud size={20} />}
              </div>
              <p className="text-sm font-bold text-[#0F253B]">Drag &amp; drop images</p>
              <p className="text-xs text-gray-400 font-medium">or click to browse (max 10MB each)</p>
              <input 
                ref={inputRef} 
                type="file" 
                accept="image/*" 
                multiple 
                className="hidden" 
                onChange={(e) => readFiles(e.target.files)} 
                disabled={uploadingImages}
              />
            </div>
            
            {coverImage && (
              <div className="mt-3 text-xs text-green-600 font-medium">
                ✓ Cover image uploaded
              </div>
            )}
            
            {images.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-3">
                {images.map((src, i) => (
                  <div key={i} className="relative group aspect-square rounded-xl overflow-hidden border border-gray-100">
                    <img src={src} alt={`upload-${i}`} className="w-full h-full object-cover" />
                    <button 
                      type="button" 
                      onClick={(e) => { e.stopPropagation(); removeImage(i); }} 
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={12} />
                    </button>
                    {i === 0 && <span className="absolute bottom-1 left-1 text-[9px] font-bold bg-[#0F253B] text-white px-1.5 py-0.5 rounded">Cover</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Rental Type */}
          <SectionTitle>Rental Type</SectionTitle>
          <div className="grid grid-cols-2 gap-2">
            {RENTAL_TYPES.map((t) => {
              const displayName = t.v === "SINGLE_LET" ? "Single Let" : t.v;
              const on = displayName === rentalType;
              return (
                <button key={t.v} type="button" onClick={() => setRentalType(t.v)}
                  className={`text-left p-3 rounded-2xl border transition-all ${on ? "border-[#F47C3C] bg-orange-50 ring-1 ring-[#F47C3C]/30" : "border-gray-100 hover:bg-gray-50"}`}>
                  <p className="font-bold text-sm text-[#0F253B]">{displayName}</p>
                  <p className="text-[11px] text-gray-400 font-medium leading-tight mt-0.5">{t.desc}</p>
                </button>
              );
            })}
          </div>

          {/* Tenant Type */}
          <div>
            <label className={LABEL}>Tenant Type</label>
            <Segmented options={TENANT_TYPES} value={tenantType} onChange={setTenantType} />
          </div>

          {/* Status */}
          <div>
            <label className={LABEL}>Status</label>
            <Segmented 
              options={["ACTIVE", "DRAFT", "ARCHIVED"]} 
              value={status} 
              onChange={setStatus} 
            />
          </div>

          <button type="submit" disabled={loading || uploadingImages} className="w-full py-3.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            {(loading || uploadingImages) && <Loader2 size={18} className="animate-spin" />}
            {loading ? 'Saving...' : uploadingImages ? 'Uploading Images...' : 'Create Property'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AdminProperties() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Fetch properties on mount
  useEffect(() => {
    fetchProperties();
  }, []);

  const fetchProperties = async (search = "") => {
    try {
      setLoading(true);
      setError("");
      const response = await apiService.getProperties({ search });
      
      // Transform API data to match frontend format
      const transformedData = (response.data || []).map(property => ({
        id: property._id,
        name: property.name,
        addressLine1: property.address?.line1 || property.name,
        area: property.address?.city || "",
        city: property.address?.city || "",
        postcode: property.address?.postcode || "",
        image: property.coverImage || img(property.name),
        images: property.gallery || [],
        type: property.rentalType === "SINGLE_LET" ? "Single Let" : property.rentalType,
        tenantType: property.tenantType || "Any",
        owner: property.ownerName || "Unassigned",
        status: property.status?.toLowerCase() || "active",
        totalRooms: property.roomStats?.total || 0,
        occupied: property.roomStats?.occupied || 0,
        _apiData: property // Keep original data
      }));
      
      setItems(transformedData);
    } catch (err) {
      console.error('Fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    const value = e.target.value;
    setQ(value);
    // Debounce search
    const timeoutId = setTimeout(() => {
      fetchProperties(value);
    }, 300);
    return () => clearTimeout(timeoutId);
  };

  const create = (property) => {
    // Add new property to the list
    setItems(prev => [property, ...prev]);
    setOpen(false);
  };

  const list = items.filter(
    (p) => p.name?.toLowerCase().includes(q.toLowerCase()) || (p.area || p.city || "").toLowerCase().includes(q.toLowerCase())
  );

  if (loading) {
    return (
      <div className="space-y-5">
        <PageHeader
          title="Properties"
          subtitle="Your portfolio — rooms, rent and occupancy"
          action={
            <button className="flex items-center gap-2 px-4 py-2.5 bg-[#F47C3C] text-white font-bold text-sm rounded-xl opacity-50 cursor-not-allowed">
              <Plus size={18} /> Add Property
            </button>
          }
        />
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-[#F47C3C] border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="mt-4 text-gray-600 font-medium">Loading properties...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Properties"
        subtitle="Your portfolio — rooms, rent and occupancy"
        action={
          <button 
            onClick={() => setOpen(true)} 
            className="flex items-center gap-2 px-4 py-2.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold text-sm rounded-xl transition-all active:scale-[0.98]"
          >
            <Plus size={18} /> Add Property
          </button>
        }
      />

      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
        <input 
          value={q} 
          onChange={handleSearch} 
          placeholder="Search properties…" 
          className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-[#F47C3C]" 
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
          <p className="font-bold">Error loading properties</p>
          <p className="text-sm">{error}</p>
          <button 
            onClick={() => fetchProperties(q)} 
            className="mt-2 px-4 py-2 bg-red-100 hover:bg-red-200 rounded-lg text-sm font-bold"
          >
            Retry
          </button>
        </div>
      )}

      {!error && list.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-2xl">
          <p className="text-gray-500 font-medium">No properties found</p>
          <p className="text-sm text-gray-400 mt-1">Try adjusting your search or add a new property</p>
          <button 
            onClick={() => setOpen(true)} 
            className="mt-4 px-6 py-2.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold text-sm rounded-xl transition-all"
          >
            Add Your First Property
          </button>
        </div>
      )}

      {!error && list.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {list.map((p) => {
            const occ = p.totalRooms ? Math.round((p.occupied / p.totalRooms) * 100) : 0;
            const isHMO = p.type === "HMO";
            const isSingle = p.type === "Single Let";
            return (
              <Link key={p.id} href={`/admin/properties/${p.id}`} className="group bg-white border border-gray-100 rounded-2xl overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all">
                <div className="relative h-44 bg-gradient-to-br from-[#0F253B] to-[#1c3e5e]">
                  <img src={p.image} alt={p.name} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                  <div className="absolute top-3 left-3 flex gap-2">
                    <Badge tone={typeTone(p.type)}>{p.type}</Badge>
                    <Badge tone="gray">{p.tenantType}</Badge>
                  </div>
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                    <p className="text-white font-bold text-lg leading-tight">{p.name}</p>
                    <p className="text-white/80 text-xs flex items-center gap-1"><MapPin size={11} />{[p.area, p.city].filter(Boolean).join(", ") || "No area"}</p>
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{isHMO ? "Total Rooms" : "Status"}</p>
                      <p className="text-xl font-bold text-[#0F253B]">
                        {isHMO ? `${p.totalRooms} rooms` : p.status}
                      </p>
                    </div>
                    {isHMO ? (
                      <div className="text-right">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-1 justify-end">Occupied</p>
                        <p className="text-xl font-bold text-[#0F253B]">{p.occupied}/{p.totalRooms}</p>
                      </div>
                    ) : (
                      <Badge tone={isSingle ? "gray" : "gray"}>
                        {isSingle ? "Single Let" : p.type}
                      </Badge>
                    )}
                  </div>
                  {isHMO && p.totalRooms > 0 && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                        <span className="text-gray-400 uppercase tracking-widest">Occupancy</span>
                        <span className="text-[#0F253B]">{occ}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div className="h-full bg-[#F47C3C] rounded-full" style={{ width: `${occ}%` }} />
                      </div>
                    </div>
                  )}
                  {p.owner && p.owner !== "Unassigned" && (
                    <p className="text-[11px] text-gray-500 font-semibold mt-3 flex items-center gap-1.5">
                      <UserRound size={12} className="text-[#F47C3C]" />
                      {p.owner}
                    </p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {open && <PropertyModal onClose={() => setOpen(false)} onCreate={create} />}
    </div>
  );
}