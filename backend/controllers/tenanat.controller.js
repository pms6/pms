import Tenant from "../models/Tenant.js";


export const getAllTenants = async (req, res) => {
  try {

    const query = {
      organizationId: null,           // Only show tenants without organization
      // organizationId: { $exists: false } // Alternative if null is not set
    };

    const tenants = await Tenant.find(query)
      .select("firstName lastName tenantEmail profileImage occupationType")
      .sort({ firstName: 1 });

    res.status(200).json({
      success: true,
      data: tenants,
      count: tenants.length,
    });
  } catch (error) {
    console.error("Get All Tenants Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch tenants",
    });
  }
};