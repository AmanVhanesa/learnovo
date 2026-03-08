const mongoose = require('mongoose');
const uri = "mongodb+srv://evotechnologiesinnovation_db_user:V9ZYlKfuNpdzePqW@cluster0.soajlb4.mongodb.net/learnovo?retryWrites=true&w=majority&appName=Cluster0";
const express = require('express');
const app = express();
const router = require('./routes/students');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mock user middleware for Protect and Authorize
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
            process.exit(1);
        }
        console.log("Section A Output Length (should be 41 or max pagination limit):", res.body.data ? res.body.data.length : res.body.length);
        console.log("Total pagination count:", res.body.pagination ? res.body.pagination.total : 0);
        
        mongoose.connection.close();
    });
}).catch(console.error);
