// The tenant report form's second level: under each category (the ids match
// StepOne's tiles) the specific problems a tenant can pick, each with optional
// self-help tips shown before they report — the cheapest repair is the one a
// tenant can sort themselves in two minutes.
//
// `emergency: true` on a category or an issue swaps the tips for a "stop and
// call" panel: the portal is not the place to report a gas leak.

// "Other" is appended to every category so a tenant is never stuck.
const OTHER = { id: "other", label: "Something else", tips: [] };

export const EMERGENCY_CATEGORIES = {
  gas: {
    title: "If you can smell gas, act now",
    steps: [
      "Do not use any electrical switches, naked flames or anything that could cause a spark.",
      "Turn off the gas at the meter if you can do so safely.",
      "Open doors and windows and leave the property.",
      "Call the National Gas Emergency line on 0800 111 999 (free, 24 hours).",
      "Once you are safe, report it below so we know.",
    ],
  },
  oil: {
    title: "If you can smell oil",
    steps: [
      "Do not smoke or use naked flames near the smell.",
      "Turn off the boiler and the oil supply valve if you can do so safely.",
      "Ventilate the area and keep children and pets away.",
      "Call us on our emergency line, then report it below.",
    ],
  },
  fire: {
    title: "If there is a fire, get out and call 999",
    steps: [
      "Leave the property immediately and close doors behind you.",
      "Do not stop to collect belongings or try to put out a large fire.",
      "Call 999 and ask for the Fire Service.",
      "Once you are safe, report any damage below.",
    ],
  },
};

