'use strict';

/**
 * Barrel export for all Mongoose models (37 collections).
 * Import anywhere as:  const { User, Property } = require('../models');
 */

module.exports = {
  // Identity & Access
  Account: require('./Account'),
  Subscription: require('./Subscription'),
  User: require('./User'),
  Owner: require('./Owner'),
  Notification: require('./Notification'),

  // Property & Structure
  Property: require('./Property'),
  Floor: require('./Floor'),
  Room: require('./Room'),
  Bed: require('./Bed'),
  RoomListing: require('./RoomListing'),
  UtilityAccount: require('./UtilityAccount'),
  UtilityBill: require('./UtilityBill'),
  CouncilTaxAccount: require('./CouncilTaxAccount'),

  // Lettings & Tenancy
  Lead: require('./Lead'),
  Applicant: require('./Applicant'),
  Viewing: require('./Viewing'),
  Tenant: require('./Tenant'),
  Guarantor: require('./Guarantor'),
  Tenancy: require('./Tenancy'),
  Inventory: require('./Inventory'),

  // Finance
  Deposit: require('./Deposit'),
  Invoice: require('./Invoice'),
  Payment: require('./Payment'),
  Transaction: require('./Transaction'),
  RecurringCharge: require('./RecurringCharge'),
  OwnerSettlement: require('./OwnerSettlement'),

  // Compliance & Utilities
  HmoLicence: require('./HmoLicence'),
  ComplianceCertificate: require('./ComplianceCertificate'),
  RightToRent: require('./RightToRent'),

  // Operations & System
  MaintenanceRequest: require('./MaintenanceRequest'),
  Supplier: require('./Supplier'),
  Inspection: require('./Inspection'),
  Action: require('./Action'),
  CalendarEvent: require('./CalendarEvent'),
  Communication: require('./Communication'),
  Document: require('./Document'),
  AuditLog: require('./AuditLog'),
};
