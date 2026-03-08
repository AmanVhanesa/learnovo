require('dotenv').config({ path: './config.env' });
const mongoose = require('mongoose');

const testConnection = async () => {
    // Use the exact connection string with NEW password
    const uri = "mongodb+srv://evotechnologiesinnovation_db_user:V9ZYlKfuNpdzePqW@cluster0.soajlb4.mongodb.net/learnovo?retryWrites=true&w=majority&appName=Cluster0";

    console.log('🔍 Testing MongoDB Connection...');
    console.log('URI:', uri.replace(/:([^:@]+)@/, ':****@')); // Hide password in output

    try {
        await mongoose.connect(uri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 10000
        });

        console.log('✅ SUCCESS: MongoDB connection established!');
        console.log('Database:', mongoose.connection.db.databaseName);

        // Test a simple query
        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log(`Found ${collections.length} collections`);

        await mongoose.disconnect();
        console.log('✅ Connection test complete - credentials are CORRECT');
        process.exit(0);

    } catch (error) {
        console.error('❌ FAILED: Could not connect to MongoDB');
        console.error('Error:', error.message);

        if (error.message.includes('authentication') || error.message.includes('auth')) {
            console.error('\n⚠️  Authentication failed - PASSWORD IS INCORRECT');
            console.error('Please verify the password in MongoDB Atlas');
        } else if (error.message.includes('network') || error.message.includes('ENOTFOUND')) {
            console.error('\n⚠️  Network error - check IP whitelist in MongoDB Atlas');
            console.error('Make sure 0.0.0.0/0 is whitelisted for Render to connect');
        }

        process.exit(1);
    }
};

testConnection();
