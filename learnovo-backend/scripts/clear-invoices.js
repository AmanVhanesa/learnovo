const mongoose = require('mongoose');
require('dotenv').config();

const clearInvoices = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/learnovo');
        console.log('Connected to MongoDB');

        const FeeInvoice = require('../models/FeeInvoice');

        const result = await FeeInvoice.deleteMany({});
        console.log(`Successfully deleted ${result.deletedCount} invoices.`);

        // Optional: Reset student balances if they exist
        // const StudentBalance = require('../models/StudentBalance');
        // await StudentBalance.deleteMany({});
        // console.log('Cleared student balances');

        process.exit(0);
    } catch (error) {
        console.error('Error clearing invoices:', error);
        process.exit(1);
    }
};

clearInvoices();
