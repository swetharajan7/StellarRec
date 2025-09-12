#!/usr/bin/env node

/**
 * Simple test script for the StellarRec recommendation server
 * This sends a test request to verify the server is working
 */

import fetch from 'node-fetch';

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';

async function testRecommendationEndpoint() {
  console.log('🧪 Testing StellarRec Recommendation Server...');
  console.log('📡 Server URL:', SERVER_URL);

  const testPayload = {
    student_name: 'John Doe',
    student_email: 'john.doe@example.com',
    student_first: 'John',
    student_last: 'Doe',
    recommender_name: 'Prof. Jane Smith',
    recommender_email: 'jane.smith@university.edu',
    unitids: ['166027', '110635', 'MOCK-1'],
    waive: 1,
    title: 'Test Recommendation Letter'
  };

  try {
    console.log('📤 Sending test request...');
    
    const response = await fetch(`${SERVER_URL}/api/recommendations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload)
    });

    const result = await response.json();

    if (response.ok) {
      console.log('✅ Test successful!');
      console.log('📋 Response:', result);
      console.log('🆔 Request ID:', result.id);
      console.log('📧 Email would be sent to:', testPayload.recommender_email);
    } else {
      console.log('❌ Test failed!');
      console.log('📋 Error response:', result);
      console.log('🔢 Status code:', response.status);
    }

  } catch (error) {
    console.log('❌ Test failed with error!');
    console.log('🚨 Error:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('💡 Make sure the server is running with: npm start');
    }
  }
}

// Run the test
testRecommendationEndpoint().catch(console.error);