"use client";

import React, { useRef, useState } from "react";
import { User, Camera, Briefcase, GraduationCap, Save } from "lucide-react";
import { useAuth } from "@/app/Context/AuthContext";
import uploadToCloudinary from "@/app/utils/uploadToCloudinary";

const EMPTY_FORM = {
  firstName: "",
  lastName: "",
  dob: "",
  gender: "",
  profileType: "",
  occupation: "",
  bio: "",
  interests: [],
};

// Map the stored tenant profile → the shape this form works with.
const profileToForm = (p) => ({
  firstName: p?.firstName || "",
  lastName: p?.lastName || "",
  dob: p?.birthdate ? String(p.birthdate).slice(0, 10) : "",
  gender: p?.gender || "",
  profileType: p?.occupationType || "",
  occupation: p?.jobTitle || "",
  bio: p?.about || "",
  interests: Array.isArray(p?.interests) ? p.interests : [],
});

export default function ProfilePage() {
  const { profile, loading, updateProfile } = useAuth();

  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null); // { type: "success"|"error", message }
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef(null);

  // Hydrate the form from the loaded profile. Using the "adjust state during
  // render when a prop changes" pattern (rather than an effect) means the form
  // re-syncs whenever the stored profile reference changes — on first load and
  // after a save — without clobbering the user's edits while they type.
  const [syncedProfile, setSyncedProfile] = useState(null);
  if (profile && profile !== syncedProfile) {
    setSyncedProfile(profile);
    setForm(profileToForm(profile));
  }

  const interestOptions = [
    "Arts & Crafts","Fitness","Food","Games","Movies","Music","Nights Out",
    "Parties","Quiet Nights","Reading","Sports","Travelling","Video Games",
    "Nature","TV",
  ];

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const toggleInterest = (interest) => {
    setForm((prev) => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter((i) => i !== interest)
        : [...prev.interests, interest],
    }));
  };

  const handleCancel = () => {
    setForm(profile ? profileToForm(profile) : EMPTY_FORM);
    setStatus(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setStatus(null);
    try {
      await updateProfile({
        firstName: form.firstName,
        lastName: form.lastName,
        birthdate: form.dob || null,
        gender: form.gender || undefined,
        occupationType: form.profileType || undefined,
        jobTitle: form.occupation,
        about: form.bio,
        interests: form.interests,
      });
      setStatus({ type: "success", message: "Profile saved successfully." });
    } catch (err) {
      setStatus({
        type: "error",
        message:
          err?.response?.data?.message || "Failed to save profile. Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleImageSelect = async (e) => {
    const file = e.target.files?.[0];
    // Reset the input so selecting the same file again still fires onChange.
    e.target.value = "";
    if (!file) return;

    setUploadingImage(true);
    setStatus(null);
    try {
      const { url } = await uploadToCloudinary(file);
      // Persist immediately so the new picture survives a refresh; updateProfile
      // also refreshes the shared auth profile, so the avatar updates everywhere.
      await updateProfile({ profileImage: url });
      setStatus({ type: "success", message: "Profile picture updated." });
    } catch (err) {
      setStatus({
        type: "error",
        message: err?.message || "Failed to upload picture. Please try again.",
      });
    } finally {
      setUploadingImage(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center text-gray-500">
        Loading your profile…
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-0.5 sm:px-6 lg:px-0 py-6 sm:py-10 space-y-6 sm:space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#0F253B]">
          My Profile
        </h1>
        <p className="text-sm sm:text-base text-gray-500 mt-1">
          Manage how your profile appears to your property manager and housemates.
        </p>
      </div>

      {/* Main Card */}
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-gray-100 p-5 sm:p-8">

        {/* Profile Image */}
        <div className="flex flex-col items-center mb-8 sm:mb-10">

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageSelect}
          />

          <div className="relative">
            <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-full bg-gray-100 border-4 border-gray-200 flex items-center justify-center overflow-hidden">
              {uploadingImage ? (
                <span className="text-xs text-gray-500">Uploading…</span>
              ) : profile?.profileImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.profileImage}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              ) : (
                <User size={50} className="sm:w-[60px] sm:h-[60px] text-gray-400" />
              )}
            </div>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingImage}
              className="absolute bottom-0 right-0 w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-[#F47C3C] text-white flex items-center justify-center disabled:opacity-60"
            >
              <Camera size={16} className="sm:w-[18px] sm:h-[18px]" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingImage}
            className="mt-4 text-sm font-semibold text-[#F47C3C] hover:underline disabled:opacity-60"
          >
            {uploadingImage ? "Uploading…" : "Upload Profile Picture"}
          </button>
        </div>

        {/* Personal Info */}
        <h2 className="text-lg sm:text-xl font-bold text-[#0F253B] mb-4 sm:mb-5">
          Personal Information
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">

          <Input label="First Name" name="firstName" value={form.firstName} onChange={handleChange} />
          <Input label="Surname" name="lastName" value={form.lastName} onChange={handleChange} />

          <Input label="Date of Birth" type="date" name="dob" value={form.dob} onChange={handleChange} />

          <div>
            <label className="block text-sm font-semibold mb-2">Gender</label>
            <select
              name="gender"
              value={form.gender}
              onChange={handleChange}
              className="w-full border rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#F47C3C] outline-none"
            >
              <option value="">Select…</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
              <option value="PREFER_NOT_SAY">Prefer not to say</option>
            </select>
          </div>

        </div>

        {/* Profile Type */}
        <div className="mt-8 sm:mt-10">

          <h2 className="text-lg sm:text-xl font-bold text-[#0F253B] mb-4 sm:mb-5">
            I am a...
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            <RoleButton
              active={form.profileType === "PROFESSIONAL"}
              onClick={() => setForm({ ...form, profileType: "PROFESSIONAL" })}
              icon={<Briefcase />}
              title="Professional"
              desc="Currently working"
            />

            <RoleButton
              active={form.profileType === "STUDENT"}
              onClick={() => setForm({ ...form, profileType: "STUDENT" })}
              icon={<GraduationCap />}
              title="Student"
              desc="Currently studying"
            />

          </div>
        </div>

        {/* Occupation */}
        <div className="mt-8 sm:mt-10">
          <label className="block font-semibold mb-2">Working As</label>
          <input
            name="occupation"
            value={form.occupation}
            onChange={handleChange}
            className="w-full border rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#F47C3C] outline-none"
          />
        </div>

        {/* Bio */}
        <div className="mt-8 sm:mt-10">
          <label className="block font-semibold mb-2">A Little Bit About Me</label>
          <textarea
            rows={4}
            name="bio"
            value={form.bio}
            onChange={handleChange}
            className="w-full border rounded-xl px-4 py-3 resize-none focus:ring-2 focus:ring-[#F47C3C] outline-none"
          />
        </div>

        {/* Interests */}
        <div className="mt-8 sm:mt-10">
          <h2 className="text-lg sm:text-xl font-bold text-[#0F253B] mb-4 sm:mb-5">
            Interests
          </h2>

          <div className="flex flex-wrap gap-2 sm:gap-3">
            {interestOptions.map((item) => {
              const active = form.interests.includes(item);

              return (
                <button
                  key={item}
                  onClick={() => toggleInterest(item)}
                  className={`px-4 sm:px-5 py-2 rounded-full border text-xs sm:text-sm font-medium transition ${
                    active
                      ? "bg-[#F47C3C] text-white border-[#F47C3C]"
                      : "border-gray-300 hover:border-[#F47C3C]"
                  }`}
                >
                  {item}
                </button>
              );
            })}
          </div>
        </div>

        {/* Status message */}
        {status && (
          <div
            className={`mt-8 rounded-xl px-4 py-3 text-sm font-medium ${
              status.type === "success"
                ? "bg-green-50 text-green-700 border border-green-200"
                : "bg-red-50 text-red-700 border border-red-200"
            }`}
          >
            {status.message}
          </div>
        )}

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row justify-end gap-3 sm:gap-4 mt-8 sm:mt-12">

          <button
            onClick={handleCancel}
            disabled={saving}
            className="w-full sm:w-auto px-6 py-3 rounded-xl border border-gray-300 font-semibold hover:bg-gray-50 disabled:opacity-60"
          >
            Cancel
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 sm:px-7 py-3 rounded-xl bg-[#F47C3C] text-white font-semibold hover:bg-[#e56f2d] disabled:opacity-60"
          >
            <Save size={18} />
            {saving ? "Saving…" : "Save Profile"}
          </button>

        </div>

      </div>
    </div>
  );
}

/* Small reusable components */
function Input({ label, ...props }) {
  return (
    <div>
      <label className="block text-sm font-semibold mb-2">{label}</label>
      <input
        {...props}
        className="w-full border rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#F47C3C] outline-none"
      />
    </div>
  );
}

function RoleButton({ active, icon, title, desc, ...props }) {
  return (
    <button
      {...props}
      className={`border rounded-2xl p-4 sm:p-5 flex items-center gap-4 transition text-left ${
        active ? "border-[#F47C3C] bg-orange-50" : "border-gray-200"
      }`}
    >
      {icon}
      <div>
        <p className="font-bold text-sm sm:text-base">{title}</p>
        <p className="text-xs sm:text-sm text-gray-500">{desc}</p>
      </div>
    </button>
  );
}
