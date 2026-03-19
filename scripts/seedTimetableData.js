/**
 * Seed Timetable Data — SP International School
 * Creates rooms, subjects, timings, allocations, and timetable entries
 * for testing the timetable module.
 *
 * Usage: node scripts/seedTimetableData.js
 */

const mongoose = require('mongoose')
const path = require('path')

// Load env
require('dotenv').config({ path: path.join(__dirname, '..', 'config.env') })

// Models
const Room = require('../models/Room')
const Subject = require('../models/Subject')
const SchoolTiming = require('../models/SchoolTiming')
const TimetableTemplate = require('../models/TimetableTemplate')
const TimetableEntry = require('../models/TimetableEntry')
const SubjectAllocation = require('../models/SubjectAllocation')

// ── Constants ──────────────────────────────────────────────
const TENANT_ID = '69788171da522fa9b3baffa8' // SP International School
const TEMPLATE_ID = '69bb36b7d03fca8efb4a844f' // 2026 term 1 timetable
const SESSION_ID = '69789a863e59a81c5100c053' // 2026-27
const CLASS_ID = '6996dbf118df30d1cc58a944' // Nursery
const SECTION_A = '6996dbf118df30d1cc58a946'
const SECTION_B = '69bb3a90d03fca8efb4a8831'
const TEACHER_1 = '6979ec6b69fba7f973404dd5' // MANPREET
const TEACHER_2 = '697b1ca57e7a7030777b691f' // TANIA MITTAL
const ADMIN_USER = '69788171da522fa9b3baffaa'
const EXISTING_MATHS_ID = '69bb3a77d03fca8efb4a8800'

const WORKING_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

