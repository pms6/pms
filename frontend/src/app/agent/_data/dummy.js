/**
 * Design-only dummy data for the admin section.
 * No backend — everything here is static sample data to demonstrate the UI/flow.
 * Images use Lorem Picsum seeded URLs so they render consistently offline-ish.
 */

export const img = (seed, w = 800, h = 500) => `https://picsum.photos/seed/${seed}/${w}/${h}`;

export const stats = {
  properties: 12,
  rooms: 63,
  occupancyRate: 92,
  occupied: 58,
  vacant: 4,
  maintenance: 1,
  monthlyRevenue: 41250,
  outstanding: 3180,
  activeTenancies: 58,
  newLeads: 9,
  upcomingViewings: 5,
  openMaintenance: 7,
  complianceDue: 3,
};

export const revenueSeries = [
  { m: "Jan", v: 34 }, { m: "Feb", v: 37 }, { m: "Mar", v: 36 },
  { m: "Apr", v: 39 }, { m: "May", v: 42 }, { m: "Jun", v: 41 },
  { m: "Jul", v: 44 },
];

export const activity = [
  { id: 1, who: "Aisha Patel", action: "signed the tenancy agreement", target: "Elm Court · Room 4", time: "12m ago", tone: "green" },
  { id: 2, who: "James Lo", action: "passed referencing", target: "Maple House · Studio", time: "1h ago", tone: "blue" },
  { id: 3, who: "System", action: "flagged Gas Safety expiring", target: "12 Oak Street", time: "3h ago", tone: "amber" },
  { id: 4, who: "Tom Reeves", action: "booked a viewing", target: "Elm Court · Room 2", time: "5h ago", tone: "orange" },
  { id: 5, who: "Sarah Khan", action: "submitted an application", target: "Maple House · Room 1", time: "Yesterday", tone: "gray" },
];

export const RENTAL_TYPES = [
  { v: "HMO", desc: "Individual rooms let separately (shared house)", tone: "orange" },
  { v: "Single Let", desc: "Whole property let to one tenant or group", tone: "blue" },
  { v: "Short-term Let", desc: "Daily or weekly bookings", tone: "green" },
  { v: "Block", desc: "A block of units managed together", tone: "amber" },
];

export const TENANT_TYPES = ["Any", "Professionals", "Students", "Social"];
export const GUARANTOR_REQ = ["Not Required", "Sometimes Required", "Always Required"];
export const LETTING_STATUS = ["Available", "Available Soon", "Occupied"];
export const LETTING_STATUS_TONE = { Available: "green", "Available Soon": "amber", Occupied: "orange" };

export const properties = [
  {
    id: "p1",
    name: "18 Elm Court",
    image: img("elmcourt"),
    addressLine1: "18 Elm Court",
    area: "Woodhouse",
    city: "Leeds",
    postcode: "LS2 9JT",
    type: "HMO",
    tenantType: "Professionals",
    status: "active",
    owner: "Northern Lettings Ltd",
    rentFrom: 575,
    rentTo: 725,
    totalRooms: 6,
    occupied: 4,
    rooms: [
      { id: "r1", name: "Room 1", rent: 650, moneyHeld: 750, guarantor: "Sometimes Required", status: "Occupied", tenant: "Aisha Patel", image: img("room-1", 600, 400) },
      { id: "r2", name: "Room 2", rent: 725, moneyHeld: 830, guarantor: "Not Required", status: "Occupied", tenant: "David Owusu", image: img("room-2", 600, 400) },
      { id: "r3", name: "Room 3", rent: 575, moneyHeld: 660, guarantor: "Always Required", status: "Available", tenant: null, image: img("room-3", 600, 400) },
      { id: "r4", name: "Room 4", rent: 650, moneyHeld: 750, guarantor: "Sometimes Required", status: "Occupied", tenant: "Marta Kfor", image: img("room-4", 600, 400) },
      { id: "r5", name: "Room 5", rent: 700, moneyHeld: 800, guarantor: "Not Required", status: "Available Soon", tenant: null, image: img("room-5", 600, 400) },
      { id: "r6", name: "Room 6", rent: 590, moneyHeld: 680, guarantor: "Sometimes Required", status: "Occupied", tenant: "P. Nowak", image: img("room-6", 600, 400) },
    ],
  },
  {
    id: "p2",
    name: "42 Maple Avenue",
    image: img("maplehouse"),
    addressLine1: "42 Maple Avenue",
    area: "Headingley",
    city: "Leeds",
    postcode: "LS6 2AB",
    type: "HMO",
    tenantType: "Students",
    status: "active",
    owner: "J. Whitfield",
    rentFrom: 600,
    rentTo: 780,
    totalRooms: 5,
    occupied: 4,
    rooms: [
      { id: "r7", name: "Studio", rent: 780, moneyHeld: 900, guarantor: "Not Required", status: "Occupied", image: img("room-7", 600, 400) },
      { id: "r8", name: "Room 1", rent: 660, moneyHeld: 760, guarantor: "Sometimes Required", status: "Occupied", image: img("room-8", 600, 400) },
      { id: "r9", name: "Room 2", rent: 600, moneyHeld: 690, guarantor: "Always Required", status: "Occupied", image: img("room-9", 600, 400) },
      { id: "r10", name: "Room 3", rent: 665, moneyHeld: 765, guarantor: "Sometimes Required", status: "Available", image: img("room-10", 600, 400) },
      { id: "r11", name: "Room 4", rent: 740, moneyHeld: 850, guarantor: "Not Required", status: "Occupied", image: img("room-11", 600, 400) },
    ],
  },
  {
    id: "p3",
    name: "12 Oak Street",
    image: img("oakstreet"),
    addressLine1: "12 Oak Street",
    area: "Burley",
    city: "Leeds",
    postcode: "LS4 1DR",
    type: "Single Let",
    tenantType: "Any",
    status: "active",
    owner: "Northern Lettings Ltd",
    rentFrom: 1450,
    rentTo: 1450,
    totalRooms: 1,
    occupied: 1,
    letting: { rent: 1450, moneyHeld: 1670, guarantor: "Always Required", status: "Occupied", tenant: "The Bennett Family" },
    rooms: [],
  },
  {
    id: "p4",
    name: "5 Riverside Way",
    image: img("riverside"),
    addressLine1: "5 Riverside Way",
    area: "City Centre",
    city: "Leeds",
    postcode: "LS1 4EX",
    type: "HMO",
    tenantType: "Any",
    status: "active",
    owner: "Aqua Holdings",
    rentFrom: 620,
    rentTo: 690,
    totalRooms: 4,
    occupied: 3,
    rooms: [
      { id: "r13", name: "Room A", rent: 690, moneyHeld: 790, guarantor: "Not Required", status: "Occupied", tenant: "H. Suzuki", image: img("room-13", 600, 400) },
      { id: "r14", name: "Room B", rent: 680, moneyHeld: 780, guarantor: "Sometimes Required", status: "Occupied", tenant: "F. Costa", image: img("room-14", 600, 400) },
      { id: "r15", name: "Room C", rent: 620, moneyHeld: 710, guarantor: "Always Required", status: "Available", tenant: null, image: img("room-15", 600, 400) },
      { id: "r16", name: "Room D", rent: 690, moneyHeld: 790, guarantor: "Not Required", status: "Occupied", tenant: "N. Silva", image: img("room-16", 600, 400) },
    ],
  },
];

