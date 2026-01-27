// Cloudflare Worker entry point
export default {
  async fetch(request, env, ctx) {
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
          const mappingKey = 'user:' + userId + ':path:' + customPath;
          
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
              return new Response('Failed to fetch content: ' + response.status + ' ' + response.statusText, {
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
              responseHeaders.set('Content-Disposition', 'attachment; filename="' + filename + '"');
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
                'Content-Disposition': 'attachment; filename="' + storedData.filename + '"',
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
          return new Response('Error processing request: ' + error.message, {
            status: 500,
            headers: { 'Content-Type': 'text/plain' }
          });
        }
      } else {
        return new Response('Invalid path format. Expected: /m/{userId}/{customPath}', {
          status: 400,
          headers: { 'Content-Type': 'text/plain' }
        });
      }
    }
    // Handle API routes
    else if (path.startsWith('/api/')) {
      // Import and handle API routes dynamically
      if (path === '/api/create-user-mapping') {
        if (request.method === 'POST') {
          return handleCreateUserMapping(request, env);
        } else if (request.method === 'OPTIONS') {
          return handleCorsPreflight();
        }
      } else if (path === '/api/create-persistent-text') {
        if (request.method === 'POST') {
          return handleCreatePersistentText(request, env);
        } else if (request.method === 'OPTIONS') {
          return handleCorsPreflight();
        }
      } else if (path.startsWith('/api/user/') && path.endsWith('/mappings')) {
        if (request.method === 'GET') {
          return handleGetUserMappings(request, env, path);
        } else if (request.method === 'OPTIONS') {
          return handleCorsPreflight();
        }
      } else if (path.startsWith('/api/user/') && path.includes('/mappings/') && path.endsWith('/delete')) {
        if (request.method === 'DELETE') {
          return handleDeleteUserMapping(request, env, path);
        } else if (request.method === 'OPTIONS') {
          return handleCorsPreflight();
        }
      }
    }
    // Handle auth routes
    else if (path.startsWith('/auth/')) {
      if (path === '/auth/register') {
        if (request.method === 'POST') {
          return handleRegister(request, env);
        } else if (request.method === 'OPTIONS') {
          return handleCorsPreflight();
        }
      } else if (path === '/auth/login') {
        if (request.method === 'POST') {
          return handleLogin(request, env);
        } else if (request.method === 'OPTIONS') {
          return handleCorsPreflight();
        }
      }
    }
    // Handle QR code generation
    else if (path.startsWith('/qrcode/generate')) {
      if (request.method === 'GET') {
        return handleQrCodeGeneration(request);
      }
    }
    // Handle admin access control
    else if (path.startsWith('/admin/')) {
      if (path === '/admin/access-control') {
        return handleAccessControlPage();
      }
    }
    // Serve the main page
    else {
      return new Response(getHtmlPage(), {
        headers: {
          'Content-Type': 'text/html',
        }
      });
    }
  }
};

