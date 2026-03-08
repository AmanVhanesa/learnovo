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

    request(app).get('/?class=1&section=A').expect(200).end((err, res) => {
        if (err) throw err;
        console.log("Section A Count:", res.body.data ? res.body.data.length : res.body.length);

        request(app).get('/?class=1&section=B').expect(200).end((err2, res2) => {
            if (err2) throw err2;
            console.log("Section B Count:", res2.body.data ? res2.body.data.length : res2.body.length);
            mongoose.connection.close();
        });
    });
}).catch(err => {
    console.error(err);
});
