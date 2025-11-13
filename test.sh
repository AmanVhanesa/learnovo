#!/bin/bash

# Learnovo Backend Testing Script
# This script provides comprehensive testing commands for QA teams

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_BASE_URL="http://localhost:${PORT:-5000}"
TEST_EMAIL="test@example.com"
TEST_SCHOOL_CODE="test001"
TEST_SUBDOMAIN="test-school"

echo -e "${BLUE}🧪 Learnovo Backend Testing Script${NC}"
echo "=================================="

# Function to print status
print_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ $2${NC}"
    else
        echo -e "${RED}❌ $2${NC}"
        exit 1
    fi
}

# Function to make API request
make_request() {
    local method=$1
    local endpoint=$2
    local data=$3
    local expected_status=$4
    
    if [ -n "$data" ]; then
        response=$(curl -s -w "\n%{http_code}" -X $method \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$API_BASE_URL$endpoint")
    else
        response=$(curl -s -w "\n%{http_code}" -X $method \
            "$API_BASE_URL$endpoint")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    if [ "$http_code" -eq "$expected_status" ]; then
        echo -e "${GREEN}✅ $method $endpoint - Status: $http_code${NC}"
        echo "$body" | jq . 2>/dev/null || echo "$body"
        return 0
    else
        echo -e "${RED}❌ $method $endpoint - Expected: $expected_status, Got: $http_code${NC}"
        echo "$body" | jq . 2>/dev/null || echo "$body"
        return 1
    fi
}

# Check if required tools are installed
check_dependencies() {
    echo -e "${YELLOW}🔍 Checking dependencies...${NC}"
    
    command -v node >/dev/null 2>&1 || { echo -e "${RED}❌ Node.js is required${NC}"; exit 1; }
    command -v npm >/dev/null 2>&1 || { echo -e "${RED}❌ npm is required${NC}"; exit 1; }
    command -v curl >/dev/null 2>&1 || { echo -e "${RED}❌ curl is required${NC}"; exit 1; }
    command -v jq >/dev/null 2>&1 || { echo -e "${RED}❌ jq is required${NC}"; exit 1; }
    
    print_status 0 "All dependencies available"
}

# Install dependencies
install_dependencies() {
    echo -e "${YELLOW}📦 Installing dependencies...${NC}"
    npm ci
    print_status $? "Dependencies installed"
}

# Run database migrations
run_migrations() {
    echo -e "${YELLOW}🗄️ Running database migrations...${NC}"
    npm run migrate
    print_status $? "Database migrations completed"
}

# Start the server in background
start_server() {
    echo -e "${YELLOW}🚀 Starting server...${NC}"
    npm start &
    SERVER_PID=$!
    
    # Wait for server to start
    sleep 5
    
    # Check if server is running
    if curl -s "$API_BASE_URL/health" > /dev/null; then
        print_status 0 "Server started successfully (PID: $SERVER_PID)"
    else
        print_status 1 "Server failed to start"
    fi
}

# Stop the server
stop_server() {
    if [ ! -z "$SERVER_PID" ]; then
        echo -e "${YELLOW}🛑 Stopping server...${NC}"
        kill $SERVER_PID
        print_status $? "Server stopped"
    fi
}

# Test health endpoint
test_health_endpoint() {
    echo -e "${YELLOW}🏥 Testing health endpoint...${NC}"
    make_request "GET" "/health" "" 200
    print_status $? "Health endpoint test passed"
}

# Test root endpoint
test_root_endpoint() {
    echo -e "${YELLOW}🏠 Testing root endpoint...${NC}"
    make_request "GET" "/" "" 200
    print_status $? "Root endpoint test passed"
}

# Test tenant registration
test_tenant_registration() {
    echo -e "${YELLOW}🏫 Testing tenant registration...${NC}"
    
    local registration_data='{
        "schoolName": "Test School",
        "email": "'$TEST_EMAIL'",
        "password": "password123",
        "schoolCode": "'$TEST_SCHOOL_CODE'",
        "subdomain": "'$TEST_SUBDOMAIN'",
        "phone": "+1234567890",
        "address": {
            "street": "123 Test St",
            "city": "Test City",
            "state": "Test State",
            "country": "Test Country",
            "zipCode": "12345"
        }
    }'
    
    make_request "POST" "/api/tenants/register" "$registration_data" 201
    print_status $? "Tenant registration test passed"
}

# Test duplicate registration
test_duplicate_registration() {
    echo -e "${YELLOW}🔄 Testing duplicate registration...${NC}"
    
    local duplicate_data='{
        "schoolName": "Another School",
        "email": "'$TEST_EMAIL'",
        "password": "password123",
        "schoolCode": "another001",
        "subdomain": "another-school"
    }'
    
    make_request "POST" "/api/tenants/register" "$duplicate_data" 409
    print_status $? "Duplicate registration test passed"
}

