/**
 * SPIS Class Dedup
 *
 * Detects Class documents in the SPIS tenant that collide on
 * (grade, name) — the bug behind dropdowns showing the same class
 * twice (e.g. "Class 1" listed twice in Exams & Report Cards).
 *
 * For each duplicate group it keeps the OLDEST class as canonical
 * and migrates everything off the younger duplicates:
 *
 *   1. Sections under the duplicate are merged into the canonical
 *      (matched by section name; created on canonical if missing).
 *   2. Students are repointed to the canonical class + merged section.
 *   3. Section-less students under the duplicate are repointed.
 *   4. Duplicate sections and the duplicate class are deleted.
 *
 * Safety:
 *   - Tenant-scoped to schoolCode "spis".
 *   - Refuses to delete a duplicate while students still reference it.
 *   - Dry-run by default. Pass --execute to mutate.
 *
 * Usage on VPS:
 *   node scripts/dedupe-spis-classes.js            # dry-run
 *   node scripts/dedupe-spis-classes.js --execute  # commit changes
 */

require('dotenv').config({ path: './config.env' });
const mongoose = require('mongoose');

const Tenant = require('../models/Tenant');
const Class = require('../models/Class');
const Section = require('../models/Section');
const User = require('../models/User');

const DRY_RUN = !process.argv.includes('--execute');

function keyOf(c) {
  return `${(c.grade || '').toString().trim().toLowerCase()}|${(c.name || '').toString().trim().toLowerCase()}`;
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'EXECUTE (will mutate DB)'}\n`);

  const tenant = await Tenant.findOne({ schoolCode: 'spis' });
  if (!tenant) {
    console.error('SPIS tenant not found. Aborting.');
    process.exit(1);
  }
  const tenantId = tenant._id;
  console.log(`SPIS tenant: ${tenant.schoolName} (${tenantId})\n`);

  const classes = await Class.find({ tenantId }).lean();
  console.log(`Total classes for SPIS: ${classes.length}\n`);

  // Group by (grade,name)
  const groups = new Map();
  for (const c of classes) {
    const k = keyOf(c);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(c);
  }

  const dupGroups = [...groups.entries()].filter(([, list]) => list.length > 1);
  if (dupGroups.length === 0) {
    console.log('No duplicate (grade,name) classes found. Nothing to do.');
    process.exit(0);
  }

  console.log(`=== DUPLICATE GROUPS (${dupGroups.length}) ===`);
  for (const [k, list] of dupGroups) {
    console.log(`  key="${k}"  count=${list.length}`);
    list.forEach(c =>
      console.log(`    ${c._id}  name="${c.name}"  grade="${c.grade}"  createdAt=${c.createdAt?.toISOString?.() || c.createdAt}`)
    );
  }
  console.log('');

  if (!DRY_RUN) {
    console.log('Proceeding with mutations in 5 seconds. Ctrl+C to abort.\n');
    await new Promise(r => setTimeout(r, 5000));
  }

  const summary = {
    duplicatesDeleted: 0,
    sectionsDeleted: 0,
    sectionsCreated: 0,
    studentsMoved: 0
  };

  for (const [, list] of dupGroups) {
    // Oldest = canonical
    list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    const [canonical, ...dups] = list;
    console.log(`-- Canonical ${canonical._id} ("${canonical.name}", grade="${canonical.grade}")`);

    for (const dup of dups) {
      console.log(`   duplicate ${dup._id} (createdAt=${dup.createdAt?.toISOString?.() || dup.createdAt})`);

      const dupSections = await Section.find({ tenantId, classId: dup._id }).lean();
      const canonicalSections = await Section.find({ tenantId, classId: canonical._id }).lean();
      const canonicalByName = new Map(canonicalSections.map(s => [s.name.toUpperCase(), s]));

      for (const ds of dupSections) {
        const upperName = ds.name.toUpperCase();
        let target = canonicalByName.get(upperName);

        if (!target) {
          if (DRY_RUN) {
            console.log(`     would CREATE section "${ds.name}" under canonical`);
          } else {
            const created = await Section.create({
              tenantId,
              classId: canonical._id,
              name: ds.name,
              sectionTeacher: ds.sectionTeacher || undefined
            });
            target = created.toObject();
            canonicalByName.set(upperName, target);
          }
          summary.sectionsCreated++;
        }

        const studentFilter = { tenantId, role: 'student', sectionId: ds._id };
        const moveCount = await User.countDocuments(studentFilter);
        if (moveCount > 0) {
          if (DRY_RUN) {
            console.log(`     would MOVE ${moveCount} students from dup section "${ds.name}" → canonical`);
          } else {
            const update = {
              classId: canonical._id,
              sectionId: target._id
            };
            if (canonical.grade) update.class = canonical.grade;
            if (target.name) update.section = target.name;
            await User.updateMany(studentFilter, { $set: update });
          }
          summary.studentsMoved += moveCount;
        }

        if (DRY_RUN) {
          console.log(`     would DELETE dup section ${ds._id} ("${ds.name}")`);
        } else {
          await Section.deleteOne({ _id: ds._id, tenantId });
        }
        summary.sectionsDeleted++;
      }

      // Sectionless students still on the dup class
      const orphanFilter = {
        tenantId,
        role: 'student',
        classId: dup._id,
        $or: [{ sectionId: null }, { sectionId: { $exists: false } }]
      };
      const orphanCount = await User.countDocuments(orphanFilter);
      if (orphanCount > 0) {
        if (DRY_RUN) {
          console.log(`     would REASSIGN ${orphanCount} sectionless students → canonical class`);
        } else {
          await User.updateMany(orphanFilter, {
            $set: { classId: canonical._id, class: canonical.grade }
          });
        }
        summary.studentsMoved += orphanCount;
      }

      // Final guard
      const stragglers = await User.countDocuments({ tenantId, role: 'student', classId: dup._id });
      if (stragglers > 0 && !DRY_RUN) {
        console.error(`     ABORT: ${stragglers} students still reference dup ${dup._id}. Skipping delete.`);
        continue;
      }

      if (DRY_RUN) {
        console.log(`     would DELETE dup class ${dup._id}`);
      } else {
        await Class.deleteOne({ _id: dup._id, tenantId });
      }
      summary.duplicatesDeleted++;
    }
  }

  console.log('\n=== SUMMARY ===');
  console.log(`  Duplicate classes ${DRY_RUN ? 'to delete' : 'deleted'}: ${summary.duplicatesDeleted}`);
  console.log(`  Sections ${DRY_RUN ? 'to delete' : 'deleted'}: ${summary.sectionsDeleted}`);
  console.log(`  Sections ${DRY_RUN ? 'to create' : 'created'}: ${summary.sectionsCreated}`);
  console.log(`  Students ${DRY_RUN ? 'to move' : 'moved'}: ${summary.studentsMoved}`);
  if (DRY_RUN) {
    console.log('\nDRY RUN complete. Re-run with --execute to apply changes.');
  } else {
    console.log('\nDONE. Refresh SPIS to verify the dropdowns are clean.');
  }

  process.exit(0);
}

run().catch(err => {
  console.error('Dedup failed:', err);
  process.exit(1);
});
