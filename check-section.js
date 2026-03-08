const mongoose = require('mongoose');
const uri = "mongodb+srv://evotechnologiesinnovation_db_user:V9ZYlKfuNpdzePqW@cluster0.soajlb4.mongodb.net/learnovo?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(uri)
    .then(async () => {
        const Section = require('./models/Section');
        const s = await Section.findById("6995a4b8f91b84df0684100f");
        console.log("Section Name for that ID:", s ? s.name : "Not found!");
        mongoose.connection.close();
    });
