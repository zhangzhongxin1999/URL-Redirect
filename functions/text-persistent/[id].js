// Backwards compatibility function - redirects to the new unified mapping system
// This maintains compatibility with older URLs while using the new system

export async function onRequest({ params, request, env }) {
  const textId = params.id; // The legacy ID
  
  // For backwards compatibility, we'll treat the old ID as a special case
  // In the new system, this would be handled by the /m/ route
  
  // This is a redirect to inform users about the new system
  return new Response(`This endpoint has been deprecated. Please use the new user-defined mapping system at /m/{userId}/{customPath}`, {
    status: 410, // Gone
    headers: { 
      'Content-Type': 'text/plain',
      'Location': '/'  // Redirect to main page
    }
  });
}