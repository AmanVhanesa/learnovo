/**
 * DATA REPAIR SCRIPT — Fix orphaned sectionIds and ensure all students have correct section/class strings.
 *
 * This script:
 * 1. Finds all students with sectionId pointing to a non-existent Section doc
 * 2. If the student has a section string, clears the bad sectionId so they can be found by string
 * 3. If section string matches a real Section, also sets the correct sectionId
 * 4. Reports what it fixes
 */
const mongoose = require('mongoose');

const uri = "mongodb+srv://evotechnologiesinnovation_db_user:V9ZYlKfuNpdzePqW@cluster0.soajlb4.mongodb.net/learnovo?retryWrites=true&w=majority&appName=Cluster0";

const DRY_RUN = process.env.DRY_RUN !== 'false';

async function run() {
    await mongoose.connect(uri);
    console.log('Connected. DRY_RUN =', DRY_RUN);

    const User = require('./models/User');
    const Section = require('./models/Section');

    // 1. Get all active Section IDs
    const allSections = await Section.find({}).select('_id name tenantId classId');
    const sectionIdSet = new Set(allSections.map(s => s._id.toString()));
    console.log(`Total Section docs in DB: ${allSections.length}`);

    // 2. Find all students that have a sectionId
    const studentsWithSectionId = await User.find({ role: 'student', sectionId: { $exists: true, $ne: null } })
        .select('fullName tenantId class section sectionId classId');

    console.log(`Students with sectionId: ${studentsWithSectionId.length}`);

    let orphaned = 0;
    let fixed = 0;
    let alreadyOk = 0;

    for (const student of studentsWithSectionId) {
        const sid = student.sectionId?.toString();
        if (!sid || sectionIdSet.has(sid)) {
            alreadyOk++;
            continue; // sectionId is valid
        }

        // This student has an orphaned sectionId
        orphaned++;
        const hasSection = student.section && student.section.trim();

        console.log(`ORPHAN: ${student.fullName} | class=${student.class} | section=${student.section} | bad sectionId=${sid}`);

        if (!DRY_RUN) {
            // Try to find the correct Section by string match
            const correctSection = allSections.find(s =>
                s.tenantId?.toString() === student.tenantId?.toString() &&
                s.name?.trim().toUpperCase() === (student.section || '').trim().toUpperCase()
            );

            const update = {};
            if (correctSection) {
                update.sectionId = correctSection._id;
                console.log(`  -> Reassigning to correct sectionId: ${correctSection._id} (${correctSection.name})`);
            } else {
                // Clear the orphaned sectionId so string-based filtering works
                update.$unset = { sectionId: '' };
                console.log(`  -> No matching Section found, clearing bad sectionId`);
            }

            await User.updateOne({ _id: student._id }, update);
            fixed++;
        }
    }

    console.log(`\n=== SUMMARY ===`);
    console.log(`Orphaned sectionIds: ${orphaned}`);
    console.log(`Fixed: ${fixed}`);
    console.log(`Already OK: ${alreadyOk}`);
    if (DRY_RUN) console.log(`\nThis was a DRY RUN. Run with DRY_RUN=false to apply fixes.`);

    await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });
