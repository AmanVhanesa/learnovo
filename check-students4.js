const express = require('express');
const mongoose = require('mongoose');

// Need to mock the middleware!
jest = require('jest-mock');
const authMiddleware = require('./middleware/auth');
authMiddleware.protect = (req, res, next) => {
    req.user = {
        _id: new mongoose.Types.ObjectId("69788171da522fa9b3baffaa"),
        tenantId: new mongoose.Types.ObjectId("69788171da522fa9b3baffa8"),
        role: 'admin'
    };
    next();
};
authMiddleware.authorize = (...roles) => (req, res, next) => next();

const studentsRouter = require('./routes/students');
const app = express();
app.use(express.json());
app.use('/api/students', studentsRouter);

const uri = "mongodb+srv://evotechnologiesinnovation_db_user:V9ZYlKfuNpdzePqW@cluster0.soajlb4.mongodb.net/learnovo?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(uri).then(() => {
    const request = require('supertest');
    console.log('Sending request to /api/students?class=1&section=B&page=1&limit=100');
    request(app)
        .get('/api/students?class=1&section=B&page=1&limit=100')
        .expect(200)
        .end((err, res) => {
            if (err) {
                console.error(err);
            } else {
                console.log(`Results length: ${res.body.data ? res.body.data.length : res.body.length}`);
                (res.body.data || res.body).forEach(s => console.log(s.fullName, s.section, s.sectionId));
            }
            mongoose.connection.close();
        });
});
