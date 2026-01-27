// API endpoint to create user-defined URL mappings using KV storage
import { nanoid } from 'https://cdn.jsdelivr.net/npm/nanoid@4.0.0/nanoid.js';

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
  
  // Check if KV namespace is available
  if (!env.URL_MAPPER_KV) {
    return new Response(JSON.stringify({ 
      error: 'KV namespace not configured. Please set up URL_MAPPER_KV in your environment.' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    const formData = await request.formData();
    const originalUrl = formData.get('originalUrl');
    const userId = formData.get('userId');
    const customPath = formData.get('customPath');
    const baseUrl = formData.get('baseUrl') || 'https://your-site.pages.dev';
    
    if (!originalUrl) {
      return new Response(JSON.stringify({ error: 'Original URL is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (!userId) {
      return new Response(JSON.stringify({ error: 'User ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (!customPath) {
      return new Response(JSON.stringify({ error: 'Custom path is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Validate the original URL
    try {
      new URL(originalUrl);
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid original URL' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Create the mapping key in the format: user:{userId}:path:{customPath}
    const mappingKey = `user:${userId}:path:${customPath}`;
    
    // Check if this mapping already exists
    const existingMapping = await env.URL_MAPPER_KV.get(mappingKey);
    if (existingMapping) {
      return new Response(JSON.stringify({ 
        error: 'A mapping with this user ID and custom path already exists' 
      }), {
        status: 409, // Conflict
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Store the original URL in KV with the mapping key
    const mappingData = {
      originalUrl: originalUrl,
      userId: userId,
      customPath: customPath,
      createdAt: new Date().toISOString(),
      type: 'url_mapping'
    };
    
    await env.URL_MAPPER_KV.put(mappingKey, JSON.stringify(mappingData));
    
    // Add this mapping to the user's list of mappings
    // First get the current list of mappings for this user
    const userMappingsListKey = `user:${userId}:mappings:list`;
    let userMappingsList = [];
    const existingList = await env.URL_MAPPER_KV.get(userMappingsListKey);
    if (existingList) {
      userMappingsList = JSON.parse(existingList);
    }
    
    // Add the new mapping to the list
    userMappingsList.push({
      mappingKey: mappingKey,
      customPath: customPath,
      createdAt: new Date().toISOString(),
      type: 'url_mapping'
    });
    
    // Update the user's list of mappings
    await env.URL_MAPPER_KV.put(userMappingsListKey, JSON.stringify(userMappingsList));
    
    // Create the mapped URL
    const mappedUrl = `${baseUrl}/m/${userId}/${customPath}`;
    
    return new Response(JSON.stringify({
      success: true,
      mappedUrl: mappedUrl,
      mappingKey: mappingKey,
      userId: userId,
      customPath: customPath,
      originalUrl: originalUrl,
      message: 'User-defined mapping created successfully'
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error('Error creating user mapping:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}