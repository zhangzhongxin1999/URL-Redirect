# Universal Content Proxy with Text-to-URL Converter

A Cloudflare Pages application that acts as a proxy for GitHub Gist raw content and converts text to downloadable files, allowing access to Gist files that might be restricted in certain regions and creating files from text content in URLs.

## Purpose

This service addresses multiple needs:
1. Accessing GitHub Gist raw content (e.g., `https://gist.githubusercontent.com/...`) when it's blocked or restricted
2. Specifying custom filenames for downloaded files
3. Creating downloadable files directly from text content in URLs

## Features

- Bypasses regional restrictions on GitHub Gist content
- Maintains original content type headers
- Includes caching for improved performance
- Supports all file types (JavaScript, CSS, JSON, text, etc.)
- Simple URL replacement pattern
- Custom filename support via query parameter
- **New:** Text-to-URL conversion feature
- Base64 encoding support for complex content

## How It Works

The service provides two main functionalities:

### 1. Gist Proxy
Intercepts requests to `/gist/*` and forwards them to `https://gist.githubusercontent.com/*`, effectively acting as a proxy to bypass restrictions.

### 2. Text-to-URL Converter
Intercepts requests to `/text/*` and returns the content specified in query parameters as a downloadable file.

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

## Technical Details

- Uses Cloudflare Pages Functions to create dynamic routes at `/gist/*` and `/text/*`
- Preserves original HTTP headers including content-type
- Sets Content-Disposition header to force download with custom filename
- Implements basic caching (1 hour) for Gist proxy, no cache for text converter
- Supports multiple content types based on file extensions
- Logs requests for debugging purposes

## Security Considerations

- This is a simple proxy service without authentication
- All requests are forwarded without modification
- Implement additional security measures if needed for production use
- Be aware of and comply with GitHub's Terms of Service
- Sanitizes filenames to prevent path traversal attacks
- Validates base64 content before decoding

## Limitations

- Does not cache binary files differently from text files
- No rate limiting implemented (consider adding if needed)
- Relies on Cloudflare's network and GitHub's availability
- Content size limited by URL length constraints for text-to-URL feature

## License

MIT