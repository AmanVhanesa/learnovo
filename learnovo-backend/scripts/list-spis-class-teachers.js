const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: './config.env' });

const Tenant = require('../models/Tenant');
const Class = require('../models/Class');
const Section = require('../models/Section');
const User = require('../models/User');
const AcademicSession = require('../models/AcademicSession');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const tenant = await Tenant.findOne({
    $or: [{ schoolCode: /spis/i }, { subdomain: /spis/i }, { schoolName: /spis/i }]
  }).lean();
  if (!tenant) { console.log('SPIS tenant not found'); process.exit(1); }
  console.log(`Tenant: ${tenant.schoolName} (${tenant.schoolCode}) ${tenant._id}\n`);

  const session = await AcademicSession.findOne({ tenantId: tenant._id, isActive: true }).lean();
  console.log(`Active session: ${session?.name || '(none)'}\n`);

  const classes = await Class.find({ tenantId: tenant._id, isActive: true })
    .select('_id name grade classTeacher academicYear createdAt')
    .sort({ name: 1 }).lean();

  const sections = await Section.find({ tenantId: tenant._id, isActive: true })
    .select('_id name classId sectionTeacher').lean();

  const teacherIds = new Set();
  classes.forEach(c => c.classTeacher && teacherIds.add(String(c.classTeacher)));
  sections.forEach(s => s.sectionTeacher && teacherIds.add(String(s.sectionTeacher)));

  const teachers = await User.find({ _id: { $in: [...teacherIds] } })
    .select('_id name fullName firstName lastName employeeId email role').lean();
  const tMap = new Map(teachers.map(t => [String(t._id), t]));

  const fmt = t => t ? `${t.fullName || t.name || `${t.firstName||''} ${t.lastName||''}`.trim()} [empId: ${t.employeeId || '-'}]` : '—';

  console.log('=== CLASS TEACHERS (Class.classTeacher) ===');
  for (const c of classes) {
    const t = c.classTeacher ? tMap.get(String(c.classTeacher)) : null;
    console.log(`Class ${c.name} (${c.academicYear || '-'}) → ${fmt(t)}`);
  }

  console.log('\n=== SECTION TEACHERS (Section.sectionTeacher) ===');
  const classById = new Map(classes.map(c => [String(c._id), c]));
  const grouped = {};
  for (const s of sections) {
    const cls = classById.get(String(s.classId));
    if (!cls) continue;
    grouped[cls.name] = grouped[cls.name] || [];
    grouped[cls.name].push({ section: s.name, teacher: s.sectionTeacher ? tMap.get(String(s.sectionTeacher)) : null });
  }
  for (const cName of Object.keys(grouped).sort()) {
    grouped[cName].sort((a,b) => a.section.localeCompare(b.section));
    for (const r of grouped[cName]) {
      console.log(`Class ${cName} - Section ${r.section} → ${fmt(r.teacher)}`);
    }
  }

  await mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });
