#!/bin/bash

# Login Endpoint Testing Script
# This script tests all scenarios for the login endpoint
# Usage: bash TEST_LOGIN_ENDPOINT.sh

API_URL="http://localhost:3001/hcgi/api/auth/login/authenticate"
TEST_EMAIL="katonrhys@gmail.com"
TEST_PASSWORD="SecurePass2026!@#"
TEST_IP="192.168.1.100"
TEST_USER_AGENT="curl/7.68.0"

echo "========================================"
echo "Login Endpoint Testing Script"
echo "========================================"
echo ""
echo "API URL: $API_URL"
echo ""

# Test 1: Valid Credentials
echo "[TEST 1] Valid Credentials"
echo "Request:"
echo "  Email: $TEST_EMAIL"
echo "  Password: *** (masked)"
echo "  IP: $TEST_IP"
echo ""
echo "Response:"
curl -X POST "$API_URL" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\",\"ipAddress\":\"$TEST_IP\",\"userAgent\":\"$TEST_USER_AGENT\"}" \
  -w "\nStatus: %{http_code}\n" \
  -s | jq .
echo ""
echo ""

# Test 2: Invalid Password
echo "[TEST 2] Invalid Password"
echo "Request:"
echo "  Email: $TEST_EMAIL"
echo "  Password: WrongPassword123! (invalid)"
echo "  IP: $TEST_IP"
echo ""
echo "Response:"
curl -X POST "$API_URL" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"WrongPassword123!\",\"ipAddress\":\"$TEST_IP\",\"userAgent\":\"$TEST_USER_AGENT\"}" \
  -w "\nStatus: %{http_code}\n" \
  -s | jq .
echo ""
echo ""

# Test 3: Missing Email
echo "[TEST 3] Missing Email"
echo "Request:"
echo "  Email: (missing)"
echo "  Password: *** (masked)"
echo "  IP: $TEST_IP"
echo ""
echo "Response:"
curl -X POST "$API_URL" \
  -H 'Content-Type: application/json' \
  -d "{\"password\":\"$TEST_PASSWORD\",\"ipAddress\":\"$TEST_IP\",\"userAgent\":\"$TEST_USER_AGENT\"}" \
  -w "\nStatus: %{http_code}\n" \
  -s | jq .
echo ""
echo ""

# Test 4: Missing Password
echo "[TEST 4] Missing Password"
echo "Request:"
echo "  Email: $TEST_EMAIL"
echo "  Password: (missing)"
echo "  IP: $TEST_IP"
echo ""
echo "Response:"
curl -X POST "$API_URL" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$TEST_EMAIL\",\"ipAddress\":\"$TEST_IP\",\"userAgent\":\"$TEST_USER_AGENT\"}" \
  -w "\nStatus: %{http_code}\n" \
  -s | jq .
echo ""
echo ""

# Test 5: Missing IP Address
echo "[TEST 5] Missing IP Address"
echo "Request:"
echo "  Email: $TEST_EMAIL"
echo "  Password: *** (masked)"
echo "  IP: (missing)"
echo ""
echo "Response:"
curl -X POST "$API_URL" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\",\"userAgent\":\"$TEST_USER_AGENT\"}" \
  -w "\nStatus: %{http_code}\n" \
  -s | jq .
echo ""
echo ""

# Test 6: Invalid JSON
echo "[TEST 6] Invalid JSON"
echo "Request:"
echo "  Body: {invalid json}"
echo ""
echo "Response:"
curl -X POST "$API_URL" \
  -H 'Content-Type: application/json' \
  -d '{invalid json}' \
  -w "\nStatus: %{http_code}\n" \
  -s | jq .
echo ""
echo ""

# Test 7: Wrong Content-Type
echo "[TEST 7] Wrong Content-Type (text/plain)"
echo "Request:"
echo "  Content-Type: text/plain"
echo "  Body: {\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\",\"ipAddress\":\"$TEST_IP\"}"
echo ""
echo "Response:"
curl -X POST "$API_URL" \
  -H 'Content-Type: text/plain' \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\",\"ipAddress\":\"$TEST_IP\",\"userAgent\":\"$TEST_USER_AGENT\"}" \
  -w "\nStatus: %{http_code}\n" \
  -s | jq .
echo ""
echo ""

# Test 8: Non-existent User
echo "[TEST 8] Non-existent User"
echo "Request:"
echo "  Email: nonexistent@example.com"
echo "  Password: *** (masked)"
echo "  IP: $TEST_IP"
echo ""
echo "Response:"
curl -X POST "$API_URL" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"nonexistent@example.com\",\"password\":\"$TEST_PASSWORD\",\"ipAddress\":\"$TEST_IP\",\"userAgent\":\"$TEST_USER_AGENT\"}" \
  -w "\nStatus: %{http_code}\n" \
  -s | jq .
echo ""
echo ""

echo "========================================"
echo "Testing Complete"
echo "========================================"
echo ""
echo "Check the API logs for detailed debugging information:"
echo "  - Request headers and body"
echo "  - Field extraction"
echo "  - Authentication attempts"
echo "  - Response data"
echo ""
echo "Enable debug logging with: LOG_LEVEL=debug in .env"
echo ""