export const LEAD_STAGES = ["new", "qualified", "viewing", "converted", "lost"];

export const leads = [
  { id: "l1", name: "Sarah Khan", email: "sarah.k@email.com", phone: "07700 900123", source: "Rightmove", interestedIn: "Maple House · Room 1", budget: 700, assignedTo: "Ella Moore", status: "qualified", createdAt: "2026-06-28" },
  { id: "l2", name: "Tom Reeves", email: "tom.reeves@email.com", phone: "07700 900456", source: "SpareRoom", interestedIn: "Elm Court · Room 2", budget: 750, assignedTo: "Ella Moore", status: "viewing", createdAt: "2026-06-27" },
  { id: "l3", name: "Aisha Patel", email: "aisha.p@email.com", phone: "07700 900789", source: "Website", interestedIn: "Elm Court · Room 4", budget: 650, assignedTo: "Sam Reed", status: "converted", createdAt: "2026-06-20" },
  { id: "l4", name: "James Lo", email: "james.lo@email.com", phone: "07700 900222", source: "Referral", interestedIn: "Maple House · Studio", budget: 800, assignedTo: "Sam Reed", status: "converted", createdAt: "2026-06-18" },
  { id: "l5", name: "Grace Bennett", email: "grace.b@email.com", phone: "07700 900333", source: "Zoopla", interestedIn: "Riverside · Room C", budget: 650, assignedTo: "Ella Moore", status: "new", createdAt: "2026-06-30" },
  { id: "l6", name: "Mo Farah", email: "mo.f@email.com", phone: "07700 900555", source: "OpenRent", interestedIn: "Elm Court · Room 3", budget: 600, assignedTo: "Sam Reed", status: "new", createdAt: "2026-06-30" },
  { id: "l7", name: "Lucy Zhang", email: "lucy.z@email.com", phone: "07700 900666", source: "Rightmove", interestedIn: "Riverside · Room C", budget: 640, assignedTo: "Ella Moore", status: "qualified", createdAt: "2026-06-29" },
  { id: "l8", name: "Ben Carter", email: "ben.c@email.com", phone: "07700 900777", source: "SpareRoom", interestedIn: "Maple House", budget: 620, assignedTo: "Sam Reed", status: "lost", createdAt: "2026-06-15" },
];

export const viewings = [
  { id: "v1", date: "2026-07-01", time: "10:30", lead: "Tom Reeves", property: "Elm Court HMO", room: "Room 2", agent: "Ella Moore", status: "scheduled" },
  { id: "v2", date: "2026-07-01", time: "13:00", lead: "Grace Bennett", property: "Riverside Apartments", room: "Room C", agent: "Sam Reed", status: "scheduled" },
  { id: "v3", date: "2026-07-01", time: "16:15", lead: "Lucy Zhang", property: "Riverside Apartments", room: "Room C", agent: "Ella Moore", status: "scheduled" },
  { id: "v4", date: "2026-07-02", time: "11:00", lead: "Mo Farah", property: "Elm Court HMO", room: "Room 3", agent: "Sam Reed", status: "scheduled" },
  { id: "v5", date: "2026-06-29", time: "14:30", lead: "Sarah Khan", property: "Maple House", room: "Room 1", agent: "Ella Moore", status: "done" },
  { id: "v6", date: "2026-06-28", time: "09:45", lead: "Ben Carter", property: "Maple House", room: "Room 4", agent: "Sam Reed", status: "cancelled" },
];

export const ONBOARDING_STAGES = [
  "Application",
  "Referencing",
  "Right to Rent",
  "Guarantor",
  "Deposit",
  "Agreement",
  "Move-in",
];

