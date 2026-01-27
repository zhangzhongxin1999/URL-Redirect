// Cloudflare Pages Function for persistent text-to-URL conversion with KV storage
// Gets text content by ID from KV storage and returns it as a file

export async function onRequest({ params, request, env }) {
  const textId = params.id; // The ID that maps to the stored text content
  
  // Check if KV namespace is available
  if (!env.TEXT_STORAGE_KV) {
    return new Response('KV namespace not configured. Please set up TEXT_STORAGE_KV in your environment.', {
      status: 500,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
  
  try {
    // Look up the text content associated with this ID
    const storedDataJson = await env.TEXT_STORAGE_KV.get(textId);
    
    if (!storedDataJson) {
      return new Response('Text content not found', {
        status: 404,
        headers: { 'Content-Type': 'text/plain' }
      });
    }
    
    // Parse the stored data (contains both content and metadata)
    let storedData;
    try {
      storedData = JSON.parse(storedDataJson);
    } catch (e) {
      return new Response('Invalid stored data format', {
        status: 500,
        headers: { 'Content-Type': 'text/plain' }
      });
    }
    
    const content = storedData.content;
    const filename = storedData.filename || 'text-content.txt';
    const contentType = storedData.contentType || 'text/plain';
    
    // Return the text content with appropriate headers
    return new Response(content, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Content-Source': 'Persistent-Text-File'
      }
    });
  } catch (error) {
    console.error('Error in persistent text-to-URL:', error);
    return new Response(`Error processing request: ${error.message}`, {
      status: 500,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}