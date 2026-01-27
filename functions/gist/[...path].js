// Cloudflare Pages Function for Gist raw content proxy with custom filename
// This function proxies requests to gist.githubusercontent.com to bypass restrictions
// Supports custom filename via query parameter: ?filename=desired-name.ext

export async function onRequest({ params, request }) {
  const url = new URL(request.url);
  const gistPath = params.path; // Extract the path after /gist/
  
  // Check if there's a custom filename in the query parameters
  const customFilename = url.searchParams.get('filename');
  
  // Determine the path components
  // Expected format: /gist/username/gist-id/raw[/subfolder]/filename.ext
  let targetUrl;
  let originalFilename;
  
  if (gistPath.length >= 4) {
    // Handle the case: /gist/username/gist-id/raw/file.ext
    // or /gist/username/gist-id/raw/subfolder/file.ext
    const username = gistPath[0];
    const gistId = gistPath[1];
    const rawKeyword = gistPath[2]; // Should be 'raw'
    
    // Everything after 'raw' is the file path
    const filePath = gistPath.slice(3).join('/');
    originalFilename = filePath.split('/').pop(); // Get the actual filename
    
    targetUrl = `https://gist.githubusercontent.com/${username}/${gistId}/${rawKeyword}/${filePath}`;
  } else {
    // If the path format is invalid, return an error
    return new Response('Invalid path format. Expected: /gist/username/gist-id/raw/file-path', {
      status: 400,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
  
  try {
    console.log(`Proxying request to: ${targetUrl}`);
    
    // Fetch the content from GitHub
    const response = await fetch(targetUrl);
    
    if (!response.ok) {
      return new Response(`Error: ${response.status} ${response.statusText}`, {
        status: response.status,
        headers: { 'Content-Type': 'text/plain' }
      });
    }
    
    // Get the original content type from the response
    const contentType = response.headers.get('Content-Type') || 'text/plain';
    
    // Clone the response to avoid issues with consuming the body twice
    const responseClone = response.clone();
    const content = await responseClone.text();
    
    // Determine the filename to use
    const finalFilename = customFilename || originalFilename || 'download';
    
    // Return the content with appropriate headers including content disposition
    return new Response(content, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${finalFilename}"`,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        'X-Proxy-Source': 'Cloudflare-Pages-Gist-Proxy'
      }
    });
  } catch (error) {
    console.error('Error fetching gist content:', error);
    return new Response(`Error fetching content: ${error.message}`, {
      status: 500,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}