export const onboarding = [
  {
    id: "o1",
    name: "Aisha Patel",
    avatarSeed: "aisha",
    email: "aisha.p@email.com",
    phone: "07700 900789",
    dob: "1998-04-12",
    nationality: "British",
    currentAddress: "77 Hyde Park Rd, Leeds LS6 1AF",
    stageIndex: 5,
    holdingDeposit: 250,
    employment: { employer: "NHS Leeds", jobTitle: "Staff Nurse", type: "Full-time", annualIncome: 34000, startDate: "2022-09-01" },
    rightToRent: { status: "verified", docType: "Passport", docNumber: "5334xxxx", expiry: "2030-01-01", shareCode: "—" },
    references: { previousLandlord: "passed", employer: "passed", credit: "passed" },
    guarantor: { name: "Raj Patel", relationship: "Father", annualIncome: 52000, address: "9 Elmwood, Bradford BD1 2QP", phone: "07700 900901", status: "approved" },
    tenancy: { property: "Elm Court HMO", room: "Room 4", rent: 650, frequency: "monthly", deposit: 750, startDate: "2026-07-05", termMonths: 12 },
    depositScheme: { provider: "DPS", status: "protected", ref: "DPS-88213" },
    documents: [
      { name: "Passport.pdf", type: "ID", status: "verified" },
      { name: "Payslip-May.pdf", type: "Proof of income", status: "verified" },
      { name: "BankStatement.pdf", type: "Bank statement", status: "verified" },
    ],
  },
  {
    id: "o2",
    name: "James Lo",
    avatarSeed: "james",
    email: "james.lo@email.com",
    phone: "07700 900222",
    dob: "1995-11-03",
    nationality: "Hong Kong (BNO)",
    currentAddress: "12 Cardigan Rd, Leeds LS6 3AB",
    stageIndex: 3,
    holdingDeposit: 250,
    employment: { employer: "Sky Betting", jobTitle: "Data Analyst", type: "Full-time", annualIncome: 41000, startDate: "2023-02-15" },
    rightToRent: { status: "verified", docType: "Share code", docNumber: "—", expiry: "2027-06-01", shareCode: "ABC-123-XYZ" },
    references: { previousLandlord: "passed", employer: "pending", credit: "passed" },
    guarantor: { name: "—", relationship: "—", annualIncome: 0, address: "—", phone: "—", status: "not_required" },
    tenancy: { property: "Maple House", room: "Studio", rent: 780, frequency: "monthly", deposit: 900, startDate: "2026-07-12", termMonths: 12 },
    depositScheme: { provider: "MyDeposits", status: "pending", ref: "—" },
    documents: [
      { name: "BNO-Visa.pdf", type: "ID", status: "verified" },
      { name: "Contract.pdf", type: "Proof of income", status: "pending" },
    ],
  },
  {
    id: "o3",
    name: "Sarah Khan",
    avatarSeed: "sarah",
    email: "sarah.k@email.com",
    phone: "07700 900123",
    dob: "2000-07-21",
    nationality: "British",
    currentAddress: "3 Woodhouse Ln, Leeds LS2 3AX",
    stageIndex: 1,
    holdingDeposit: 250,
    employment: { employer: "University of Leeds", jobTitle: "PhD Student", type: "Student", annualIncome: 19000, startDate: "2024-10-01" },
    rightToRent: { status: "pending", docType: "Passport", docNumber: "5011xxxx", expiry: "2029-03-01", shareCode: "—" },
    references: { previousLandlord: "pending", employer: "n/a", credit: "pending" },
    guarantor: { name: "Fatima Khan", relationship: "Mother", annualIncome: 38000, address: "22 Beeston Rd, Leeds LS11 6AA", phone: "07700 900902", status: "pending" },
    tenancy: { property: "Maple House", room: "Room 1", rent: 660, frequency: "monthly", deposit: 760, startDate: "2026-08-01", termMonths: 12 },
    depositScheme: { provider: "TDS", status: "not_started", ref: "—" },
    documents: [
      { name: "Passport.pdf", type: "ID", status: "verified" },
      { name: "StudentFinance.pdf", type: "Proof of income", status: "pending" },
    ],
  },
  {
    id: "o4",
    name: "David Owusu",
    avatarSeed: "david",
    email: "david.o@email.com",
    phone: "07700 900444",
    dob: "1992-01-30",
    nationality: "British",
    currentAddress: "50 Kirkstall Rd, Leeds LS3 1LG",
    stageIndex: 6,
    holdingDeposit: 250,
    employment: { employer: "Jet2", jobTitle: "Software Engineer", type: "Full-time", annualIncome: 58000, startDate: "2021-05-10" },
    rightToRent: { status: "verified", docType: "Passport", docNumber: "9921xxxx", expiry: "2031-08-01", shareCode: "—" },
    references: { previousLandlord: "passed", employer: "passed", credit: "passed" },
    guarantor: { name: "—", relationship: "—", annualIncome: 0, address: "—", phone: "—", status: "not_required" },
    tenancy: { property: "Elm Court HMO", room: "Room 2", rent: 725, frequency: "monthly", deposit: 830, startDate: "2026-06-15", termMonths: 12 },
    depositScheme: { provider: "DPS", status: "protected", ref: "DPS-88104" },
    documents: [
      { name: "Passport.pdf", type: "ID", status: "verified" },
      { name: "Payslip.pdf", type: "Proof of income", status: "verified" },
      { name: "Reference.pdf", type: "Landlord reference", status: "verified" },
    ],
  },
];

export const team = [
  { id: "u1", name: "Sharjeel Sohail", email: "admin@northernlettings.com", role: "admin", status: "active", avatarSeed: "sharjeel" },
  { id: "u2", name: "Ella Moore", email: "ella@northernlettings.com", role: "agent", status: "active", avatarSeed: "ella" },
  { id: "u3", name: "Sam Reed", email: "sam@northernlettings.com", role: "agent", status: "active", avatarSeed: "sam" },
  { id: "u4", name: "Priya Shah", email: "priya@northernlettings.com", role: "finance", status: "active", avatarSeed: "priya" },
  { id: "u5", name: "Mark Davies", email: "mark@northernlettings.com", role: "manager", status: "invited", avatarSeed: "mark" },
];

export const OWNER_STATUS = [
  { v: "lead", label: "Lead", tone: "blue" },
  { v: "in_progress", label: "In Progress", tone: "amber" },
  { v: "live", label: "Live", tone: "green" },
];

export const owners = [
  {
    id: "ow1", name: "Northern Lettings Ltd", company: true, email: "accounts@northernlettings.com",
    phone: "0113 496 0001", avatarSeed: "northern", properties: ["Elm Court HMO", "12 Oak Street"],
    propertyCount: 2, maintenance: 500, monthlyIncome: 4990,
    bank: { account: "****8842" }, status: "live", payoutStatus: "paid",
    notes: "Prefers monthly statements by email. Long-standing client since 2021.",
    files: ["Management Agreement.pdf", "ID Verification.pdf"],
  },
  {
    id: "ow2", name: "J. Whitfield", company: false, email: "j.whitfield@email.com",
    phone: "07700 900910", avatarSeed: "whitfield", properties: ["Maple House"],
    propertyCount: 1, maintenance: 300, monthlyIncome: 3445,
    bank: { account: "****2201" }, status: "in_progress", payoutStatus: "due",
    notes: "Onboarding — awaiting signed management agreement.",
    files: ["Draft Agreement.pdf"],
  },
  {
    id: "ow3", name: "Aqua Holdings", company: true, email: "finance@aquaholdings.co.uk",
    phone: "0161 496 0002", avatarSeed: "aqua", properties: ["Riverside Apartments"],
    propertyCount: 1, maintenance: 200, monthlyIncome: 2060,
    bank: { account: "****5510" }, status: "lead", payoutStatus: "pending",
    notes: "New enquiry via referral. Portfolio expansion planned Q4.",
    files: [],
  },
];

