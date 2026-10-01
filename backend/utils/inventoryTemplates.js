// utils/inventoryTemplates.js
//
// The built-in room / area templates for Inventory Reports, and the report's
// fixed wording (schedule of condition subjects, key exchange text, disclaimer).
//
// Every template here is modelled on the office's reference check-out report
// (SPI.London, 53 Rowsley Ave) — its areas, the items it lists in each and the
// order it lists them in — so a report started from a template reads like that
// document rather than a generic checklist. Descriptions are the typical ones
// from the reference; staff overwrite them for the actual property.
//
// Organisations can save their own templates on top of these (InventoryTemplate
// model); the built-ins are never stored, so improving one here reaches every
// organisation without a migration.

// MUST stay in sync with AREA_TYPES in frontend/src/app/utils/inventoryReports.js.
export const AREA_TYPES = [
  "FRONT_OF_PROPERTY",
  "ENTRANCE_HALLWAY",
  "BEDROOM",
  "EN_SUITE",
  "BATHROOM",
  "WC",
  "KITCHEN",
  "RECEPTION",
  "STAIRWELL",
  "LANDING",
  "GARDEN",
  "COMMUNAL",
  "OTHER",
];

export const AREA_LABELS = {
  FRONT_OF_PROPERTY: "Front of Property",
  ENTRANCE_HALLWAY: "Entrance and Hallway",
  BEDROOM: "Bedroom",
  EN_SUITE: "En Suite",
  BATHROOM: "Bathroom",
  WC: "WC",
  KITCHEN: "Kitchen",
  RECEPTION: "Reception",
  STAIRWELL: "Stairwell",
  LANDING: "Landing",
  GARDEN: "Garden",
  COMMUNAL: "Communal Area",
  OTHER: "Other",
};

// [item, description] pairs. A blank item continues the item above it, the
// way the reference lists "Door" then "1x chrome lever handle" beneath it.
const row = (item, description = "") => ({ item, description });

// The door group every internal room in the reference opens with.
const DOOR_GROUP = [
  row("Door", "White wood panelled"),
  row("", "1x chrome lever handle"),
  row("Door Frame", "White wood"),
  row("Reverse of Door", "White wood panelled"),
  row("", "1x chrome lever handle"),
  row("Door Frame Reverse", "White wood"),
];

const SURFACES = [
  row("Flooring", "Grey laminate"),
  row("Skirting Boards", "Painted white"),
  row("Walls", "Painted white"),
  row("Coving", "Painted white"),
  row("Ceiling", "Painted white"),
  row("Lighting", "1x ceiling mounted light fitting"),
];

const WET_SURFACES = [
  row("Flooring", "Grey tiles"),
  row("Walls", "Tiled cream"),
  row("Ceiling", "Painted white"),
  row("Lighting", "1x ceiling mounted light fitting"),
];

