const mongoose = require('mongoose');
require('dotenv').config();

const inspectInvoices = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/learnovo');
        console.log('Connected to MongoDB');

        const FeeInvoice = require('../models/FeeInvoice');
        const User = require('../models/User'); // Ensure User model is registered

        const invoices = await FeeInvoice.find({})
            .populate('studentId', 'name fullName studentId admissionNumber email phone')
            .limit(10);

        console.log('--- Inspecting Invoices ---');
        invoices.forEach(inv => {
            console.log(`Invoice: ${inv.invoiceNumber}`);
            if (inv.studentId) {
                console.log(`  Student ID (Obj): ${inv.studentId._id}`);
                console.log(`  Name: "${inv.studentId.name}"`);
                console.log(`  FullName: "${inv.studentId.fullName}"`);
                console.log(`  StudentID: "${inv.studentId.studentId}"`);
                console.log(`  Admission: "${inv.studentId.admissionNumber}"`);
            } else {
                console.log('  Student: NULL (Populate failed)');
            }
            console.log('---------------------------');
        });

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

inspectInvoices();
