# Universal Content Proxy with URL Mapping

A Cloudflare Pages application that acts as a proxy for GitHub Gist raw content, converts text to downloadable files, and maps URLs to proxy endpoints, allowing access to restricted content and dynamic content retrieval.

## Purpose

This service addresses multiple needs:
1. Accessing GitHub Gist raw content (e.g., `https://gist.githubusercontent.com/...`) when it's blocked or restricted
2. Specifying custom filenames for downloaded files
3. Creating downloadable files directly from text content in URLs
4. Mapping any URL to a proxy endpoint that fetches content dynamically
5. Supporting both temporary and persistent URL mappings

## Features

- Bypasses regional restrictions on GitHub Gist content
- Maintains original content type headers
- Includes caching for improved performance
- Supports all file types (JavaScript, CSS, JSON, text, etc.)
- Simple URL replacement pattern
- Custom filename support via query parameter
- Text-to-URL conversion feature
- Base64 encoding support for complex content
- URL mapping/proxy functionality
- Self-contained temporary URLs (no persistent storage required)
- **New:** Persistent URL mappings using Cloudflare KV storage

## How It Works

The service provides four main functionalities:

### 1. Gist Proxy
Intercepts requests to `/gist/*` and forwards them to `https://gist.githubusercontent.com/*`, effectively acting as a proxy to bypass restrictions.

### 2. Text-to-URL Converter
Intercepts requests to `/text/*` and returns the content specified in query parameters as a downloadable file.

### 3. Temporary URL Mapper/Proxy
Provides endpoints that fetch content from any URL and return it to the client without persistent storage:
- Parameter-based: `/proxy-direct?url=encoded_target_url`
- Base64-encoded: `/proxy/base64_encoded_url`

### 4. Persistent URL Mapper/Proxy
Uses Cloudflare KV storage to maintain URL mappings:
- Endpoint: `/map/{id}` - retrieves content from the stored original URL
- API: `/api/create-persistent-map` - creates new persistent mappings

## Deployment

### Method 1: Connect your GitHub repository (Recommended)

1. Fork this repository to your GitHub account
2. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/) → Pages
3. Click "Create a project" → "Connect to Git"
4. Select your forked repository
5. In "Build configurations", set:
   - Framework preset: `None`
   - Build command: `echo "Build not needed for static site"`
   - Build output directory: `./`
6. **Important**: Set up Cloudflare KV namespace for persistent mappings:
   - Go to Workers & Pages → KV → Create namespace
   - Name it "URL_MAPPER_KV" (or any name you prefer)
   - In Pages settings → Environment variables, add:
     - Key: `URL_MAPPER_KV`
     - Value: Your KV namespace ID
7. Click "Save and Deploy"

### Method 2: Direct upload

1. Download this repository as a ZIP file
2. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/) → Pages
3. Click "Create a project" → "Upload assets"
4. Upload the contents of this repository
5. Configure KV namespace as described above
6. Click "Deploy"

## Usage

### 1. Gist Proxy

#### Basic URL Pattern
```
https://{your-site}.pages.dev/gist/{username}/{gist-id}/raw/{file-path}
```

#### With Custom Filename
```
https://{your-site}.pages.dev/gist/{username}/{gist-id}/raw/{file-path}?filename={desired-filename.ext}
```

#### Examples

**Original:**
```
https://gist.githubusercontent.com/octocat/12345/raw/example.js
```

**Basic Proxied:**
```
https://your-site.pages.dev/gist/octocat/12345/raw/example.js
```

**With Custom Filename:**
```
https://your-site.pages.dev/gist/octocat/12345/raw/example.js?filename=my-custom-script.js
```

### 2. Text-to-URL Converter

#### Basic URL Pattern
```
https://{your-site}.pages.dev/text/{filename.ext}?content={text-content}
```

#### With Base64 Encoding
```
https://{your-site}.pages.dev/text/{filename.ext}?b64={base64-encoded-content}
```

#### Examples

**Plain text:**
```
https://your-site.pages.dev/text/hello.txt?content=Hello%20World
```

**JavaScript file:**
```
https://your-site.pages.dev/text/script.js?content=function%20test()%20{%20return%20'Hello';%20}
```

**JSON with base64:**
```
https://your-site.pages.dev/text/data.json?b64=eyAiZGF0YSI6ICJleGFtcGxlIiwgIm51bWJlciI6IDEyMyB9
```

### 3. Temporary URL Mapper/Proxy

#### Parameter-based Pattern
```
https://{your-site}.pages.dev/proxy-direct?url={encoded-target-url}
```

#### Base64-encoded Pattern
```
https://{your-site}.pages.dev/proxy/{base64-encoded-url}
```

#### Examples

**Parameter-based:**
```
https://your-site.pages.dev/proxy-direct?url=https%3A%2F%2Fexample.com%2Fdata.json
```

**Base64-encoded:**
```
https://your-site.pages.dev/proxy/aHR0cHM6Ly9leGFtcGxlLmNvbS9kYXRhLmpzb24=
```

### 4. Persistent URL Mapper/Proxy

#### Create Mapping (via API)
```
POST to /api/create-persistent-map
Form data:
- originalUrl: The URL to map
- customId: (optional) Custom ID for the mapping
- baseUrl: Your site URL
```

#### Access Mapped Content
```
https://{your-site}.pages.dev/map/{mapping-id}
```

## Configuration for Persistent Storage

To use persistent URL mappings:

1. Create a KV namespace in your Cloudflare dashboard
2. Name it "URL_MAPPER_KV" or another name of your choice
3. Get the namespace ID
4. In your Pages project settings, add an environment variable:
   - Key: `URL_MAPPER_KV`
   - Value: Your KV namespace ID
5. Redeploy your project

## Technical Details

- Uses Cloudflare Pages Functions to create dynamic routes
- Preserves original HTTP headers including content-type
- Sets Content-Disposition header to force download with custom filename
- Implements caching strategies:
  - Gist proxy: 15-minute cache (balance between performance and freshness)
  - Text-to-URL converter: No cache (ensures fresh content for dynamic text)
  - URL mappers: No cache (ensures fresh content from target URLs)
- Supports multiple content types based on file extensions
- Self-contained temporary URLs (no persistent storage required)
- Persistent storage option using Cloudflare KV
- Logs requests for debugging purposes

## Security Considerations

- This is a simple proxy service without authentication
- All requests are forwarded without modification
- Implement additional security measures if needed for production use
- Be aware of and comply with GitHub's Terms of Service
- Sanitizes filenames to prevent path traversal attacks
- Validates URLs before making requests
- Requires proper configuration of KV namespace for persistent mappings

## Limitations

- Does not cache binary files differently from text files
- No rate limiting implemented (consider adding if needed)
- Relies on Cloudflare's network and target servers' availability
- Content size limited by URL length constraints for text-to-URL and temporary URL mapping features
- Self-contained temporary URLs can become very long for complex target URLs
- Persistent mappings require Cloudflare KV which has its own limitations and costs

## License

MIT