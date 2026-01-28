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
    else if (path.startsWith('/admin')) {
      if (path === '/admin' || path === '/admin/') {
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
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>URL工具</title>
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
    <h1>🔄 通用内容代理</h1>
    
    <div class="warning">
      <strong>🔒 安全提示：</strong>所有映射均由管理员统一管理，防止未授权访问。
    </div>
    
    <div class="service-section">
      <h2>1. 📄 URL 映射</h2>
      <div class="form-group">
        <label>目标 URL 地址：</label>
        <input type="url" id="targetUrl" placeholder="例如：https://example.com/data.json">
      </div>
      <div class="form-group">
        <label>自定义路径：</label>
        <input type="text" id="customPath" placeholder="例如：my-api-endpoint">
      </div>
      <button onclick="createUrlMapping()">生成</button>
      
      <div id="mappingResult" class="result">
        <p><strong>已创建映射：</strong></p>
        <p><a id="mappingUrl" href="#" target="_blank"></a></p>
      </div>
    </div>
    
    <div class="service-section">
      <h2>2. ✍️ 文本内容映射</h2>
      <div class="form-group">
        <label>内容：</label>
        <textarea id="persistentContent" placeholder="在此输入文本内容..."></textarea>
      </div>
      <div class="form-group">
        <label>文件名称：</label>
        <input type="text" id="persistentFilename" value="config.txt" placeholder="例如：config.json, script.js">
      </div>
      <div class="form-group">
        <label>自定义路径：</label>
        <input type="text" id="textCustomPath" placeholder="例如：my-config, my-script">
      </div>
      <button onclick="createTextMapping()">生成</button>
      
      <div id="persistentTextResult" class="result">
        <p><strong>文本映射地址：</strong></p>
        <p><a id="persistentTextUrl" href="#" target="_blank"></a></p>
      </div>
    </div>
    
    <div class="service-section">
      <h2>3. 📱 二维码生成器</h2>
      <div class="form-group">
        <label>URL 地址：</label>
        <input type="url" id="qrcodeUrl" placeholder="请输入 URL">
      </div>
      <button onclick="generateQRCode()">生成</button>
      <div id="qrcodeResult" class="result">
        <div id="qrcodeContainer" style="display:flex; justify-content:center; margin:10px 0;"></div>
      </div>
    </div>

    <div class="instructions">
      <h2>使用方法</h2>
      <ol>
        <li>选择所需服务（URL 映射或文本内容）。</li>
        <li>填写必要字段信息。</li>
        <li>点击创建按钮。</li>
        <li>使用生成的链接访问您的内容。</li>
      </ol>
    </div>
    
  </div>

  <script>
    // --- 核心功能 ---
    async function createUrlMapping() {
      const targetUrl = document.getElementById('targetUrl').value;
      const customPath = document.getElementById('customPath').value;
      
      if (!targetUrl || !customPath) return alert('请填写所有字段');
      
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
          resultDiv.classList.add('show');
          addQRCodeToElement('mappingUrl');
        } else {
          alert('错误：' + data.error);
        }
      } catch (e) {
        alert('错误：' + e.message);
      }
    }

    async function createTextMapping() {
      const content = document.getElementById('persistentContent').value;
      const filename = document.getElementById('persistentFilename').value;
      const customPath = document.getElementById('textCustomPath').value;
      
      if (!content || !filename || !customPath) return alert('请填写所有字段');
      
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
          alert('错误：' + data.error);
        }
      } catch (e) {
        alert('错误：' + e.message);
      }
    }

    // --- 二维码 ---
    async function generateQRCode() {
      const url = document.getElementById('qrcodeUrl').value;
      if (!url) return alert('请输入 URL');
      
      try {
        new URL(url); // 验证
        const img = document.createElement('img');
        img.src = '/qrcode/generate?url=' + encodeURIComponent(url);
        img.style.maxWidth = '300px';
        
        const container = document.getElementById('qrcodeContainer');
        container.innerHTML = '';
        container.appendChild(img);
        document.getElementById('qrcodeResult').classList.add('show');
      } catch (e) {
        alert('无效的 URL');
      }
    }

    function addQRCodeToElement(elementId) {
      const element = document.getElementById(elementId);
      // 移除现有二维码按钮以避免重复
      if (element.nextSibling && element.nextSibling.tagName === 'BUTTON') {
        element.nextSibling.remove();
      }
      
      if (element && element.href) {
        const qrButton = document.createElement('button');
        qrButton.textContent = '二维码';
        qrButton.style.marginLeft = '10px';
        qrButton.style.padding = '2px 8px';
        qrButton.style.fontSize = '12px';
        qrButton.onclick = function() {
          window.open('/qrcode/generate?url=' + encodeURIComponent(element.href), '_blank');
        };
        element.parentNode.appendChild(qrButton);
      }
    }

    // --- 暴露函数供 HTML onclick 属性使用 ---
    window.createUrlMapping = createUrlMapping;
    window.createTextMapping = createTextMapping;
    window.generateQRCode = generateQRCode;

  </script>