// --- HTML Content Generation (Updated with Fixes) ---
function getHtmlPage() {
  // 注意：在 Worker 的字符串中，客户端 JS 的反引号 ` 和变量符号 $ 需要转义
  // 以防止后端 JS 尝试解析它们。
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Universal Content Proxy with User-defined Mapping</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
      color: #333;
    }
    .container {
      background: white;
      border-radius: 10px;
      padding: 30px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    h1 {
      color: #2c6bed;
      text-align: center;
    }
    .form-group {
      margin-bottom: 15px;
    }
    label {
      display: block;
      margin-bottom: 5px;
      font-weight: bold;
    }
    input[type="text"], input[type="url"], input[type="email"], input[type="password"], textarea {
      width: 100%;
      padding: 8px;
      border: 1px solid #ccc;
      border-radius: 4px;
      box-sizing: border-box;
    }
    textarea {
      height: 120px;
      font-family: monospace;
    }
    button {
      background-color: #4CAF50;
      color: white;
      padding: 10px 15px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 16px;
    }
    button:hover {
      background-color: #45a049;
    }
    button:disabled {
      background-color: #cccccc;
      cursor: not-allowed;
    }
    .auth-button {
      background-color: #2196F3;
    }
    .auth-button:hover {
      background-color: #0b7dda;
    }
    .logout-button {
      background-color: #f44336;
      float: right; 
      display: none;
    }
    .logout-button:hover {
      background-color: #da190b;
    }
    .result {
      margin-top: 15px;
      padding: 10px;
      background-color: #e8f4fd;
      border-radius: 4px;
      display: none;
    }
    .result.show {
      display: block;
    }
    .mapping-item {
      border: 1px solid #ddd;
      padding: 10px;
      margin: 10px 0;
      border-radius: 5px;
      background-color: #f9f9f9;
    }
    .delete-btn {
      background-color: #f44336;
      color: white;
      border: none;
      padding: 5px 10px;
      border-radius: 3px;
      cursor: pointer;
      float: right;
    }
    .delete-btn:hover {
      background-color: #da190b;
    }
    .auth-status {
      margin: 10px 0;
      padding: 10px;
      background-color: #e8f5e8;
      border-radius: 4px;
      display: none;
    }
    .auth-status.authenticated {
      background-color: #e8f5e8;
      border: 1px solid #4CAF50;
    }
    .auth-status.unauthenticated {
      background-color: #ffeaea;
      border: 1px solid #f44336;
    }
    .warning {
      background: #fff3cd;
      border: 1px solid #ffeaa7;
      color: #856404;
      padding: 10px;
      border-radius: 5px;
      margin: 15px 0;
    }
    .service-section {
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 15px;
      margin: 15px 0;
    }
    .instructions, .features {
      margin-top: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔄 Universal Content Proxy</h1>
    
    <div class="warning">
      <strong>🔒 Security Notice:</strong> For enhanced security, ensure your backend validates all requests.
    </div>
    
    <div class="auth-section">
      <h2>🔐 Account</h2>
      <p>Register or login to manage your mappings</p>
      
      <div id="authStatus" class="auth-status">
        <span id="authStatusText"></span>
        <button class="logout-button" id="logoutBtn" onclick="logout()">Logout</button>
      </div>
      
      <div class="form-group">
        <label>Desired User ID:</label>
        <input type="text" id="registerUserId" placeholder="e.g., myuser123">
      </div>
      <div class="form-group">
        <label>Email (optional):</label>
        <input type="email" id="registerEmail" placeholder="e.g., user@example.com">
      </div>
      <div class="form-group">
        <label>Password:</label>
        <input type="password" id="registerPassword" placeholder="Enter password">
      </div>
      <button class="auth-button" onclick="registerUser()">Register</button>
      
      <div class="form-group" style="margin-top: 20px;">
        <label>User ID:</label>
        <input type="text" id="loginUserId" placeholder="e.g., myuser123">
      </div>
      <div class="form-group">
        <label>Password:</label>
        <input type="password" id="loginPassword" placeholder="Enter password">
      </div>
      <button class="auth-button" onclick="loginUser()">Login</button>
    </div>
    
    <div class="user-management service-section">
      <h2>👤 User Management</h2>
      <p>View and manage your mappings</p>
      
      <div class="form-group">
        <label>Your User ID:</label>
        <input type="text" id="manageUserId" disabled>
      </div>
      
      <button onclick="viewUserMappings()" disabled>View My Mappings</button>
      
      <div id="userMappingsResult" class="result">
        <p><strong>Your Mappings:</strong></p>
        <div id="mappingsList"></div>
      </div>
    </div>
    
    <div class="service-section">
      <h2>1. 📄 Unified URL Mapping System</h2>
      <div class="form-group">
        <label>Target URL to map:</label>
        <input type="url" id="targetUrl" placeholder="e.g., https://example.com/data.json" disabled>
      </div>
      <div class="form-group">
        <label>Your User ID:</label>
        <input type="text" id="userId" disabled>
      </div>
      <div class="form-group">
        <label>Custom Path:</label>
        <input type="text" id="customPath" placeholder="e.g., my-api-endpoint" disabled>
      </div>
      <button onclick="createUserMapping()" disabled>Create Custom Mapping</button>
      
      <div id="mappingResult" class="result">
        <p><strong>Your Custom Mapping:</strong></p>
        <p><a id="mappingUrl" href="#" target="_blank"></a></p>
        <p>Mapping Key: <span id="mappingKeyDisplay"></span></p>
      </div>
    </div>
    
    <div class="service-section">
      <h2>2. ✍️ Text Content Mapping</h2>
      <div class="form-group">
        <label>Content:</label>
        <textarea id="persistentContent" placeholder="Enter text content here..." disabled></textarea>
      </div>
      <div class="form-group">
        <label>File Name:</label>
        <input type="text" id="persistentFilename" value="config.txt" disabled>
      </div>
      <div class="form-group">
        <label>Your User ID:</label>
        <input type="text" id="textUserId" disabled>
      </div>
      <div class="form-group">
        <label>Custom Path:</label>
        <input type="text" id="textCustomPath" disabled>
      </div>
      <button onclick="createPersistentText()" disabled>Create Text Mapping</button>
      
      <div id="persistentTextResult" class="result">
        <p><strong>Text Mapping URL:</strong></p>
        <p><a id="persistentTextUrl" href="#" target="_blank"></a></p>
      </div>
    </div>
    
    <div class="service-section">
      <h2>3. 📱 QR Code Generator</h2>
      <div class="form-group">
        <label>URL:</label>
        <input type="url" id="qrcodeUrl" placeholder="Enter URL" disabled>
      </div>
      <button onclick="generateQRCode()" disabled>Generate QR Code</button>
      <div id="qrcodeResult" class="result">
        <div id="qrcodeContainer" style="display:flex; justify-content:center; margin:10px 0;"></div>
      </div>
    </div>

    <div class="instructions">
      <h2>How to Use</h2>
      <ol>
        <li>Register or Login first.</li>
        <li>Choose a service (URL Map or Text Content).</li>
        <li>Fill in the fields and click Create.</li>
        <li>Manage your links in the User Management section.</li>
      </ol>
    </div>
  </div>

  <script>
    // --- Global State ---
    let currentUser = null;

    // --- Initialization ---
    document.addEventListener('DOMContentLoaded', function() {
      const savedUser = localStorage.getItem('currentUser');
      if (savedUser) {
        try {
          currentUser = JSON.parse(savedUser);
          updateAuthStatus(true);
        } catch(e) {
          console.error('Auth Error', e);
          localStorage.removeItem('currentUser');
          updateAuthStatus(false);
        }
      } else {
        updateAuthStatus(false);
      }
    });

    // --- UI Helpers ---
    function updateAuthStatus(isAuthenticated) {
      const authStatusDiv = document.getElementById('authStatus');
      const authStatusText = document.getElementById('authStatusText');
      const logoutBtn = document.getElementById('logoutBtn');
      
      // Elements to enable/disable
      const inputs = [
        'manageUserId', 'userId', 'targetUrl', 'customPath',
        'persistentContent', 'persistentFilename', 'textUserId', 'textCustomPath',
        'qrcodeUrl'
      ];
      
      const actionButtons = document.querySelectorAll('button:not(.auth-button):not(.logout-button)');

      if (isAuthenticated && currentUser) {
        // --- LOGGED IN STATE ---
        authStatusDiv.className = 'auth-status authenticated';
        authStatusText.textContent = 'Logged in as: ' + currentUser.userId;
        logoutBtn.style.display = 'block';
        
        // Auto-fill User IDs
        document.getElementById('manageUserId').value = currentUser.userId;
        document.getElementById('userId').value = currentUser.userId;
        document.getElementById('textUserId').value = currentUser.userId;
        
        // Enable inputs
        inputs.forEach(id => {
          const el = document.getElementById(id);
          if(el) el.disabled = false;
        });

        // Enable action buttons
        actionButtons.forEach(btn => btn.disabled = false);

      } else {
        // --- LOGGED OUT STATE ---
        authStatusDiv.className = 'auth-status unauthenticated';
        authStatusText.textContent = 'Not logged in. Please register or login.';
        logoutBtn.style.display = 'none';
        
        // Clear User IDs
        document.getElementById('manageUserId').value = '';
        document.getElementById('userId').value = '';
        document.getElementById('textUserId').value = '';
        
        // Disable inputs
        inputs.forEach(id => {
          const el = document.getElementById(id);
          if(el) el.disabled = true;
        });

        // Disable action buttons
        actionButtons.forEach(btn => btn.disabled = true);
      }
      
      authStatusDiv.style.display = 'block';
    }

    // --- Auth Functions ---
    async function registerUser() {
      const userId = document.getElementById('registerUserId').value;
      const email = document.getElementById('registerEmail').value;
      const password = document.getElementById('registerPassword').value;
      
      if (!userId || !password) return alert('User ID and password are required');
      
      try {
        const formData = new FormData();
        formData.append('userId', userId);
        if (email) formData.append('email', email);
        formData.append('password', password);
        
        const response = await fetch('/auth/register', { method: 'POST', body: formData });
        const data = await response.json();
        
        if (data.success) {
          alert('Registration successful! Please login.');
          document.getElementById('registerPassword').value = '';
        } else {
          alert('Registration failed: ' + data.error);
        }
      } catch (e) {
        alert('System Error: ' + e.message);
      }
    }

    async function loginUser() {
      const userId = document.getElementById('loginUserId').value;
      const password = document.getElementById('loginPassword').value;
      
      if (!userId || !password) return alert('Missing credentials');
      
      try {
        const formData = new FormData();
        formData.append('userId', userId);
        formData.append('password', password);
        
        const response = await fetch('/auth/login', { method: 'POST', body: formData });
        const data = await response.json();
        
        if (data.success) {
          currentUser = { userId: userId };
          localStorage.setItem('currentUser', JSON.stringify(currentUser));
          updateAuthStatus(true);
          alert('Login successful!');
          document.getElementById('loginPassword').value = '';
        } else {
          alert('Login failed: ' + data.error);
        }
      } catch (e) {
        alert('System Error: ' + e.message);
      }
    }

    function logout() {
      currentUser = null;
      localStorage.removeItem('currentUser');
      updateAuthStatus(false);
      alert('Logged out.');
    }

    // --- Core Features ---
    async function createUserMapping() {
      if (!currentUser) return alert('Please login first');
      
      const targetUrl = document.getElementById('targetUrl').value;
      const userId = document.getElementById('userId').value;
      const customPath = document.getElementById('customPath').value;
      
      if (!targetUrl || !customPath) return alert('Missing fields');
      
      try {
        const formData = new FormData();
        formData.append('originalUrl', targetUrl);
        formData.append('userId', userId);
        formData.append('customPath', customPath);
        
        const response = await fetch('/api/create-user-mapping', { method: 'POST', body: formData });
        const data = await response.json();
        
        if (data.success) {
          const resultDiv = document.getElementById('mappingResult');
          const link = document.getElementById('mappingUrl');
          link.href = data.mappedUrl;
          link.textContent = data.mappedUrl;
          document.getElementById('mappingKeyDisplay').textContent = data.mappingKey;
          resultDiv.classList.add('show');
          addQRCodeToElement('mappingUrl');
        } else {
          alert('Error: ' + data.error);
        }
      } catch (e) {
        alert('Error: ' + e.message);
      }
    }

    async function createPersistentText() {
      if (!currentUser) return alert('Please login first');
      
      const content = document.getElementById('persistentContent').value;
      const filename = document.getElementById('persistentFilename').value;
      const userId = document.getElementById('textUserId').value;
      const customPath = document.getElementById('textCustomPath').value;
      
      if (!content || !filename || !customPath) return alert('Missing fields');
      
      try {
        const formData = new FormData();
        formData.append('content', content);
        formData.append('filename', filename);
        formData.append('userId', userId);
        formData.append('customPath', customPath);
        
        const response = await fetch('/api/create-persistent-text', { method: 'POST', body: formData });
        const data = await response.json();
        
        if (data.success) {
          const resultDiv = document.getElementById('persistentTextResult');
          const link = document.getElementById('persistentTextUrl');
          link.href = data.persistentUrl;
          link.textContent = data.persistentUrl;
          resultDiv.classList.add('show');
          addQRCodeToElement('persistentTextUrl');
        } else {
          alert('Error: ' + data.error);
        }
      } catch (e) {
        alert('Error: ' + e.message);
      }
    }

    // --- Viewing & Deleting (The Fixed Part) ---
    async function viewUserMappings() {
      if (!currentUser) return alert('Please login first');
      
      try {
        const response = await fetch(\`/api/user/\${encodeURIComponent(currentUser.userId)}/mappings\`);
        const data = await response.json();
        
        if (data.success) {
          const listDiv = document.getElementById('mappingsList');
          listDiv.innerHTML = '';
          
          if (data.mappings.length === 0) {
            listDiv.innerHTML = '<p>No mappings found.</p>';
          } else {
            data.mappings.forEach(mapping => {
              const item = document.createElement('div');
              item.className = 'mapping-item';
              
              // FIX: Using Template Literals with escaped backticks for Worker environment
              item.innerHTML = \`
                <div>
                  <strong>Path:</strong> \${mapping.customPath}<br>
                  <strong>Type:</strong> \${mapping.type}<br>
                  <strong>Created:</strong> \${new Date(mapping.createdAt).toLocaleString()}<br>
                  <div style="margin-top:5px;">
                    <a href="/m/\${currentUser.userId}/\${mapping.customPath}" target="_blank" style="margin-right:10px;">Open</a>
                    <button class="delete-btn" onclick="deleteMapping('\${currentUser.userId}', '\${mapping.customPath}')">Delete</button>
                  </div>
                </div>
              \`;
              listDiv.appendChild(item);
            });
          }
          document.getElementById('userMappingsResult').classList.add('show');
        } else {
          alert('Error: ' + data.error);
        }
      } catch (e) {
        alert('Fetch Error: ' + e.message);
      }
    }

    async function deleteMapping(userId, path) {
      if (!currentUser) return alert('Please login first');
      if (!confirm(\`Are you sure you want to delete mapping: \${path}?\`)) return;
      
      try {
        const response = await fetch(\`/api/user/\${encodeURIComponent(userId)}/mappings/\${encodeURIComponent(path)}/delete\`, { method: 'DELETE' });
        const data = await response.json();
        
        if (data.success) {
          alert('Deleted successfully');
          viewUserMappings(); // Refresh list
        } else {
          alert('Error: ' + data.error);
        }
      } catch (e) {
        alert('Delete Error: ' + e.message);
      }
    }

    // --- QR Code ---
    function generateQRCode() {
      if (!currentUser) return alert('Please login first');
      const url = document.getElementById('qrcodeUrl').value;
      if (!url) return alert('Enter URL');
      
      try {
        new URL(url); // Validate
        const img = document.createElement('img');
        img.src = '/qrcode/generate?url=' + encodeURIComponent(url);
        img.style.maxWidth = '300px';
        
        const container = document.getElementById('qrcodeContainer');
        container.innerHTML = '';
        container.appendChild(img);
        document.getElementById('qrcodeResult').classList.add('show');
      } catch (e) {
        alert('Invalid URL');
      }
    }

    function addQRCodeToElement(elementId) {
      const element = document.getElementById(elementId);
      // Remove existing QR button if any to prevent duplicates
      if (element.nextSibling && element.nextSibling.tagName === 'BUTTON') {
        element.nextSibling.remove();
      }
      
      if (element && element.href) {
        const qrButton = document.createElement('button');
        qrButton.textContent = 'QR';
        qrButton.style.marginLeft = '10px';
        qrButton.style.padding = '2px 8px';
        qrButton.style.fontSize = '12px';
        qrButton.onclick = function() {
          window.open('/qrcode/generate?url=' + encodeURIComponent(element.href), '_blank');
        };
        element.parentNode.appendChild(qrButton);
      }
    }

    // --- Expose functions to window for HTML onclick attributes ---
    window.registerUser = registerUser;
    window.loginUser = loginUser;
    window.logout = logout;
    window.createUserMapping = createUserMapping;
    window.createPersistentText = createPersistentText;
    window.viewUserMappings = viewUserMappings;
    window.deleteMapping = deleteMapping;
    window.generateQRCode = generateQRCode;

  </script>
</body>
</html>`;
}

// --- Helper Functions for API Logic ---

async function handleCreateUserMapping(request, env) {
  if (request.method === 'OPTIONS') {
    return handleCorsPreflight();
  }
  
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }
  
  // Check if KV namespace is available
  if (!env.URL_MAPPER_KV) {
    return new Response(JSON.stringify({ 
      error: 'KV namespace not configured. Please set up URL_MAPPER_KV in your environment.' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    const formData = await request.formData();
    const originalUrl = formData.get('originalUrl');
    const userId = formData.get('userId');
    const customPath = formData.get('customPath');
    
    if (!originalUrl) {
      return new Response(JSON.stringify({ error: 'Original URL is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (!userId) {
      return new Response(JSON.stringify({ error: 'User ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (!customPath) {
      return new Response(JSON.stringify({ error: 'Custom path is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Validate the original URL
    try {
      new URL(originalUrl);
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid original URL' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Create the mapping key in the format: user:{userId}:path:{customPath}
    const mappingKey = 'user:' + userId + ':path:' + customPath;
    
    // Check if this mapping already exists
    const existingMapping = await env.URL_MAPPER_KV.get(mappingKey);
    if (existingMapping) {
      return new Response(JSON.stringify({ 
        error: 'A mapping with this user ID and custom path already exists' 
      }), {
        status: 409, // Conflict
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Store the original URL in KV with the mapping key
    const mappingData = {
      originalUrl: originalUrl,
      userId: userId,
      customPath: customPath,
      createdAt: new Date().toISOString(),
      type: 'url_mapping'
    };
    
    await env.URL_MAPPER_KV.put(mappingKey, JSON.stringify(mappingData));
    
    // Add this mapping to the user's list of mappings
    // First get the current list of mappings for this user
    const userMappingsListKey = 'user:' + userId + ':mappings:list';
    let userMappingsList = [];
    const existingList = await env.URL_MAPPER_KV.get(userMappingsListKey);
    if (existingList) {
      userMappingsList = JSON.parse(existingList);
    }
    
    // Add the new mapping to the list
    userMappingsList.push({
      mappingKey: mappingKey,
      customPath: customPath,
      createdAt: new Date().toISOString(),
      type: 'url_mapping'
    });
    
    // Update the user's list of mappings
    await env.URL_MAPPER_KV.put(userMappingsListKey, JSON.stringify(userMappingsList));
    
    // Derive the base URL from the request
    const url = new URL(request.url);
    const baseUrl = url.protocol + '//' + url.host;
    
    // Create the mapped URL
    const mappedUrl = baseUrl + '/m/' + userId + '/' + customPath;
    
    return new Response(JSON.stringify({
      success: true,
      mappedUrl: mappedUrl,
      mappingKey: mappingKey,
      userId: userId,
      customPath: customPath,
      originalUrl: originalUrl,
      message: 'User-defined mapping created successfully'
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error('Error creating user mapping:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function handleCreatePersistentText(request, env) {
  if (request.method === 'OPTIONS') {
    return handleCorsPreflight();
  }
  
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }
  
  // Check if KV namespace is available
  if (!env.URL_MAPPER_KV) {
    return new Response(JSON.stringify({ 
      error: 'KV namespace not configured. Please set up URL_MAPPER_KV in your environment.' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    const formData = await request.formData();
    const content = formData.get('content');
    const filename = formData.get('filename') || 'text-content.txt';
    const userId = formData.get('userId');
    const customPath = formData.get('customPath');
    
    if (!content) {
      return new Response(JSON.stringify({ error: 'Content is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (!userId) {
      return new Response(JSON.stringify({ error: 'User ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (!customPath) {
      return new Response(JSON.stringify({ error: 'Custom path is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
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
    
    // Create the mapping key in the format: user:{userId}:path:{customPath}
    const mappingKey = 'user:' + userId + ':path:' + customPath;
    
    // Check if this mapping already exists
    const existingMapping = await env.URL_MAPPER_KV.get(mappingKey);
    if (existingMapping) {
      return new Response(JSON.stringify({ 
        error: 'A mapping with this user ID and customPath already exists' 
      }), {
        status: 409, // Conflict
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Store the content and metadata in KV with the mapping key
    const storedData = {
      content: content,
      filename: filename,
      contentType: contentType,
      userId: userId,
      customPath: customPath,
      createdAt: new Date().toISOString(),
      type: 'text_content'
    };
    
    await env.URL_MAPPER_KV.put(mappingKey, JSON.stringify(storedData));
    
    // Add this mapping to the user's list of mappings
    // First get the current list of mappings for this user
    const userMappingsListKey = 'user:' + userId + ':mappings:list';
    let userMappingsList = [];
    const existingList = await env.URL_MAPPER_KV.get(userMappingsListKey);
    if (existingList) {
      userMappingsList = JSON.parse(existingList);
    }
    
    // Add the new mapping to the list
    userMappingsList.push({
      mappingKey: mappingKey,
      customPath: customPath,
      createdAt: new Date().toISOString(),
      type: 'text_content'
    });
    
    // Update the user's list of mappings
    await env.URL_MAPPER_KV.put(userMappingsListKey, JSON.stringify(userMappingsList));
    
    // Derive the base URL from the request
    const url = new URL(request.url);
    const baseUrl = url.protocol + '//' + url.host;
    
    // Create the persistent URL
    const persistentUrl = baseUrl + '/m/' + userId + '/' + customPath;
    
    return new Response(JSON.stringify({
      success: true,
      persistentUrl: persistentUrl,
      mappingKey: mappingKey,
      userId: userId,
      customPath: customPath,
      filename: filename,
      contentType: contentType,
      message: 'User-defined text content mapping created successfully'
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error('Error creating user-defined text content:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function handleGetUserMappings(request, env, path) {
  if (request.method === 'OPTIONS') {
    return handleCorsPreflight();
  }
  
  // Extract userId from the path: /api/user/{userId}/mappings
  const pathParts = path.split('/');
  if (pathParts.length < 5 || pathParts[2] !== 'user' || pathParts[4] !== 'mappings') {
    return new Response(JSON.stringify({ error: 'Invalid path format' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const userId = pathParts[3];
  
  if (!userId) {
    return new Response(JSON.stringify({ error: 'User ID is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    // Get the user's list of mappings
    const userMappingsListKey = 'user:' + userId + ':mappings:list';
    const userMappingsListJson = await env.URL_MAPPER_KV.get(userMappingsListKey);
    
    if (!userMappingsListJson) {
      return new Response(JSON.stringify({
        success: true,
        mappings: [],
        message: 'No mappings found for this user'
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
    
    const userMappingsList = JSON.parse(userMappingsListJson);
    
    // Get detailed information for each mapping
    const detailedMappings = [];
    for (const mappingRef of userMappingsList) {
      const mappingDataJson = await env.URL_MAPPER_KV.get(mappingRef.mappingKey);
      if (mappingDataJson) {
        const mappingData = JSON.parse(mappingDataJson);
        
        let contentPreview = '';
        if (mappingData.type === 'url_mapping') {
          // Limit the preview length
          contentPreview = mappingData.originalUrl.length > 100 ? 
            mappingData.originalUrl.substring(0, 100) + '...' : 
            mappingData.originalUrl;
        } else if (mappingData.type === 'text_content') {
          // Limit the preview length
          contentPreview = mappingData.content.length > 100 ? 
            mappingData.content.substring(0, 100) + '...' : 
            mappingData.content.substring(0, Math.min(100, mappingData.content.length));
        }
        
        detailedMappings.push({
          ...mappingData,
          contentPreview: contentPreview,
          mappingKey: mappingRef.mappingKey,
          createdAt: mappingRef.createdAt
        });
      }
    }
    
    return new Response(JSON.stringify({
      success: true,
      mappings: detailedMappings,
      count: detailedMappings.length
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error('Error fetching user mappings:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function handleDeleteUserMapping(request, env, path) {
  if (request.method === 'OPTIONS') {
    return handleCorsPreflight();
  }
  
  // Extract userId and customPath from the path: /api/user/{userId}/mappings/{customPath}/delete
  const pathParts = path.split('/');
  if (pathParts.length < 6 || pathParts[2] !== 'user' || pathParts[4] !== 'mappings' || pathParts[5] === 'delete') {
    // Handle the case where 'delete' is part of the customPath
    if (pathParts[pathParts.length - 1] === 'delete') {
      const userId = pathParts[3];
      const customPath = pathParts.slice(5, pathParts.length - 1).join('/'); // Everything between 'mappings' and 'delete'
      
      return performDelete(env, userId, customPath);
    } else {
      return new Response(JSON.stringify({ error: 'Invalid path format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
  
  const userId = pathParts[3];
  const customPath = pathParts[5]; // The path part after 'mappings'
  
  return performDelete(env, userId, customPath);
}

async function performDelete(env, userId, customPath) {
  if (!userId || !customPath) {
    return new Response(JSON.stringify({ error: 'User ID and custom path are required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    // Create the mapping key in the format: user:{userId}:path:{customPath}
    const mappingKey = 'user:' + userId + ':path:' + customPath;
    
    // Check if the mapping exists
    const existingMapping = await env.URL_MAPPER_KV.get(mappingKey);
    if (!existingMapping) {
      return new Response(JSON.stringify({ error: 'Mapping not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Delete the mapping
    await env.URL_MAPPER_KV.delete(mappingKey);
    
    // Remove the mapping from the user's list
    const userMappingsListKey = 'user:' + userId + ':mappings:list';
    const userMappingsListJson = await env.URL_MAPPER_KV.get(userMappingsListKey);
    
    if (userMappingsListJson) {
      let userMappingsList = JSON.parse(userMappingsListJson);
      
      // Filter out the mapping that was deleted
      userMappingsList = userMappingsList.filter(item => item.mappingKey !== mappingKey);
      
      // Update the user's list of mappings
      await env.URL_MAPPER_KV.put(userMappingsListKey, JSON.stringify(userMappingsList));
    }
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Mapping deleted successfully'
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error('Error deleting user mapping:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function handleRegister(request, env) {
  if (request.method === 'OPTIONS') {
    return handleCorsPreflight();
  }
  
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }
  
  try {
    const formData = await request.formData();
    const userId = formData.get('userId');
    const email = formData.get('email');
    const password = formData.get('password');
    
    if (!userId || !password) {
      return new Response(JSON.stringify({ error: 'User ID and password are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Validate userId format (only alphanumeric, hyphens, and underscores)
    if (!/^[a-zA-Z0-9_-]+$/.test(userId)) {
      return new Response(JSON.stringify({ error: 'User ID can only contain letters, numbers, hyphens, and underscores' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Check if user already exists
    const userExists = await env.URL_MAPPER_KV.get('user:' + userId + ':profile');
    if (userExists) {
      return new Response(JSON.stringify({ error: 'User ID already exists' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Hash the password (using a simple approach for now)
    const hashedPassword = await hashPassword(password);
    
    // Store user profile
    const userProfile = {
      userId: userId,
      email: email || null,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString()
    };
    
    await env.URL_MAPPER_KV.put('user:' + userId + ':profile', JSON.stringify(userProfile));
    
    // Store user credentials
    const userCredentials = {
      userId: userId,
      hashedPassword: hashedPassword,
      updatedAt: new Date().toISOString()
    };
    
    await env.URL_MAPPER_KV.put('user:' + userId + ':credentials', JSON.stringify(userCredentials));
    
    return new Response(JSON.stringify({
      success: true,
      message: 'User registered successfully',
      userId: userId
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error('Error registering user:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function handleLogin(request, env) {
  if (request.method === 'OPTIONS') {
    return handleCorsPreflight();
  }
  
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }
  
  try {
    const formData = await request.formData();
    const userId = formData.get('userId');
    const password = formData.get('password');
    
    if (!userId || !password) {
      return new Response(JSON.stringify({ error: 'User ID and password are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Get stored credentials
    const storedCredentialsJson = await env.URL_MAPPER_KV.get('user:' + userId + ':credentials');
    if (!storedCredentialsJson) {
      return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const storedCredentials = JSON.parse(storedCredentialsJson);
    const hashedInputPassword = await hashPassword(password);
    
    // Compare passwords
    if (storedCredentials.hashedPassword !== hashedInputPassword) {
      return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Update last login time
    const userProfileJson = await env.URL_MAPPER_KV.get('user:' + userId + ':profile');
    if (userProfileJson) {
      const userProfile = JSON.parse(userProfileJson);
      userProfile.lastLoginAt = new Date().toISOString();
      await env.URL_MAPPER_KV.put('user:' + userId + ':profile', JSON.stringify(userProfile));
    }
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Login successful',
      userId: userId
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error('Error logging in user:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function hashPassword(password) {
  // Simple hashing using Web Crypto API (in a real app, use a more secure method)
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function handleQrCodeGeneration(request) {
  if (request.method === 'OPTIONS') {
    return handleCorsPreflight();
  }
  
  const url = new URL(request.url);
  const targetUrl = url.searchParams.get('url');
  
  if (!targetUrl) {
    return new Response('URL parameter is required', {
      status: 400,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
  
  try {
    // Generate a QR code URL using a public QR code API
    // Note: In a production environment, you might want to generate QR codes directly in the worker
    const qrApiUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(targetUrl);
    const qrResponse = await fetch(qrApiUrl);
    
    if (!qrResponse.ok) {
      throw new Error('Failed to generate QR code');
    }
    
    return new Response(qrResponse.body, {
      headers: {
        'Content-Type': 'image/png',
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

function handleAccessControlPage() {
  const accessControlPage = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin Access Control Panel</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
      color: #333;
    }
    .container {
      background: white;
      border-radius: 10px;
      padding: 30px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    h1 {
      color: #d9534f;
      text-align: center;
    }
    .warning {
      background: #fff3cd;
      border: 1px solid #ffeaa7;
      color: #856404;
      padding: 15px;
      border-radius: 5px;
      margin: 20px 0;
    }
    .form-group {
      margin-bottom: 15px;
    }
    label {
      display: block;
      margin-bottom: 5px;
      font-weight: bold;
    }
    input[type="password"], select {
      width: 100%;
      padding: 8px;
      border: 1px solid #ccc;
      border-radius: 4px;
      box-sizing: border-box;
    }
    button {
      background-color: #d9534f;
      color: white;
      padding: 10px 15px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 16px;
    }
    button:hover {
      background-color: #c9302c;
    }
    .success {
      background: #d4edda;
      border: 1px solid #c3e6c3;
      color: #155724;
      padding: 10px;
      border-radius: 4px;
      margin: 10px 0;
    }
    .error {
      background: #f8d7da;
      border: 1px solid #f5c6cb;
      color: #721c24;
      padding: 10px;
      border-radius: 4px;
      margin: 10px 0;
    }
    .access-list {
      margin-top: 20px;
      padding: 15px;
      background-color: #f8f9fa;
      border-radius: 5px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔐 Admin Access Control</h1>
    <div class="warning">
      <strong>Warning:</strong> This feature is not fully implemented in the current version. 
      The access control functionality requires additional backend implementation.
    </div>
    
    <h2>Configure Access Settings</h2>
    <p>Set up authentication requirements for this service:</p>
    
    <div class="form-group">
      <label for="accessLevel">Access Level:</label>
      <select id="accessLevel">
        <option value="public">Public Access (No Authentication)</option>
        <option value="registered-users">Registered Users Only</option>
        <option value="whitelist">Whitelisted Users Only</option>
        <option value="private">Private (Admin Only)</option>
      </select>
    </div>
    
    <div class="form-group">
      <label for="adminPassword">Admin Password:</label>
      <input type="password" id="adminPassword" placeholder="Enter admin password to apply changes">
    </div>
    
    <button onclick="applySettings()">Apply Settings</button>
    
    <div id="resultMessage"></div>
    
    <div class="access-list">
      <h3>Current Access Configuration</h3>
      <p><strong>Status:</strong> Currently, this service allows public access with optional user registration.</p>
      <p><strong>Requirements:</strong> Users can register accounts to create personalized mappings.</p>
      <p><strong>Security:</strong> All mappings are identified by user ID, providing basic separation between users.</p>
    </div>
    
    <div style="margin-top: 30px; text-align: center; color: #6c757d;">
      <p>Note: Full access control features require additional configuration in the Worker environment variables.</p>
      <p><a href="/">← Back to Main Page</a></p>
    </div>
  </div>
  
  <script>
    function applySettings() {
      const accessLevel = document.getElementById('accessLevel').value;
      const adminPassword = document.getElementById('adminPassword').value;
      
      if (!adminPassword) {
        showMessage('Please enter the admin password to apply changes.', 'error');
        return;
      }
      
      // In a real implementation, this would make an API call to save settings
      // For now, we'll just simulate the action
      setTimeout(() => {
        showMessage(
          'Access control settings would be applied in a complete implementation.\\n' +
          'Current selection: ' + accessLevel + '\\n' +
          'This requires additional backend and configuration changes.',
          'success'
        );
      }, 500);
    }
    
    function showMessage(text, type) {
      const resultDiv = document.getElementById('resultMessage');
      resultDiv.textContent = text;
      resultDiv.className = type;
      resultDiv.style.display = 'block';
    }
  </script>
</body>
</html>`;
  
  return new Response(accessControlPage, {
    headers: {
      'Content-Type': 'text/html',
    }
  });
}

function handleCorsPreflight() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
