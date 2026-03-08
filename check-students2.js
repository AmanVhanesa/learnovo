const mongoose = require('mongoose');
const User = require('./models/User');
const Section = require('./models/Section');
const Class = require('./models/Class');

const uri = "mongodb+srv://evotechnologiesinnovation_db_user:V9ZYlKfuNpdzePqW@cluster0.soajlb4.mongodb.net/learnovo?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(uri)
    .then(async () => {
        try {
            const tenantId = new mongoose.Types.ObjectId("6995a45cf91b84df06840fae"); // We don't know the exact tenantId, maybe query the first one from users
            const admin = await User.findOne({ role: 'admin' });
            const tid = admin.tenantId;

            const reqQuery = { class: '1', section: 'B' };
            const filter = { role: 'student', tenantId: tid };

            if (reqQuery.class) {
                filter.class = reqQuery.class;
            }

            if (reqQuery.section) {
                const sectionQuery = {
                    name: reqQuery.section,
                    tenantId: tid,
                    isActive: true
                };

                if (reqQuery.class) {
                    const classDoc = await Class.findOne({
                        grade: reqQuery.class,
                        tenantId: tid
                    });
                    if (classDoc) {
                        sectionQuery.classId = classDoc._id;
                    }
                }

                const section = await Section.findOne(sectionQuery);
                if (section) {
                    filter.sectionId = section._id;
                } else {
                    filter.section = reqQuery.section;
                }
            }

            console.log("BUILT FILTER:", filter);
            const results = await User.find(filter).select('fullName class section sectionId');
            console.log(`Query returned ${results.length} results:`);
            results.forEach(r => console.log(`- ${String(r.fullName).padEnd(30)} | class: ${r.class} | sec: ${r.section} | secId: ${r.sectionId}`));

        } catch (e) {
            console.error(e);
        } finally {
            mongoose.connection.close();
        }
    })
    .catch(err => console.error(err));
