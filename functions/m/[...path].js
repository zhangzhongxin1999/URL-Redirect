// Cloudflare Pages Function for handling user-defined mappings
// Maps /m/{userId}/{customPath} to the stored original URL

export async function onRequest({ params, request, env }) {
  // Extract userId and customPath from the URL path
  const pathParts = params.path.split('/');
  
  if (pathParts.length < 2) {
    return new Response('Invalid path format. Expected /m/{userId}/{customPath}', {
      status: 400,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
  
  const userId = pathParts[0];
  const customPath = pathParts.slice(1).join('/'); // Allow custom paths with slashes
  
  // Check if KV namespace is available
  if (!env.URL_MAPPER_KV) {
    return new Response('KV namespace not configured. Please set up URL_MAPPER_KV in your environment.', {
      status: 500,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
  
  try {
    // Create the mapping key in the format: user:{userId}:path:{customPath}
    const mappingKey = `user:${userId}:path:${customPath}`;
    
    // Look up the original URL associated with this mapping
    const storedDataJson = await env.URL_MAPPER_KV.get(mappingKey);
    
    if (!storedDataJson) {
      return new Response('Mapping not found', {
        status: 404,
        headers: { 'Content-Type': 'text/plain' }
      });
    }
    
    // Parse the stored data
    let storedData;
    try {
      storedData = JSON.parse(storedDataJson);
    } catch (e) {
      return new Response('Invalid stored data format', {
        status: 500,
        headers: { 'Content-Type': 'text/plain' }
      });
    }
    
    const originalUrl = storedData.originalUrl;
    
    // Validate the original URL
    try {
      new URL(originalUrl);
    } catch (e) {
      return new Response('Invalid stored URL', {
        status: 500,
        headers: { 'Content-Type': 'text/plain' }
      });
    }
    
    // Fetch the content from the original URL
    const response = await fetch(originalUrl);
    
    if (!response.ok) {
      return new Response(`Failed to fetch content: ${response.status} ${response.statusText}`, {
        status: response.status,
        headers: { 'Content-Type': 'text/plain' }
      });
    }
    
    // Get the content type from the original response
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    
    // Create a new response with the fetched content
    const responseBody = await response.arrayBuffer();
    
    // Determine if this is a file download request based on the original URL
    const urlObj = new URL(originalUrl);
    const pathname = urlObj.pathname;
    const filename = pathname.split('/').pop(); // Get the last part as filename
    
    // Set appropriate headers
    const responseHeaders = new Headers(response.headers);
    
    // Override certain headers to ensure proper behavior
    responseHeaders.set('Content-Type', contentType);
    
    // If there's a filename in the original URL, set it as a download
    if (filename && filename.includes('.')) {
      responseHeaders.set('Content-Disposition', `attachment; filename="${filename}"`);
    }
    
    // Add security headers
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.delete('Set-Cookie'); // Remove cookies from origin
    
    return new Response(responseBody, {
      status: response.status,
      headers: responseHeaders
    });
  } catch (error) {
    console.error('Error in user-defined mapping:', error);
    return new Response(`Error processing request: ${error.message}`, {
      status: 500,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}