export const BUILT_IN_TEMPLATES = [
  {
    key: "builtin:FRONT_OF_PROPERTY",
    areaType: "FRONT_OF_PROPERTY",
    name: "Front of Property",
    items: [
      row("Ground", "Paved surface"),
      row("Wheelie bins", "Bins to front"),
      row("Food waste bins"),
      row("Front lantern"),
      row("Front Door", "Painted wood door"),
      row("", "Door knocker"),
      row("", "House numeral"),
      row("", "Letterbox entry"),
      row("", "Pull handle"),
      row("", "YALE lock"),
      row("", "CHUBB lock"),
      row("Door Frame", "White painted wood"),
      row("Reverse of Door", "White painted wood"),
      row("", "Bolts"),
      row("", "Spyhole"),
      row("", "Reverse of YALE lock"),
      row("Doorbell"),
    ],
  },
  {
    key: "builtin:ENTRANCE_HALLWAY",
    areaType: "ENTRANCE_HALLWAY",
    name: "Entrance and Hallway",
    items: [
      row("Flooring", "Grey laminate surface"),
      row("", "Wood bead skirting painted white"),
      row("Skirting Boards", "Painted white"),
      row("Walls", "Painted white"),
      row("Coving", "Painted white"),
      row("Ceiling", "Painted white"),
      row("Lighting", "Ceiling mounted spotlight fittings"),
      row("Heating", "1x wall mounted white radiator"),
      row("Shelf Unit"),
      row("Digital Thermostat Control", "1x wall mounted"),
      row("Time Switch Control", "1x wall mounted"),
      row("Under Stairs Cupboard", "1x white wood door"),
      row("", "White wood doorframe"),
      row("Smoke Alarm"),
      row("Meter Cupboard"),
      row("Switches & Sockets", "White single light switch"),
      row("", "White double plug sockets"),
    ],
  },
  {
    key: "builtin:BEDROOM",
    areaType: "BEDROOM",
    name: "Bedroom",
    items: [
      ...DOOR_GROUP,
      row("Flooring", "Grey laminate"),
      row("", "Painted white wood bead skirting"),
      ...SURFACES.slice(1),
      row("Window", "1x white UPVC, opening windows with standard lever handles, painted white windowsill"),
      row("Curtains", "Curtains"),
      row("Blinds", "Plastic slatted venetian blinds"),
      row("Heating", "1x wall mounted white radiator"),
      row("Switches & Sockets", "1x white single light switch"),
      row("", "White double plug sockets"),
      row("Smoke Alarm"),
      row("Bed", "1x double divan"),
      row("Mattress", "1x double mattress"),
      row("Wardrobe"),
      row("Chest of Drawers"),
      row("Desk"),
      row("Chair"),
    ],
  },
  {
    key: "builtin:EN_SUITE",
    areaType: "EN_SUITE",
    name: "En Suite",
    items: [
      row("Door", "White wood panelled"),
      row("", "1x chrome lever handle"),
      row("Door Frame", "White wood"),
      row("Reverse of Door", "White wood panelled"),
      row("", "1x chrome lever handle with twist lock"),
      row("Door Frame Reverse", "White wood"),
      ...WET_SURFACES,
      row("Toilet", "1x white\nWhite toilet seat and lid\nDouble chrome flush"),
      row("Washbasin", "1x white\nChrome mixer tap\nChrome waste and plug"),
      row("", "1x fitted cupboard below sink"),
      row(
        "Shower Cubicle",
        "1x glass panelled with chrome edging\nWhite shower tray\nChrome plug\nChrome shower dial\nChrome shower hose, showerhead and bracket"
      ),
      row("Mirror"),
      row("Extractor Fan", "1x wall mounted"),
      row("Switches & Sockets", "Pull cord shower switch and pull cord light switch"),
    ],
  },
  {
    key: "builtin:BATHROOM",
    areaType: "BATHROOM",
    name: "Bathroom",
    items: [
      row("Door", "White wood panelled"),
      row("", "1x chrome lever handle"),
      row("Door Frame", "White wood"),
      row("Reverse of Door", "White wood panelled"),
      row("", "1x chrome lever handle"),
      row("", "1x stainless steel twist lock"),
      row("Door Frame Reverse", "White wood"),
      row("Flooring", "Grey tile"),
      row("Walls", "Tiled cream"),
      row("Ceiling", "Painted white"),
      row("Lighting", "Recessed spotlights"),
      row("Window", "White wood frame, 1x opening window, standard lever handle"),
      row("Mirror", "1x wall mounted"),
      row("Extractor Fan", "1x wall mounted, white"),
      row("Heating", "1x wall mounted towel rail heater"),
      row("Toilet", "1x white\nWhite toilet seat and lid\nDouble chrome flush button"),
      row("Washbasin", "1x white\nChrome mixer tap\nChrome waste and plug"),
      row("", "1x fitted double cupboard below sink"),
      row(
        "Bathtub",
        "1x white\nChrome chain and plug\nChrome mixer tap\nChrome shower hose, showerhead and bracket\nShower curtain rail\n1x shower curtain"
      ),
      row("Shower", "Shower screen / cubicle"),
      row("Switches & Sockets", "Pull cord shower switch and pull cord light switch"),
    ],
  },
  {
    key: "builtin:WC",
    areaType: "WC",
    name: "WC",
    items: [
      row("Door", "White wood panelled"),
      row("", "Chrome lever handle"),
      row("Door Frame", "White wood"),
      row("Reverse of Door", "White wood panelled"),
      row("", "Chrome lever handle"),
      row("Flooring", "Grey tile"),
      row("Walls", "Tiled cream"),
      row("Ceiling", "Painted white"),
      row("Lighting", "Ceiling mounted circular flush light"),
      row("Window", "White wood frame, 1x opening window, standard lever handle, tiled sill"),
      row("Heating", "1x wall mounted towel rail heater"),
      row("Toilet", "1x white\nWhite toilet seat and lid\nChrome double flush button"),
      row("Corner Washbasin", "1x white\nChrome mixer tap"),
      row("Toilet Brush and Holder", "1x"),
      row("Switches & Sockets", "1x pull cord light switch"),
    ],
  },
  {
    key: "builtin:KITCHEN",
    areaType: "KITCHEN",
    name: "Kitchen",
    items: [
      row("Door", "White wood panelled"),
      row("", "1x stainless steel lever handle"),
      row("Door Frame", "White wood"),
      row("Reverse of Door", "White wood"),
      row("", "1x chrome lever handle"),
      row("Door Frame Reverse", "White wood"),
      row("Flooring", "Grey tiles"),
      row("Skirting Boards", "Tiled grey"),
      row("Walls", "Tiled cream"),
      row("Ceiling", "Painted white"),
      row("Lighting", "Ceiling mounted spotlight tracks"),
      row("Smoke Alarm"),
      row("Garden Door", "1x white UPVC, lever handle with twist lock"),
      row("Windows", "White UPVC, opening windows, standard lever handles"),
      row("Heating", "1x wall mounted white radiator"),
      row("Worktop", "Grey laminate"),
      row("Sink", "1x stainless steel\nChrome mixer tap"),
      row("Kitchen Units", "Wall mounted cupboard units"),
      row("", "Wall mounted boiler"),
      row("", "Base cupboard units"),
      row("", "Base drawer unit"),
      row("Appliances", "Gas / electric hob"),
      row("", "Extractor hood"),
      row("", "Oven"),
      row("", "Microwave"),
      row("", "Kettle"),
      row("", "Toaster"),
      row("", "Upright fridge freezer"),
      row("", "Freezer compartments and shelves"),
      row("", "Washing machine"),
      row("Switches & Sockets", "White double light switch"),
      row("", "White double plug sockets"),
      row("", "White isolator switch"),
      row("", "White fuse switch"),
      row("Fire Blanket"),
    ],
  },
  {
    key: "builtin:RECEPTION",
    areaType: "RECEPTION",
    name: "Reception",
    items: [
      ...DOOR_GROUP,
      row("Flooring", "Grey wood laminate"),
      row("", "White wood bead skirting"),
      ...SURFACES.slice(1, 5),
      row("Lighting", "Ceiling mounted spotlight tracks"),
      row("", "Wall mounted spotlight"),
      row("Windows", "White UPVC"),
      row("Patio / Garden Doors"),
      row("Curtains"),
      row("Blinds"),
      row("Heating", "1x wall mounted white radiator"),
      row("Switches & Sockets", "White light switch"),
      row("", "White double plug sockets"),
      row("Furniture", "Sofa"),
      row("", "Coffee table"),
      row("", "Dining table and chairs"),
      row("", "TV unit"),
    ],
  },
  {
    key: "builtin:STAIRWELL",
    areaType: "STAIRWELL",
    name: "Stairwell",
    items: [
      row("Flooring", "Grey carpeted"),
      row("Newel Post, Banister Rail and Spindles", "Painted white"),
      row("Skirting Board", "Painted white"),
      row("Walls", "Painted white"),
      row("Ceiling", "Painted white"),
      row("Lighting"),
      row("Window", "White wood frame, 1x opening window"),
    ],
  },
  {
    key: "builtin:LANDING",
    areaType: "LANDING",
    name: "Landing",
    items: [
      row("Flooring", "Grey laminate surface"),
      row("", "Wood bead skirting"),
      row("Skirting Board", "Painted white"),
      row("Walls", "Painted white"),
      row("Ceiling", "Painted white"),
      row("Lighting", "Ceiling mounted spotlight fittings"),
      row("Smoke Alarm"),
      row("Loft Hatch", "White painted underside and frame surround"),
      row("Heating", "1x wall mounted white radiator"),
      row("Fitted Cupboard", "White wood door"),
      row("", "Painted white frame"),
      row("", "Reverse of door painted white"),
      row("", "To inside: flooring, hanging rail, walls"),
      row("Switches & Sockets", "White single light switches"),
      row("", "White double plug socket"),
      row("", "White fuse switch"),
    ],
  },
  {
    key: "builtin:GARDEN",
    areaType: "GARDEN",
    name: "Garden",
    items: [
      row("Ground", "Concrete surface"),
      row("Grassed area"),
      row("Fencing"),
      row("Garage / Shed"),
      row("Outside Lighting"),
      row("Outside Tap"),
      row("Bins"),
    ],
  },
  {
    key: "builtin:COMMUNAL",
    areaType: "COMMUNAL",
    name: "Communal Area",
    items: [
      row("Entrance Door"),
      row("Flooring"),
      row("Walls"),
      row("Ceiling"),
      row("Lighting"),
      row("Smoke Alarm"),
      row("Fire Door"),
      row("Fire Extinguisher"),
      row("Emergency Lighting"),
      row("Notice Board"),
      row("Post Boxes"),
    ],
  },
  {
    key: "builtin:OTHER",
    areaType: "OTHER",
    name: "Other / Blank",
    items: [row("Flooring"), row("Walls"), row("Ceiling"), row("Lighting")],
  },
];

