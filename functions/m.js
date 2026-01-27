// Simple function to handle /m/ route
export async function onRequest(context) {
  const { request, env } = context;
  
  // For this route, we redirect to the main page or return an error
  // Actual mapping is handled by _worker.js
  return new Response('Please use the proper mapping URL format: /m/{userId}/{customPath}', {
    status: 400,
    headers: { 'Content-Type': 'text/plain' }
  });
}