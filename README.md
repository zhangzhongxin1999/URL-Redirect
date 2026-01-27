# Universal Content Proxy with User-defined Mapping

一个Cloudflare Pages应用程序，允许用户定义自己的URL映射，将任意URL或文本内容映射到自定义路径，实现内容代理和访问受限内容的功能。

## 功能

这个服务解决了多个需求：
1. 访问被阻止或受限的外部内容（例如GitHub Gist、API端点等）
2. 为下载的文件指定自定义文件名
3. 直接存储和分发文本内容
4. 创建用户自定义的URL映射
5. 为生成的URL提供二维码
6. 用户管理：查看和删除用户创建的映射

## 功能特性

- 绕过内容访问限制
- 保持原始内容类型头信息
- 包括缓存以提高性能
- 支持所有文件类型（JavaScript、CSS、JSON、文本等）
- 简单的URL替换模式
- 通过查询参数支持自定义文件名
- 用户定义的映射系统（使用KV存储）
- 文本内容存储和检索
- 二维码生成功能
- 用户管理：查看和删除用户创建的映射
- **新增：** 安全访问控制

## 工作原理

该服务提供四个主要功能：

### 1. 统一用户映射系统
使用Cloudflare KV存储维护用户定义的URL映射：
- 端点：`/m/{userId}/{customPath}` - 从存储的原始URL或文本内容检索
- API：`/api/create-user-mapping` - 创建新的用户URL映射
- API：`/api/create-persistent-text` - 创建新的用户文本内容映射

### 2. 用户管理
管理用户创建的映射：
- API：`/api/user/{userId}/mappings` - 获取用户的所有映射
- API：`/api/user/{userId}/mappings/{customPath}/delete` - 删除用户的特定映射

### 3. 二维码生成器
为任意URL生成二维码图片：
- 端点：`/qrcode/generate?url={target-url}` - 生成目标URL的二维码
- 方便移动设备扫描访问

## 使用方法

### 1. 创建用户URL映射

#### 通过API创建映射
```
POST 到 /api/create-user-mapping
表单数据：
- originalUrl: 要映射的原始URL（如 https://example.com/data.json 或 https://gist.githubusercontent.com/...）
- userId: 你的用户ID（如 myuser123）
- customPath: 自定义路径（如 my-api-endpoint 或 my-gist-file）
- baseUrl: 你的网站URL（如 https://your-site.pages.dev）
```

#### 访问映射的内容
```
https://{your-site}.pages.dev/m/{userId}/{customPath}
```

#### 示例
```
# 映射一个外部API
原始URL: https://api.example.com/data.json
用户ID: myuser123
自定义路径: weather-data

访问URL: https://your-site.pages.dev/m/myuser123/weather-data
```

### 2. 创建用户文本内容映射

#### 通过API创建文本内容
```
POST 到 /api/create-persistent-text
表单数据：
- content: 要存储的文本内容
- filename: 文件名（如 config.json）
- userId: 你的用户ID（如 myuser123）
- customPath: 自定义路径（如 my-config 或 my-script）
- baseUrl: 你的网站URL（如 https://your-site.pages.dev）
```

#### 访问文本内容
```
https://{your-site}.pages.dev/m/{userId}/{customPath}
```

### 3. 用户管理

#### 查看用户的所有映射
```
GET 请求到 /api/user/{userId}/mappings
```

#### 删除用户的特定映射
```
DELETE 请求到 /api/user/{userId}/mappings/{customPath}/delete
```

### 4. 二维码生成器

#### 生成二维码
```
https://{your-site}.pages.dev/qrcode/generate?url={target-url}
```

#### 示例
```
https://your-site.pages.dev/qrcode/generate?url=https%3A%2F%2Fexample.com%2Fdata.json
```

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
6. **重要：** 为持久化功能设置Cloudflare KV命名空间：
   - 前往 Workers & Pages → KV → 创建命名空间
   - 命名为 "URL_MAPPER_KV"（用于所有映射存储）
   - 在Pages设置 → 环境变量中添加：
     - 键：`URL_MAPPER_KV`，值：你的KV命名空间ID
7. 点击"保存并部署"

### 方法2：直接上传

1. 下载此仓库作为ZIP文件
2. 前往 [Cloudflare Dashboard](https://dash.cloudflare.com/) → Pages
3. 点击"创建项目" → "上传资产"
4. 上传此仓库的内容
5. 配置KV命名空间，如上所述
6. 点击"部署"

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
  - 所有映射：无缓存（确保内容的新鲜度）
- 支持基于文件扩展名的多种内容类型
- 持久化存储选项使用Cloudflare KV
- 为调试记录请求

## 安全注意事项

- 这是一个没有身份验证的简单代理服务
- 所有请求都会未经修改地转发
- 如需生产使用，请实施额外的安全措施
- 请注意并遵守目标服务器的服务条款
- 验证URL以防止恶意请求
- 需要正确配置KV命名空间以进行持久化映射
- 访问 `/admin/access-control` 设置身份验证以保护服务

## 限制

- 未实施速率限制（如有需要可考虑添加）
- 依赖Cloudflare的网络和目标服务器的可用性
- 持久化功能需要Cloudflare KV，这有其自身的限制和成本

## 许可证

MIT