export const rentSummary = {
  dueThisMonth: 41250,
  collected: 38070,
  outstanding: 3180,
  overdue: 1240,
  collectionRate: 92,
};

export const rentCharges = [
  { id: "rc1", tenant: "Aisha Patel", property: "Elm Court HMO", room: "Room 4", amount: 650, dueDate: "2026-07-01", status: "paid", method: "Direct Debit", paidDate: "2026-07-01" },
  { id: "rc2", tenant: "David Owusu", property: "Elm Court HMO", room: "Room 2", amount: 725, dueDate: "2026-07-01", status: "paid", method: "Direct Debit", paidDate: "2026-07-01" },
  { id: "rc3", tenant: "James Lo", property: "Maple House", room: "Studio", amount: 780, dueDate: "2026-07-01", status: "due", method: "Card", paidDate: null },
  { id: "rc4", tenant: "Sarah Khan", property: "Maple House", room: "Room 1", amount: 660, dueDate: "2026-06-28", status: "overdue", method: "Bank transfer", paidDate: null },
  { id: "rc5", tenant: "Marta Kfor", property: "Elm Court HMO", room: "Room 6", amount: 590, dueDate: "2026-07-01", status: "partial", method: "Card", paidDate: "2026-07-01" },
  { id: "rc6", tenant: "H. Suzuki", property: "Riverside Apartments", room: "Room A", amount: 690, dueDate: "2026-07-01", status: "paid", method: "Direct Debit", paidDate: "2026-07-02" },
  { id: "rc7", tenant: "F. Costa", property: "Riverside Apartments", room: "Room B", amount: 680, dueDate: "2026-07-01", status: "due", method: "Direct Debit", paidDate: null },
  { id: "rc8", tenant: "The Bennett Family", property: "12 Oak Street", room: "Whole property", amount: 1450, dueDate: "2026-07-01", status: "paid", method: "Standing order", paidDate: "2026-07-01" },
];

export const maintenance = [
  { id: "m1", ref: "MR-1042", title: "Boiler not heating", property: "Elm Court HMO", room: "Room 5", priority: "urgent", status: "in_progress", reportedBy: "David Owusu", supplier: "Leeds Heating Co.", cost: 180, category: "Heating", date: "2026-06-30", image: img("maint-1", 400, 300) },
  { id: "m2", ref: "MR-1039", title: "Leaking tap", property: "Elm Court HMO", room: "Room 3", priority: "med", status: "assigned", reportedBy: "Marta Kfor", supplier: "AquaFix Plumbing", cost: 60, category: "Plumbing", date: "2026-06-29", image: img("maint-2", 400, 300) },
  { id: "m3", ref: "MR-1036", title: "Broken window latch", property: "12 Oak Street", room: "Bedroom 2", priority: "low", status: "open", reportedBy: "The Bennett Family", supplier: null, cost: null, category: "General", date: "2026-06-28", image: img("maint-3", 400, 300) },
  { id: "m4", ref: "MR-1033", title: "Mould in bathroom", property: "Maple House", room: "Room 2", priority: "high", status: "in_progress", reportedBy: "P. Nowak", supplier: "FreshWalls Ltd", cost: 240, category: "Damp", date: "2026-06-27", image: img("maint-4", 400, 300) },
  { id: "m5", ref: "MR-1028", title: "Faulty smoke alarm", property: "Riverside Apartments", room: "Communal", priority: "urgent", status: "closed", reportedBy: "N. Silva", supplier: "SafeGuard Electrical", cost: 45, category: "Electrical", date: "2026-06-22", image: img("maint-5", 400, 300) },
  { id: "m6", ref: "MR-1025", title: "Fridge not cooling", property: "Maple House", room: "Kitchen", priority: "med", status: "closed", reportedBy: "K. Adeyemi", supplier: "ColdTech", cost: 95, category: "Appliance", date: "2026-06-20", image: img("maint-6", 400, 300) },
];

export const reports = {
  // Income vs expenses (£k) per month — pairs with revenueSeries months.
  incomeExpenses: [
    { m: "Jan", income: 34, expenses: 9 },
    { m: "Feb", income: 37, expenses: 11 },
    { m: "Mar", income: 36, expenses: 8 },
    { m: "Apr", income: 39, expenses: 12 },
    { m: "May", income: 42, expenses: 10 },
    { m: "Jun", income: 41, expenses: 13 },
    { m: "Jul", income: 44, expenses: 9 },
  ],
  occupancyTrend: [
    { m: "Jan", v: 84 }, { m: "Feb", v: 86 }, { m: "Mar", v: 88 },
    { m: "Apr", v: 87 }, { m: "May", v: 90 }, { m: "Jun", v: 91 }, { m: "Jul", v: 92 },
  ],
  leadSources: [
    { source: "Rightmove", count: 34, tone: "bg-[#F47C3C]" },
    { source: "SpareRoom", count: 22, tone: "bg-[#0F253B]" },
    { source: "Zoopla", count: 16, tone: "bg-blue-500" },
    { source: "Website", count: 12, tone: "bg-emerald-500" },
    { source: "Referral", count: 9, tone: "bg-amber-500" },
  ],
  expenseBreakdown: [
    { label: "Maintenance", pct: 38, tone: "bg-[#F47C3C]" },
    { label: "Management fees", pct: 24, tone: "bg-[#0F253B]" },
    { label: "Utilities", pct: 18, tone: "bg-blue-500" },
    { label: "Compliance", pct: 12, tone: "bg-amber-500" },
    { label: "Other", pct: 8, tone: "bg-gray-400" },
  ],
  arrears: [
    { bucket: "0–7 days", amount: 940 },
    { bucket: "8–30 days", amount: 1240 },
    { bucket: "31–60 days", amount: 620 },
    { bucket: "60+ days", amount: 380 },
  ],
  files: [
    { id: "rf1", name: "Monthly Rent Statement", desc: "Rent collected, due & arrears", period: "July 2026", generatedAt: "2026-07-01", type: "Finance" },
    { id: "rf2", name: "Owner Settlement Statements", desc: "Per-owner payouts & deductions", period: "June 2026", generatedAt: "2026-06-30", type: "Finance" },
    { id: "rf3", name: "Portfolio Occupancy Report", desc: "Occupancy by property & room", period: "Q2 2026", generatedAt: "2026-06-30", type: "Operations" },
    { id: "rf4", name: "Compliance Status Report", desc: "Certificates, expiries & gaps", period: "July 2026", generatedAt: "2026-07-01", type: "Compliance" },
    { id: "rf5", name: "Maintenance Spend Report", desc: "Costs by property & category", period: "Q2 2026", generatedAt: "2026-06-30", type: "Operations" },
    { id: "rf6", name: "Lead Conversion Report", desc: "Sources, viewings & conversions", period: "Q2 2026", generatedAt: "2026-06-30", type: "Lettings" },
    { id: "rf7", name: "Tax & Expense Summary", desc: "Income & allowable expenses", period: "2025/26", generatedAt: "2026-04-06", type: "Finance" },
  ],
};

