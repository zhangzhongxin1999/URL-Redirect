# Universal Content Proxy with URL Mapping

A Cloudflare Pages application that acts as a proxy for GitHub Gist raw content, converts text to downloadable files, and maps URLs to proxy endpoints, allowing access to restricted content and dynamic content retrieval.

## Purpose

This service addresses multiple needs:
1. Accessing GitHub Gist raw content (e.g., `https://gist.githubusercontent.com/...`) when it's blocked or restricted
2. Specifying custom filenames for downloaded files
3. Creating downloadable files directly from text content in URLs
4. Mapping any URL to a proxy endpoint that fetches content dynamically

## Features

- Bypasses regional restrictions on GitHub Gist content
- Maintains original content type headers
- Includes caching for improved performance
- Supports all file types (JavaScript, CSS, JSON, text, etc.)
- Simple URL replacement pattern
- Custom filename support via query parameter
- Text-to-URL conversion feature
- Base64 encoding support for complex content
- **New:** URL mapping/proxy functionality
- Self-contained URLs (no persistent storage required)

## How It Works

The service provides three main functionalities:

### 1. Gist Proxy
Intercepts requests to `/gist/*` and forwards them to `https://gist.githubusercontent.com/*`, effectively acting as a proxy to bypass restrictions.

### 2. Text-to-URL Converter
Intercepts requests to `/text/*` and returns the content specified in query parameters as a downloadable file.

### 3. URL Mapper/Proxy
Provides endpoints that fetch content from any URL and return it to the client. Two approaches are available:
- Parameter-based: `/proxy-direct?url=encoded_target_url`
- Base64-encoded: `/proxy/base64_encoded_url`

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
6. Click "Save and Deploy"

### Method 2: Direct upload

1. Download this repository as a ZIP file
2. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/) → Pages
3. Click "Create a project" → "Upload assets"
4. Upload the contents of this repository
5. Click "Deploy"

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

### 3. URL Mapper/Proxy

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

## Technical Details

- Uses Cloudflare Pages Functions to create dynamic routes
- Preserves original HTTP headers including content-type
- Sets Content-Disposition header to force download with custom filename
- Implements caching strategies:
  - Gist proxy: 15-minute cache (balance between performance and freshness)
  - Text-to-URL converter: No cache (ensures fresh content for dynamic text)
  - URL mapper: No cache (ensures fresh content from target URLs)
- Supports multiple content types based on file extensions
- Self-contained URLs (no persistent storage required)
- Logs requests for debugging purposes

## Security Considerations

- This is a simple proxy service without authentication
- All requests are forwarded without modification
- Implement additional security measures if needed for production use
- Be aware of and comply with GitHub's Terms of Service
- Sanitizes filenames to prevent path traversal attacks
- Validates URLs before making requests
- No persistent storage of URLs (all mapping info is contained in the URL itself)

## Limitations

- Does not cache binary files differently from text files
- No rate limiting implemented (consider adding if needed)
- Relies on Cloudflare's network and target servers' availability
- Content size limited by URL length constraints for text-to-URL and URL mapping features
- Self-contained URLs can become very long for complex target URLs

## License

MIT