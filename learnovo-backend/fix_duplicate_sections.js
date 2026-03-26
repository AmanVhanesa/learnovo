const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// --- Configuration ---
const DRY_RUN = process.env.DRY_RUN !== 'false'; // Default to TRUE (safety first)
// ---------------------

const SectionSchema = new mongoose.Schema({
    name: String,
    classId: mongoose.Schema.Types.Mixed,
    tenantId: mongoose.Schema.Types.ObjectId,
    sectionTeacher: mongoose.Schema.Types.ObjectId
}, { strict: false });

const UserSchema = new mongoose.Schema({
    role: String,
    sectionId: mongoose.Schema.Types.ObjectId,
    classId: mongoose.Schema.Types.Mixed,
    name: String
}, { strict: false });

const Section = mongoose.model('Section', SectionSchema);
const User = mongoose.model('User', UserSchema);

async function run() {
    try {
        console.log('--- Duplicate Section Cleaner ---');
        console.log(`Mode: ${DRY_RUN ? 'DRY RUN (No changes will be applied)' : 'LIVE EXECUTION (Changes WILL be applied)'}`);
        if (DRY_RUN) console.log('To run for real, use: DRY_RUN=false node learnovo-backend/fix_duplicate_sections.js');

        // 1. Connect to DB
        let uri = process.env.MONGO_URI || process.env.MONGODB_URI;
        if (!uri) {
            const configPath = path.join(__dirname, 'config.env');
            if (fs.existsSync(configPath)) {
                console.log(`Reading config from: ${configPath}`);
                const envConfig = fs.readFileSync(configPath, 'utf8');
                for (const line of envConfig.split('\n')) {
                    const parts = line.split('=');
                    const key = parts[0].trim();
                    if (key === 'MONGO_URI' || key === 'MONGODB_URI') {
                        uri = parts.slice(1).join('=').trim().replace(/['"]/g, '');
                        break;
                    }
                }
            }
        }

        if (!uri) throw new Error('MONGO_URI not found. Please provide it as an environment variable.');

        // Hide credentials in logs
        const maskedUri = uri.replace(/:([^:@]+)@/, ':****@');
        console.log(`Connecting to: ${maskedUri}`);

        await mongoose.connect(uri);
        console.log('Connected to DB:', mongoose.connection.name);

        // 2. Fetch all sections
        const allSections = await Section.find({});
        console.log(`Scanning ${allSections.length} sections for duplicates...`);

        // 3. Group by "ClassID_Name" to find duplicates
        // We normalize ClassID to string to handle Mixed types (ObjectId vs String)
        const groups = new Map();

        allSections.forEach(sec => {
            const cId = sec.classId ? sec.classId.toString() : 'null';
            const name = (sec.name || '').trim().toUpperCase();
            const key = `${cId}|${name}`;

            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(sec);
        });

        // 4. Process groups
        let duplicateGroupsFound = 0;
        let sectionsToDelete = 0;
        let studentsToMove = 0;

        for (const [key, sections] of groups) {
            if (sections.length > 1) {
                duplicateGroupsFound++;
                const [cId, name] = key.split('|');
                console.log(`\nDuplicate Group Found: ClassID=${cId}, Name="${name}" (${sections.length} copies)`);

                // Logic: Keep the one with the most recent _id? OR matched ObjectId classId?
                // Let's prefer the one where classId matches the format of the key relative to Class collection?
                // Simplest: Keep the FIRST one encountered (usually oldest if natural order) or arbitrary.
                // Let's sort by _id (creation time). Keep the OLDEST one.
                sections.sort((a, b) => a._id.toString().localeCompare(b._id.toString()));

                const keeper = sections[0];
                const duplicates = sections.slice(1);

                console.log(`   -> Keeping: ${keeper._id} (ClassId type: ${typeof keeper.classId}, Val: ${keeper.classId})`);

                for (const dup of duplicates) {
                    console.log(`   -> Duplicate to remove: ${dup._id} (ClassId type: ${typeof dup.classId}, Val: ${dup.classId})`);

                    // Check for students assigned to duplicate
                    const studentCount = await User.countDocuments({ sectionId: dup._id });
                    if (studentCount > 0) {
                        console.log(`      Found ${studentCount} students linked to this duplicate.`);
                        studentsToMove += studentCount;

                        if (!DRY_RUN) {
                            await User.updateMany(
                                { sectionId: dup._id },
                                { $set: { sectionId: keeper._id } } // Move to keeper
                            );
                            console.log('      Moved students to keeper.');
                        }
                    }

                    sectionsToDelete++;
                    if (!DRY_RUN) {
                        await Section.deleteOne({ _id: dup._id });
                        console.log('      Deleted section.');
                    }
                }
            }
        }

        console.log('\n------------------------------------------------');
        console.log('Scan Complete.');
        console.log(`Duplicate Groups Found: ${duplicateGroupsFound}`);
        console.log(`Sections to Delete: ${sectionsToDelete}`);
        console.log(`Students to Migrate: ${studentsToMove}`);

        if (DRY_RUN) {
            console.log('\n[!] THIS WAS A DRY RUN. NO CHANGES MADE.');
            if (duplicateGroupsFound > 0) {
                console.log('Run the following command to apply fixes:');
                console.log('   DRY_RUN=false node learnovo-backend/fix_duplicate_sections.js');
                // Also suggest passing URI if needed
                if (!process.env.MONGO_URI) {
                    console.log('   (If you use a cloud DB, prepend MONGO_URI="your_connection_string")');
                }
            }
        } else {
            console.log('\n[SUCCESS] Fixes applied successfully.');
            console.log('Please restart your backend server to see changes.');
        }

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await mongoose.disconnect();
    }
}

run();