const GUIDE = {
  bathroom: [
    { id: "blocked-toilet", label: "Toilet blocked", tips: [
      "Try a plunger: cover the outlet completely and push firmly 10–15 times.",
      "Pour a bucket of hot (not boiling) water from waist height into the bowl.",
      "Don't keep flushing a blocked toilet — it may overflow.",
    ] },
    { id: "toilet-not-flushing", label: "Toilet not flushing", tips: [
      "Lift the cistern lid and check the chain or lever is still connected.",
      "Check the cistern is filling — if not, the isolation valve on the pipe may be turned off.",
    ] },
    { id: "blocked-sink", label: "Sink, bath or shower drain blocked", tips: [
      "Remove and clean any hair from the plughole.",
      "Use a plunger, covering the overflow hole with a wet cloth.",
      "Try a drain unblocker from a supermarket, following the instructions.",
    ] },
    { id: "shower-not-working", label: "Shower not working", tips: [
      "For an electric shower, check the pull-cord switch outside the bathroom is on.",
      "Check the trip switches in the fuse box.",
      "If the water is weak, unscrew and descale the shower head.",
    ] },
    { id: "extractor-fan", label: "Extractor fan not working", tips: [
      "Check whether the fan has its own switch or isolator, often outside the bathroom.",
    ] },
    { id: "mould", label: "Mould or condensation", tips: [
      "Open a window or run the extractor fan during and after showers.",
      "Wipe down windows and walls when you see condensation.",
      "Small patches can be cleaned with a mould spray.",
    ] },
  ],
  kitchen: [
    { id: "oven", label: "Oven or hob not working", tips: [
      "Check the cooker switch on the wall is on.",
      "Check the trip switches in the fuse box.",
      "Some ovens have a clock/timer that must be set before they heat up.",
    ] },
    { id: "fridge", label: "Fridge or freezer not cold", tips: [
      "Check it is plugged in and switched on at the wall.",
      "Check the temperature dial hasn't been turned down.",
      "Make sure the door is closing fully and the seal is clean.",
    ] },
    { id: "kitchen-sink", label: "Kitchen sink blocked", tips: [
      "Use a plunger with the overflow covered.",
      "Clear food from the plughole; avoid pouring fat down the sink.",
    ] },
    { id: "cupboards", label: "Cupboard or drawer broken", tips: [] },
    { id: "appliance", label: "Dishwasher or other appliance", tips: [
      "Check the plug, the wall switch and the trip switches.",
      "For a dishwasher, clean the filter in the bottom of the machine.",
    ] },
  ],
  heating: [
    { id: "no-heating", label: "No heating", tips: [
      "Check the thermostat is set above room temperature and the timer is on.",
      "Check the boiler pressure gauge reads between 1 and 1.5 bar.",
      "Try resetting the boiler using the reset button (see the boiler manual).",
      "If you have a prepayment meter, check there is credit.",
    ] },
    { id: "no-hot-water", label: "No hot water", tips: [
      "Check the hot water setting on the boiler or programmer is on.",
      "Check the boiler pressure is between 1 and 1.5 bar.",
      "Try resetting the boiler.",
    ] },
    { id: "radiator-cold", label: "Radiator cold", tips: [
      "If it's cold at the top, bleed it with a radiator key (with the heating off).",
      "Check the valve at the side is turned open.",
    ] },
    { id: "boiler-error", label: "Boiler showing an error code", tips: [
      "Note down the error code — it helps the engineer.",
      "Try the reset button once. If the error returns, report it.",
    ] },
    { id: "boiler-leak", label: "Boiler leaking", tips: [
      "Put a container under the leak and turn the boiler off.",
    ] },
  ],
  water: [
    { id: "major-leak", label: "Major leak or flooding", emergency: true, tips: [] },
    { id: "dripping-tap", label: "Dripping tap", tips: [] },
    { id: "pipe-leak", label: "Small leak from a pipe", tips: [
      "Put a container underneath and a towel around the pipe.",
      "If you can, turn off the isolation valve on the pipe feeding it.",
    ] },
    { id: "no-water", label: "No water", tips: [
      "Check with neighbours or your water supplier for outages in the area.",
      "Check the stopcock (usually under the kitchen sink) is turned on.",
    ] },
    { id: "low-pressure", label: "Low water pressure", tips: [
      "Check the stopcock is fully open.",
      "Unscrew and clean the tap aerator or shower head.",
    ] },
    { id: "damp", label: "Damp patch on wall or ceiling", tips: [] },
  ],
  doors: [
    { id: "locked-out", label: "Locked out", tips: [
      "Check whether a housemate is home or can let you in.",
    ] },
    { id: "lock-broken", label: "Lock broken or stiff", tips: [
      "Try a little graphite or lock lubricant in the keyhole (not oil).",
    ] },
    { id: "door-not-closing", label: "Door not closing properly", tips: [] },
    { id: "front-door-insecure", label: "Front door won't lock (property insecure)", emergency: true, tips: [] },
    { id: "handle", label: "Handle loose or broken", tips: [] },
  ],
  floors: [
    { id: "crack", label: "Crack in wall or ceiling", tips: [] },
    { id: "ceiling-damage", label: "Ceiling sagging or water stain", tips: [
      "If a ceiling is sagging with water, keep out of the room and put a bucket under it.",
    ] },
    { id: "flooring", label: "Carpet or flooring damaged", tips: [] },
    { id: "plaster", label: "Plaster coming away", tips: [] },
  ],
  lighting: [
    { id: "bulb", label: "Light not working", tips: [
      "Try a new bulb first — replacing bulbs is usually the tenant's responsibility.",
      "Check the trip switches in the fuse box.",
    ] },
    { id: "fitting", label: "Light fitting broken", tips: [] },
    { id: "flickering", label: "Lights flickering", tips: [
      "Check the bulb is screwed in firmly.",
    ] },
  ],
  window: [
    { id: "wont-open", label: "Window won't open or close", tips: [] },
    { id: "broken-glass", label: "Broken glass", tips: [
      "Keep clear of the glass and cover the gap if you can do so safely.",
    ] },
    { id: "lock", label: "Window lock broken", tips: [] },
    { id: "condensation", label: "Condensation or draught", tips: [
      "Open trickle vents at the top of the window if fitted.",
    ] },
  ],
  garden: [
    { id: "fence", label: "Fence or gate damaged", tips: [] },
    { id: "gutters", label: "Gutters blocked or leaking", tips: [] },
    { id: "bins", label: "Bins missing or damaged", tips: [
      "Lost or damaged council bins can usually be replaced through the council's website.",
    ] },
    { id: "overgrown", label: "Garden overgrown", tips: [] },
  ],
  laundry: [
    { id: "washer", label: "Washing machine not working", tips: [
      "Check it's plugged in and switched on at the wall.",
      "Make sure the door is fully closed and the water tap behind it is on.",
      "Clean the filter (usually behind a small flap at the bottom front).",
    ] },
    { id: "dryer", label: "Dryer not working", tips: [
      "Empty the lint filter and the water container.",
    ] },
  ],
  furniture: [
    { id: "bed", label: "Bed or mattress", tips: [] },
    { id: "wardrobe", label: "Wardrobe or drawers", tips: [] },
    { id: "chair-table", label: "Chair, sofa or table", tips: [] },
  ],
  electricity: [
    { id: "no-power", label: "No power", tips: [
      "Check the trip switches in the fuse box and reset any that have tripped.",
      "If it trips again straight away, unplug everything and reset it, then plug items back in one at a time to find the faulty one.",
      "If you have a prepayment meter, check there is credit.",
      "Check with neighbours or your supplier for a power cut.",
    ] },
    { id: "socket", label: "Socket not working", tips: [
      "Try another appliance in the socket.",
      "Check the trip switches.",
    ] },
    { id: "sparking", label: "Sparking, burning smell or exposed wires", emergency: true, tips: [] },
  ],
  internet: [
    { id: "no-internet", label: "No internet", tips: [
      "Restart the router: unplug it for 30 seconds, then plug it back in.",
      "Check the provider's service status page for outages.",
    ] },
    { id: "slow", label: "Slow or unreliable Wi-Fi", tips: [
      "Restart the router.",
      "Try moving closer to the router to see if it's a signal problem.",
    ] },
  ],
  alarm: [
    { id: "beeping", label: "Smoke or CO alarm beeping", tips: [
      "A single chirp every minute or so usually means the battery is low.",
      "Press the test/hush button. Never remove an alarm or its battery without replacing it.",
    ] },
    { id: "co-alarm", label: "Carbon monoxide alarm sounding", emergency: true, tips: [] },
    { id: "missing", label: "Alarm missing or not working", tips: [] },
  ],
  pests: [
    { id: "mice", label: "Mice or rats", tips: [
      "Keep food in sealed containers and clear crumbs.",
    ] },
    { id: "insects", label: "Insects (ants, cockroaches, bed bugs)", tips: [] },
    { id: "wasps", label: "Wasp nest", tips: [
      "Keep away from the nest and keep windows near it closed.",
    ] },
  ],
  roof: [
    { id: "roof-leak", label: "Roof leaking", tips: [
      "Put a container under the drip and move belongings away.",
    ] },
    { id: "tiles", label: "Missing or loose tiles", tips: [] },
  ],
  shared: [
    { id: "hallway-light", label: "Hallway or stair lighting", tips: [] },
    { id: "entry-system", label: "Door entry / intercom", tips: [] },
    { id: "lift", label: "Lift not working", tips: [] },
    { id: "cleaning", label: "Communal cleaning", tips: [] },
  ],
  meters: [
    { id: "meter-fault", label: "Meter faulty or not showing", tips: [] },
    { id: "prepayment", label: "Prepayment meter problem", tips: [
      "Check your key or card has credit and try re-inserting it.",
      "Your energy supplier can help with top-up and emergency credit problems.",
    ] },
  ],
  stairs: [
    { id: "handrail", label: "Handrail loose or broken", tips: [] },
    { id: "step", label: "Step or stair carpet damaged", tips: [] },
  ],
  services: [
    { id: "keys", label: "Keys or fobs", tips: [] },
    { id: "cleaning", label: "Cleaning", tips: [] },
    { id: "waste", label: "Waste collection", tips: [] },
  ],
  gas: [{ id: "smell-gas", label: "I can smell gas", emergency: true, tips: [] }],
  oil: [{ id: "smell-oil", label: "I can smell oil", emergency: true, tips: [] }],
  fire: [{ id: "fire", label: "Fire or fire damage", emergency: true, tips: [] }],
  other: [],
};

// The issues a tenant can pick under a category. "Other" alone has only the
// catch-all, so the step is skipped straight to "describe it".
export const issuesFor = (categoryId) => {
  const list = GUIDE[categoryId] || [];
  return categoryId === "gas" || categoryId === "oil" || categoryId === "fire" ? list : [...list, OTHER];
};

// The "stop and call" panel for an emergency category or issue, or null.
export const emergencyFor = (categoryId, issue) => {
  if (EMERGENCY_CATEGORIES[categoryId]) return EMERGENCY_CATEGORIES[categoryId];
  if (issue?.emergency) {
    return {
      title: "This sounds like an emergency",
      steps: [
        "Make yourself and others safe first.",
        "Call our emergency line now so we can send someone straight away.",
        "Then report it below with a photo or video if it is safe to take one.",
      ],
    };
  }
  return null;
};
