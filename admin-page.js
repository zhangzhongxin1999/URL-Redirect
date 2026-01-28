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
          details = `<strong>URL:</strong> ${mapping.originalUrl}<br><strong>User:</strong> ${mapping.userId}<br><strong>Path:</strong> ${mapping.customPath}`;
        } else if (mapping.type === 'text_content') {
          const contentPreview = mapping.content.length > 100 ? 
            mapping.content.substring(0, 100) + '...' : 
            mapping.content;
          details = `<strong>Content:</strong> ${contentPreview}<br><strong>Filename:</strong> ${mapping.filename}<br><strong>Content-Type:</strong> ${mapping.contentType}`;
        } else {
          details = `<em>Unknown type: ${mapping.type}</em>`;
        }
        
        tableHTML += `
          <tr>
            <td>${mapping.key}</td>
            <td>${mapping.type}</td>
            <td>${details}</td>
            <td><button class="delete-btn" onclick="deleteMapping('${mapping.key}')">Delete</button></td>
          </tr>
        `;
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
      const regex = /^user:[a-zA-Z0-9_-]+:path:.+$/;
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