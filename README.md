# 🔄 URL-Redirect & Content Mapper

一个基于 Cloudflare Workers + KV 存储的轻量级、功能强大的 URL 管理与内容托管工具。

## ✨ 核心功能

- **🔗 高级 URL 映射**：不仅仅是简单的 302 跳转。支持将目标 URL 映射到自定义路径，并作为透明代理返回内容，自动处理文件下载。
- **📄 文本内容托管**：直接托管文本、JSON、脚本或 HTML 内容，支持自定义文件名和 Mime-Type。
- **📱 实时二维码生成**：为生成的映射链接一键生成二维码。
- **🔐 管理员控制台**：内置可视化管理界面 `/admin`，支持对所有 KV 映射进行增删改查。
- **🛠️ 安全认证**：支持管理密码保护，确保 API 和控制台的安全。

## 🚀 快速部署

1. **克隆项目**：
   ```bash
   git clone https://github.com/zhangzhongxin1999/URL-Redirect.git
   cd URL-Redirect
   ```

2. **创建 KV 命名空间**：
   在 Cloudflare Dashboard 中创建一个 KV 命名空间，并获取其 `ID`。

3. **配置 `wrangler.toml`**：
   将你的 KV ID 填入配置文件：
   ```toml
   [[kv_namespaces]]
   binding = "URL_MAPPER_KV"
   id = "你的_KV_ID"
   ```

4. **部署到 Cloudflare**：
   ```bash
   wrangler deploy
   ```

## 📖 路径规范

- **用户访问路径**：https://your-worker.dev/m/{userId}/{customPath}
- **管理后台**：https://your-worker.dev/admin
- **API 接口**：
    - POST /api/create-url-mapping
    - POST /api/create-text-mapping
    - GET /api/list-mappings

## 🛡️ 环境配置

可以在 Cloudflare 后台设置以下环境变量：
- ADMIN_PASSWORD：设置后，访问 /admin 和调用管理 API 将需要 Bearer Token 验证。

## 📄 许可证

MIT License
