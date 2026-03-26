/**
 * Reusable pagination helper for Mongoose list queries.
 *
 * Usage in a route:
 *   const { skip, limit, page } = parsePagination(req.query);
 *   const [data, total] = await Promise.all([
 *     Model.find(filter).skip(skip).limit(limit).lean(),
 *     Model.countDocuments(filter),
 *   ]);
 *   res.json(paginatedResponse(data, total, page, limit));
 */

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 500;

/**
 * Extract and clamp page/limit from query params.
 * @param {Object} query - express req.query
 * @returns {{ page: number, limit: number, skip: number }}
 */
function parsePagination(query = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  let limit = parseInt(query.limit, 10) || DEFAULT_LIMIT;
  limit = Math.min(Math.max(1, limit), MAX_LIMIT);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

/**
 * Build a standard paginated response envelope.
 */
function paginatedResponse(data, total, page, limit) {
  const totalPages = Math.ceil(total / limit);
  return {
    success: true,
    data,
    pagination: {
      total,
      page,
      current: page,      // backward-compat alias
      limit,
      totalPages,
      pages: totalPages,  // backward-compat alias (frontend reads this)
    },
  };
}

module.exports = { parsePagination, paginatedResponse, DEFAULT_LIMIT, MAX_LIMIT };
