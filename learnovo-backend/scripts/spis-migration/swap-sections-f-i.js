#!/usr/bin/env node
/**
 * Swap section name "F" ↔ "I" across all classes in the SPIS tenant.
 *
 * Background: students were imported with the mapping:
 *   Rose→A, Lotus→B, Lily→C, Marigold→D, Sunflower→E, Orchid→F, Jasmine→G, Daisy→H, Tulip→I
 * Correct mapping should be:
 *   Orchid→I, Tulip→F (everything else stays)
 * So this swap fixes that error: students in section F (mistakenly labeled F)
 * become section I, and vice versa. Their sectionId references stay valid because
 * we only rename the Section docs themselves.
 *
 * Three-step rename to avoid the unique {tenantId, classId, name} constraint:
 *   F → __SWAP_TMP__
 *   I → F
 *   __SWAP_TMP__ → I
 *
 * Usage:
 *   node swap-sections-f-i.js              # dry-run
 *   node swap-sections-f-i.js --execute    # actually swap
 */

const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '..', '..', 'config.env') });

const Tenant = require('../../models/Tenant');
const Class = require('../../models/Class');
const Section = require('../../models/Section');
const User = require('../../models/User');

const args = process.argv.slice(2);
const EXECUTE = args.includes('--execute');

(async() => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✓ Connected to MongoDB');

  const tenant = await Tenant.findOne({ schoolCode: /spis/i }).lean();
  if (!tenant) {
    console.error('SPIS tenant not found'); process.exit(1);
  }
  console.log(`✓ Tenant: ${tenant.schoolName} (${tenant.schoolCode})\n`);

  const classes = await Class.find({ tenantId: tenant._id }).select('_id name').sort({ name: 1 }).lean();

  let classesAffected = 0;
  const classesSkipped = 0;
  const planned = [];

  for (const cls of classes) {
    const sections = await Section.find({
      tenantId: tenant._id,
      classId: cls._id,
      name: { $in: ['F', 'I'] }
    }).lean();

    const f = sections.find(s => s.name === 'F');
    const i = sections.find(s => s.name === 'I');

    if (!f && !i) continue;
    if (f && !i) {
      // Only F exists → those students were mis-mapped as Orchid; correct = I. Just rename F → I.
      const fStudents = await User.countDocuments({ tenantId: tenant._id, role: 'student', sectionId: f._id });
      planned.push({ cls, op: 'rename', source: f, newName: 'I', count: fStudents });
      console.log(`Class ${cls.name}: only F (${fStudents} students) → rename to I`);
      classesAffected++;
      continue;
    }
    if (!f && i) {
      // Only I exists → those students were mis-mapped as Tulip; correct = F. Just rename I → F.
      const iStudents = await User.countDocuments({ tenantId: tenant._id, role: 'student', sectionId: i._id });
      planned.push({ cls, op: 'rename', source: i, newName: 'F', count: iStudents });
      console.log(`Class ${cls.name}: only I (${iStudents} students) → rename to F`);
      classesAffected++;
      continue;
    }

    const fStudents = await User.countDocuments({ tenantId: tenant._id, role: 'student', sectionId: f._id });
    const iStudents = await User.countDocuments({ tenantId: tenant._id, role: 'student', sectionId: i._id });
    planned.push({ cls, op: 'swap', f, i, fStudents, iStudents });
    console.log(`Class ${cls.name}: F (${fStudents} students) ⇄ I (${iStudents} students)`);
    classesAffected++;
  }

  console.log(`\nClasses affected: ${classesAffected}`);
  if (classesSkipped > 0) console.log(`Classes skipped: ${classesSkipped}`);

  if (!EXECUTE) {
    console.log('\n(Dry run — re-run with --execute to apply)');
    await mongoose.disconnect();
    return;
  }

  console.log('\n--- EXECUTING ---');
  for (const op of planned) {
    if (op.op === 'swap') {
      // Three-step rename to avoid unique constraint
      await Section.updateOne({ _id: op.f._id }, { $set: { name: '__SWAP_TMP__' } });
      await Section.updateOne({ _id: op.i._id }, { $set: { name: 'F' } });
      await Section.updateOne({ _id: op.f._id }, { $set: { name: 'I' } });
      console.log(`  ✓ ${op.cls.name}: swapped F ⇄ I`);
    } else if (op.op === 'rename') {
      await Section.updateOne({ _id: op.source._id }, { $set: { name: op.newName } });
      console.log(`  ✓ ${op.cls.name}: renamed ${op.source.name} → ${op.newName} (${op.count} students)`);
    }
  }

  console.log(`\n✅ Updated ${planned.length} class(es).`);
  await mongoose.disconnect();
})().catch(err => {
  console.error('\n❌ Error:', err.message);
  console.error(err.stack);
  process.exit(1);
});
