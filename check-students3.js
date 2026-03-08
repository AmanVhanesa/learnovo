const { executeHttp } = require('./models/User'); // just a dummy, let's make an actual http request
const http = require('http');
const mongoose = require('mongoose');
const User = require('./models/User');

const uri = "mongodb+srv://evotechnologiesinnovation_db_user:V9ZYlKfuNpdzePqW@cluster0.soajlb4.mongodb.net/learnovo?retryWrites=true&w=majority&appName=Cluster0";

// Since we have DB access and we know the exact tenant, admin user etc.
// We can just construct a mock Request and Response object and pass it to the route handler !
// Even easier: we can just copy the route handler logic and see what it does.
// But we ALREADY did that in check-students2.js, and it worked flawlessly (returned 3 students).

// Let's do a direct test of the route using express.
const express = require('express');
const app = express();

const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const tenantId = new mongoose.Types.ObjectId("69788171da522fa9b3baffa8");
        const Section = require('./models/Section');
        const Class = require('./models/Class');

        const filter = { role: 'student', tenantId };

        if (req.query.class) {
            filter.class = req.query.class;
        }

        if (req.query.section) {
            try {
                const sectionQuery = {
                    name: req.query.section,
                    tenantId,
                    isActive: true
                };

                if (req.query.class) {
                    const classDoc = await Class.findOne({
                        grade: req.query.class,
                        tenantId
                    });
                    if (classDoc) {
                        sectionQuery.classId = classDoc._id;
                    }
                }

                const section = await Section.findOne(sectionQuery);
                if (section) {
                    filter.sectionId = section._id;
                } else {
                    filter.section = req.query.section;
                }
            } catch (err) {
                filter.section = req.query.section;
            }
        }

        console.log("FINAL FILTER:", JSON.stringify(filter));
        const students = await User.find(filter).select('fullName class section sectionId');
        res.json(students);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.use(router);

mongoose.connect(uri).then(() => {
    const request = require('supertest');
    request(app)
        .get('/?class=1&section=B')
        .expect(200)
        .end((err, res) => {
            if (err) throw err;
            console.log(`Results length: ${res.body.length}`);
            res.body.forEach(s => console.log(s.fullName, s.section, s.sectionId));
            mongoose.connection.close();
        });
});
