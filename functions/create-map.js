// API endpoint to create URL mappings
// This would normally store the mapping in a database/KV store
// For this implementation, we'll use URL encoding to create self-contained URLs

export async function onRequest(context) {
  const { request } = context;
  
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
    const originalUrl = formData.get('originalUrl');
    const customPath = formData.get('customPath') || null;
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
    
    // Create a self-contained URL that encodes the original URL
    // This approach doesn't require persistent storage
    const encodedUrl = btoa(encodeURIComponent(originalUrl));
    const mappedUrl = customPath 
      ? `${baseUrl}/${customPath}` 
      : `${baseUrl}/proxy/${encodedUrl}`;
    
    // Also create a version with the original URL embedded as a parameter
    const paramBasedUrl = `${baseUrl}/proxy-direct?url=${encodeURIComponent(originalUrl)}`;
    
    return new Response(JSON.stringify({
      success: true,
      mappedUrl: mappedUrl,
      paramBasedUrl: paramBasedUrl,
      originalUrl: originalUrl,
      encodedUrl: encodedUrl
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}