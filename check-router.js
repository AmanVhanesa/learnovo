const mongoose = require('mongoose');
const User = require('./models/User');

const uri = "mongodb+srv://evotechnologiesinnovation_db_user:V9ZYlKfuNpdzePqW@cluster0.soajlb4.mongodb.net/learnovo?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(uri)
  .then(async () => {
    const tid = new mongoose.Types.ObjectId("69788171da522fa9b3baffa8");
    const filter = { role: 'student', tenantId: tid };
    
    // mimic router logic for class=1, section=A
    filter.class = '1';
    const reqQuerySection = 'A';
    
    const Section = require('./models/Section');
    const sectionNameRegex = new RegExp(`^${reqQuerySection.trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i');
    const sectionQuery = { name: sectionNameRegex, tenantId: tid };
    
    const Class = require('./models/Class');
    const classDoc = await Class.findOne({
      $or: [
        { grade: new RegExp(`^1$`, 'i') },
        { name: new RegExp(`^1$`, 'i') }
      ],
      tenantId: tid
    });
    if (classDoc) sectionQuery.classId = classDoc._id;
    
    const sections = await Section.find(sectionQuery);
    const sectionIds = sections.map(s => s._id);
    
    if (!filter.$and) filter.$and = [];
    if (sectionIds.length > 0) {
      filter.$and.push({ $or: [{ sectionId: { $in: sectionIds } }, { section: sectionNameRegex }] });
    } else {
      filter.$and.push({ section: sectionNameRegex });
    }
    
    console.log("Filter Object:", JSON.stringify(filter, null, 2));

    const total = await User.countDocuments(filter);
    console.log("Total Count:", total);
    
    const students = await User.find(filter)
      .select('fullName class section sectionId')
      .sort({ createdAt: -1 })
      .skip(0)
      .limit(20);
      
    console.log("Returned subset length:", students.length);
    if(students.length > 0) {
        console.log("First returned:", students[0]);
    }
    
    mongoose.connection.close();
  });
