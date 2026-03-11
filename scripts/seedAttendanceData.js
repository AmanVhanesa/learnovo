const mongoose = require('mongoose')
require('dotenv').config()

const User = require('../models/User')
const Class = require('../models/Class')
const Counter = require('../models/Counter')

/**
 * Seed script to create test data for attendance system
 * Creates:
 * 1. A demo teacher
 * 2. A demo class
 * 3. Sample students with admission numbers
 */
const seedAttendanceData = async () => {
  try {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Seed script cannot run in production!');
    }

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/learnovo', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    })
    console.log('✅ Connected to MongoDB')

    // Find demo tenant
    const Tenant = require('../models/Tenant')
    const demoTenant = await Tenant.findOne({ schoolCode: 'demo' })

    if (!demoTenant) {
      console.error('❌ Demo tenant not found. Please run the demo setup first.')
      process.exit(1)
    }

    console.log('📦 Found demo tenant:', demoTenant.schoolCode)

    // Find or create demo teacher
    let demoTeacher = await User.findOne({
      email: 'sarah.wilson@learnovo.com',
      tenantId: demoTenant._id
    })

    if (!demoTeacher) {
      console.log('👩‍🏫 Creating demo teacher...')
      demoTeacher = await User.create({
        name: 'Sarah Wilson',
        email: 'sarah.wilson@learnovo.com',
        password: 'teacher123',
        role: 'teacher',
        tenantId: demoTenant._id,
        subjects: ['Mathematics', 'Physics'],
        qualifications: 'M.Sc. Mathematics',
        assignedClasses: [],
        phone: '+919876543210'
      })
      console.log('✅ Created demo teacher:', demoTeacher.name)
    } else {
      console.log('✅ Found existing demo teacher:', demoTeacher.name)
    }

    // Create a sample class
    const currentYear = new Date().getFullYear()
    const nextYear = currentYear + 1
    const academicYear = `${currentYear}-${nextYear}`

    let demoClass = await Class.findOne({
      name: 'Class 10A',
      tenantId: demoTenant._id
    })

    if (!demoClass) {
      console.log('📚 Creating demo class...')
      demoClass = await Class.create({
        tenantId: demoTenant._id,
        name: 'Class 10A',
        grade: '10',
        academicYear,
        classTeacher: demoTeacher._id,
        subjects: [],
        isActive: true
      })
      console.log('✅ Created demo class:', demoClass.name)
    } else {
      console.log('✅ Found existing demo class:', demoClass.name)
    }

    // Create sample students with admission numbers
    const sampleStudents = [
      { name: 'John Doe', email: 'john.doe@learnovo.com', class: 'Class 10A' },
      { name: 'Jane Smith', email: 'jane.smith@learnovo.com', class: 'Class 10A' },
      { name: 'Mike Johnson', email: 'mike.johnson@learnovo.com', class: 'Class 10A' },
      { name: 'Sarah Williams', email: 'sarah.williams@learnovo.com', class: 'Class 10A' },
      { name: 'David Brown', email: 'david.brown@learnovo.com', class: 'Class 10A' }
    ]

    console.log('👥 Creating sample students...')
    let createdCount = 0
    let existingCount = 0

    for (const studentData of sampleStudents) {
      // Check if student already exists
      const existingStudent = await User.findOne({
        email: studentData.email,
        tenantId: demoTenant._id
      })

      if (existingStudent) {
        existingCount++
        console.log(`⏭️  Skipping existing student: ${studentData.name}`)
        continue
      }

      // Generate admission number
      const sequence = await Counter.getNextSequence('admission', currentYear.toString(), demoTenant._id)
      const admissionNumber = Counter.formatAdmissionNumber(sequence, currentYear.toString())

      // Create student
      await User.create({
        name: studentData.name,
        email: studentData.email,
        password: 'student123',
        role: 'student',
        tenantId: demoTenant._id,
        admissionNumber,
        class: studentData.class,
        classId: demoClass._id,
        admissionDate: new Date(),
        guardianName: 'Guardian Name',
        guardianPhone: '+919999999999',
        address: 'Sample Address',
        phone: '+919999999999'
      })

      createdCount++
      console.log(`✅ Created student: ${studentData.name} (${admissionNumber})`)
    }

    console.log(`\n📊 Summary:`)
    console.log(`   Teacher: ${demoTeacher.name}`)
    console.log(`   Class: ${demoClass.name}`)
    console.log(`   Students created: ${createdCount}`)
    console.log(`   Students existing: ${existingCount}`)
    console.log(`\n🎉 Seed data created successfully!`)

    process.exit(0)
  } catch (error) {
    console.error('❌ Error seeding data:', error)
    process.exit(1)
  }
}

// Run the seed script
seedAttendanceData()

