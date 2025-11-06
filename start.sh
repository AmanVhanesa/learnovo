#!/bin/bash

echo "🚀 Starting Learnovo Student Management System..."

# Check if MongoDB is running
if ! pgrep -x "mongod" > /dev/null; then
    echo "⚠️  MongoDB is not running. Please start MongoDB first:"
    echo "   brew services start mongodb-community"
    echo "   or"
    echo "   sudo systemctl start mongod"
    echo ""
    read -p "Press Enter to continue anyway..."
fi

# Function to start backend
start_backend() {
    echo "📦 Starting Backend Server..."
    cd learnovo-backend
    npm install
    npm run seed
    npm run dev &
    BACKEND_PID=$!
    cd ..
}

# Function to start frontend
start_frontend() {
    echo "🎨 Starting Frontend Server..."
    cd learnovo-frontend
    npm install
    npm run dev &
    FRONTEND_PID=$!
    cd ..
}

# Start both servers
start_backend
sleep 3
start_frontend

echo ""
echo "✅ Learnovo is starting up!"
echo ""
echo "🌐 Frontend: http://localhost:3000"
echo "🔧 Backend API: http://localhost:5001"
echo ""
echo "🔑 Demo Credentials:"
echo "   Admin: admin@learnovo.com / admin123"
echo "   Teacher: sarah.wilson@learnovo.com / teacher123"
echo "   Student: john.doe@learnovo.com / student123"
echo "   Parent: parent@learnovo.com / parent123"
echo ""
echo "Press Ctrl+C to stop both servers"

# Wait for user to stop
wait
