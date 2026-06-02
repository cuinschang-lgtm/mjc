# 网易云“免费 API”接入与网站配置指南

本项目当前用于补全专辑详情页的曲目列表、艺术家简介、热评摘录等内容。由于网易云没有面向第三方开发者公开的“官方免费数据 API”，业内常用做法是部署一个开源的网易云 API 代理服务（非官方），由你自己托管后再让本网站调用。

请只用于补全公开信息展示，不要用于绕过付费/版权限制或批量爬取。

## 方案概览

推荐方案：自托管 **NeteaseCloudMusicApi（非官方）**，把它当作“免费 API 网关”。

本网站已支持通过环境变量切换数据源：
- `NETEASE_API_BASE_URL`：你的 NeteaseCloudMusicApi 服务地址（例如 `http://localhost:3005` 或 `https://xxx.onrender.com`）
- `NETEASE_API_COOKIE`：可选，网易云登录 Cookie（用于提高部分接口稳定性；不建议放到前端，只放服务端环境变量）

如果你不配置 `NETEASE_API_BASE_URL`，网站会继续尝试直连 `music.163.com` 的旧接口（可能更容易失败，从而出现“缺少信息”）。

## 1）获取与部署 API（两种方式）

### A. 本地部署（最简单，适合你先验证效果）

1. 打开 GitHub 仓库（浏览器访问）  
   - 搜索并打开：`Binaryify/NeteaseCloudMusicApi`
2. 克隆到本地（命令行）

```bash
git clone https://github.com/Binaryify/NeteaseCloudMusicApi.git
cd NeteaseCloudMusicApi
npm install
```

3. 启动服务（建议改端口避免和 Next.js 冲突）

```bash
set PORT=3005
npm start
```

4. 用浏览器验证服务可用  
   - 打开：`http://localhost:3005/search?keywords=Jay&type=10&limit=1`
   - 正常应返回 JSON

### B. 云端部署（推荐长期使用）

推荐使用 Render（支持 Node 服务持续运行，配置简单）。

1. 打开 Render  
   - https://render.com/
2. 登录后选择 New → Web Service
3. 连接你的 GitHub，选择 `Binaryify/NeteaseCloudMusicApi` 仓库（可 fork 到你名下）
4. 关键配置建议：
   - Runtime：Node
   - Build Command：`npm install`
   - Start Command：`npm start`
   - Health Check Path：`/`
5. 部署完成后，Render 会给你一个公开地址，例如：  
   - `https://netease-api-xxx.onrender.com`
6. 用浏览器验证：
   - `https://netease-api-xxx.onrender.com/search?keywords=Jay&type=10&limit=1`

## 2）配置到本网站（本项目）

1. 打开本项目根目录的 `.env` 文件，新增（或修改）：

```env
NETEASE_API_BASE_URL=http://localhost:3005
NETEASE_API_COOKIE=
```

如果你部署在云端，把 `NETEASE_API_BASE_URL` 换成云端地址，例如：

```env
NETEASE_API_BASE_URL=https://netease-api-xxx.onrender.com
```

2. 重启本项目开发服务器（Next.js 需要读取新的 env）

3. 打开专辑详情页，点击“重新抓取”（或刷新）验证曲目/简介被补全

## 3）常见问题排查

### 仍然显示“缺少信息”
- 先确认 `NETEASE_API_BASE_URL` 是否生效：  
  打开任意专辑详情页，访问：  
  `/api/album-details?albumId=<你的专辑id>&refresh=1`  
  看返回的 `basic.tracks`、`content.artistBio` 是否为空。

### 接口偶发 403 / 频繁失败
- 尝试设置 `NETEASE_API_COOKIE`（仅服务端环境变量），并确保不要泄露到浏览器端。
- 云端部署建议开启基础防护（限流/缓存），避免被判定为异常访问。

### 端口冲突
- NeteaseCloudMusicApi 默认端口常见是 3000，和 Next.js 冲突时，改为 3005/3006 等即可。