// The "Schedule of Condition" summary page — the subjects the reference rates
// the whole property on, grouped the same way (general, bathroom, kitchen).
export const SCHEDULE_OF_CONDITION = [
  { group: "", subject: "General Cleanliness" },
  { group: "", subject: "Decorative Condition" },
  { group: "", subject: "Flooring" },
  { group: "", subject: "Lighting" },
  { group: "", subject: "Windows" },
  { group: "", subject: "Curtains/Blinds" },
  { group: "", subject: "Furnishings" },
  { group: "Bathroom", subject: "Toilet" },
  { group: "Bathroom", subject: "Wash Basin" },
  { group: "Bathroom", subject: "Bath" },
  { group: "Bathroom", subject: "Shower" },
  { group: "Kitchen", subject: "Oven" },
  { group: "Kitchen", subject: "Hob" },
  { group: "Kitchen", subject: "Extractor Hood" },
  { group: "Kitchen", subject: "Fridge/Freezer" },
  { group: "Kitchen", subject: "Washing Machine" },
  { group: "Kitchen", subject: "Microwave" },
  { group: "Kitchen", subject: "Kettle" },
  { group: "Kitchen", subject: "Toaster" },
  { group: "", subject: "Garden" },
  { group: "", subject: "Smoke Alarm/s" },
];

