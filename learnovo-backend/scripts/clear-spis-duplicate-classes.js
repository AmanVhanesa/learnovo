/**
 * SPIS Duplicate Class Cleanup
 *
 * Removes the ghost "1ST".."8TH" Class records that the broken importer
 * auto-created on SPIS during the failed import runs (before the
 * ordinal-suffix matching fix landed). For each ghost grade it:
 *
 *   1. Locates the canonical class with the matching numeric grade
 *      (e.g. ghost grade "1ST" → canonical grade "1").
 *   2. Migrates students under ghost sections onto the matching-by-name
 *      section under the canonical class (creating it if missing).
 *   3. Migrates students sitting on the ghost class with no section.
 *   4. Deletes ghost sections and the ghost class.
 *
 * Safety:
 *   - Tenant scoped to schoolCode "spis" only.
 *   - Refuses to delete a ghost if no canonical match exists.
 *   - Dry-run by default. Pass --execute to actually mutate the DB.
 *
 * Usage on VPS:
 *   node scripts/clear-spis-duplicate-classes.js            # dry-run
 *   node scripts/clear-spis-duplicate-classes.js --execute  # commit changes
 */

require('dotenv').config({ path: './config.env' });
const mongoose = require('mongoose');

const Tenant = require('../models/Tenant');
const Class = require('../models/Class');
const Section = require('../models/Section');
const User = require('../models/User');

const DRY_RUN = !process.argv.includes('--execute');

