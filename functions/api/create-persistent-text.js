// API endpoint to create user-defined text content mappings using KV storage
import { nanoid } from 'https://cdn.jsdelivr.net/npm/nanoid@4.0.0/nanoid.js';

export async function onRequest(context) {
  const { request, env, nextUrl } = context;
  
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
    const content = formData.get('content');
    const filename = formData.get('filename') || 'text-content.txt';
    const userId = formData.get('userId');
    const customPath = formData.get('customPath');
    
    if (!content) {
      return new Response(JSON.stringify({ error: 'Content is required' }), {
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
    
    // Determine content type based on file extension
    let contentType = 'text/plain';
    if (filename.endsWith('.json')) {
      contentType = 'application/json';
    } else if (filename.endsWith('.js')) {
      contentType = 'application/javascript';
    } else if (filename.endsWith('.css')) {
      contentType = 'text/css';
    } else if (filename.endsWith('.html') || filename.endsWith('.htm')) {
      contentType = 'text/html';
    } else if (filename.endsWith('.xml')) {
      contentType = 'application/xml';
    }
    
    // Create the mapping key in the format: user:{userId}:path:{customPath}
    const mappingKey = `user:${userId}:path:${customPath}`;
    
    // Check if this mapping already exists
    const existingMapping = await env.URL_MAPPER_KV.get(mappingKey);
    if (existingMapping) {
      return new Response(JSON.stringify({ 
        error: 'A mapping with this user ID and customPath already exists' 
      }), {
        status: 409, // Conflict
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Store the content and metadata in KV with the mapping key
    const storedData = {
      content: content,
      filename: filename,
      contentType: contentType,
      userId: userId,
      customPath: customPath,
      createdAt: new Date().toISOString(),
      type: 'text_content'
    };
    
    await env.URL_MAPPER_KV.put(mappingKey, JSON.stringify(storedData));
    
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
      type: 'text_content'
    });
    
    // Update the user's list of mappings
    await env.URL_MAPPER_KV.put(userMappingsListKey, JSON.stringify(userMappingsList));
    
    // Derive the base URL from the request
    const baseUrl = `${nextUrl.protocol}//${nextUrl.host}`;
    
    // Create the persistent URL
    const persistentUrl = `${baseUrl}/m/${userId}/${customPath}`;
    
    return new Response(JSON.stringify({
      success: true,
      persistentUrl: persistentUrl,
      mappingKey: mappingKey,
      userId: userId,
      customPath: customPath,
      filename: filename,
      contentType: contentType,
      message: 'User-defined text content mapping created successfully'
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error('Error creating user-defined text content:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}