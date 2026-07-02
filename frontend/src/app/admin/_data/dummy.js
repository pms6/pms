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
  { v: "Whole Property", desc: "Entire property rented to one tenant/group", eg: "House, apartment", tone: "blue" },
  { v: "HMO Room", desc: "Individual rooms rented separately", eg: "Shared house", tone: "orange" },
  { v: "Block Booking", desc: "Multiple rooms or whole property reserved by one organization", eg: "Company, university, contractor", tone: "amber" },
  { v: "Short-Term Stay", desc: "Daily or weekly bookings", eg: "Airbnb, holiday lets", tone: "green" },
  { v: "Serviced Accommodation", desc: "Furnished property with hotel-like services", eg: "Corporate apartments", tone: "gray" },
  { v: "Commercial", desc: "Office, shop, warehouse", eg: "Business premises", tone: "red" },
];

export const properties = [
  {
    id: "p1",
    name: "Elm Court HMO",
    image: img("elmcourt"),
    addressLine1: "18 Elm Court",
    city: "Leeds",
    postcode: "LS2 9JT",
    type: "HMO Room",
    status: "active",
    owner: "Northern Lettings Ltd",
    rentFrom: 575,
    rentTo: 725,
    totalRooms: 6,
    occupied: 5,
    rooms: [
      { id: "r1", number: "Room 1", type: "double", rent: 650, status: "occupied", tenant: "Aisha Patel", image: img("room-1", 600, 400) },
      { id: "r2", number: "Room 2", type: "ensuite", rent: 725, status: "occupied", tenant: "David Owusu", image: img("room-2", 600, 400) },
      { id: "r3", number: "Room 3", type: "single", rent: 575, status: "vacant", tenant: null, image: img("room-3", 600, 400) },
      { id: "r4", number: "Room 4", type: "double", rent: 650, status: "occupied", tenant: "Aisha Patel", image: img("room-4", 600, 400) },
      { id: "r5", number: "Room 5", type: "ensuite", rent: 700, status: "maintenance", tenant: null, image: img("room-5", 600, 400) },
      { id: "r6", number: "Room 6", type: "single", rent: 590, status: "occupied", tenant: "Marta Kfor", image: img("room-6", 600, 400) },
    ],
  },
  {
    id: "p2",
    name: "Maple House",
    image: img("maplehouse"),
    addressLine1: "42 Maple Avenue",
    city: "Leeds",
    postcode: "LS6 2AB",
    type: "HMO Room",
    status: "active",
    owner: "J. Whitfield",
    rentFrom: 600,
    rentTo: 780,
    totalRooms: 5,
    occupied: 5,
    rooms: [
      { id: "r7", number: "Studio", type: "ensuite", rent: 780, status: "occupied", tenant: "James Lo", image: img("room-7", 600, 400) },
      { id: "r8", number: "Room 1", type: "double", rent: 660, status: "occupied", tenant: "Sarah Khan", image: img("room-8", 600, 400) },
      { id: "r9", number: "Room 2", type: "single", rent: 600, status: "occupied", tenant: "P. Nowak", image: img("room-9", 600, 400) },
      { id: "r10", number: "Room 3", type: "double", rent: 665, status: "occupied", tenant: "K. Adeyemi", image: img("room-10", 600, 400) },
      { id: "r11", number: "Room 4", type: "ensuite", rent: 740, status: "occupied", tenant: "L. Rossi", image: img("room-11", 600, 400) },
    ],
  },
  {
    id: "p3",
    name: "12 Oak Street",
    image: img("oakstreet"),
    addressLine1: "12 Oak Street",
    city: "Leeds",
    postcode: "LS4 1DR",
    type: "Whole Property",
    status: "active",
    owner: "Northern Lettings Ltd",
    rentFrom: 1450,
    rentTo: 1450,
    totalRooms: 1,
    occupied: 1,
    rooms: [
      { id: "r12", number: "Whole property", type: "house", rent: 1450, status: "occupied", tenant: "The Bennett Family", image: img("room-12", 600, 400) },
    ],
  },
  {
    id: "p4",
    name: "Riverside Apartments",
    image: img("riverside"),
    addressLine1: "5 Riverside Way",
    city: "Leeds",
    postcode: "LS1 4EX",
    type: "HMO Room",
    status: "active",
    owner: "Aqua Holdings",
    rentFrom: 620,
    rentTo: 690,
    totalRooms: 4,
    occupied: 3,
    rooms: [
      { id: "r13", number: "Room A", type: "double", rent: 690, status: "occupied", tenant: "H. Suzuki", image: img("room-13", 600, 400) },
      { id: "r14", number: "Room B", type: "double", rent: 680, status: "occupied", tenant: "F. Costa", image: img("room-14", 600, 400) },
      { id: "r15", number: "Room C", type: "single", rent: 620, status: "vacant", tenant: null, image: img("room-15", 600, 400) },
      { id: "r16", number: "Room D", type: "ensuite", rent: 690, status: "occupied", tenant: "N. Silva", image: img("room-16", 600, 400) },
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

export const money = (n) => `£${Number(n).toLocaleString("en-GB")}`;