# Test validation errors
test_validation_errors() {
    echo -e "${YELLOW}⚠️ Testing validation errors...${NC}"
    
    local invalid_data='{
        "schoolName": "",
        "email": "invalid-email",
        "password": "123",
        "schoolCode": "ab",
        "subdomain": "ab"
    }'
    
    make_request "POST" "/api/tenants/register" "$invalid_data" 400
    print_status $? "Validation errors test passed"
}

# Test availability check
test_availability_check() {
    echo -e "${YELLOW}🔍 Testing availability check...${NC}"
    
    make_request "GET" "/api/tenants/check-availability?schoolCode=$TEST_SCHOOL_CODE&subdomain=$TEST_SUBDOMAIN&email=$TEST_EMAIL" "" 200
    print_status $? "Availability check test passed"
}

# Test CSV import template
test_csv_template() {
    echo -e "${YELLOW}📋 Testing CSV import template...${NC}"
    
    # First, we need to get a valid token for authenticated requests
    # This is a simplified test - in real scenario, you'd need to login first
    echo -e "${YELLOW}Note: CSV import tests require authentication${NC}"
    print_status 0 "CSV template test skipped (requires auth)"
}

# Run unit tests
run_unit_tests() {
    echo -e "${YELLOW}🧪 Running unit tests...${NC}"
    npm run test:unit
    print_status $? "Unit tests passed"
}

# Run integration tests
run_integration_tests() {
    echo -e "${YELLOW}🔗 Running integration tests...${NC}"
    npm run test:integration
    print_status $? "Integration tests passed"
}

# Run all tests
run_all_tests() {
    echo -e "${YELLOW}🎯 Running all tests...${NC}"
    npm run test:ci
    print_status $? "All tests passed"
}

# Performance test
performance_test() {
    echo -e "${YELLOW}⚡ Running performance test...${NC}"
    
    # Simple load test using curl
    local start_time=$(date +%s)
    
    for i in {1..10}; do
        curl -s "$API_BASE_URL/health" > /dev/null &
    done
    
    wait
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    echo -e "${GREEN}✅ Performance test completed in ${duration}s${NC}"
}

# Security test
security_test() {
    echo -e "${YELLOW}🔒 Running security tests...${NC}"
    
    # Test SQL injection attempt
    make_request "GET" "/api/tenants/check-availability?schoolCode='; DROP TABLE users; --" "" 200
    
    # Test XSS attempt
    make_request "POST" "/api/tenants/register" '{"schoolName": "<script>alert(\"xss\")</script>"}' 400
    
    print_status $? "Security tests passed"
}

# Main test execution
main() {
    case "${1:-all}" in
        "deps")
            check_dependencies
            ;;
        "install")
            check_dependencies
            install_dependencies
            ;;
        "migrate")
            run_migrations
            ;;
        "start")
            start_server
            ;;
        "stop")
            stop_server
            ;;
        "health")
            test_health_endpoint
            ;;
        "api")
            test_root_endpoint
            test_health_endpoint
            test_tenant_registration
            test_duplicate_registration
            test_validation_errors
            test_availability_check
            test_csv_template
            ;;
        "unit")
            run_unit_tests
            ;;
        "integration")
            run_integration_tests
            ;;
        "test")
            run_all_tests
            ;;
        "performance")
            performance_test
            ;;
        "security")
            security_test
            ;;
        "smoke")
            echo -e "${YELLOW}💨 Running smoke tests...${NC}"
            check_dependencies
            start_server
            test_health_endpoint
            test_root_endpoint
            stop_server
            print_status $? "Smoke tests completed"
            ;;
        "full")
            echo -e "${YELLOW}🎯 Running full test suite...${NC}"
            check_dependencies
            install_dependencies
            run_migrations
            start_server
            test_health_endpoint
            test_root_endpoint
            test_tenant_registration
            test_duplicate_registration
            test_validation_errors
            test_availability_check
            performance_test
            security_test
            stop_server
            run_all_tests
            print_status $? "Full test suite completed"
            ;;
        "all"|*)
            echo -e "${YELLOW}🎯 Running comprehensive test suite...${NC}"
            check_dependencies
            install_dependencies
            run_migrations
            start_server
            test_health_endpoint
            test_root_endpoint
            test_tenant_registration
            test_duplicate_registration
            test_validation_errors
            test_availability_check
            test_csv_template
            performance_test
            security_test
            stop_server
            run_all_tests
            print_status $? "Comprehensive test suite completed"
            ;;
    esac
}

# Cleanup on exit
cleanup() {
    stop_server
}

trap cleanup EXIT

# Run main function with all arguments
main "$@"