const ORDINAL_RE = /^(\d+)\s*(st|nd|rd|th)$/i;

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

  // Pull every class for SPIS
  const classes = await Class.find({ tenantId }).lean();
  console.log(`Total classes for SPIS: ${classes.length}\n`);

  // Identify ghosts
  const ghosts = classes.filter(c => ORDINAL_RE.test((c.grade || '').trim()));
  if (ghosts.length === 0) {
    console.log('No ghost ordinal-graded classes found. Nothing to do.');
    process.exit(0);
  }

  console.log(`=== GHOSTS DETECTED (${ghosts.length}) ===`);
  ghosts.forEach(g => {
    console.log(`  ${g._id}  name="${g.name}"  grade="${g.grade}"`);
  });
  console.log('');

  // Build canonical lookup keyed by numeric grade string
  const canonicalByGrade = new Map();
  classes
    .filter(c => /^\d+$/.test((c.grade || '').trim()))
    .forEach(c => {
      // First-wins by createdAt? They're already in insertion order from the DB.
      // If multiple canonicals exist, prefer the one with the most students.
      const existing = canonicalByGrade.get(c.grade.trim());
      if (!existing) canonicalByGrade.set(c.grade.trim(), c);
    });

  console.log('=== CANONICAL CLASSES BY GRADE ===');
  for (const [g, c] of canonicalByGrade.entries()) {
    console.log(`  grade "${g}" → ${c._id}  name="${c.name}"`);
  }
  console.log('');

  // Refuse if any ghost lacks a canonical match — bail without deleting anything
  const orphanGhosts = ghosts.filter(g => {
    const numeric = g.grade.match(ORDINAL_RE)[1];
    return !canonicalByGrade.has(numeric);
  });
  if (orphanGhosts.length > 0) {
    console.error('ABORT: ghost classes have no canonical numeric counterpart:');
    orphanGhosts.forEach(g => console.error(`  ${g._id} grade="${g.grade}"`));
    console.error('Manual review required. No changes made.');
    process.exit(1);
  }

  if (!DRY_RUN) {
    console.log('Proceeding with mutations in 5 seconds. Ctrl+C to abort.\n');
    await new Promise(r => setTimeout(r, 5000));
  }

  const summary = {
    ghostsDeleted: 0,
    sectionsDeleted: 0,
    sectionsCreated: 0,
    studentsMoved: 0
  };

  for (const ghost of ghosts) {
    const numeric = ghost.grade.match(ORDINAL_RE)[1];
    const canonical = canonicalByGrade.get(numeric);
    console.log(`-- Ghost ${ghost._id} ("${ghost.name}") → canonical ${canonical._id} ("${canonical.name}")`);

    // Pull ghost sections + canonical sections
    const ghostSections = await Section.find({ tenantId, classId: ghost._id }).lean();
    const canonicalSections = await Section.find({ tenantId, classId: canonical._id }).lean();
    const canonicalByName = new Map(
      canonicalSections.map(s => [s.name.toUpperCase(), s])
    );

    for (const gs of ghostSections) {
      const upperName = gs.name.toUpperCase();
      let target = canonicalByName.get(upperName);

      if (!target) {
        // Create matching section under canonical
        if (DRY_RUN) {
          console.log(`   would CREATE section "${gs.name}" under canonical`);
        } else {
          const created = await Section.create({
            tenantId,
            classId: canonical._id,
            name: gs.name,
            sectionTeacher: gs.sectionTeacher || undefined
          });
          target = created.toObject();
          canonicalByName.set(upperName, target);
        }
        summary.sectionsCreated++;
      }

      // Move students from ghost section → target section
      const studentFilter = { tenantId, role: 'student', sectionId: gs._id };
      const moveCount = await User.countDocuments(studentFilter);
      if (moveCount > 0) {
        if (DRY_RUN) {
          console.log(`   would MOVE ${moveCount} students from ghost section "${gs.name}" → canonical`);
        } else {
          const update = {
            classId: canonical._id,
            sectionId: target._id
          };
          // Also rewrite the legacy class string field if present
          if (canonical.grade) update.class = canonical.grade;
          if (target.name) update.section = target.name;
          await User.updateMany(studentFilter, { $set: update });
        }
        summary.studentsMoved += moveCount;
      }

      // Delete ghost section (now drained)
      if (DRY_RUN) {
        console.log(`   would DELETE ghost section ${gs._id} ("${gs.name}")`);
      } else {
        await Section.deleteOne({ _id: gs._id, tenantId });
      }
      summary.sectionsDeleted++;
    }

    // Catch any students sitting on the ghost class with no sectionId
    const orphanStudents = await User.countDocuments({
      tenantId,
      role: 'student',
      classId: ghost._id,
      $or: [{ sectionId: null }, { sectionId: { $exists: false } }]
    });
    if (orphanStudents > 0) {
      if (DRY_RUN) {
        console.log(`   would REASSIGN ${orphanStudents} sectionless students from ghost class → canonical class`);
      } else {
        await User.updateMany(
          {
            tenantId,
            role: 'student',
            classId: ghost._id,
            $or: [{ sectionId: null }, { sectionId: { $exists: false } }]
          },
          { $set: { classId: canonical._id, class: canonical.grade } }
        );
      }
      summary.studentsMoved += orphanStudents;
    }

    // Final safety: confirm no students still reference the ghost class
    const stragglers = await User.countDocuments({ tenantId, role: 'student', classId: ghost._id });
    if (stragglers > 0 && !DRY_RUN) {
      console.error(`   ABORT: ${stragglers} students still reference ghost class ${ghost._id}. Skipping ghost delete.`);
      continue;
    }

    if (DRY_RUN) {
      console.log(`   would DELETE ghost class ${ghost._id}`);
    } else {
      await Class.deleteOne({ _id: ghost._id, tenantId });
    }
    summary.ghostsDeleted++;
  }

  console.log('\n=== SUMMARY ===');
  console.log(`  Ghost classes ${DRY_RUN ? 'to delete' : 'deleted'}: ${summary.ghostsDeleted}`);
  console.log(`  Ghost sections ${DRY_RUN ? 'to delete' : 'deleted'}: ${summary.sectionsDeleted}`);
  console.log(`  Canonical sections ${DRY_RUN ? 'to create' : 'created'}: ${summary.sectionsCreated}`);
  console.log(`  Students ${DRY_RUN ? 'to move' : 'moved'}: ${summary.studentsMoved}`);
  if (DRY_RUN) {
    console.log('\nDRY RUN complete. Re-run with --execute to apply changes.');
  } else {
    console.log('\nDONE. Refresh SPIS to verify the dropdowns are clean.');
  }

  process.exit(0);
}

run().catch(err => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});
