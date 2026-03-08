require('dotenv').config({ path: './config.env' });
const mongoose = require('mongoose');

const testConnection = async () => {
    const uri = "mongodb+srv://evotechnologiesinnovation_db_user:Learnovo_2663@cluster0.soajlb4.mongodb.net/learnovo?appName=Cluster0";
    
    console.log('🔍 Testing MongoDB Connection...');
    console.log('URI:', uri.replace(/:[^:@]+@/, ':****@')); // Hide password in output
    
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
        console.log('✅ Connection test complete');
        process.exit(0);
        
    } catch (error) {
        console.error('❌ FAILED: Could not connect to MongoDB');
        console.error('Error:', error.message);
        
        if (error.message.includes('authentication')) {
            console.error('\n⚠️  Authentication failed - password is incorrect');
        } else if (error.message.includes('network')) {
            console.error('\n⚠️  Network error - check IP whitelist in MongoDB Atlas');
        }
        
        process.exit(1);
    }
};

testConnection();
