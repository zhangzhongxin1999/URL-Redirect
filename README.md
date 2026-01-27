# 通用内容代理与URL映射

一个Cloudflare Pages应用程序，可作为GitHub Gist原始内容的代理，将文本转换为可下载文件，并将URL映射到代理端点，允许访问受限制的内容和动态内容检索。

## 功能

这个服务解决了多个需求：
1. 访问被阻止或受限的GitHub Gist原始内容（例如 `https://gist.githubusercontent.com/...`）
2. 为下载的文件指定自定义文件名
3. 直接从URL参数中的文本内容创建可下载文件
4. 将任意URL映射到获取内容的代理端点
5. 支持临时和持久化的URL映射

## 功能特性

- 绕过GitHub Gist内容的区域限制
- 保持原始内容类型头信息
- 包括缓存以提高性能
- 支持所有文件类型（JavaScript、CSS、JSON、文本等）
- 简单的URL替换模式
- 通过查询参数支持自定义文件名
- 文本到URL转换功能
- 复杂内容的Base64编码支持
- URL映射/代理功能
- 自包含URL（无需持久存储）
- **新增：** 使用Cloudflare KV存储的持久化URL映射
- **新增：** 安全访问控制

## 工作原理

该服务提供四个主要功能：

### 1. Gist代理
拦截发送到 `/gist/*` 的请求并将其转发到 `https://gist.githubusercontent.com/*`，有效地作为代理以绕过限制。

### 2. 文本到URL转换器
拦截发送到 `/text/*` 的请求并返回查询参数中指定的内容作为可下载文件。

### 3. 临时URL映射/代理
提供获取任何URL内容并将其返回给客户端的端点，无需持久存储：
- 基于参数：`/proxy-direct?url=encoded_target_url`
- Base64编码：`/proxy/base64_encoded_url`

### 4. 持久化URL映射/代理
使用Cloudflare KV存储维护URL映射：
- 端点：`/map/{id}` - 从存储的原始URL检索内容
- API：`/api/create-persistent-map` - 创建新的持久化映射

## 部署

### 方法1：连接你的GitHub仓库（推荐）

1. Fork此仓库到你的GitHub账户
2. 前往 [Cloudflare Dashboard](https://dash.cloudflare.com/) → Pages
3. 点击"创建项目" → "连接到Git"
4. 选择你的forked仓库
5. 在"构建配置"中设置：
   - 框架预设：`None`
   - 构建命令：`echo "Build not needed for static site"`
   - 构建输出目录：`./`
6. **重要：** 为持久化映射设置Cloudflare KV命名空间：
   - 前往 Workers & Pages → KV → 创建命名空间
   - 命名为 "URL_MAPPER_KV"（或你喜欢的名称）
   - 在Pages设置 → 环境变量中添加：
     - 键：`URL_MAPPER_KV`
     - 值：你的KV命名空间ID
7. 点击"保存并部署"

### 方法2：直接上传

1. 下载此仓库作为ZIP文件
2. 前往 [Cloudflare Dashboard](https://dash.cloudflare.com/) → Pages
3. 点击"创建项目" → "上传资产"
4. 上传此仓库的内容
5. 配置KV命名空间，如上所述
6. 点击"部署"

## 使用方法

### 1. Gist代理

#### 基本URL模式
```
https://{your-site}.pages.dev/gist/{username}/{gist-id}/raw/{file-path}
```

#### 带自定义文件名
```
https://{your-site}.pages.dev/gist/{username}/{gist-id}/raw/{file-path}?filename={desired-filename.ext}
```

#### 示例

**原始：**
```
https://gist.githubusercontent.com/octocat/12345/raw/example.js
```

**基本代理：**
```
https://your-site.pages.dev/gist/octocat/12345/raw/example.js
```

**带自定义文件名：**
```
https://your-site.pages.dev/gist/octocat/12345/raw/example.js?filename=my-custom-script.js
```

### 2. 文本到URL转换器

#### 基本URL模式
```
https://{your-site}.pages.dev/text/{filename.ext}?content={text-content}
```

#### 使用Base64编码
```
https://{your-site}.pages.dev/text/{filename.ext}?b64={base64-encoded-content}
```

#### 示例

**纯文本：**
```
https://your-site.pages.dev/text/hello.txt?content=Hello%20World
```

**JavaScript文件：**
```
https://your-site.pages.dev/text/script.js?content=function%20test()%20{%20return%20'Hello';%20}
```

**JSON与base64：**
```
https://your-site.pages.dev/text/data.json?b64=eyAiZGF0YSI6ICJleGFtcGxlIiwgIm51bWJlciI6IDEyMyB9
```

### 3. 临时URL映射/代理

#### 基于参数的模式
```
https://{your-site}.pages.dev/proxy-direct?url={encoded-target-url}
```

#### Base64编码模式
```
https://{your-site}.pages.dev/proxy/{base64-encoded-url}
```

#### 示例

**基于参数：**
```
https://your-site.pages.dev/proxy-direct?url=https%3A%2F%2Fexample.com%2Fdata.json
```

**Base64编码：**
```
https://your-site.pages.dev/proxy/aHR0cHM6Ly9leGFtcGxlLmNvbS9kYXRhLmpzb24=
```

### 4. 持久化URL映射/代理

#### 创建映射（通过API）
```
POST 到 /api/create-persistent-map
表单数据：
- originalUrl: 要映射的URL
- customId: （可选）映射的自定义ID
- baseUrl: 你的网站URL
```

#### 访问映射的内容
```
https://{your-site}.pages.dev/map/{mapping-id}
```

## 持久化存储配置

要使用持久化URL映射：

1. 在Cloudflare仪表板中创建KV命名空间
2. 命名为 "URL_MAPPER_KV" 或其他你喜欢的名称
3. 获取命名空间ID
4. 在你的Pages项目设置中，添加环境变量：
   - 键：`URL_MAPPER_KV`
   - 值：你的KV命名空间ID
5. 重新部署你的项目

## 安全功能

要保护你的实例，请访问 `/admin/access-control` 设置身份验证：

1. 默认凭据：用户名 `admin`，密码 `password`
2. 登录后可更改默认凭据
3. 建议在生产环境中使用强密码

## 技术细节

- 使用Cloudflare Pages Functions创建动态路由
- 保留原始HTTP头信息，包括内容类型
- 设置Content-Disposition头以强制使用自定义文件名下载
- 实施缓存策略：
  - Gist代理：15分钟缓存（在性能和新鲜度之间平衡）
  - 文本到URL转换器：无缓存（确保动态文本内容的新鲜度）
  - URL映射器：无缓存（确保来自目标URL的新鲜内容）
- 支持基于文件扩展名的多种内容类型
- 自包含临时URL（无需持久存储）
- 持久化存储选项使用Cloudflare KV
- 为调试记录请求

## 安全注意事项

- 这是一个没有身份验证的简单代理服务
- 所有请求都会未经修改地转发
- 如需生产使用，请实施额外的安全措施
- 请注意并遵守GitHub的服务条款
- 清理文件名以防止路径遍历攻击
- 在发出请求前验证URL
- 需要正确配置KV命名空间以进行持久化映射
- 访问 `/admin/access-control` 设置身份验证以保护服务

## 限制

- 二进制文件和文本文件不会分别缓存
- 未实施速率限制（如有需要可考虑添加）
- 依赖Cloudflare的网络和目标服务器的可用性
- 文本到URL和临时URL映射功能受URL长度限制
- 自包含的临时URL对于复杂的目标URL可能会变得很长
- 持久化映射需要Cloudflare KV，这有其自身的限制和成本

## 许可证

MIT