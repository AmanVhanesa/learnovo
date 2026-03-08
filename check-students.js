const mongoose = require('mongoose');
const User = require('./models/User');
const Section = require('./models/Section');
const Class = require('./models/Class');

const uri = "mongodb+srv://evotechnologiesinnovation_db_user:V9ZYlKfuNpdzePqW@cluster0.soajlb4.mongodb.net/learnovo?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(uri)
  .then(async () => {
    // get students for class 1
    const students = await User.find({ role: 'student', class: '1' }).select('fullName class section sectionId');
    console.log('\nStudents in class 1:');
    students.forEach(s => {
      console.log(`- ${String(s.fullName).padEnd(30)} | class: ${s.class} | section: ${s.section} | sectionId: ${s.sectionId}`);
    });

    console.log('\nSections named B:');
    const sections = await Section.find({ name: 'B' }).populate('classId', 'grade');
    sections.forEach(s => {
      console.log(`- ${s._id} | classGrade: ${s.classId?.grade} | name: ${s.name}`);
    });

    console.log('\nClasses named 1:');
    const classes = await Class.find({ $or: [{ grade: '1' }, { name: '1' }] });
    classes.forEach(c => {
      console.log(`- ${c._id} | grade: ${c.grade} | name: ${c.name}`);
    });

    mongoose.connection.close();
  })
  .catch(err => console.error(err));
