// User login endpoint
import { hash, compare } from 'https://cdn.skypack.dev/@blakeembrey/hash';

export async function onRequest(context) {
  const { request, env } = context;
  
  if (request.method === 'OPTIONS') {
    // Handle CORS preflight request
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }
  
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }
  
  try {
    const formData = await request.formData();
    const userId = formData.get('userId');
    const password = formData.get('password');
    
    if (!userId || !password) {
      return new Response(JSON.stringify({ error: 'User ID and password are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Get stored hashed password
    const storedHashedPassword = await env.URL_MAPPER_KV.get(`user:${userId}:password`);
    if (!storedHashedPassword) {
      return new Response(JSON.stringify({ error: 'Invalid user ID or password' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Compare passwords
    const isValid = await compare(password, storedHashedPassword);
    if (!isValid) {
      return new Response(JSON.stringify({ error: 'Invalid user ID or password' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Update last login time
    const userProfileKey = `user:${userId}:profile`;
    const userProfileJson = await env.URL_MAPPER_KV.get(userProfileKey);
    
    if (userProfileJson) {
      const userProfile = JSON.parse(userProfileJson);
      userProfile.lastLoginAt = new Date().toISOString();
      await env.URL_MAPPER_KV.put(userProfileKey, JSON.stringify(userProfile));
    }
    
    // In a real implementation, we would generate a JWT or session token
    // For this implementation, we'll just return success
    return new Response(JSON.stringify({
      success: true,
      message: 'Login successful',
      userId: userId
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error('Error logging in user:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}