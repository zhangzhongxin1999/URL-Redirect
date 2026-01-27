// API endpoint to create persistent URL mappings using KV storage
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
    const customId = formData.get('customId') || null;
    const baseUrl = formData.get('baseUrl') || 'https://your-site.pages.dev';
    
    if (!originalUrl) {
      return new Response(JSON.stringify({ error: 'Original URL is required' }), {
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
    
    // Generate a unique ID if custom ID is not provided
    const mapId = customId || nanoid(10);
    
    // Store the mapping in KV
    await env.URL_MAPPER_KV.put(mapId, originalUrl);
    
    // Create the mapped URL
    const mappedUrl = `${baseUrl}/map/${mapId}`;
    
    return new Response(JSON.stringify({
      success: true,
      mapId: mapId,
      mappedUrl: mappedUrl,
      originalUrl: originalUrl,
      message: 'URL mapping created successfully'
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error('Error creating persistent mapping:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}