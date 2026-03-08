const mongoose = require('mongoose');
const uri = "mongodb+srv://evotechnologiesinnovation_db_user:V9ZYlKfuNpdzePqW@cluster0.soajlb4.mongodb.net/learnovo?retryWrites=true&w=majority&appName=Cluster0";
const express = require('express');
const app = express();
const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const tenantId = new mongoose.Types.ObjectId("69788171da522fa9b3baffa8");
        const Section = require('./models/Section');
        const Class = require('./models/Class');
        const User = require('./models/User');

        const filter = { role: 'student', tenantId };
        if (req.query.class) filter.class = req.query.class;
        if (req.query.section) {
            try {
                const sectionQuery = { name: req.query.section, tenantId, isActive: true };
                if (req.query.class) {
                    const classDoc = await Class.findOne({ grade: req.query.class, tenantId });
                    if (classDoc) sectionQuery.classId = classDoc._id;
                }
                const section = await Section.findOne(sectionQuery);
                if (section) {
                    filter.sectionId = section._id;
                } else {
                    filter.section = req.query.section;
                }
            } catch (err) { filter.section = req.query.section; }
        }
        const students = await User.find(filter).select('fullName class section sectionId');
        res.json(students);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.use(router);

mongoose.connect(uri).then(() => {
    const request = require('supertest');
    console.log('\n--- Testing Section A ---');
    request(app).get('/?class=1&section=A').expect(200).end((err, res) => {
        if (err) throw err;
        res.body.forEach(s => console.log(s.fullName, "|", s.section, "|", s.sectionId));
        mongoose.connection.close();
    });
});
