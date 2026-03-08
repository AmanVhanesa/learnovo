#!/bin/bash

# Function to start backend
start_backend() {
    echo "📦 Starting Backend Server..."
    cd learnovo-backend
    npm install
    # npm run seed  <-- SKIPPED TO PRESERVE DATA
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

# Wait for user to stop
wait