</body>
</html>`;
}

// --- Helper Functions for API Logic ---

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
    
    // Generate a random user ID (using a random identifier)
    const userId = Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    
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
    
    // Generate a random user ID (using a random identifier)
    const userId = Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    
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
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>管理员控制台 - URL工具</title>
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
    <h1>🔐 管理员控制台</h1>
    <p>欢迎使用管理员控制台。您可以在此管理 KV 存储中的所有映射。</p>
    
    <div id="adminResult"></div>
    
    <h2>添加新映射</h2>
    <div class="form-group">
      <label>映射类型：</label>
      <select id="mappingType">
        <option value="url_mapping">URL 映射</option>
        <option value="text_content">文本内容</option>
      </select>
    </div>
    
    <div id="urlMappingFields">
      <div class="form-group">
        <label>目标 URL：</label>
        <input type="url" id="targetUrl" placeholder="https://example.com/data.json">
      </div>
      <div class="form-group">
        <label>映射密钥（格式：user:{userId}:path:{customPath}）：</label>
        <input type="text" id="mappingKey" placeholder="user:myuser:path:myendpoint">
      </div>
    </div>
    
    <div id="textContentFields" style="display:none;">
      <div class="form-group">
        <label>内容：</label>
        <textarea id="textContent" placeholder="在此输入文本内容..."></textarea>
      </div>
      <div class="form-group">
        <label>文件名：</label>
        <input type="text" id="textFilename" value="config.txt" placeholder="例如：config.json, script.js">
      </div>
      <div class="form-group">
        <label>内容类型：</label>
        <input type="text" id="contentType" value="text/plain" placeholder="例如：application/json, text/javascript">
      </div>
      <div class="form-group">
        <label>映射密钥（格式：user:{userId}:path:{customPath}）：</label>
        <input type="text" id="textMappingKey" placeholder="user:myuser:path:myendpoint">
      </div>
    </div>
    
    <button onclick="switchMappingType()">切换类型</button>
    <button onclick="createMapping()">生成</button>
    
    <h2>管理现有映射</h2>
    <button class="refresh-btn" onclick="loadMappings()">刷新映射列表</button>
    <button class="secondary-btn" onclick="deleteAllMappings()">删除所有映射</button>
    
    <div id="mappingsList" class="mapping-list">
      <p>正在加载映射...</p>
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
            showMessage('请填写所有字段', 'error');
            return;
          }
          
          // 验证 URL
          new URL(targetUrl);
          
          // 验证映射密钥格式
          if (!isValidMappingKey(mappingKey)) {
            showMessage('无效的映射密钥格式。请使用格式：user:{userId}:path:{customPath}', 'error');
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
            showMessage('映射创建成功！', 'success');
            document.getElementById('targetUrl').value = '';
            document.getElementById('mappingKey').value = '';
            loadMappings(); // 刷新列表
          } else {
            showMessage('错误：' + result.error, 'error');
          }
        } else { // text_content
          const content = document.getElementById('textContent').value;
          const filename = document.getElementById('textFilename').value;
          const contentType = document.getElementById('contentType').value;
          const mappingKey = document.getElementById('textMappingKey').value;
          
          if (!content || !filename || !contentType || !mappingKey) {
            showMessage('请填写所有字段', 'error');
            return;
          }
          
          // 验证映射密钥格式
          if (!isValidMappingKey(mappingKey)) {
            showMessage('无效的映射密钥格式。请使用格式：user:{userId}:path:{customPath}', 'error');
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
            showMessage('文本映射创建成功！', 'success');
            document.getElementById('textContent').value = '';
            document.getElementById('textFilename').value = 'config.txt';
            document.getElementById('contentType').value = 'text/plain';
            document.getElementById('textMappingKey').value = '';
            loadMappings(); // 刷新列表
          } else {
            showMessage('错误：' + result.error, 'error');
          }
        }
      } catch (error) {
        showMessage('错误：' + error.message, 'error');
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
          showMessage('加载映射时出错：' + result.error, 'error');
        }
      } catch (error) {
        showMessage('错误：' + error.message, 'error');
      }
    }
    
    function displayMappings(mappings) {
      const container = document.getElementById('mappingsList');
      
      if (mappings.length === 0) {
        container.innerHTML = '<p>未找到映射。</p>';
        return;
      }
      
      // 创建表格显示映射
      let tableHTML = '<table><thead><tr><th>密钥</th><th>类型</th><th>详情</th><th>操作</th></tr></thead><tbody>';
      
      mappings.forEach(mapping => {
        let details = '';
        if (mapping.type === 'url_mapping') {
          details = \`<strong>URL：</strong> \${mapping.originalUrl}<br><strong>用户：</strong> \${mapping.userId}<br><strong>路径：</strong> \${mapping.customPath}\`;
        } else if (mapping.type === 'text_content') {
          const contentPreview = mapping.content.length > 100 ? 
            mapping.content.substring(0, 100) + '...' : 
            mapping.content;
          details = \`<strong>内容：</strong> \${contentPreview}<br><strong>文件名：</strong> \${mapping.filename}<br><strong>内容类型：</strong> \${mapping.contentType}\`;
        } else {
          details = \`<em>未知类型：\${mapping.type}</em>\`;
        }
        
        tableHTML += \`
          <tr>
            <td>\${mapping.key}</td>
            <td>\${mapping.type}</td>
            <td>\${details}</td>
            <td><button class="delete-btn" onclick="deleteMapping('\${mapping.key}')">删除</button></td>
          </tr>
        \`;
      });
      
      tableHTML += '</tbody></table>';
      container.innerHTML = tableHTML;
    }
    
    async function deleteMapping(key) {
      if (!confirm('您确定要删除映射：' + key + ' 吗？')) {
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
          showMessage('映射删除成功！', 'success');
          loadMappings(); // 刷新列表
        } else {
          showMessage('错误：' + result.error, 'error');
        }
      } catch (error) {
        showMessage('错误：' + error.message, 'error');
      }
    }
    
    async function deleteAllMappings() {
      if (!confirm('您确定要删除所有映射吗？此操作不可撤销！')) {
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
          showMessage('所有映射删除成功！', 'success');
          loadMappings(); // 刷新列表
        } else {
          showMessage('错误：' + result.error, 'error');
        }
      } catch (error) {
        showMessage('错误：' + error.message, 'error');
      }
    }
    
    function showMessage(text, type) {
      const resultDiv = document.getElementById('adminResult');
      resultDiv.innerHTML = '<div class="' + type + '">' + text + '</div>';
      
      // 5秒后自动隐藏成功消息
      if (type === 'success') {
        setTimeout(() => {
          resultDiv.innerHTML = '';
        }, 5000);
      }
    }
    
    function isValidMappingKey(key) {
      // 检查密钥是否符合模式：user:{userId}:path:{customPath}
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
    
    // 页面加载时获取映射
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


async function handleQrCodeGeneration(request) {
  // Parse the URL parameters
  const url = new URL(request.url);
  const targetUrl = url.searchParams.get('url');
  
  if (!targetUrl) {
    return new Response('URL parameter is required', { status: 400 });
  }
  
  try {
    // Validate the URL
    new URL(targetUrl);
    
    // Generate QR code using an external service
    // Using a QR code API service
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(targetUrl)}`;
    
    // Fetch the QR code image from the external service
    const qrResponse = await fetch(qrApiUrl);
    
    if (!qrResponse.ok) {
      throw new Error(`QR code service error: ${qrResponse.status}`);
    }
    
    // Get the image buffer
    const imageBuffer = await qrResponse.arrayBuffer();
    
    // Return the image
    return new Response(imageBuffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    return new Response(`Error generating QR code: ${error.message}`, { 
      status: 500,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
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