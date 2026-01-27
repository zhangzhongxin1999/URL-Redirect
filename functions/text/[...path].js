// Cloudflare Pages Function for converting text to downloadable files
// This function takes text content from URL parameters and returns it as a file

export async function onRequest({ params, request }) {
  const url = new URL(request.url);
  const pathParts = params.path; // Extract the path after /text/
  
  // The path should contain the filename
  const filename = pathParts.join('/') || 'text-content.txt';
  
  // Get text content from query parameter
  const textContent = url.searchParams.get('content');
  const base64Content = url.searchParams.get('b64'); // Alternative: base64 encoded content
  
  let content = '';
  
  if (base64Content) {
    // Decode base64 content
    try {
      content = atob(base64Content);
    } catch (e) {
      return new Response('Invalid base64 content', { 
        status: 400, 
        headers: { 'Content-Type': 'text/plain' } 
      });
    }
  } else if (textContent !== null) {
    // Use regular text content
    content = textContent;
  } else {
    return new Response('Missing content parameter. Use ?content=your-text or ?b64=base64-encoded-text', { 
      status: 400, 
      headers: { 'Content-Type': 'text/plain' } 
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
  
  // Return the text content as a downloadable file
  return new Response(content, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache',
      'X-Content-Source': 'Dynamic-Text-File'
    }
  });
}