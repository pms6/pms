'use strict';

/**
 * Parse ?page=&limit=&sort= query params into mongoose-friendly options.
 * Defaults: page 1, limit 20 (max 100), sort -createdAt.
 */
function parsePagination(query = {}) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 100);
  const skip = (page - 1) * limit;
  const sort = query.sort || '-createdAt';
  return { page, limit, skip, sort };
}

function buildMeta({ page, limit }, total) {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
  };
}

module.exports = { parsePagination, buildMeta };
