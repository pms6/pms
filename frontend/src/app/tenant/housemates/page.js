"use client";

import { useEffect, useState } from "react";
import { User } from "lucide-react";
import { useAuth } from "@/app/Context/AuthContext";
import api from "@/app/api/api";

// Round avatar that shows the housemate's picture, or a fallback user icon.
function Avatar({ src, alt, size = "md" }) {
  const dims =
    size === "lg"
      ? "w-16 h-16 sm:w-20 sm:h-20"
      : "w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16";
  return (
    <div
      className={`${dims} rounded-full bg-slate-50 flex items-center justify-center border border-slate-100 overflow-hidden flex-shrink-0`}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className="w-full h-full object-cover" />
      ) : (
        <User size={size === "lg" ? 28 : 22} className="text-slate-400" />
      )}
    </div>
  );
}

export default function HousematesPage() {
  const { profile, user } = useAuth();

  const [housemates, setHousemates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await api.get("/tenancies/housemates");
        if (active) setHousemates(res.data?.data || []);
      } catch (err) {
        if (active)
          setError(
            err?.response?.data?.message || "Failed to load housemates."
          );
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // The signed-in tenant's own details for the footer card.
  const myName =
    [profile?.firstName, profile?.lastName].filter(Boolean).join(" ") ||
    user?.name ||
    "You";
  const myOccupation = profile?.jobTitle || "";
  const myBio = profile?.about || "";

  return (
    <div className="max-w-6xl mx-auto px-0.5 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16">

      {/* Header */}
      <header className="mb-8 sm:mb-10 lg:mb-12">
        <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight">
          My Housemates
        </h1>
        <p className="text-sm sm:text-base text-slate-500 mt-2">
          Connect with the people you live with.
        </p>
      </header>

      {/* States */}
      {loading ? (
        <div className="py-16 text-center text-slate-500">
          Loading housemates…
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700">
          {error}
        </div>
      ) : housemates.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-12 text-center">
          <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100">
            <User size={24} className="text-slate-400" />
          </div>
          <p className="text-slate-600 font-medium">No housemates yet</p>
          <p className="text-sm text-slate-400 mt-1">
            When other tenants move into your property, they&apos;ll appear here.
          </p>
        </div>
      ) : (
        /* Grid */
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          {housemates.map((mate) => (
            <article
              key={mate.id}
              className="bg-white border border-slate-200 p-5 sm:p-6 lg:p-8 rounded-2xl transition-shadow duration-300 hover:border-slate-300"
            >
              {/* Top Row */}
              <div className="flex items-start gap-4">
                <Avatar src={mate.profileImage} alt={mate.name} />

                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg font-semibold text-slate-900">
                    {mate.name}
                  </h3>

                  <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-slate-500 mt-1">
                    {mate.gender && <span>{mate.gender}</span>}
                    {mate.gender && mate.age && (
                      <span className="w-1 h-1 rounded-full bg-slate-300" />
                    )}
                    {mate.age && <span>{mate.age}</span>}
                  </div>
                </div>

                {mate.room && (
                  <span className="ml-auto text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50 px-2 sm:px-3 py-1 rounded-full border border-slate-100 whitespace-nowrap">
                    {mate.room}
                  </span>
                )}
              </div>

              {/* Occupation */}
              {mate.occupation && (
                <p className="mt-4 text-xs sm:text-sm font-medium text-slate-500">
                  {mate.occupation}
                </p>
              )}

              {/* Bio */}
              {mate.bio && (
                <p className="mt-3 sm:mt-4 text-slate-600 leading-relaxed font-light italic text-sm sm:text-base">
                  “{mate.bio}”
                </p>
              )}

              {/* Interests */}
              {mate.interests?.length > 0 && (
                <div className="mt-4 sm:mt-6 flex flex-wrap gap-2">
                  {mate.interests.map((label) => (
                    <div
                      key={label}
                      className="flex items-center gap-1.5 bg-slate-50 border border-slate-100 px-2 sm:px-3 py-1.5 rounded-md text-[11px] sm:text-[13px] font-medium text-slate-700"
                    >
                      {label}
                    </div>
                  ))}
                </div>
              )}
            </article>
          ))}
        </section>
      )}

      {/* Footer Profile — the signed-in tenant */}
      <section className="mt-10 sm:mt-12 p-5 sm:p-6 lg:p-8 rounded-2xl bg-slate-900 text-white flex flex-col sm:flex-row items-start sm:items-center gap-6 sm:gap-8">
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/5 flex items-center justify-center border border-white/10 overflow-hidden flex-shrink-0">
          {profile?.profileImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.profileImage}
              alt={myName}
              className="w-full h-full object-cover"
            />
          ) : (
            <User size={28} />
          )}
        </div>

        <div>
          <h2 className="text-lg sm:text-xl font-medium">{myName}</h2>
          {myOccupation && (
            <p className="text-slate-400 text-xs sm:text-sm mt-1">
              {myOccupation}
            </p>
          )}
          {myBio && (
            <p className="mt-3 sm:mt-4 text-slate-300 italic text-sm">
              &quot;{myBio}&quot;
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