export const finances = {
  summary: { income: 289400, expenses: 72300, net: 217100, margin: 75 }, // YTD £
  cashflow: [
    { m: "Jan", income: 34, expenses: 9 },
    { m: "Feb", income: 37, expenses: 11 },
    { m: "Mar", income: 36, expenses: 8 },
    { m: "Apr", income: 39, expenses: 12 },
    { m: "May", income: 42, expenses: 10 },
    { m: "Jun", income: 41, expenses: 13 },
    { m: "Jul", income: 44, expenses: 9 },
  ],
  revenueByProperty: [
    { name: "Elm Court HMO", amount: 3540, tone: "bg-[#F47C3C]" },
    { name: "Maple House", amount: 3445, tone: "bg-[#0F253B]" },
    { name: "Riverside Apartments", amount: 2060, tone: "bg-blue-500" },
    { name: "12 Oak Street", amount: 1450, tone: "bg-emerald-500" },
  ],
  settlements: [
    { id: "s1", owner: "Northern Lettings Ltd", properties: "Elm Court HMO, 12 Oak Street", period: "June 2026", grossRent: 4990, mgmtFee: 499, maintenance: 180, otherDeductions: 0, netPayout: 4311, status: "paid", paidDate: "2026-07-01" },
    { id: "s2", owner: "J. Whitfield", properties: "Maple House", period: "June 2026", grossRent: 3445, mgmtFee: 345, maintenance: 240, otherDeductions: 30, netPayout: 2830, status: "due", paidDate: null },
    { id: "s3", owner: "Aqua Holdings", properties: "Riverside Apartments", period: "June 2026", grossRent: 2060, mgmtFee: 206, maintenance: 45, otherDeductions: 0, netPayout: 1809, status: "pending", paidDate: null },
  ],
  items: [
    { id: "fi1", date: "2026-07-01", type: "income", category: "Rent", description: "Rent — Aisha Patel", property: "Elm Court · Room 4", amount: 650 },
    { id: "fi2", date: "2026-07-01", type: "income", category: "Rent", description: "Rent — David Owusu", property: "Elm Court · Room 2", amount: 725 },
    { id: "fi3", date: "2026-07-01", type: "income", category: "Rent", description: "Rent — Bennett Family", property: "12 Oak Street", amount: 1450 },
    { id: "fi4", date: "2026-06-30", type: "expense", category: "Maintenance", description: "Boiler repair", property: "Elm Court · Room 5", amount: -180 },
    { id: "fi5", date: "2026-06-30", type: "expense", category: "Management", description: "Management fee (10%)", property: "Portfolio", amount: -1050 },
    { id: "fi6", date: "2026-06-28", type: "expense", category: "Utilities", description: "Electricity — communal", property: "Maple House", amount: -142 },
    { id: "fi7", date: "2026-06-27", type: "expense", category: "Compliance", description: "Gas Safety certificate", property: "12 Oak Street", amount: -75 },
    { id: "fi8", date: "2026-06-25", type: "income", category: "Deposit", description: "Holding deposit — James Lo", property: "Maple House · Studio", amount: 250 },
    { id: "fi9", date: "2026-06-22", type: "expense", category: "Maintenance", description: "Smoke alarm replacement", property: "Riverside · Communal", amount: -45 },
    { id: "fi10", date: "2026-06-20", type: "income", category: "Rent", description: "Rent — K. Adeyemi", property: "Maple House · Room 3", amount: 665 },
  ],
  otherReports: [
    { id: "or1", name: "Profit & Loss Statement", desc: "Income, expenses & net profit", period: "Q2 2026", type: "P&L" },
    { id: "or2", name: "Rent Roll", desc: "Contracted rent by unit", period: "July 2026", type: "Rent" },
    { id: "or3", name: "Owner Settlement Statements", desc: "Per-owner payouts & deductions", period: "June 2026", type: "Settlement" },
    { id: "or4", name: "VAT Summary", desc: "VAT collected & reclaimable", period: "Q2 2026", type: "Tax" },
    { id: "or5", name: "Expense Ledger", desc: "All expense line items", period: "Q2 2026", type: "Expense" },
    { id: "or6", name: "Cashflow Forecast", desc: "Projected 3-month cashflow", period: "Aug–Oct 2026", type: "Forecast" },
  ],
};

export const FEEDBACK_TYPES = ["Overall", "Service", "Housemates", "Tidiness"];

// Average monthly Overall Satisfaction (from "Overall" feedback only).
export const satisfaction = [
  { month: "March", score: 4.2, responses: 18 },
  { month: "April", score: 4.5, responses: 22 },
  { month: "May", score: 4.1, responses: 19 },
  { month: "July", score: 4.6, responses: 25 },
];

