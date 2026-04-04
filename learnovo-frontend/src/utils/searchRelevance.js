/**
 * Sorts search results by relevance, prioritizing exact matches.
 *
 * Scoring: exact match on ID fields > starts-with on ID > exact name > starts-with name > partial match
 */

export function sortStudentsByRelevance(students, query) {
  if (!query || !students?.length) return students

  const q = query.trim().toLowerCase()
  if (!q) return students

  return [...students].sort((a, b) => {
    return getStudentScore(b, q) - getStudentScore(a, q)
  })
}

function getStudentScore(student, q) {
  let score = 0

  // Admission number / studentId — highest priority for numeric queries
  const admNo = (student.admissionNumber || student.studentId || '').toString().toLowerCase()
  if (admNo === q) score += 100
  else if (admNo.startsWith(q)) score += 60
  else if (admNo.includes(q)) score += 30

  // Roll number
  const roll = (student.rollNumber || '').toString().toLowerCase()
  if (roll === q) score += 90
  else if (roll.startsWith(q)) score += 50
  else if (roll.includes(q)) score += 20

  // Full name / name
  const name = (student.fullName || student.name || '').toLowerCase()
  if (name === q) score += 80
  else if (name.startsWith(q)) score += 50
  else if (name.includes(q)) score += 20

  // Phone
  const phone = (student.phone || '').toLowerCase()
  if (phone === q) score += 70
  else if (phone.startsWith(q)) score += 40
  else if (phone.includes(q)) score += 15

  return score
}

/**
 * Generic relevance sort for any entity with configurable fields.
 * fields: array of { key: string, weight: number }
 */
export function sortByRelevance(items, query, fields) {
  if (!query || !items?.length) return items

  const q = query.trim().toLowerCase()
  if (!q) return items

  return [...items].sort((a, b) => {
    return getGenericScore(b, q, fields) - getGenericScore(a, q, fields)
  })
}

function getGenericScore(item, q, fields) {
  let score = 0
  for (const { key, weight = 1 } of fields) {
    const val = getNestedValue(item, key)
    if (!val) continue
    const v = val.toString().toLowerCase()
    if (v === q) score += 100 * weight
    else if (v.startsWith(q)) score += 60 * weight
    else if (v.includes(q)) score += 20 * weight
  }
  return score
}

function getNestedValue(obj, path) {
  return path.split('.').reduce((acc, part) => acc?.[part], obj)
}

/**
 * Returns which field matched the search term for a student result.
 * Used to show "Matched Phone: 9459885502" style indicators in search dropdowns.
 */
export function getMatchedField(student, searchTerm) {
  if (!searchTerm) return null
  const term = searchTerm.toLowerCase()
  const fields = [
    { key: 'admissionNumber', label: 'Admission No' },
    { key: 'name', label: 'Name' },
    { key: 'fullName', label: 'Name' },
    { key: 'rollNumber', label: 'Roll No' },
    { key: 'studentId', label: 'Student ID' },
    { key: 'phone', label: 'Phone' },
    { key: 'email', label: 'Email' },
  ]
  for (const { key, label } of fields) {
    const val = student[key]
    if (val && String(val).toLowerCase().includes(term)) return { label, value: String(val) }
  }
  return null
}
