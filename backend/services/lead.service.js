'use strict';

const { Lead } = require('../models');
const ApiError = require('../utils/ApiError');
const { parsePagination, buildMeta } = require('../utils/pagination');

async function createLead(accountId, userId, data) {
  // Default ownership to the creating agent unless explicitly assigned.
  const assignedTo = data.assignedTo || userId;
  const lead = await Lead.create({ accountId, ...data, assignedTo });
  return lead;
}

async function listLeads(accountId, query = {}) {
  const { page, limit, skip, sort } = parsePagination(query);

  const filter = { accountId };
  if (query.status) filter.status = query.status;
  if (query.source) filter.source = query.source;
  if (query.assignedTo) filter.assignedTo = query.assignedTo;
  if (query.search) {
    filter.$or = [
      { name: { $regex: query.search, $options: 'i' } },
      { email: { $regex: query.search, $options: 'i' } },
    ];
  }

  const [items, total] = await Promise.all([
    Lead.find(filter).populate('assignedTo', 'name').sort(sort).skip(skip).limit(limit),
    Lead.countDocuments(filter),
  ]);
  return { items, meta: buildMeta({ page, limit }, total) };
}

async function getLeadById(accountId, id) {
  const lead = await Lead.findOne({ _id: id, accountId }).populate('assignedTo', 'name');
  if (!lead) throw ApiError.notFound('Lead not found');
  return lead;
}

async function updateLead(accountId, id, data) {
  const lead = await Lead.findOneAndUpdate(
    { _id: id, accountId },
    { $set: data },
    { new: true, runValidators: true }
  ).populate('assignedTo', 'name');
  if (!lead) throw ApiError.notFound('Lead not found');
  return lead;
}

async function deleteLead(accountId, id) {
  const lead = await Lead.findOneAndDelete({ _id: id, accountId });
  if (!lead) throw ApiError.notFound('Lead not found');
  return lead;
}

module.exports = { createLead, listLeads, getLeadById, updateLead, deleteLead };