// Individual feedback records (drive the "Feedbacks for the Selected Month").
export const feedbackRecords = [
  { id: "fb1", month: "July", property: "18 Elm Court", tenant: "Aisha Patel", room: "Room 4", type: "Overall", score: 5 },
  { id: "fb2", month: "July", property: "18 Elm Court", tenant: "David Owusu", room: "Room 2", type: "Service", score: 4 },
  { id: "fb3", month: "July", property: "42 Maple Avenue", tenant: "James Lo", room: "Studio", type: "Housemates", score: 5 },
  { id: "fb4", month: "July", property: "42 Maple Avenue", tenant: "Sarah Khan", room: "Room 1", type: "Tidiness", score: 3 },
  { id: "fb5", month: "July", property: "5 Riverside Way", tenant: "H. Suzuki", room: "Room A", type: "Overall", score: 4 },
  { id: "fb6", month: "July", property: "5 Riverside Way", tenant: "F. Costa", room: "Room B", type: "Service", score: 5 },
  { id: "fb7", month: "July", property: "12 Oak Street", tenant: "The Bennett Family", room: "—", type: "Overall", score: 5 },
  { id: "fb8", month: "May", property: "18 Elm Court", tenant: "Marta Kfor", room: "Room 6", type: "Overall", score: 4 },
  { id: "fb9", month: "May", property: "42 Maple Avenue", tenant: "P. Nowak", room: "Room 2", type: "Tidiness", score: 4 },
  { id: "fb10", month: "April", property: "5 Riverside Way", tenant: "N. Silva", room: "Room D", type: "Housemates", score: 5 },
  { id: "fb11", month: "April", property: "18 Elm Court", tenant: "Aisha Patel", room: "Room 4", type: "Service", score: 4 },
  { id: "fb12", month: "March", property: "42 Maple Avenue", tenant: "K. Adeyemi", room: "Room 3", type: "Overall", score: 4 },
];

// Detailed reviews — separate from the satisfaction score.
export const reviews = [
  { id: "rv1", date: "2026-07-06", tenant: "Aisha Patel", property: "18 Elm Court", room: "Room 4", rating: 5, text: "Fantastic house and a really responsive management team. Any issue I raised was sorted within a day. The housemates are friendly and the communal areas are always clean. Would happily recommend." },
  { id: "rv2", date: "2026-07-03", tenant: "James Lo", property: "42 Maple Avenue", room: "Studio", rating: 5, text: "Great location close to the city and the studio is spacious. Move-in was smooth and everything was as described. Bills-included made budgeting easy." },
  { id: "rv3", date: "2026-06-28", tenant: "Sarah Khan", property: "42 Maple Avenue", room: "Room 1", rating: 3, text: "Room is good but the kitchen could be cleaned more often by other housemates. Maintenance response was okay but took a couple of days for a minor repair." },
  { id: "rv4", date: "2026-06-20", tenant: "H. Suzuki", property: "5 Riverside Way", room: "Room A", rating: 4, text: "Comfortable room and nice building. Wi-Fi is fast. Only small gripe is parking availability in the evenings." },
  { id: "rv5", date: "2026-05-30", tenant: "The Bennett Family", property: "12 Oak Street", room: "—", rating: 5, text: "We've rented the whole house for a year now and it's been excellent. The garden is lovely and the landlord is fair and quick to help." },
  { id: "rv6", date: "2026-05-15", tenant: "F. Costa", property: "5 Riverside Way", room: "Room B", rating: 4, text: "Good value for the area and a well-run property. Communal cleaning rota works well most weeks." },
];

export const DEPOSIT_STATUS = ["Pending", "Active", "Closing", "Closed"];
export const DEPOSIT_STATUS_TONE = { Pending: "amber", Active: "green", Closing: "blue", Closed: "gray" };
export const DEPOSIT_TYPES = ["Deposit Protection Scheme", "Zero Deposit Scheme", "Holding Deposit"];
export const PROTECTION_SCHEMES = ["DPS", "MyDeposits", "TDS"];
export const PROTECTION_TYPES = ["Custodial", "Insured"];
export const DEPOSIT_TAGS = ["HMO", "Student", "Professional", "Guarantor"];

export const deposits = [
  {
    id: "dp1", property: "18 Elm Court", room: "Room 4", tenant: "Aisha Patel", amount: 750,
    depositType: "Deposit Protection Scheme", scheme: "DPS", protectionType: "Custodial", status: "Active",
    tags: ["HMO", "Professional"], ref: "DPS-88213", protectedDate: "2026-07-05",
    history: [
      { date: "2026-07-05", event: "Deposit received (£750)" },
      { date: "2026-07-05", event: "Protected with DPS (Custodial)" },
      { date: "2026-07-06", event: "Prescribed information sent to tenant" },
    ],
  },
  {
    id: "dp2", property: "18 Elm Court", room: "Room 2", tenant: "David Owusu", amount: 830,
    depositType: "Deposit Protection Scheme", scheme: "MyDeposits", protectionType: "Insured", status: "Active",
    tags: ["HMO", "Professional"], ref: "MD-40192", protectedDate: "2026-06-15",
    history: [
      { date: "2026-06-15", event: "Deposit received (£830)" },
      { date: "2026-06-16", event: "Protected with MyDeposits (Insured)" },
    ],
  },
  {
    id: "dp3", property: "42 Maple Avenue", room: "Studio", tenant: "James Lo", amount: 900,
    depositType: "Deposit Protection Scheme", scheme: "DPS", protectionType: "Custodial", status: "Active",
    tags: ["HMO"], ref: "DPS-88410", protectedDate: "2026-07-12",
    history: [
      { date: "2026-07-12", event: "Deposit received (£900)" },
      { date: "2026-07-12", event: "Protected with DPS (Custodial)" },
    ],
  },
  {
    id: "dp4", property: "42 Maple Avenue", room: "Room 1", tenant: "Sarah Khan", amount: 760,
    depositType: "Deposit Protection Scheme", scheme: "TDS", protectionType: "Insured", status: "Pending",
    tags: ["HMO", "Student", "Guarantor"], ref: "—", protectedDate: null,
    history: [
      { date: "2026-07-28", event: "Deposit requested (£760)" },
      { date: "2026-07-30", event: "Awaiting cleared funds" },
    ],
  },
  {
    id: "dp5", property: "12 Oak Street", room: "—", tenant: "The Bennett Family", amount: 1670,
    depositType: "Deposit Protection Scheme", scheme: "DPS", protectionType: "Custodial", status: "Active",
    tags: ["Guarantor"], ref: "DPS-87004", protectedDate: "2026-01-05",
    history: [
      { date: "2026-01-05", event: "Deposit received (£1,670)" },
      { date: "2026-01-06", event: "Protected with DPS (Custodial)" },
    ],
  },
  {
    id: "dp6", property: "5 Riverside Way", room: "Room A", tenant: "H. Suzuki", amount: 790,
    depositType: "Deposit Protection Scheme", scheme: "MyDeposits", protectionType: "Insured", status: "Closing",
    tags: ["HMO"], ref: "MD-39980", protectedDate: "2025-08-01",
    history: [
      { date: "2025-08-01", event: "Deposit received (£790)" },
      { date: "2026-07-20", event: "End of tenancy — deductions proposed (£60)" },
      { date: "2026-07-25", event: "Awaiting tenant response" },
    ],
  },
  {
    id: "dp7", property: "5 Riverside Way", room: "Room B", tenant: "F. Costa", amount: 780,
    depositType: "Zero Deposit Scheme", scheme: "TDS", protectionType: "Insured", status: "Closed",
    tags: ["HMO", "Student"], ref: "TDS-11220", protectedDate: "2025-05-10",
    history: [
      { date: "2025-05-10", event: "Deposit received (£780)" },
      { date: "2026-06-30", event: "Deposit returned in full" },
      { date: "2026-06-30", event: "Deposit closed" },
    ],
  },
  {
    id: "dp8", property: "18 Elm Court", room: "Room 6", tenant: "Marta Kfor", amount: 680,
    depositType: "Deposit Protection Scheme", scheme: "TDS", protectionType: "Insured", status: "Active",
    tags: ["HMO", "Professional"], ref: "TDS-11541", protectedDate: "2026-05-01",
    history: [
      { date: "2026-05-01", event: "Deposit received (£680)" },
      { date: "2026-05-02", event: "Protected with TDS (Insured)" },
    ],
  },
];

