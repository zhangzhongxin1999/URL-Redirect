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
    // Updated API endpoints to remove user-specific restrictions
    else if (path.startsWith('/api/')) {
      // Import and handle API routes dynamically
      if (path === '/api/create-url-mapping') {
        if (request.method === 'POST') {
          return handleCreateUrlMapping(request, env);
        } else if (request.method === 'OPTIONS') {
          return handleCorsPreflight();
        }
      } else if (path === '/api/create-text-mapping') {
        if (request.method === 'POST') {
          return handleCreateTextMapping(request, env);
        } else if (request.method === 'OPTIONS') {
          return handleCorsPreflight();
        }
      } else if (path === '/api/list-mappings') {
        if (request.method === 'GET') {
          return handleListAllMappings(request, env);
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
    // Handle admin routes
    else if (path.startsWith('/admin/')) {
      if (path === '/admin') {
        if (request.method === 'GET') {
          return handleAdminPage();
        } else if (request.method === 'POST') {
          return handleAdminAction(request, env);
        } else if (request.method === 'OPTIONS') {
          return handleCorsPreflight();
        }
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

// --- HTML Content Generation (Simplified version without auth) ---
function getHtmlPage() {
  // 注意：在 Worker 的字符串中，客户端 JS 的反引号 ` 和变量符号 $ 需要转义
  // 以防止后端 JS 尝试解析它们。
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Universal Content Proxy</title>
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
    input[type="text"], input[type="url"], textarea {
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
    .instructions {
      margin-top: 20px;
    }
    .admin-link {
      text-align: center;
      margin-top: 20px;
      padding: 10px;
      font-size: 14px;
    }
    .admin-link a {
      color: #2c6bed;
      text-decoration: none;
    }
    .admin-link a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔄 Universal Content Proxy</h1>
    
    <div class="warning">
      <strong>🔒 Security Notice:</strong> All mappings are managed by administrator. For unauthorized access prevention.
    </div>
    
    <div class="service-section">
      <h2>1. 📄 URL Mapping System</h2>
      <div class="form-group">
        <label>Target URL to map:</label>
        <input type="url" id="targetUrl" placeholder="e.g., https://example.com/data.json">
      </div>
      <div class="form-group">
        <label>Custom Path:</label>
        <input type="text" id="customPath" placeholder="e.g., my-api-endpoint">
      </div>
      <button onclick="createUrlMapping()">Create URL Mapping</button>
      
      <div id="mappingResult" class="result">
        <p><strong>Created Mapping:</strong></p>
        <p><a id="mappingUrl" href="#" target="_blank"></a></p>
        <p>Mapping Key: <span id="mappingKeyDisplay"></span></p>
      </div>
    </div>
    
    <div class="service-section">
      <h2>2. ✍️ Text Content Mapping</h2>
      <div class="form-group">
        <label>Content:</label>
        <textarea id="persistentContent" placeholder="Enter text content here..."></textarea>
      </div>
      <div class="form-group">
        <label>File Name:</label>
        <input type="text" id="persistentFilename" value="config.txt" placeholder="e.g., config.json, script.js">
      </div>
      <div class="form-group">
        <label>Custom Path:</label>
        <input type="text" id="textCustomPath" placeholder="e.g., my-config, my-script">
      </div>
      <button onclick="createTextMapping()">Create Text Mapping</button>
      
      <div id="persistentTextResult" class="result">
        <p><strong>Text Mapping URL:</strong></p>
        <p><a id="persistentTextUrl" href="#" target="_blank"></a></p>
      </div>
    </div>
    
    <div class="service-section">
      <h2>3. 📱 QR Code Generator</h2>
      <div class="form-group">
        <label>URL:</label>
        <input type="url" id="qrcodeUrl" placeholder="Enter URL">
      </div>
      <button onclick="generateQRCode()">Generate QR Code</button>
      <div id="qrcodeResult" class="result">
        <div id="qrcodeContainer" style="display:flex; justify-content:center; margin:10px 0;"></div>
      </div>
    </div>

    <div class="instructions">
      <h2>How to Use</h2>
      <ol>
        <li>Choose a service (URL Map or Text Content).</li>
        <li>Fill in the required fields.</li>
        <li>Click the Create button.</li>
        <li>Use the generated link to access your content.</li>
      </ol>
    </div>
    
    <div class="admin-link">
      <p>Administrator access: <a href="/admin">Manage all mappings</a></p>
    </div>
  </div>

  <script>
    // --- Core Features ---
    async function createUrlMapping() {
      const targetUrl = document.getElementById('targetUrl').value;
      const customPath = document.getElementById('customPath').value;
      
      if (!targetUrl || !customPath) return alert('Please fill in all fields');
      
      try {
        const formData = new FormData();
        formData.append('originalUrl', targetUrl);
        formData.append('customPath', customPath);
        
        const response = await fetch('/api/create-url-mapping', { method: 'POST', body: formData });
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

    async function createTextMapping() {
      const content = document.getElementById('persistentContent').value;
      const filename = document.getElementById('persistentFilename').value;
      const customPath = document.getElementById('textCustomPath').value;
      
      if (!content || !filename || !customPath) return alert('Please fill in all fields');
      
      try {
        const formData = new FormData();
        formData.append('content', content);
        formData.append('filename', filename);
        formData.append('customPath', customPath);
        
        const response = await fetch('/api/create-text-mapping', { method: 'POST', body: formData });
        const data = await response.json();
        
        if (data.success) {
          const resultDiv = document.getElementById('persistentTextResult');
          const link = document.getElementById('persistentTextUrl');
          link.href = data.mappedUrl;
          link.textContent = data.mappedUrl;
          resultDiv.classList.add('show');
          addQRCodeToElement('persistentTextUrl');
        } else {
          alert('Error: ' + data.error);
        }
      } catch (e) {
        alert('Error: ' + e.message);
      }
    }

    // --- QR Code ---
    async function generateQRCode() {
      const url = document.getElementById('qrcodeUrl').value;
      if (!url) return alert('Please enter a URL');
      
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
    window.createUrlMapping = createUrlMapping;
    window.createTextMapping = createTextMapping;
    window.generateQRCode = generateQRCode;

  </script>
</body>
</html>`;
}
}
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

// Updated API endpoints to remove user-specific restrictions
else if (path.startsWith('/api/')) {
  // Import and handle API routes dynamically
  if (path === '/api/create-url-mapping') {
    if (request.method === 'POST') {
      return handleCreateUrlMapping(request, env);
    } else if (request.method === 'OPTIONS') {
      return handleCorsPreflight();
    }
  } else if (path === '/api/create-text-mapping') {
    if (request.method === 'POST') {
      return handleCreateTextMapping(request, env);
    } else if (request.method === 'OPTIONS') {
      return handleCorsPreflight();
    }
  } else if (path === '/api/list-mappings') {
    if (request.method === 'GET') {
      return handleListAllMappings(request, env);
    } else if (request.method === 'OPTIONS') {
      return handleCorsPreflight();
    }
  }
}

// Handle admin routes
else if (path.startsWith('/admin/')) {
  if (path === '/admin') {
    if (request.method === 'GET') {
      return handleAdminPage();
    } else if (request.method === 'POST') {
      return handleAdminAction(request, env);
    } else if (request.method === 'OPTIONS') {
      return handleCorsPreflight();
    }
  }
}

// Fallback to main page if no route matches
else {
  return new Response(getHtmlPage(), {
    headers: {
      'Content-Type': 'text/html',
    }
  });
}

// Helper functions for API endpoints
async function handleCreateUrlMapping(request, env) {
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
    const customPath = formData.get('customPath');
    
    if (!originalUrl) {
      return new Response(JSON.stringify({ error: 'Original URL is required' }), {
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
    
    // Generate a default user ID if not provided (using a random identifier)
    const userId = 'admin_' + Date.now().toString(36);
    
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
    
    // Add this mapping to the general list of mappings
    // First get the current list of mappings
    const allMappingsListKey = 'all_mappings_list';
    let allMappingsList = [];
    const existingList = await env.URL_MAPPER_KV.get(allMappingsListKey);
    if (existingList) {
      allMappingsList = JSON.parse(existingList);
    }
    
    // Add the new mapping to the list
    allMappingsList.push({
      mappingKey: mappingKey,
      customPath: customPath,
      createdAt: new Date().toISOString(),
      type: 'url_mapping'
    });
    
    // Update the general list of mappings
    await env.URL_MAPPER_KV.put(allMappingsListKey, JSON.stringify(allMappingsList));
    
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
      message: 'URL mapping created successfully'
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error('Error creating URL mapping:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function handleCreateTextMapping(request, env) {
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
    const customPath = formData.get('customPath');
    
    if (!content) {
      return new Response(JSON.stringify({ error: 'Content is required' }), {
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
    
    // Generate a default user ID if not provided (using a random identifier)
    const userId = 'admin_' + Date.now().toString(36);
    
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
    
    // Add this mapping to the general list of mappings
    // First get the current list of mappings
    const allMappingsListKey = 'all_mappings_list';
    let allMappingsList = [];
    const existingList = await env.URL_MAPPER_KV.get(allMappingsListKey);
    if (existingList) {
      allMappingsList = JSON.parse(existingList);
    }
    
    // Add the new mapping to the list
    allMappingsList.push({
      mappingKey: mappingKey,
      customPath: customPath,
      createdAt: new Date().toISOString(),
      type: 'text_content'
    });
    
    // Update the general list of mappings
    await env.URL_MAPPER_KV.put(allMappingsListKey, JSON.stringify(allMappingsList));
    
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
      filename: filename,
      contentType: contentType,
      message: 'Text content mapping created successfully'
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error('Error creating text content mapping:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function handleListAllMappings(request, env) {
  if (request.method === 'OPTIONS') {
    return handleCorsPreflight();
  }
  
  try {
    // Get the general list of mappings
    const allMappingsListKey = 'all_mappings_list';
    const allMappingsListJson = await env.URL_MAPPER_KV.get(allMappingsListKey);
    
    if (!allMappingsListJson) {
      return new Response(JSON.stringify({
        success: true,
        mappings: [],
        message: 'No mappings found'
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
    
    const allMappingsList = JSON.parse(allMappingsListJson);
    
    // Get detailed information for each mapping
    const detailedMappings = [];
    for (const mappingRef of allMappingsList) {
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
    console.error('Error fetching all mappings:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

function handleAdminPage() {
  const adminPage = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin Dashboard - URL Redirect</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      max-width: 1200px;
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
    .form-group {
      margin-bottom: 15px;
    }
    label {
      display: block;
      margin-bottom: 5px;
      font-weight: bold;
    }
    input[type="text"], input[type="url"], textarea, select {
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
      background-color: #d9534f;
      color: white;
      padding: 10px 15px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 16px;
      margin-right: 5px;
      margin-bottom: 5px;
    }
    button:hover {
      background-color: #c9302c;
    }
    .secondary-btn {
      background-color: #5bc0de;
    }
    .secondary-btn:hover {
      background-color: #46b8da;
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
    .mapping-list {
      margin-top: 20px;
    }
    .mapping-item {
      border: 1px solid #ddd;
      padding: 10px;
      margin: 10px 0;
      border-radius: 5px;
      background-color: #f9f9f9;
    }
    .delete-btn {
      background-color: #d9534f;
      color: white;
      border: none;
      padding: 5px 10px;
      border-radius: 3px;
      cursor: pointer;
      float: right;
    }
    .delete-btn:hover {
      background-color: #c9302c;
    }
    .refresh-btn {
      background-color: #5cb85c;
    }
    .refresh-btn:hover {
      background-color: #4cae4c;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 15px;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 8px;
      text-align: left;
    }
    th {
      background-color: #f2f2f2;
    }
    tr:nth-child(even) {
      background-color: #f9f9f9;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔐 Administrator Dashboard</h1>
    <p>Welcome to the administrator dashboard. Here you can manage all mappings in the KV store.</p>
    
    <div id="adminResult"></div>
    
    <h2>Add New Mapping</h2>
    <div class="form-group">
      <label>Mapping Type:</label>
      <select id="mappingType">
        <option value="url_mapping">URL Mapping</option>
        <option value="text_content">Text Content</option>
      </select>
    </div>
    
    <div id="urlMappingFields">
      <div class="form-group">
        <label>Target URL:</label>
        <input type="url" id="targetUrl" placeholder="https://example.com/data.json">
      </div>
      <div class="form-group">
        <label>Mapping Key (format: user:{userId}:path:{customPath}):</label>
        <input type="text" id="mappingKey" placeholder="user:myuser:path:myendpoint">
      </div>
    </div>
    
    <div id="textContentFields" style="display:none;">
      <div class="form-group">
        <label>Content:</label>
        <textarea id="textContent" placeholder="Enter text content here..."></textarea>
      </div>
      <div class="form-group">
        <label>Filename:</label>
        <input type="text" id="textFilename" value="config.txt" placeholder="e.g., config.json, script.js">
      </div>
      <div class="form-group">
        <label>Content Type:</label>
        <input type="text" id="contentType" value="text/plain" placeholder="e.g., application/json, text/javascript">
      </div>
      <div class="form-group">
        <label>Mapping Key (format: user:{userId}:path:{customPath}):</label>
        <input type="text" id="textMappingKey" placeholder="user:myuser:path:myendpoint">
      </div>
    </div>
    
    <button onclick="switchMappingType()">Switch Type</button>
    <button onclick="createMapping()">Create Mapping</button>
    
    <h2>Manage Existing Mappings</h2>
    <button class="refresh-btn" onclick="loadMappings()">Refresh Mappings List</button>
    <button class="secondary-btn" onclick="deleteAllMappings()">Delete All Mappings</button>
    
    <div id="mappingsList" class="mapping-list">
      <p>Loading mappings...</p>
    </div>
  </div>
  
  <script>
    let currentMappingType = 'url_mapping';
    
    function switchMappingType() {
      if (currentMappingType === 'url_mapping') {
        document.getElementById('urlMappingFields').style.display = 'none';
        document.getElementById('textContentFields').style.display = 'block';
        currentMappingType = 'text_content';
      } else {
        document.getElementById('urlMappingFields').style.display = 'block';
        document.getElementById('textContentFields').style.display = 'none';
        currentMappingType = 'url_mapping';
      }
    }
    
    async function createMapping() {
      try {
        if (currentMappingType === 'url_mapping') {
          const targetUrl = document.getElementById('targetUrl').value;
          const mappingKey = document.getElementById('mappingKey').value;
          
          if (!targetUrl || !mappingKey) {
            showMessage('Please fill in all fields', 'error');
            return;
          }
          
          // Validate URL
          new URL(targetUrl);
          
          // Validate mapping key format
          if (!isValidMappingKey(mappingKey)) {
            showMessage('Invalid mapping key format. Use format: user:{userId}:path:{customPath}', 'error');
            return;
          }
          
          const mappingData = {
            originalUrl: targetUrl,
            userId: extractUserIdFromKey(mappingKey),
            customPath: extractCustomPathFromKey(mappingKey),
            createdAt: new Date().toISOString(),
            type: 'url_mapping'
          };
          
          const response = await fetch('/admin', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              action: 'create',
              key: mappingKey,
              value: JSON.stringify(mappingData),
              type: currentMappingType
            })
          });
          
          const result = await response.json();
          if (result.success) {
            showMessage('Mapping created successfully!', 'success');
            document.getElementById('targetUrl').value = '';
            document.getElementById('mappingKey').value = '';
            loadMappings(); // Refresh the list
          } else {
            showMessage('Error: ' + result.error, 'error');
          }
        } else { // text_content
          const content = document.getElementById('textContent').value;
          const filename = document.getElementById('textFilename').value;
          const contentType = document.getElementById('contentType').value;
          const mappingKey = document.getElementById('textMappingKey').value;
          
          if (!content || !filename || !contentType || !mappingKey) {
            showMessage('Please fill in all fields', 'error');
            return;
          }
          
          // Validate mapping key format
          if (!isValidMappingKey(mappingKey)) {
            showMessage('Invalid mapping key format. Use format: user:{userId}:path:{customPath}', 'error');
            return;
          }
          
          const mappingData = {
            content: content,
            filename: filename,
            contentType: contentType,
            userId: extractUserIdFromKey(mappingKey),
            customPath: extractCustomPathFromKey(mappingKey),
            createdAt: new Date().toISOString(),
            type: 'text_content'
          };
          
          const response = await fetch('/admin', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              action: 'create',
              key: mappingKey,
              value: JSON.stringify(mappingData),
              type: currentMappingType
            })
          });
          
          const result = await response.json();
          if (result.success) {
            showMessage('Text mapping created successfully!', 'success');
            document.getElementById('textContent').value = '';
            document.getElementById('textFilename').value = 'config.txt';
            document.getElementById('contentType').value = 'text/plain';
            document.getElementById('textMappingKey').value = '';
            loadMappings(); // Refresh the list
          } else {
            showMessage('Error: ' + result.error, 'error');
          }
        }
      } catch (error) {
        showMessage('Error: ' + error.message, 'error');
      }
    }
    
    async function loadMappings() {
      try {
        const response = await fetch('/admin', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            action: 'list'
          })
        });
        
        const result = await response.json();
        if (result.success) {
          displayMappings(result.mappings);
        } else {
          showMessage('Error loading mappings: ' + result.error, 'error');
        }
      } catch (error) {
        showMessage('Error: ' + error.message, 'error');
      }
    }
    
    function displayMappings(mappings) {
      const container = document.getElementById('mappingsList');
      
      if (mappings.length === 0) {
        container.innerHTML = '<p>No mappings found.</p>';
        return;
      }
      
      // Create a table to display mappings
      let tableHTML = '<table><thead><tr><th>Key</th><th>Type</th><th>Details</th><th>Actions</th></tr></thead><tbody>';
      
      mappings.forEach(mapping => {
        let details = '';
        if (mapping.type === 'url_mapping') {
          details = \`<strong>URL:</strong> \${mapping.originalUrl}<br><strong>User:</strong> \${mapping.userId}<br><strong>Path:</strong> \${mapping.customPath}\`;
        } else if (mapping.type === 'text_content') {
          const contentPreview = mapping.content.length > 100 ? 
            mapping.content.substring(0, 100) + '...' : 
            mapping.content;
          details = \`<strong>Content:</strong> \${contentPreview}<br><strong>Filename:</strong> \${mapping.filename}<br><strong>Content-Type:</strong> \${mapping.contentType}\`;
        } else {
          details = \`<em>Unknown type: \${mapping.type}</em>\`;
        }
        
        tableHTML += \`
          <tr>
            <td>\${mapping.key}</td>
            <td>\${mapping.type}</td>
            <td>\${details}</td>
            <td><button class="delete-btn" onclick="deleteMapping('\${mapping.key}')">Delete</button></td>
          </tr>
        \`;
      });
      
      tableHTML += '</tbody></table>';
      container.innerHTML = tableHTML;
    }
    
    async function deleteMapping(key) {
      if (!confirm('Are you sure you want to delete mapping: ' + key + '?')) {
        return;
      }
      
      try {
        const response = await fetch('/admin', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            action: 'delete',
            key: key
          })
        });
        
        const result = await response.json();
        if (result.success) {
          showMessage('Mapping deleted successfully!', 'success');
          loadMappings(); // Refresh the list
        } else {
          showMessage('Error: ' + result.error, 'error');
        }
      } catch (error) {
        showMessage('Error: ' + error.message, 'error');
      }
    }
    
    async function deleteAllMappings() {
      if (!confirm('Are you absolutely sure you want to delete ALL mappings? This cannot be undone!')) {
        return;
      }
      
      try {
        const response = await fetch('/admin', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            action: 'delete_all'
          })
        });
        
        const result = await response.json();
        if (result.success) {
          showMessage('All mappings deleted successfully!', 'success');
          loadMappings(); // Refresh the list
        } else {
          showMessage('Error: ' + result.error, 'error');
        }
      } catch (error) {
        showMessage('Error: ' + error.message, 'error');
      }
    }
    
    function showMessage(text, type) {
      const resultDiv = document.getElementById('adminResult');
      resultDiv.innerHTML = '<div class="' + type + '">' + text + '</div>';
      
      // Auto-hide success messages after 5 seconds
      if (type === 'success') {
        setTimeout(() => {
          resultDiv.innerHTML = '';
        }, 5000);
      }
    }
    
    function isValidMappingKey(key) {
      // Check if key matches pattern: user:{userId}:path:{customPath}
      const regex = /^user:[a-zA-Z0-9_-]+:path:.+\$/;
      return regex.test(key);
    }
    
    function extractUserIdFromKey(key) {
      const parts = key.split(':');
      if (parts.length >= 2) {
        return parts[1]; // user:{userId}:path:...
      }
      return 'unknown';
    }
    
    function extractCustomPathFromKey(key) {
      const parts = key.split(':path:');
      if (parts.length >= 2) {
        return parts[1]; // ...:path:{customPath}
      }
      return 'unknown';
    }
    
    // Load mappings when page loads
    window.onload = function() {
      loadMappings();
    };
  </script>
</body>
</html>`;
  
  return new Response(adminPage, {
    headers: {
      'Content-Type': 'text/html',
    }
  });
}

async function handleAdminAction(request, env) {
  if (request.method === 'OPTIONS') {
    return handleCorsPreflight();
  }
  
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }
  
  try {
    const requestBody = await request.json();
    const action = requestBody.action;
    
    if (action === 'create') {
      // Create a new mapping
      const key = requestBody.key;
      const value = requestBody.value;
      const type = requestBody.type;
      
      if (!key || !value || !type) {
        return new Response(JSON.stringify({ error: 'Key, value, and type are required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Validate mapping key format
      if (!isValidMappingKey(key)) {
        return new Response(JSON.stringify({ error: 'Invalid mapping key format. Use format: user:{userId}:path:{customPath}' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Check if this mapping already exists
      const existingMapping = await env.URL_MAPPER_KV.get(key);
      if (existingMapping) {
        return new Response(JSON.stringify({ 
          error: 'A mapping with this key already exists' 
        }), {
          status: 409, // Conflict
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Store the mapping in KV
      await env.URL_MAPPER_KV.put(key, value);
      
      // Add this mapping to the general list of mappings
      const allMappingsListKey = 'all_mappings_list';
      let allMappingsList = [];
      const existingList = await env.URL_MAPPER_KV.get(allMappingsListKey);
      if (existingList) {
        allMappingsList = JSON.parse(existingList);
      }
      
      // Add the new mapping to the list
      const customPath = extractCustomPathFromKey(key);
      allMappingsList.push({
        mappingKey: key,
        customPath: customPath,
        createdAt: new Date().toISOString(),
        type: type
      });
      
      // Update the general list of mappings
      await env.URL_MAPPER_KV.put(allMappingsListKey, JSON.stringify(allMappingsList));
      
      return new Response(JSON.stringify({
        success: true,
        message: 'Mapping created successfully',
        key: key
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } 
    else if (action === 'list') {
      // List all mappings
      const allMappingsListKey = 'all_mappings_list';
      const allMappingsListJson = await env.URL_MAPPER_KV.get(allMappingsListKey);
      
      if (!allMappingsListJson) {
        return new Response(JSON.stringify({
          success: true,
          mappings: [],
          message: 'No mappings found'
        }), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
      
      const allMappingsList = JSON.parse(allMappingsListJson);
      
      // Get detailed information for each mapping
      const detailedMappings = [];
      for (const mappingRef of allMappingsList) {
        const mappingDataJson = await env.URL_MAPPER_KV.get(mappingRef.mappingKey);
        if (mappingDataJson) {
          const mappingData = JSON.parse(mappingDataJson);
          
          detailedMappings.push({
            ...mappingData,
            key: mappingRef.mappingKey,
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
    }
    else if (action === 'delete') {
      // Delete a specific mapping
      const key = requestBody.key;
      
      if (!key) {
        return new Response(JSON.stringify({ error: 'Key is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Check if the mapping exists
      const existingMapping = await env.URL_MAPPER_KV.get(key);
      if (!existingMapping) {
        return new Response(JSON.stringify({ error: 'Mapping not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Delete the mapping
      await env.URL_MAPPER_KV.delete(key);
      
      // Remove the mapping from the general list
      const allMappingsListKey = 'all_mappings_list';
      const allMappingsListJson = await env.URL_MAPPER_KV.get(allMappingsListKey);
      
      if (allMappingsListJson) {
        let allMappingsList = JSON.parse(allMappingsListJson);
        
        // Filter out the mapping that was deleted
        allMappingsList = allMappingsList.filter(item => item.mappingKey !== key);
        
        // Update the general list of mappings
        await env.URL_MAPPER_KV.put(allMappingsListKey, JSON.stringify(allMappingsList));
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
    }
    else if (action === 'delete_all') {
      // Delete all mappings
      // Get the list of all mappings
      const allMappingsListKey = 'all_mappings_list';
      const allMappingsListJson = await env.URL_MAPPER_KV.get(allMappingsListKey);
      
      if (allMappingsListJson) {
        const allMappingsList = JSON.parse(allMappingsListJson);
        
        // Delete each mapping
        for (const mappingRef of allMappingsList) {
          await env.URL_MAPPER_KV.delete(mappingRef.mappingKey);
        }
        
        // Clear the mappings list
        await env.URL_MAPPER_KV.put(allMappingsListKey, JSON.stringify([]));
      }
      
      return new Response(JSON.stringify({
        success: true,
        message: 'All mappings deleted successfully'
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
    else {
      return new Response(JSON.stringify({ error: 'Invalid action' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (error) {
    console.error('Error in admin action:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

function isValidMappingKey(key) {
  // Check if key matches pattern: user:{userId}:path:{customPath}
  const regex = /^user:[a-zA-Z0-9_-]+:path:.+$/;
  return regex.test(key);
}

function extractCustomPathFromKey(key) {
  const parts = key.split(':path:');
  if (parts.length >= 2) {
    return parts[1]; // ...:path:{customPath}
  }
  return 'unknown';
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
