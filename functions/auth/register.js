// User registration endpoint
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
    const email = formData.get('email') || null;
    
    if (!userId || !password) {
      return new Response(JSON.stringify({ error: 'User ID and password are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Validate userId format (alphanumeric and hyphens/underscores only)
    if (!/^[a-zA-Z0-9_-]+$/.test(userId)) {
      return new Response(JSON.stringify({ error: 'User ID can only contain letters, numbers, hyphens, and underscores' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Check if user already exists
    const userExists = await env.URL_MAPPER_KV.get(`user:${userId}:profile`);
    if (userExists) {
      return new Response(JSON.stringify({ error: 'User ID already exists' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Hash the password
    const hashedPassword = await hash(password);
    
    // Create user profile
    const userProfile = {
      userId: userId,
      email: email,
      createdAt: new Date().toISOString(),
      lastLoginAt: null,
      isActive: true
    };
    
    // Store user profile and hashed password
    await env.URL_MAPPER_KV.put(`user:${userId}:profile`, JSON.stringify(userProfile));
    await env.URL_MAPPER_KV.put(`user:${userId}:password`, hashedPassword);
    
    // Initialize user's mappings list
    await env.URL_MAPPER_KV.put(`user:${userId}:mappings:list`, JSON.stringify([]));
    
    return new Response(JSON.stringify({
      success: true,
      message: 'User registered successfully',
      userId: userId
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error('Error registering user:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}