export const rentReviews = [
  {
    id: "rr1", tenant: "Aisha Patel", property: "18 Elm Court", room: "Room 4",
    fixedTermEnd: "2027-07-04", nextReviewDate: "2026-07-15", currentRent: 650, unitTargetRent: 700,
    dueTenancy: true, dueUnit: false,
    lastTenancyReview: "2025-07-05", lastReviewedTargetRent: 680, nextTenancyReviewDate: "2026-07-15",
    lastUnitReview: "2025-06-01", minViableRent: 600, nextUnitReviewDate: "2026-12-01",
    history: [
      { date: "2025-07-05", opening: 620, newAmount: 650, change: 30, pct: 4.8 },
      { date: "2024-07-05", opening: 600, newAmount: 620, change: 20, pct: 3.3 },
    ],
  },
  {
    id: "rr2", tenant: "James Lo", property: "42 Maple Avenue", room: "Studio",
    fixedTermEnd: "2027-07-11", nextReviewDate: "2026-09-01", currentRent: 780, unitTargetRent: 800,
    dueTenancy: false, dueUnit: false,
    lastTenancyReview: "2025-07-12", lastReviewedTargetRent: 790, nextTenancyReviewDate: "2026-09-01",
    lastUnitReview: "2025-05-01", minViableRent: 720, nextUnitReviewDate: "2026-11-01",
    history: [{ date: "2025-07-12", opening: 750, newAmount: 780, change: 30, pct: 4.0 }],
  },
  {
    id: "rr3", tenant: "H. Suzuki", property: "5 Riverside Way", room: "Room A",
    fixedTermEnd: "2026-08-15", nextReviewDate: "2026-07-05", currentRent: 690, unitTargetRent: 720,
    dueTenancy: true, dueUnit: true,
    lastTenancyReview: null, lastReviewedTargetRent: null, nextTenancyReviewDate: "2026-07-05",
    lastUnitReview: "2025-08-01", minViableRent: 640, nextUnitReviewDate: "2026-07-05",
    history: [],
  },
  {
    id: "rr4", tenant: "The Bennett Family", property: "12 Oak Street", room: "—",
    fixedTermEnd: "2026-08-01", nextReviewDate: "2026-07-20", currentRent: 1450, unitTargetRent: 1550,
    dueTenancy: true, dueUnit: false,
    lastTenancyReview: "2025-01-05", lastReviewedTargetRent: 1500, nextTenancyReviewDate: "2026-07-20",
    lastUnitReview: "2025-01-01", minViableRent: 1350, nextUnitReviewDate: "2027-01-01",
    history: [{ date: "2025-01-05", opening: 1400, newAmount: 1450, change: 50, pct: 3.6 }],
  },
  {
    id: "rr5", tenant: "David Owusu", property: "18 Elm Court", room: "Room 2",
    fixedTermEnd: "2027-06-14", nextReviewDate: "2026-11-01", currentRent: 725, unitTargetRent: 740,
    dueTenancy: false, dueUnit: false,
    lastTenancyReview: "2025-06-15", lastReviewedTargetRent: 730, nextTenancyReviewDate: "2026-11-01",
    lastUnitReview: "2025-06-01", minViableRent: 680, nextUnitReviewDate: "2026-12-01",
    history: [{ date: "2025-06-15", opening: 700, newAmount: 725, change: 25, pct: 3.6 }],
  },
  {
    id: "rr6", tenant: "Sarah Khan", property: "42 Maple Avenue", room: "Room 1",
    fixedTermEnd: "2027-08-01", nextReviewDate: "2026-08-10", currentRent: 660, unitTargetRent: 690,
    dueTenancy: true, dueUnit: false,
    lastTenancyReview: null, lastReviewedTargetRent: null, nextTenancyReviewDate: "2026-08-10",
    lastUnitReview: "2025-07-01", minViableRent: 620, nextUnitReviewDate: "2026-07-30",
    history: [],
  },
];

export const TENANCY_STATUS = ["Fixed Term", "Becoming Periodic", "Periodic", "Ending"];
export const TENANCY_STATUS_TONE = { "Fixed Term": "green", "Becoming Periodic": "amber", Periodic: "blue", Ending: "red" };

export const occupancyOverview = { units: 16, occupants: 13, tenancyChanges: 3, renewals: 4 };

