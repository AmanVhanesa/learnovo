// Normalize a date-picker range so a single-day selection (e.g. 2026-05-10 to
// 2026-05-10) covers the whole calendar day. Without this, `new Date('2026-05-10')`
// resolves to midnight, so $lte excludes everything later in the day.
//
// Returns an object with $gte/$lte keys ready to drop into a Mongo query, or
// null when both inputs are empty.
function buildDateRange(startDate, endDate) {
  if (!startDate && !endDate) return null;
  const range = {};
  if (startDate) {
    const s = new Date(startDate);
    if (!isNaN(s)) {
      s.setHours(0, 0, 0, 0);
      range.$gte = s;
    }
  }
  if (endDate) {
    const e = new Date(endDate);
    if (!isNaN(e)) {
      e.setHours(23, 59, 59, 999);
      range.$lte = e;
    }
  }
  return Object.keys(range).length ? range : null;
}

// Apply buildDateRange directly onto a Mongo filter object under `field`. No-op
// when both inputs are empty so the filter isn't mutated unnecessarily.
function applyDateRange(filter, field, startDate, endDate) {
  const range = buildDateRange(startDate, endDate);
  if (range) filter[field] = range;
  return filter;
}

module.exports = { buildDateRange, applyDateRange };
