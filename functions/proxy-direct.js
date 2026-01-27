// Proxy function that fetches content from a URL passed as a parameter
// Format: /proxy-direct?url=encoded_original_url

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  
  // Get the target URL from the query parameter
  const targetUrlParam = url.searchParams.get('url');
  
  if (!targetUrlParam) {
    return new Response('Missing url parameter', { 
      status: 400, 
      headers: { 'Content-Type': 'text/plain' } 
    });
  }
  
  let targetUrl;
  try {
    // Decode the URL
    targetUrl = decodeURIComponent(targetUrlParam);
    // Validate the URL
    new URL(targetUrl);
  } catch (e) {
    return new Response('Invalid URL parameter', { 
      status: 400, 
      headers: { 'Content-Type': 'text/plain' } 
    });
  }
  
  try {
    // Fetch content from the target URL
    const response = await fetch(targetUrl);
    
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
        'X-Proxy-Source': 'Cloudflare-Pages-Direct-Proxy'
      }
    });
  } catch (error) {
    console.error('Error fetching target URL:', error);
    return new Response(`Error fetching content: ${error.message}`, {
      status: 500,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}