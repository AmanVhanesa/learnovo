/**
 * Shared class ordering utility for educational hierarchy.
 * Indian school standard: Pre-Nursery → Nursery → LKG → UKG → Class 1 → ... → Class 12
 */

const PRE_PRIMARY_ORDER = {
  'pre-nursery': 0, 'prenursery': 0, 'playgroup': 0, 'play group': 0,
  'nursery': 1, 'nur': 1,
  'lkg': 2, 'jr. kg': 2, 'jr kg': 2, 'junior kg': 2, 'lower kg': 2,
  'ukg': 3, 'sr. kg': 3, 'sr kg': 3, 'senior kg': 3, 'upper kg': 3
}

/**
 * Returns a numeric sort order for a class name.
 * Pre-primary classes get negative values, numeric classes get their number.
 */
export function getClassOrder(className) {
  if (!className) return 9999
  const normalized = className.toString().trim().toLowerCase()

  // Check pre-primary
  if (PRE_PRIMARY_ORDER[normalized] !== undefined) {
    return PRE_PRIMARY_ORDER[normalized] - 100 // negative to sort before Class 1
  }

  // Extract number from "Class 5", "5", "Grade 5", etc.
  const num = parseInt(normalized.replace(/^(class|grade|std|standard)\s*/i, ''), 10)
  if (!isNaN(num)) return num

  // Fallback: alphabetical at the end
  return 9000 + normalized.charCodeAt(0)
}

/**
 * Sort an array of class names in educational hierarchy order.
 */
export function sortClasses(classes) {
  if (!classes || !Array.isArray(classes)) return []
  return [...classes].sort((a, b) => getClassOrder(a) - getClassOrder(b))
}

/**
 * Sort an array of objects by a class field in educational hierarchy order.
 */
export function sortClassObjects(items, classField = 'name') {
  if (!items || !Array.isArray(items)) return []
  return [...items].sort((a, b) => getClassOrder(a[classField]) - getClassOrder(b[classField]))
}

/**
 * Get the next class in hierarchy from a sorted list.
 * Returns null if currentClass is the highest.
 */
export function getNextClass(currentClass, allClasses) {
  const sorted = sortClasses(allClasses)
  const idx = sorted.findIndex(c =>
    c.toString().toLowerCase().replace(/^class\s+/i, '') ===
    currentClass.toString().toLowerCase().replace(/^class\s+/i, '')
  )
  if (idx === -1 || idx >= sorted.length - 1) return null
  return sorted[idx + 1]
}

/**
 * Get the previous class in hierarchy from a sorted list.
 */
export function getPreviousClass(currentClass, allClasses) {
  const sorted = sortClasses(allClasses)
  const idx = sorted.findIndex(c =>
    c.toString().toLowerCase().replace(/^class\s+/i, '') ===
    currentClass.toString().toLowerCase().replace(/^class\s+/i, '')
  )
  if (idx <= 0) return null
  return sorted[idx - 1]
}

/**
 * Dedupe class objects by name (case-insensitive). When preferredAcademicYear
 * is given, a record matching that year wins over other duplicates.
 */
export function dedupeClassesByName(items, preferredAcademicYear = null) {
  if (!items || !Array.isArray(items)) return []
  const byKey = new Map()
  for (const c of items) {
    const key = (c?.name || '').toString().trim().toLowerCase()
    if (!key) continue
    const existing = byKey.get(key)
    if (!existing) { byKey.set(key, c); continue }
    if (preferredAcademicYear && c.academicYear === preferredAcademicYear && existing.academicYear !== preferredAcademicYear) {
      byKey.set(key, c)
    }
  }
  return Array.from(byKey.values())
}

export default { getClassOrder, sortClasses, sortClassObjects, getNextClass, getPreviousClass, dedupeClassesByName }
