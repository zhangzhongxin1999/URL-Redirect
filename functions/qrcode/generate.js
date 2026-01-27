// Cloudflare Pages Function for generating QR codes
// Uses a QR code library to generate QR codes for URLs

export async function onRequest({ request, env }) {
  // Parse the URL from query parameters
  const url = new URL(request.url);
  const targetUrl = url.searchParams.get('url');
  
  if (!targetUrl) {
    return new Response('Missing URL parameter', {
      status: 400,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
  
  // Validate that the URL is properly formatted
  try {
    new URL(targetUrl);
  } catch (e) {
    return new Response('Invalid URL parameter', {
      status: 400,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
  
  // Use an external QR code generation service
  // We'll redirect to a public QR code generator with the target URL
  const qrServiceUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(targetUrl)}`;
  
  // Make a request to the QR code service and return the image
  try {
    const response = await fetch(qrServiceUrl);
    
    if (!response.ok) {
      throw new Error(`QR code service returned ${response.status}`);
    }
    
    // Get the image data from the QR code service
    const imageBuffer = await response.arrayBuffer();
    
    // Return the QR code image
    return new Response(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error('Error generating QR code:', error);
    return new Response('Error generating QR code', {
      status: 500,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}