require('./models/SubDepartment'); require('./models/Driver'); require('./models/Class');const mongoose = require('mongoose');
const uri = "mongodb+srv://evotechnologiesinnovation_db_user:V9ZYlKfuNpdzePqW@cluster0.soajlb4.mongodb.net/learnovo?retryWrites=true&w=majority&appName=Cluster0";
const express = require('express');
const app = express();
const router = require('./routes/students_test');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mock user middleware
app.use((req, res, next) => {
    req.user = {
        _id: new mongoose.Types.ObjectId(),
        tenantId: new mongoose.Types.ObjectId("69788171da522fa9b3baffa8"),
        role: 'admin'
    };
    next();
});

app.use('/', router);

mongoose.connect(uri).then(() => {
    const request = require('supertest');

    request(app).get('/?class=1&section=A').expect(200).end((err, res) => {
        if (err) {
            console.error("Error from API:", err);
            console.error(res ? res.body : "No body");
            process.exit(1);
        }
        console.log("Section A Output Length:", res.body.data ? res.body.data.length : res.body.length);
        console.log("Total pagination count:", res.body.pagination ? res.body.pagination.total : 0);

        request(app).get('/?class=1&section=B').expect(200).end((err2, res2) => {
            if (err2) throw err2;
            console.log("Section B Output Length:", res2.body.data ? res2.body.data.length : res2.body.length);
            console.log("Section B Total pagination count:", res2.body.pagination ? res2.body.pagination.total : 0);
            mongoose.connection.close();
        });
    });
}).catch(console.error);
