'use strict';

const { Viewing } = require('../models');
const ApiError = require('../utils/ApiError');
const { parsePagination, buildMeta } = require('../utils/pagination');

async function createViewing(accountId, userId, data) {
  const agentId = data.agentId || userId; // default to the booking agent
  const viewing = await Viewing.create({ accountId, ...data, agentId });
  return viewing;
}

async function listViewings(accountId, query = {}) {
  const { page, limit, skip, sort } = parsePagination(query);

  const filter = { accountId };
  if (query.status) filter.status = query.status;
  if (query.from || query.to) {
    filter.scheduledAt = {};
    if (query.from) filter.scheduledAt.$gte = query.from;
    if (query.to) filter.scheduledAt.$lte = query.to;
  }

  const [items, total] = await Promise.all([
    Viewing.find(filter)
      .populate('leadId', 'name email')
      .populate('agentId', 'name')
      .sort(sort || 'scheduledAt')
      .skip(skip)
      .limit(limit),
    Viewing.countDocuments(filter),
  ]);
  return { items, meta: buildMeta({ page, limit }, total) };
}

async function getViewingById(accountId, id) {
  const viewing = await Viewing.findOne({ _id: id, accountId })
    .populate('leadId', 'name email')
    .populate('agentId', 'name');
  if (!viewing) throw ApiError.notFound('Viewing not found');
  return viewing;
}

async function updateViewing(accountId, id, data) {
  const viewing = await Viewing.findOneAndUpdate(
    { _id: id, accountId },
    { $set: data },
    { new: true, runValidators: true }
  )
    .populate('leadId', 'name email')
    .populate('agentId', 'name');
  if (!viewing) throw ApiError.notFound('Viewing not found');
  return viewing;
}

async function deleteViewing(accountId, id) {
  const viewing = await Viewing.findOneAndDelete({ _id: id, accountId });
  if (!viewing) throw ApiError.notFound('Viewing not found');
  return viewing;
}

module.exports = { createViewing, listViewings, getViewingById, updateViewing, deleteViewing };
