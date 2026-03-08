const mongoose = require('mongoose');
const uri = "mongodb+srv://evotechnologiesinnovation_db_user:V9ZYlKfuNpdzePqW@cluster0.soajlb4.mongodb.net/learnovo?retryWrites=true&w=majority&appName=Cluster0";
mongoose.connect(uri).then(async () => {
    const User = require('./models/User');
    const tid = new mongoose.Types.ObjectId("69788171da522fa9b3baffa8");
    
    // exact logic of /api/students/filters
    const sections = await User.find({ role: 'student', tenantId: tid }).distinct('section');
    console.log("Sections returned to UI dropdown:", sections);
    mongoose.connection.close();
});
