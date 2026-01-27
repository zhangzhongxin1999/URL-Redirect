// Middleware to handle dynamic routing for user-defined mappings
export async function onRequest({ request, env, next }) {
  const url = new URL(request.url);
  const path = url.pathname;

  // Handle the /m/{userId}/{customPath} route
  if (path.startsWith('/m/')) {
    // Extract the part after /m/
    const routePath = path.substring(3); // Remove '/m/' prefix
    const pathParts = routePath.split('/');
    
    if (pathParts.length >= 2) {
      const userId = pathParts[0];
      const customPath = pathParts.slice(1).join('/');
      
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
        
        // Look up the stored data associated with this mapping
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
        
        // Handle different mapping types
        if (storedData.type === 'url_mapping') {
          // If it's a URL mapping, redirect to the original URL
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
        } else if (storedData.type === 'text_content') {
          // If it's text content, return the stored content
          return new Response(storedData.content, {
            headers: {
              'Content-Type': storedData.contentType,
              'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
              'Content-Disposition': `attachment; filename="${storedData.filename}"`,
              'Access-Control-Allow-Origin': '*'
            }
          });
        } else {
          return new Response('Invalid mapping type', {
            status: 500,
            headers: { 'Content-Type': 'text/plain' }
          });
        }
      } catch (error) {
        console.error('Error in user-defined mapping:', error);
        return new Response(`Error processing request: ${error.message}`, {
          status: 500,
          headers: { 'Content-Type': 'text/plain' }
        });
      }
    }
  }
  
  // For other routes, continue with the normal flow
  return next();
}