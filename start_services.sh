#!/bin/bash

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if a port is in use
port_in_use() {
    nc -z localhost $1 >/dev/null 2>&1
}

# Check for required commands
for cmd in python3 pip3 npm nc; do
    if ! command_exists $cmd; then
        echo "Error: $cmd is not installed"
        exit 1
    fi
done

# Install Python dependencies
echo "Installing Python dependencies..."
pip3 install -r requirements.txt || {
    echo "Error: Failed to install Python dependencies"
    exit 1
}

# Initialize database
echo "Initializing database..."
python3 src/db/init_db.py || {
    echo "Error: Failed to initialize database"
    exit 1
}

# Start Python backend server
echo "Starting Python backend server..."
python3 src/backend/simulator.py &
PYTHON_PID=$!

# Wait for Python server to start (assuming it uses port 8000)
for i in {1..10}; do
    if port_in_use 8000; then
        break
    fi
    sleep 1
    if [ $i -eq 10 ]; then
        echo "Error: Python server failed to start"
        kill $PYTHON_PID 2>/dev/null
        exit 1
    fi
done

# Install npm dependencies
echo "Installing npm dependencies..."
npm install || {
    echo "Error: Failed to install npm dependencies"
    kill $PYTHON_PID 2>/dev/null
    exit 1
}

# Start frontend development server
echo "Starting frontend development server..."
npm run dev &
NPM_PID=$!

# Wait for frontend server to start
for i in {1..10}; do
    if port_in_use 5173; then
        break
    fi
    sleep 1
    if [ $i -eq 10 ]; then
        echo "Error: Frontend server failed to start"
        kill $PYTHON_PID 2>/dev/null
        kill $NPM_PID 2>/dev/null
        exit 1
    fi
done

echo "All services started successfully!"
echo "Frontend server running at http://localhost:5173"
echo "Python backend running at http://localhost:8000"

# Wait for any key to terminate all processes
read -p "Press any key to stop all services..."

# Cleanup
kill $PYTHON_PID 2>/dev/null
kill $NPM_PID 2>/dev/null

echo "All services stopped"