export const occupancy = [
  { id: "oc1", property: "18 Elm Court", unit: "Room 4", tenant: "Aisha Patel", rent: 650, startDate: "2026-07-05", fixedTermEnd: "2027-07-04", periodicStart: null, availability: "Occupied", status: "Fixed Term", onboarded: true },
  { id: "oc2", property: "18 Elm Court", unit: "Room 2", tenant: "David Owusu", rent: 725, startDate: "2025-06-15", fixedTermEnd: "2026-06-14", periodicStart: null, availability: "Occupied", status: "Becoming Periodic", onboarded: true },
  { id: "oc3", property: "18 Elm Court", unit: "Room 6", tenant: "Marta Kfor", rent: 590, startDate: "2024-05-01", fixedTermEnd: null, periodicStart: "2025-05-01", availability: "Occupied", status: "Periodic", onboarded: true },
  { id: "oc4", property: "42 Maple Avenue", unit: "Studio", tenant: "James Lo", rent: 780, startDate: "2026-07-12", fixedTermEnd: "2027-07-11", periodicStart: null, availability: "Occupied", status: "Fixed Term", onboarded: false },
  { id: "oc5", property: "42 Maple Avenue", unit: "Room 1", tenant: "Sarah Khan", rent: 660, startDate: "2026-08-01", fixedTermEnd: "2027-08-01", periodicStart: null, availability: "Occupied", status: "Fixed Term", onboarded: false },
  { id: "oc6", property: "5 Riverside Way", unit: "Room A", tenant: "H. Suzuki", rent: 690, startDate: "2025-08-01", fixedTermEnd: "2026-08-15", periodicStart: null, availability: "Available 16 Aug", status: "Ending", onboarded: true },
  { id: "oc7", property: "12 Oak Street", unit: "Whole property", tenant: "The Bennett Family", rent: 1450, startDate: "2026-01-05", fixedTermEnd: "2026-08-01", periodicStart: null, availability: "Available 2 Aug", status: "Ending", onboarded: true },
  { id: "oc8", property: "5 Riverside Way", unit: "Room B", tenant: "F. Costa", rent: 680, startDate: "2024-05-10", fixedTermEnd: null, periodicStart: "2025-05-10", availability: "Occupied", status: "Periodic", onboarded: true },
  { id: "oc9", property: "5 Riverside Way", unit: "Room D", tenant: "N. Silva", rent: 690, startDate: "2025-09-01", fixedTermEnd: "2026-09-01", periodicStart: null, availability: "Occupied", status: "Fixed Term", onboarded: true },
];

export const INSPECTION_TYPES = ["Routine", "Check-in", "Check-out", "Mid-term", "Fire Safety"];
export const INSPECTION_STATUS_TONE = { Completed: "green", Scheduled: "blue", Overdue: "red" };

export const inspections = [
  { id: "in1", date: "2026-07-02", property: "18 Elm Court", room: "Room 4", type: "Routine", inspector: "Ella Moore", status: "Completed", notes: "All in good order." },
  { id: "in2", date: "2026-07-05", property: "42 Maple Avenue", room: "Studio", type: "Check-in", inspector: "Sam Reed", status: "Scheduled", notes: "New tenant move-in." },
  { id: "in3", date: "2026-06-28", property: "5 Riverside Way", room: "Communal", type: "Fire Safety", inspector: "Ella Moore", status: "Completed", notes: "Alarms tested, OK." },
  { id: "in4", date: "2026-06-20", property: "12 Oak Street", room: "Whole property", type: "Mid-term", inspector: "Sam Reed", status: "Overdue", notes: "Reschedule required." },
  { id: "in5", date: "2026-08-16", property: "5 Riverside Way", room: "Room A", type: "Check-out", inspector: "Ella Moore", status: "Scheduled", notes: "End of tenancy." },
];

export const welcomePack = {
  quickInfo: [
    { id: "wq1", label: "Management 24/7", value: "07123 456789" },
    { id: "wq2", label: "Gas emergency", value: "0800 111 999" },
    { id: "wq3", label: "Bin day", value: "Wednesday" },
  ],
  infoCards: [
    { id: "wc1", title: "Defrosting a freezer", description: "You'll need to defrost the freezers every 3–6 months as ice builds up. Attached is a handy guide for the Hotpoint freezers we use.", video: "https://youtu.be/8FUouFhF5Dg", files: ["freezer-guide.pdf"] },
    { id: "wc2", title: "Heating & hot water", description: "Combi boiler — thermostat in the hallway. Hot water is on-demand.", video: "", files: [] },
  ],
};

export const subscriptionPlans = [
  { name: "Free", price: "£0", features: ["Up to 5 rooms", "Core features"], current: false },
  { name: "Pro", price: "£29", features: ["Unlimited rooms", "Compliance alerts", "Stripe rent"], current: true },
  { name: "Enterprise", price: "Custom", features: ["Multi-branch", "Priority support", "API access"], current: false },
];

// Central tenant registry — assign these to rooms / lettings instead of typing
// free-text names. status: Assigned (currently in a unit) | Available | Onboarding.
export const tenants = [
  { id: "t1", name: "Aisha Patel", email: "aisha.p@email.com", phone: "07700 900789", status: "Assigned" },
  { id: "t2", name: "David Owusu", email: "david.o@email.com", phone: "07700 900444", status: "Assigned" },
  { id: "t3", name: "Marta Kfor", email: "marta.k@email.com", phone: "07700 900912", status: "Assigned" },
  { id: "t4", name: "P. Nowak", email: "p.nowak@email.com", phone: "07700 900913", status: "Assigned" },
  { id: "t5", name: "H. Suzuki", email: "h.suzuki@email.com", phone: "07700 900914", status: "Assigned" },
  { id: "t6", name: "F. Costa", email: "f.costa@email.com", phone: "07700 900915", status: "Assigned" },
  { id: "t7", name: "N. Silva", email: "n.silva@email.com", phone: "07700 900916", status: "Assigned" },
  { id: "t8", name: "The Bennett Family", email: "bennett@email.com", phone: "07700 900917", status: "Assigned" },
  { id: "t9", name: "James Lo", email: "james.lo@email.com", phone: "07700 900222", status: "Onboarding" },
  { id: "t10", name: "Sarah Khan", email: "sarah.k@email.com", phone: "07700 900123", status: "Onboarding" },
  { id: "t11", name: "Grace Bennett", email: "grace.b@email.com", phone: "07700 900333", status: "Available" },
  { id: "t12", name: "Mo Farah", email: "mo.f@email.com", phone: "07700 900555", status: "Available" },
];

export const money = (n) => `£${Number(n).toLocaleString("en-GB")}`;
