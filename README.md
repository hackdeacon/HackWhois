# HackWhois

域名情报平台。RDAP / WHOIS / DNS / 托管信息查询。

## 功能

- 域名、IP、ASN 查询，RDAP 优先，WHOIS 兜底
- DNS 记录（A、AAAA、MX、NS、TXT、CNAME、SOA）
- HTTP 探测与 SSL 证书检查
- 托管 / CDN / 服务商识别
- 批量查询，支持 CSV / JSON 导出
- 查询历史，自动去重
- 中英文切换
- 跟随系统深色模式

## API

```
GET /google.com
GET /8.8.8.8
GET /AS15169
```

返回 JSON，包含注册信息、DNS、托管、HTTP、SSL 数据。

## 本地运行

```bash
npm install
npm start
# → http://localhost:3456
```

## 部署

```bash
npm run deploy
```

部署到 Vercel。`vercel.json` 的全量重写将所有路径交由 `api/intel.js` 处理，同时提供静态文件、SPA 路由和 API 查询。

## 技术栈

- 原生 HTML / CSS / JS，无框架，无构建步骤
- Vercel Serverless Functions
- RDAP（主）+ WHOIS（备）获取注册数据
- DNS-over-HTTPS 解析 DNS 记录

## 许可

MIT
