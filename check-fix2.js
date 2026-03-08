const mongoose = require('mongoose');
const uri = "mongodb+srv://evotechnologiesinnovation_db_user:V9ZYlKfuNpdzePqW@cluster0.soajlb4.mongodb.net/learnovo?retryWrites=true&w=majority&appName=Cluster0";
const express = require('express');
const app = express();
const router = require('./routes/students');

// Mock user middleware
app.use((req, res, next) => {
    req.user = { tenantId: new mongoose.Types.ObjectId("69788171da522fa9b3baffa8"), role: 'admin' };
    next();
});
app.use('/', router);

mongoose.connect(uri).then(() => {
    const request = require('supertest');

    // We check how many class 1, section A students we get:
    request(app).get('/?class=1&section=A&limit=100').expect(200).end(async (err, res) => {
        if (err) throw err;
        console.log("Section A Count via API:", res.body.data ? res.body.data.length : res.body.length);
        console.log("Total pagination count:", res.body.pagination ? res.body.pagination.total : "No pagination");

        // Let's directly query the raw DB using the same fields
        const User = require('./models/User');
        const tid = new mongoose.Types.ObjectId("69788171da522fa9b3baffa8");
        const rawClass1A = await User.find({ role: 'student', tenantId: tid, class: '1', section: 'A' }).select('fullName class section sectionId classId isActive');
        console.log("Raw DB Class 1 Section A length:", rawClass1A.length);

        if (rawClass1A.length > 0) {
            console.log("\nSample missing student from raw DB:");
            const missing = rawClass1A.filter(r => !res.body.data.find(apiStudent => apiStudent._id === r._id.toString()));
            if (missing.length > 0) {
                console.log(missing[0]);
            } else {
                console.log("None missing! (This would mean pagination or limit issue)");
            }
        }

        mongoose.connection.close();
    });
}).catch(err => {
    console.error(err);
});