export const DEFAULT_METERS = [
  { type: "Electric", reading: "", serialNumber: "", location: "", keyType: "" },
  { type: "Gas", reading: "", serialNumber: "", location: "", keyType: "" },
  { type: "Water", reading: "", serialNumber: "", location: "", keyType: "" },
];

// `{company}` is replaced with the organisation's name when the report is
// created, so the wording is the company's own and can then be edited.
export const SCHEDULE_NOTE =
  "Whilst every care is taken to ensure the accuracy of this inventory, it is the responsibility of the Landlord, Tenant and/or any other involved parties to verify its content. Discrepancies relating to any descriptions or content must be emailed to {company} within 7 days of receiving this report. {company} will not be held responsible for any errors, omissions or differences in opinion after this time.\n\nThis Inventory has been prepared on the accepted principle that in the absence of comment an item is free from obvious damage or soiling.\n\nThe schedule of condition provides an overview of the property. The descriptions and comments in the report provide a greater accuracy in the event of any inconsistencies.";

export const KEY_EXCHANGE_NOTE =
  "Verification of the official key exchange is held in this section. If this section is empty the key exchange is pending or tenants were not present.";

export const SIGNATURE_NOTE =
  "By signing below, you confirm that you have received / returned the keys to the property. You will have 7 days upon receipt to register any queries with {company}, otherwise it is understood you agree with the content of the report regardless of presence of signatures. If the property is rented to multiple tenants, one tenant's signature or one tenant receiving the report denotes approval of all tenants.";

export const DEFAULT_DISCLAIMER = `This inventory provides a fair and accurate record of the contents and condition of the property as well as the property's internal condition. No attempt has been made to value the property or any of its contents. This inventory is prepared as an "as seen snapshot" of the property and its contents at the time of the inspection. It is compiled as a fair and accurate record of the property's internal condition and its contents and should not be used as an accurate description of each and every piece of furniture and equipment, or as a structural survey report.

The clerk preparing this inventory is neither an expert on fabrics, woods, materials, antiques, etc. nor qualified to value or survey any item. They are not required to state whether an item is antique, made of precious metals, of unique origin, or whether it is new despite the appearance of being so.

Please be advised that items left in lofts, cellars, locked rooms, garages and sheds that have not been noted in the inventory are the sole responsibility of the landlord.

The movement of any items of heavy furniture or appliances will not be undertaken and therefore some observations may be restricted.

Where inventories are completed with tenants in situ, it is impossible for clerks to differentiate between property belonging to the landlord or the tenant.

Since the accuracy of this inventory lies with the Landlord and Tenant, it is recommended that any queries or discrepancies relating to the description or content be addressed to {company} within 7 days of receipt of this report.

Safety Disclaimer
The Inventory relates only to the furniture, furnishings and all the landlord's equipment and contents in the property. It is no guarantee of the safety of any such equipment or contents, rather a record that such items exist in the property at the date of the inventory and the superficial condition of the items. None of the electrical or gas appliances have been checked as to working order.

Furniture & Furnishings – Fire / Safety Regulations 1988 as amended 1993
Relevant furniture and furnishings that have the appropriate label complying with the above regulations will be indicated on the inventory as "fire resistant". There is no correlation on whether the landlord is in compliance with the laws and regulations in the event that appropriate labels are not identified or noted in the report.

Smoke Detectors
It is the tenant's responsibility to inspect all smoke detectors fitted in the property at regular intervals to ensure they are in full working order as per the manufacturer's instructions.

Check out and inspection at the end of the tenancy
It is essential that all items be returned to their respective locations as shown on the original inventory before the final check out is due. Failure to do this may incur further costs, as the clerks are not commissioned to search for items not found as listed. Furthermore, items may be listed as missing which may incur tenants unnecessary costs.

This report remains the property of {company} and cannot be used or duplicated without written permission.`;

export const withCompany = (text, company) =>
  String(text || "").replace(/\{company\}/g, company || "the agent");
