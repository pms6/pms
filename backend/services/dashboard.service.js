'use strict';

const {
  Property,
  Room,
  Lead,
  Viewing,
  MaintenanceRequest,
  Action,
  Tenancy,
  User,
  Subscription,
} = require('../models');
const complianceService = require('./compliance.service');

/** Start/end of the current day (server time). */
function dayBounds(now = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/**
 * Aggregate the headline statistics for the admin dashboard.
 * Mirrors SRS 3.2: total properties, onboarding progress, today's actions,
 * upcoming viewings, new leads, maintenance requests, occupancy status.
 *
 * Every collection is queried defensively — empty collections return zeros,
 * so the dashboard works from day one even before other modules add data.
 *
 * @param {string} accountId - tenant from the JWT
 */
async function getStats(accountId) {
  const now = new Date();
  const { start: todayStart, end: todayEnd } = dayBounds(now);

  // Rooms are scoped via their Property (Room has no accountId of its own),
  // so resolve this account's property ids first.
  const properties = await Property.find({ accountId, isDeleted: { $ne: true } })
    .select('_id')
    .lean();
  const propertyIds = properties.map((p) => p._id);
  const roomFilter = { propertyId: { $in: propertyIds }, isDeleted: { $ne: true } };

  const [
    totalProperties,
    archivedProperties,
    totalRooms,
    occupiedRooms,
    vacantRooms,
    maintRooms,
    newLeads,
    totalLeads,
    upcomingViewings,
    openMaintenance,
    urgentMaintenance,
    actionsToday,
    actionsOverdue,
    activeTenancies,
    teamSize,
    subscription,
    compliance,
  ] = await Promise.all([
    Property.countDocuments({ accountId, isDeleted: { $ne: true }, status: 'active' }),
    Property.countDocuments({ accountId, isDeleted: { $ne: true }, status: 'archived' }),
    Room.countDocuments(roomFilter),
    Room.countDocuments({ ...roomFilter, status: 'occupied' }),
    Room.countDocuments({ ...roomFilter, status: 'vacant' }),
    Room.countDocuments({ ...roomFilter, status: 'maint' }),
    Lead.countDocuments({ accountId, status: 'new' }),
    Lead.countDocuments({ accountId }),
    Viewing.countDocuments({ accountId, status: 'scheduled', scheduledAt: { $gte: now } }),
    MaintenanceRequest.countDocuments({
      accountId,
      status: { $in: ['open', 'assigned', 'in_progress'] },
    }),
    MaintenanceRequest.countDocuments({
      accountId,
      priority: 'urgent',
      status: { $ne: 'closed' },
    }),
    Action.countDocuments({ accountId, dueDate: { $gte: todayStart, $lte: todayEnd } }),
    Action.countDocuments({
      accountId,
      status: { $ne: 'done' },
      dueDate: { $lt: todayStart },
    }),
    Tenancy.countDocuments({ accountId, status: 'active' }),
    User.countDocuments({ accountId }),
    Subscription.findOne({ accountId }).select('plan status renewalDate').lean(),
    complianceService.counts(accountId, propertyIds),
  ]);

  const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

  return {
    properties: { total: totalProperties, archived: archivedProperties },
    occupancy: {
      totalRooms,
      occupied: occupiedRooms,
      vacant: vacantRooms,
      maintenance: maintRooms,
      occupancyRate, // percentage 0–100
    },
    leads: { new: newLeads, total: totalLeads },
    viewings: { upcoming: upcomingViewings },
    maintenance: { open: openMaintenance, urgent: urgentMaintenance },
    compliance: { due: compliance.expiring, expired: compliance.expired },
    actions: { today: actionsToday, overdue: actionsOverdue },
    tenancies: { active: activeTenancies },
    team: { total: teamSize },
    subscription: subscription || { plan: 'free', status: 'trial' },
    generatedAt: now,
  };
}

module.exports = { getStats };
