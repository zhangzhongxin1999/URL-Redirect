// API endpoint to generate text-to-URL links
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
    const content = formData.get('content');
    const filename = formData.get('filename') || 'text-content.txt';
    const baseUrl = formData.get('baseUrl') || 'https://your-site.pages.dev';
    
    if (!content) {
      return new Response(JSON.stringify({ error: 'Content is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Create the URL
    const encodedContent = encodeURIComponent(content);
    const generatedUrl = `${baseUrl}/text/${filename}?content=${encodedContent}`;
    
    // Also create a base64 version for comparison
    const base64Content = btoa(unescape(encodeURIComponent(content)));
    const generatedBase64Url = `${baseUrl}/text/${filename}?b64=${base64Content}`;
    
    return new Response(JSON.stringify({
      success: true,
      url: generatedUrl,
      base64Url: generatedBase64Url,
      filename: filename,
      contentLength: content.length
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