const mongoose = require('mongoose');
const User = require('../models/User');
const Fee = require('../models/Fee');
const Admission = require('../models/Admission');
const Settings = require('../models/Settings');
require('dotenv').config({ path: './config.env' });

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/learnovo', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Seed data
const seedData = async() => {
  try {
    console.log('🌱 Starting to seed data...');

    // Clear existing data
    await User.deleteMany({});
    await Fee.deleteMany({});
    await Admission.deleteMany({});
    await Settings.deleteMany({});

    // Create default settings
    const settings = await Settings.create({
      institution: {
        name: 'Learnovo International School',
        address: {
          street: '123 Education Street',
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400001',
          country: 'India'
        },
        contact: {
          phone: '+912212345678',
          email: 'info@learnovo.com',
          website: 'www.learnovo.com'
        },
        establishedYear: 2010
      },
      currency: {
        default: 'INR',
        symbol: '₹',
        position: 'before',
        decimalPlaces: 2,
        thousandSeparator: ',',
        decimalSeparator: '.'
      },
      academic: {
        currentYear: '2024-2025',
        terms: [
          {
            name: 'First Term',
            startDate: new Date('2024-06-01'),
            endDate: new Date('2024-09-30'),
            isActive: true
          },
          {
            name: 'Second Term',
            startDate: new Date('2024-10-01'),
            endDate: new Date('2024-12-31'),
            isActive: false
          },
          {
            name: 'Third Term',
            startDate: new Date('2025-01-01'),
            endDate: new Date('2025-03-31'),
            isActive: false
          }
        ],
        classes: [
          { name: '1st Grade', level: 1, maxStudents: 30, isActive: true },
          { name: '2nd Grade', level: 2, maxStudents: 30, isActive: true },
          { name: '3rd Grade', level: 3, maxStudents: 30, isActive: true },
          { name: '4th Grade', level: 4, maxStudents: 30, isActive: true },
          { name: '5th Grade', level: 5, maxStudents: 30, isActive: true },
          { name: '6th Grade', level: 6, maxStudents: 35, isActive: true },
          { name: '7th Grade', level: 7, maxStudents: 35, isActive: true },
          { name: '8th Grade', level: 8, maxStudents: 35, isActive: true },
          { name: '9th Grade', level: 9, maxStudents: 40, isActive: true },
          { name: '10th Grade', level: 10, maxStudents: 40, isActive: true },
          { name: '11th Grade', level: 11, maxStudents: 40, isActive: true },
          { name: '12th Grade', level: 12, maxStudents: 40, isActive: true }
        ],
        subjects: [
          { name: 'Mathematics', code: 'MATH', isActive: true },
          { name: 'Science', code: 'SCI', isActive: true },
          { name: 'English', code: 'ENG', isActive: true },
          { name: 'Hindi', code: 'HIN', isActive: true },
          { name: 'Social Studies', code: 'SST', isActive: true },
          { name: 'Computer Science', code: 'CS', isActive: true },
          { name: 'Physical Education', code: 'PE', isActive: true },
          { name: 'Art', code: 'ART', isActive: true }
        ]
      },
      fees: {
        lateFeePercentage: 5,
        lateFeeGracePeriod: 7,
        autoGenerateFees: false,
        feeStructure: [
          { class: '1st Grade', feeType: 'tuition', amount: 5000, term: 'annual', isActive: true },
          { class: '2nd Grade', feeType: 'tuition', amount: 5500, term: 'annual', isActive: true },
          { class: '3rd Grade', feeType: 'tuition', amount: 6000, term: 'annual', isActive: true },
          { class: '4th Grade', feeType: 'tuition', amount: 6500, term: 'annual', isActive: true },
          { class: '5th Grade', feeType: 'tuition', amount: 7000, term: 'annual', isActive: true },
          { class: '6th Grade', feeType: 'tuition', amount: 8000, term: 'annual', isActive: true },
          { class: '7th Grade', feeType: 'tuition', amount: 8500, term: 'annual', isActive: true },
          { class: '8th Grade', feeType: 'tuition', amount: 9000, term: 'annual', isActive: true },
          { class: '9th Grade', feeType: 'tuition', amount: 10000, term: 'annual', isActive: true },
          { class: '10th Grade', feeType: 'tuition', amount: 11000, term: 'annual', isActive: true },
          { class: '11th Grade', feeType: 'tuition', amount: 12000, term: 'annual', isActive: true },
          { class: '12th Grade', feeType: 'tuition', amount: 13000, term: 'annual', isActive: true }
        ]
      },
      notifications: {
        email: {
          enabled: true,
          reminderDays: [7, 3, 1],
          overdueReminderDays: [1, 3, 7],
          templates: {
            feeReminder: 'Your fee payment is due on {dueDate}',
            feeOverdue: 'Your fee payment is overdue. Please pay immediately.',
            admissionApproved: 'Congratulations! Your admission has been approved.',
            admissionRejected: 'We regret to inform you that your admission has been rejected.'
          }
        },
        sms: {
          enabled: false,
          apiKey: '',
          apiSecret: '',
          senderId: ''
        },
        dashboard: {
          enabled: true,
          showOverdueFees: true,
          showUpcomingFees: true
        }
      },
      system: {
        maintenanceMode: false,
        maintenanceMessage: '',
        maxFileSize: 5242880,
        allowedFileTypes: ['jpg', 'jpeg', 'png', 'pdf', 'doc', 'docx'],
        sessionTimeout: 3600,
        passwordPolicy: {
          minLength: 8,
          requireUppercase: true,
          requireLowercase: true,
          requireNumbers: true,
          requireSpecialChars: false
        }
      },
      theme: {
        primaryColor: '#3EC4B1',
        secondaryColor: '#2355A6',
        logo: null,
        favicon: null
      }
    });

    console.log('✅ Settings created');

    // Create admin user
    const admin = await User.create({
      name: 'Admin User',
      email: 'admin@learnovo.com',
      password: 'admin123',
      role: 'admin',
      phone: '+919876543210'
    });

    console.log('✅ Admin user created');

    // Create teachers
    const teachers = await User.create([
      {
        name: 'Dr. Sarah Wilson',
        email: 'sarah.wilson@learnovo.com',
        password: 'teacher123',
        role: 'teacher',
        phone: '+919876543211',
        subjects: ['Mathematics', 'Computer Science'],
        qualifications: 'PhD in Mathematics',
        assignedClasses: ['9th Grade', '10th Grade', '11th Grade', '12th Grade']
      },
      {
        name: 'Mr. David Brown',
        email: 'david.brown@learnovo.com',
        password: 'teacher123',
        role: 'teacher',
        phone: '+919876543212',
        subjects: ['Science', 'Physics'],
        qualifications: 'MSc in Physics',
        assignedClasses: ['6th Grade', '7th Grade', '8th Grade', '9th Grade']
      },
      {
        name: 'Ms. Priya Sharma',
        email: 'priya.sharma@learnovo.com',
        password: 'teacher123',
        role: 'teacher',
        phone: '+919876543213',
        subjects: ['English', 'Hindi'],
        qualifications: 'MA in English Literature',
        assignedClasses: ['1st Grade', '2nd Grade', '3rd Grade', '4th Grade']
      }
    ]);

    console.log('✅ Teachers created');

    // Create students
    const students = await User.create([
      {
        name: 'John Doe',
        email: 'john.doe@learnovo.com',
        password: 'student123',
        role: 'student',
        phone: '+919876543220',
        class: '10th Grade',
        rollNumber: 'STU001',
        admissionDate: new Date('2023-06-15'),
        guardianName: 'Jane Doe',
        guardianPhone: '+91-9876543221',
        address: '123 Main Street, Mumbai, Maharashtra 400001'
      },
      {
        name: 'Jane Smith',
        email: 'jane.smith@learnovo.com',
        password: 'student123',
        role: 'student',
        phone: '+919876543222',
        class: '10th Grade',
        rollNumber: 'STU002',
        admissionDate: new Date('2023-06-20'),
        guardianName: 'Bob Smith',
        guardianPhone: '+91-9876543223',
        address: '456 Oak Avenue, Mumbai, Maharashtra 400002'
      },
      {
        name: 'Mike Johnson',
        email: 'mike.johnson@learnovo.com',
        password: 'student123',
        role: 'student',
        phone: '+919876543224',
        class: '9th Grade',
        rollNumber: 'STU003',
        admissionDate: new Date('2023-07-01'),
        guardianName: 'Sarah Johnson',
        guardianPhone: '+91-9876543225',
        address: '789 Pine Street, Mumbai, Maharashtra 400003'
      },
      {
        name: 'Emily Davis',
        email: 'emily.davis@learnovo.com',
        password: 'student123',
        role: 'student',
        phone: '+919876543226',
        class: '8th Grade',
        rollNumber: 'STU004',
        admissionDate: new Date('2023-07-10'),
        guardianName: 'Robert Davis',
        guardianPhone: '+91-9876543227',
        address: '321 Elm Street, Mumbai, Maharashtra 400004'
      },
      {
        name: 'Alex Wilson',
        email: 'alex.wilson@learnovo.com',
        password: 'student123',
        role: 'student',
        phone: '+919876543228',
        class: '7th Grade',
        rollNumber: 'STU005',
        admissionDate: new Date('2023-07-15'),
        guardianName: 'Lisa Wilson',
        guardianPhone: '+91-9876543229',
        address: '654 Maple Avenue, Mumbai, Maharashtra 400005'
      }
    ]);

    console.log('✅ Students created');

    // Create parent user
    const parent = await User.create({
      name: 'Parent User',
      email: 'parent@learnovo.com',
      password: 'parent123',
      role: 'parent',
      phone: '+919876543230',
      children: [students[0]._id, students[1]._id] // John and Jane are children
    });

    console.log('✅ Parent user created');

    // Create fees
    const fees = await Fee.create([
      {
        student: students[0]._id,
        amount: 11000,
        currency: 'INR',
        description: 'Annual Tuition Fee - 10th Grade',
        dueDate: new Date('2024-01-15'),
        status: 'paid',
        paidDate: new Date('2024-01-10'),
        paymentMethod: 'online',
        feeType: 'tuition',
        academicYear: '2024-2025',
        term: 'annual'
      },
      {
        student: students[1]._id,
        amount: 11000,
        currency: 'INR',
        description: 'Annual Tuition Fee - 10th Grade',
        dueDate: new Date('2024-01-15'),
        status: 'pending',
        feeType: 'tuition',
        academicYear: '2024-2025',
        term: 'annual'
      },
      {
        student: students[2]._id,
        amount: 10000,
        currency: 'INR',
        description: 'Annual Tuition Fee - 9th Grade',
        dueDate: new Date('2024-01-15'),
        status: 'overdue',
        feeType: 'tuition',
        academicYear: '2024-2025',
        term: 'annual'
      },
      {
        student: students[3]._id,
        amount: 9000,
        currency: 'INR',
        description: 'Annual Tuition Fee - 8th Grade',
        dueDate: new Date('2024-01-15'),
        status: 'paid',
        paidDate: new Date('2024-01-12'),
        paymentMethod: 'bank_transfer',
        feeType: 'tuition',
        academicYear: '2024-2025',
        term: 'annual'
      },
      {
        student: students[4]._id,
        amount: 8500,
        currency: 'INR',
        description: 'Annual Tuition Fee - 7th Grade',
        dueDate: new Date('2024-01-15'),
        status: 'pending',
        feeType: 'tuition',
        academicYear: '2024-2025',
        term: 'annual'
      }
    ]);

    console.log('✅ Fees created');

    // Create admission applications
    const admissions = await Admission.create([
      {
        applicationNumber: 'APP-2024-001',
        student: students[0]._id,
        personalInfo: {
          firstName: 'Rahul',
          lastName: 'Kumar',
          dateOfBirth: new Date('2010-05-15'),
          gender: 'male',
          bloodGroup: 'A+',
          nationality: 'Indian'
        },
        contactInfo: {
          email: 'rahul.kumar@example.com',
          phone: '+919876543300',
          address: {
            street: '100 New Street',
            city: 'Mumbai',
            state: 'Maharashtra',
            pincode: '400010',
            country: 'India'
          }
        },
        guardianInfo: {
          fatherName: 'Rajesh Kumar',
          fatherOccupation: 'Engineer',
          fatherPhone: '+919876543301',
          motherName: 'Sunita Kumar',
          motherOccupation: 'Teacher',
          motherPhone: '+919876543302',
          guardianRelation: 'father'
        },
        academicInfo: {
          classApplied: '6th Grade',
          previousSchool: 'ABC Primary School',
          previousClass: '5th Grade',
          previousMarks: 85,
          previousBoard: 'CBSE',
          subjects: ['Mathematics', 'Science', 'English', 'Hindi'],
          extraCurricular: ['Cricket', 'Music']
        },
        documents: {
          photo: 'uploads/rahul_photo.jpg',
          birthCertificate: 'uploads/rahul_birth_cert.pdf',
          previousMarksheet: 'uploads/rahul_marksheet.pdf'
        },
        status: 'pending'
      },
      {
        applicationNumber: 'APP-2024-002',
        student: students[1]._id,
        personalInfo: {
          firstName: 'Priya',
          lastName: 'Patel',
          dateOfBirth: new Date('2009-08-22'),
          gender: 'female',
          bloodGroup: 'B+',
          nationality: 'Indian'
        },
        contactInfo: {
          email: 'priya.patel@example.com',
          phone: '+919876543303',
          address: {
            street: '200 Old Street',
            city: 'Mumbai',
            state: 'Maharashtra',
            pincode: '400011',
            country: 'India'
          }
        },
        guardianInfo: {
          fatherName: 'Amit Patel',
          fatherOccupation: 'Doctor',
          fatherPhone: '+919876543304',
          motherName: 'Kavita Patel',
          motherOccupation: 'Nurse',
          motherPhone: '+919876543305',
          guardianRelation: 'father'
        },
        academicInfo: {
          classApplied: '7th Grade',
          previousSchool: 'XYZ High School',
          previousClass: '6th Grade',
          previousMarks: 92,
          previousBoard: 'ICSE',
          subjects: ['Mathematics', 'Science', 'English', 'Hindi', 'Social Studies'],
          extraCurricular: ['Dancing', 'Painting']
        },
        documents: {
          photo: 'uploads/priya_photo.jpg',
          birthCertificate: 'uploads/priya_birth_cert.pdf',
          previousMarksheet: 'uploads/priya_marksheet.pdf'
        },
        status: 'approved'
      }
    ]);

    console.log('✅ Admission applications created');

    console.log('🎉 Data seeding completed successfully!');
    console.log('\n📋 Login Credentials:');
    console.log('Admin: admin@learnovo.com / admin123');
    console.log('Teacher: sarah.wilson@learnovo.com / teacher123');
    console.log('Student: john.doe@learnovo.com / student123');
    console.log('Parent: parent@learnovo.com / parent123');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding data:', error);
    process.exit(1);
  }
};

// Run seed data
seedData();