async function seed() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/learnovo'
  console.log(`Connecting to ${uri} ...`)
  await mongoose.connect(uri)
  console.log('Connected.\n')

  // ── 1. Create Subjects ────────────────────────────────────
  console.log('── Creating Subjects ──')
  const subjectDefs = [
    { name: 'English', subjectCode: 'ENG001', type: 'Theory' },
    { name: 'Hindi', subjectCode: 'HIN001', type: 'Theory' },
    { name: 'Science', subjectCode: 'SCI001', type: 'Both' },
    { name: 'EVS', subjectCode: 'EVS001', type: 'Theory' },
    { name: 'Drawing', subjectCode: 'DRW001', type: 'Practical' },
    { name: 'Computer', subjectCode: 'CMP001', type: 'Practical' },
    { name: 'Physical Education', subjectCode: 'PE001', type: 'Practical' },
    { name: 'General Knowledge', subjectCode: 'GK001', type: 'Theory' },
  ]

  const subjectIds = { maths: EXISTING_MATHS_ID }
  for (const def of subjectDefs) {
    const existing = await Subject.findOne({ tenantId: TENANT_ID, subjectCode: def.subjectCode })
    if (existing) {
      subjectIds[def.name.toLowerCase()] = existing._id.toString()
      console.log(`  ✓ ${def.name} (exists)`)
    } else {
      const s = await Subject.create({ tenantId: TENANT_ID, ...def, isActive: true })
      subjectIds[def.name.toLowerCase()] = s._id.toString()
      console.log(`  + ${def.name}`)
    }
  }

  // ── 2. Create Rooms ───────────────────────────────────────
  console.log('\n── Creating Rooms ──')
  const roomDefs = [
    { name: 'Room 101', code: 'R101', type: 'classroom', building: 'Main Block', floor: 1, capacity: 40 },
    { name: 'Room 102', code: 'R102', type: 'classroom', building: 'Main Block', floor: 1, capacity: 40 },
    { name: 'Room 201', code: 'R201', type: 'classroom', building: 'Main Block', floor: 2, capacity: 35 },
    { name: 'Computer Lab', code: 'CLAB', type: 'lab', building: 'Science Block', floor: 1, capacity: 30, facilities: ['Projector', 'Computers', 'AC'] },
    { name: 'Science Lab', code: 'SLAB', type: 'lab', building: 'Science Block', floor: 1, capacity: 30, facilities: ['Projector', 'Lab Equipment'] },
    { name: 'Art Room', code: 'ART1', type: 'classroom', building: 'Main Block', floor: 2, capacity: 30, facilities: ['Drawing Boards', 'Art Supplies'] },
    { name: 'Playground', code: 'PG01', type: 'sports', building: 'Outdoor', floor: 0, capacity: 100 },
    { name: 'Auditorium', code: 'AUD1', type: 'auditorium', building: 'Main Block', floor: 0, capacity: 200, facilities: ['Projector', 'Sound System', 'AC'] },
    { name: 'Library', code: 'LIB1', type: 'library', building: 'Main Block', floor: 2, capacity: 50, facilities: ['Books', 'Reading Area', 'AC'] },
  ]

  const roomIds = {}
  for (const def of roomDefs) {
    const existing = await Room.findOne({ tenantId: TENANT_ID, name: def.name })
    if (existing) {
      roomIds[def.code] = existing._id.toString()
      console.log(`  ✓ ${def.name} (exists)`)
    } else {
      const r = await Room.create({ tenantId: TENANT_ID, ...def, isActive: true })
      roomIds[def.code] = r._id.toString()
      console.log(`  + ${def.name}`)
    }
  }

  // ── 3. Create School Timings (Bell Schedule) ──────────────
  console.log('\n── Creating School Timings ──')
  // Clear existing timings for this template
  await SchoolTiming.deleteMany({ tenantId: TENANT_ID, templateId: TEMPLATE_ID })

  const timingDefs = [
    { slotNumber: 1, label: 'Assembly', startTime: '08:00', endTime: '08:20', type: 'assembly' },
    { slotNumber: 2, label: 'Period 1', startTime: '08:20', endTime: '09:00', type: 'period' },
    { slotNumber: 3, label: 'Period 2', startTime: '09:00', endTime: '09:40', type: 'period' },
    { slotNumber: 4, label: 'Period 3', startTime: '09:40', endTime: '10:20', type: 'period' },
    { slotNumber: 5, label: 'Short Break', startTime: '10:20', endTime: '10:35', type: 'break' },
    { slotNumber: 6, label: 'Period 4', startTime: '10:35', endTime: '11:15', type: 'period' },
    { slotNumber: 7, label: 'Period 5', startTime: '11:15', endTime: '11:55', type: 'period' },
    { slotNumber: 8, label: 'Lunch Break', startTime: '11:55', endTime: '12:30', type: 'lunch' },
    { slotNumber: 9, label: 'Period 6', startTime: '12:30', endTime: '13:10', type: 'period' },
    { slotNumber: 10, label: 'Period 7', startTime: '13:10', endTime: '13:50', type: 'period' },
    { slotNumber: 11, label: 'Period 8', startTime: '13:50', endTime: '14:30', type: 'period' },
  ]

  const timingIds = {}
  for (const def of timingDefs) {
    const t = await SchoolTiming.create({ tenantId: TENANT_ID, templateId: TEMPLATE_ID, ...def })
    timingIds[def.slotNumber] = t._id.toString()
    console.log(`  + Slot ${def.slotNumber}: ${def.label} (${def.startTime}-${def.endTime})`)
  }

  // Get only period slots (not breaks/assembly/lunch)
  const periodSlots = timingDefs.filter(t => t.type === 'period').map(t => t.slotNumber)

  // ── 4. Publish Template ───────────────────────────────────
  console.log('\n── Publishing Template ──')
  await TimetableTemplate.findByIdAndUpdate(TEMPLATE_ID, {
    status: 'published',
    publishedAt: new Date(),
    publishedBy: ADMIN_USER,
    academicSessionId: SESSION_ID,
    effectiveFrom: new Date('2026-04-01'),
    effectiveTo: new Date('2026-09-30'),
  })
  console.log('  ✓ Template published')

  // ── 5. Create Subject Allocations ─────────────────────────
  console.log('\n── Creating Subject Allocations ──')
  await SubjectAllocation.deleteMany({ tenantId: TENANT_ID, templateId: TEMPLATE_ID })

  // Section A allocations (Teacher 1 = MANPREET)
  const allocationsA = [
    { subjectId: subjectIds.maths, teacherId: TEACHER_1, periodsPerWeek: 6 },
    { subjectId: subjectIds.english, teacherId: TEACHER_2, periodsPerWeek: 6 },
    { subjectId: subjectIds.hindi, teacherId: TEACHER_1, periodsPerWeek: 5 },
    { subjectId: subjectIds.science, teacherId: TEACHER_2, periodsPerWeek: 5 },
    { subjectId: subjectIds.evs, teacherId: TEACHER_1, periodsPerWeek: 4 },
    { subjectId: subjectIds.drawing, teacherId: TEACHER_2, periodsPerWeek: 3 },
    { subjectId: subjectIds.computer, teacherId: TEACHER_2, periodsPerWeek: 2 },
    { subjectId: subjectIds['physical education'], teacherId: TEACHER_1, periodsPerWeek: 3 },
    { subjectId: subjectIds['general knowledge'], teacherId: TEACHER_1, periodsPerWeek: 2 },
  ]

  // Section B allocations (swap teachers for variety)
  const allocationsB = [
    { subjectId: subjectIds.maths, teacherId: TEACHER_2, periodsPerWeek: 6 },
    { subjectId: subjectIds.english, teacherId: TEACHER_1, periodsPerWeek: 6 },
    { subjectId: subjectIds.hindi, teacherId: TEACHER_2, periodsPerWeek: 5 },
    { subjectId: subjectIds.science, teacherId: TEACHER_1, periodsPerWeek: 5 },
    { subjectId: subjectIds.evs, teacherId: TEACHER_2, periodsPerWeek: 4 },
    { subjectId: subjectIds.drawing, teacherId: TEACHER_1, periodsPerWeek: 3 },
    { subjectId: subjectIds.computer, teacherId: TEACHER_1, periodsPerWeek: 2 },
    { subjectId: subjectIds['physical education'], teacherId: TEACHER_2, periodsPerWeek: 3 },
    { subjectId: subjectIds['general knowledge'], teacherId: TEACHER_2, periodsPerWeek: 2 },
  ]

  for (const a of allocationsA) {
    await SubjectAllocation.create({
      tenantId: TENANT_ID,
      templateId: TEMPLATE_ID,
      classId: CLASS_ID,
      sectionId: SECTION_A,
      ...a,
    })
  }
  for (const a of allocationsB) {
    await SubjectAllocation.create({
      tenantId: TENANT_ID,
      templateId: TEMPLATE_ID,
      classId: CLASS_ID,
      sectionId: SECTION_B,
      ...a,
    })
  }
  console.log(`  + ${allocationsA.length} allocations for Section A`)
  console.log(`  + ${allocationsB.length} allocations for Section B`)

  // ── 6. Create Timetable Entries ───────────────────────────
  console.log('\n── Creating Timetable Entries ──')
  await TimetableEntry.deleteMany({ tenantId: TENANT_ID, templateId: TEMPLATE_ID })

  // CONSTRAINT: same teacher cannot be in two sections at the same timeslot.
  // T1 subjects (Section A): maths, hindi, evs, PE, GK
  // T2 subjects (Section A): english, science, drawing, computer
  // Section B teachers are SWAPPED — so for any slot:
  //   If A has a T1-subject, B must also have a T1-subject (taught by T2 in B)
  //   If A has a T2-subject, B must also have a T2-subject (taught by T1 in B)
  // This ensures T1 teaches A while T2 teaches B, or vice versa — never same teacher in both.

  // T1-pool: maths, hindi, evs, PE, GK (Section A → T1, Section B → T2)
  // T2-pool: english, science, drawing, computer (Section A → T2, Section B → T1)
  // RULE: Each slot must pair subjects from the SAME pool so teachers never overlap.
  //   [T1-pool, T1-pool] → A gets T1, B gets T2
  //   [T2-pool, T2-pool] → A gets T2, B gets T1

  const weeklyScheduleA = {
    //         P1       P2        P3        P4        P5        P6        P7        P8
    monday:    ['maths','english','hindi',  'science','evs',    'drawing','maths',  'english'],
    tuesday:   ['english','maths','science','hindi',  'drawing','evs',   'english', 'general knowledge'],
    wednesday: ['hindi','science','maths',  'english','evs',    'computer','hindi', 'science'],
    thursday:  ['science','maths','english','hindi',  'physical education','drawing','science','evs'],
    friday:    ['maths','english','hindi',  'science','general knowledge','computer','maths', 'physical education'],
    saturday:  ['english','hindi','science','maths',  'drawing','evs',   'physical education','english'],
  }

  // Section B: MUST match the pool of Section A per slot
  const weeklyScheduleB = {
    //         P1       P2        P3        P4        P5        P6        P7        P8
    monday:    ['hindi','science','evs',    'english','maths',  'computer','general knowledge','science'],
    tuesday:   ['science','hindi','english','maths',  'computer','general knowledge','science','evs'],
    wednesday: ['evs',  'english','hindi',  'science','maths',  'drawing','general knowledge','drawing'],
    thursday:  ['english','hindi','science','evs',    'maths',  'computer','english','physical education'],
    friday:    ['hindi','science','evs',    'drawing','maths',  'english','general knowledge','evs'],
    saturday:  ['science','maths','drawing','hindi',  'computer','physical education','evs',  'science'],
  }

  // Room mapping by subject
  const subjectRoomMap = {
    maths: 'R101', english: 'R101', hindi: 'R101', science: 'SLAB',
    evs: 'R101', drawing: 'ART1', computer: 'CLAB',
    'physical education': 'PG01', 'general knowledge': 'R101',
  }
  const subjectRoomMapB = {
    maths: 'R102', english: 'R102', hindi: 'R102', science: 'R201',
    evs: 'R102', drawing: 'ART1', computer: 'CLAB',
    'physical education': 'PG01', 'general knowledge': 'R102',
  }

  let entryCount = 0

  // Teacher assignments: T1-pool subjects → T1 in A, T2 in B. T2-pool → T2 in A, T1 in B.
  const t1Pool = ['maths', 'hindi', 'evs', 'physical education', 'general knowledge']
  const getTeacherA = (subj) => t1Pool.includes(subj) ? TEACHER_1 : TEACHER_2
  const getTeacherB = (subj) => t1Pool.includes(subj) ? TEACHER_2 : TEACHER_1

  for (const day of WORKING_DAYS) {
    const schedA = weeklyScheduleA[day]
    const schedB = weeklyScheduleB[day]

    for (let i = 0; i < periodSlots.length && i < schedA.length; i++) {
      const slotNum = periodSlots[i]
      const subjA = schedA[i]
      const subjB = schedB[i]

      await TimetableEntry.create({
        tenantId: TENANT_ID, templateId: TEMPLATE_ID, dayOfWeek: day,
        timingSlotId: timingIds[slotNum], classId: CLASS_ID, sectionId: SECTION_A,
        subjectId: subjectIds[subjA], teacherId: getTeacherA(subjA),
        roomId: roomIds[subjectRoomMap[subjA]] || null, isManual: true,
      })
      entryCount++

      await TimetableEntry.create({
        tenantId: TENANT_ID, templateId: TEMPLATE_ID, dayOfWeek: day,
        timingSlotId: timingIds[slotNum], classId: CLASS_ID, sectionId: SECTION_B,
        subjectId: subjectIds[subjB], teacherId: getTeacherB(subjB),
        roomId: roomIds[subjectRoomMapB[subjB]] || null, isManual: true,
      })
      entryCount++
    }
    console.log(`  + ${day}: ${schedA.length} periods (A) + ${schedB.length} periods (B)`)
  }

  console.log(`\n  Total entries created: ${entryCount}`)

  // ── Summary ───────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════')
  console.log('  SEED COMPLETE')
  console.log('══════════════════════════════════════════')
  console.log(`  Tenant:    SP International School`)
  console.log(`  Template:  2026 term 1 timetable (PUBLISHED)`)
  console.log(`  Class:     Nursery (Sections A & B)`)
  console.log(`  Subjects:  ${Object.keys(subjectIds).length}`)
  console.log(`  Rooms:     ${Object.keys(roomIds).length}`)
  console.log(`  Timings:   ${timingDefs.length} slots (${periodSlots.length} periods)`)
  console.log(`  Entries:   ${entryCount} timetable entries`)
  console.log(`  Days:      ${WORKING_DAYS.join(', ')}`)
  console.log('══════════════════════════════════════════\n')

  await mongoose.disconnect()
  console.log('Disconnected. Done!')
}

seed().catch(err => {
  console.error('Seed failed:', err)
  process.exit(1)
})
