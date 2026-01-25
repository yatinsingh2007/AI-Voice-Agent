#!/bin/bash

# Configuration
BASE_URL="http://localhost:8000/api/v1"
EMAIL="testuser_$(date +%s)@example.com"
PASSWORD="password123"
NAME="Test User"

echo "--- Testing API Flow ---"

# 1. Signup
echo "Step 1: Signup"
SIGNUP_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/signup" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$EMAIL\",
    \"password\": \"$PASSWORD\",
    \"name\": \"$NAME\"
  }")

echo "Signup Response: $SIGNUP_RESPONSE"

# 2. Login
echo -e "\nStep 2: Login"
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: multipart/form-data" \
  -F "username=$EMAIL" \
  -F "password=$PASSWORD")

echo "Login Response: $LOGIN_RESPONSE"

# Extract token
TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

if [ -n "$TOKEN" ]; then
  echo -e "\nSuccess! Token: $TOKEN"
else
  echo -e "\nError: Could not retrieve token."
  exit 1
fi

echo -e "\n--- API Flow Completed ---"
