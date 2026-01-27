// Cloudflare Pages Function for URL mapping/proxy with KV storage
// Maps a generated ID to an original URL and serves content from the original URL

export async function onRequest({ params, request, env }) {
  const mapId = params.id; // The ID that maps to the original URL
  
  // Check if KV namespace is available
  if (!env.URL_MAPPER_KV) {
    return new Response('KV namespace not configured. Please set up URL_MAPPER_KV in your environment.', {
      status: 500,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
  
  try {
    // Look up the original URL associated with this map ID
    const originalUrl = await env.URL_MAPPER_KV.get(mapId);
    
    if (!originalUrl) {
      return new Response('Mapping not found', {
        status: 404,
        headers: { 'Content-Type': 'text/plain' }
      });
    }
    
    // Validate the URL
    try {
      new URL(originalUrl);
    } catch (e) {
      return new Response('Invalid URL in mapping', {
        status: 500,
        headers: { 'Content-Type': 'text/plain' }
      });
    }
    
    // Fetch content from the original URL
    const response = await fetch(originalUrl);
    
    if (!response.ok) {
      return new Response(`Error: ${response.status} ${response.statusText}`, {
        status: response.status,
        headers: { 'Content-Type': 'text/plain' }
      });
    }
    
    // Get the original content type from the response
    const contentType = response.headers.get('Content-Type') || 'text/plain';
    const contentDisposition = response.headers.get('Content-Disposition');
    
    // Clone the response to access the body
    const responseClone = response.clone();
    const content = await responseClone.text();
    
    // Return the content with appropriate headers
    return new Response(content, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        ...(contentDisposition && {'Content-Disposition': contentDisposition}),
        'X-Proxy-Source': 'Cloudflare-Pages-KV-Proxy'
      }
    });
  } catch (error) {
    console.error('Error in KV-based proxy:', error);
    return new Response(`Error processing request: ${error.message}`, {
      status: 500,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}