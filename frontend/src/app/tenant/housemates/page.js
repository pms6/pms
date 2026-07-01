"use client";

import {
  User,
  Dumbbell,
  Popcorn,
  Tv,
  Gamepad2,
  Music,
} from "lucide-react";

const HOUSEMATES = [
  {
    id: 1,
    room: "Room 1",
    name: "Jefferson",
    gender: "Male",
    age: "Early 30s",
    occupation: "Sports Therapist",
    bio: "Football is my day gig, normally try to keep fit and healthy.",
    interests: [
      { label: "Fitness", icon: Dumbbell },
      { label: "Sports", icon: Dumbbell },
      { label: "Games", icon: Gamepad2 },
      { label: "TV", icon: Tv },
    ],
  },
  {
    id: 2,
    room: "Room 3",
    name: "Aidan",
    gender: "Male",
    age: "Early 30s",
    occupation: "Community Worker",
    bio: "One day we'll fly away.",
    interests: [
      { label: "Fitness", icon: Dumbbell },
      { label: "Movies", icon: Popcorn },
      { label: "Games", icon: Gamepad2 },
      { label: "TV", icon: Tv },
    ],
  },
  {
    id: 3,
    room: "Room 4",
    name: "Tristram",
    gender: "Male",
    age: "33 Years",
    occupation: "Charities Fundraiser",
    bio: "When I'm not playing sport I'm thinking about playing sport.",
    interests: [
      { label: "Fitness", icon: Dumbbell },
      { label: "Sports", icon: Dumbbell },
      { label: "Games", icon: Gamepad2 },
      { label: "TV", icon: Tv },
    ],
  },
  {
    id: 4,
    room: "Room 5",
    name: "Esme",
    gender: "Female",
    age: "Mid 30s",
    occupation: "Aromatherapist",
    bio: "Can you keep up with me?",
    interests: [
      { label: "Fitness", icon: Dumbbell },
      { label: "Movies", icon: Popcorn },
      { label: "Music", icon: Music },
      { label: "TV", icon: Tv },
    ],
  },
];

export default function HousematesPage() {
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

      {/* Grid */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">

        {HOUSEMATES.map((mate) => (
          <article
            key={mate.id}
            className="bg-white border border-slate-200 p-5 sm:p-6 lg:p-8 rounded-2xl transition-shadow duration-300 hover:border-slate-300"
          >

            {/* Top Row */}
            <div className="flex items-start gap-4">

              <div className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100 flex-shrink-0">
                <User size={22} className="text-slate-400" />
              </div>

              <div className="min-w-0">
                <h3 className="text-base sm:text-lg font-semibold text-slate-900">
                  {mate.name}
                </h3>

                <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-slate-500 mt-1">
                  <span>{mate.gender}</span>
                  <span className="w-1 h-1 rounded-full bg-slate-300" />
                  <span>{mate.age}</span>
                </div>
              </div>

              <span className="ml-auto text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50 px-2 sm:px-3 py-1 rounded-full border border-slate-100 whitespace-nowrap">
                {mate.room}
              </span>

            </div>

            {/* Bio */}
            <p className="mt-4 sm:mt-6 text-slate-600 leading-relaxed font-light italic text-sm sm:text-base">
              “{mate.bio}”
            </p>

            {/* Interests */}
            <div className="mt-4 sm:mt-6 flex flex-wrap gap-2">
              {mate.interests.map((i) => (
                <div
                  key={i.label}
                  className="flex items-center gap-1.5 bg-slate-50 border border-slate-100 px-2 sm:px-3 py-1.5 rounded-md text-[11px] sm:text-[13px] font-medium text-slate-700"
                >
                  <i.icon size={14} className="text-slate-400" />
                  {i.label}
                </div>
              ))}
            </div>

          </article>
        ))}
      </section>

      {/* Footer Profile */}
      <section className="mt-10 sm:mt-12 p-5 sm:p-6 lg:p-8 rounded-2xl bg-slate-900 text-white flex flex-col sm:flex-row items-start sm:items-center gap-6 sm:gap-8">

        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/5 flex items-center justify-center border border-white/10 flex-shrink-0">
          <User size={28} />
        </div>

        <div>
          <h2 className="text-lg sm:text-xl font-medium">Jonah</h2>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            Environmental Health Officer
          </p>
          <p className="mt-3 sm:mt-4 text-slate-300 italic text-sm">
            "I'm Jonah. What more do I need to say?"
          </p>
        </div>

      </section>

    </div>
  );
}