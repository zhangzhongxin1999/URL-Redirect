// Access control for the URL redirector service
// Implements basic authentication to restrict access

// Define admin credentials (in a real implementation, use environment variables)
const ADMIN_CREDENTIALS = {
  // Default credentials - should be changed in production
  username: 'admin',
  password: 'password'  // Should be changed in production
};

// For this implementation, we'll use a simple approach
// In production, use environment variables for credentials

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  
  // Basic authentication check
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return unauthorizedResponse();
  }
  
  try {
    const encodedCredentials = authHeader.substring(6); // Remove 'Basic ' prefix
    const decodedCredentials = atob(encodedCredentials);
    const [username, password] = decodedCredentials.split(':');
    
    if (username !== ADMIN_CREDENTIALS.username || password !== ADMIN_CREDENTIALS.password) {
      return unauthorizedResponse();
    }
  } catch (e) {
    return unauthorizedResponse();
  }
  
  // If authenticated, return the admin panel
  if (request.method === 'GET') {
    return new Response(`
      <html>
        <head>
          <title>Admin Panel - URL Redirector</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            .container { max-width: 800px; margin: 0 auto; }
            .panel { background: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0; }
            button { background: #007cba; color: white; padding: 10px 15px; border: none; border-radius: 3px; cursor: pointer; }
            button:hover { background: #005a87; }
            input, select { padding: 8px; margin: 5px; border: 1px solid #ccc; border-radius: 3px; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Admin Panel - URL Redirector</h1>
            
            <div class="panel">
              <h2>Change Admin Credentials</h2>
              <form id="credentialsForm">
                <div>
                  <label>Username: <input type="text" id="newUsername" required></label>
                </div>
                <div>
                  <label>Password: <input type="password" id="newPassword" required></label>
                </div>
                <button type="submit">Update Credentials</button>
              </form>
            </div>
            
            <div class="panel">
              <h2>About Access Control</h2>
              <p>This service implements basic authentication to protect access.</p>
              <p>To access the main functionality, users need to provide the correct credentials.</p>
            </div>
          </div>
          
          <script>
            document.getElementById('credentialsForm').addEventListener('submit', async function(e) {
              e.preventDefault();
              
              const newUsername = document.getElementById('newUsername').value;
              const newPassword = document.getElementById('newPassword').value;
              
              // In a real implementation, this would update server-side settings
              alert('Credentials would be updated in a real implementation. Currently, update them in the source code.');
            });
          </script>
        </body>
      </html>
    `, {
      headers: { 'Content-Type': 'text/html' }
    });
  }
  
  // For POST requests, handle credential updates
  if (request.method === 'POST') {
    // In a real implementation, this would handle credential updates
    // For this demo, we'll just return a message
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Credentials updated (demo only - update source code in real implementation)' 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  return new Response('Method not allowed', { status: 405 });
}

function unauthorizedResponse() {
  return new Response('Unauthorized', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Access to URL Redirector admin panel"',
      'Content-Type': 'text/plain'
    }
  });
}