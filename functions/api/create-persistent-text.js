// API endpoint to create persistent text content using KV storage
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
  if (!env.TEXT_STORAGE_KV) {
    return new Response(JSON.stringify({ 
      error: 'KV namespace not configured. Please set up TEXT_STORAGE_KV in your environment.' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    const formData = await request.formData();
    const content = formData.get('content');
    const filename = formData.get('filename') || 'text-content.txt';
    const customId = formData.get('customId') || null;
    const baseUrl = formData.get('baseUrl') || 'https://your-site.pages.dev';
    
    if (!content) {
      return new Response(JSON.stringify({ error: 'Content is required' }), {
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
    
    // Generate a unique ID if custom ID is not provided
    const textId = customId || nanoid(10);
    
    // Store the content and metadata in KV
    const storedData = {
      content: content,
      filename: filename,
      contentType: contentType,
      createdAt: new Date().toISOString()
    };
    
    await env.TEXT_STORAGE_KV.put(textId, JSON.stringify(storedData));
    
    // Create the persistent URL
    const persistentUrl = `${baseUrl}/text-persistent/${textId}`;
    
    return new Response(JSON.stringify({
      success: true,
      textId: textId,
      persistentUrl: persistentUrl,
      filename: filename,
      contentType: contentType,
      message: 'Persistent text content created successfully'
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error('Error creating persistent text content:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}