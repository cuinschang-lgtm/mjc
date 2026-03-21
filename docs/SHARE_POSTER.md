# 生成分享海报

## 功能说明

专辑详情页提供“分享”按钮，可将隐藏的海报组件渲染为 PNG 并自动触发浏览器下载。

## 关键文件

- 海报组件（两种风格）：[CanvasPoster.js](file:///c:/Users/%E5%BC%A0%E4%B9%A6%E8%88%AA/OneDrive/%E5%B7%A5%E4%BD%9C/mjc/components/CanvasPoster.js)
- 生成与下载工具：`lib/sharePoster.js`
- 跨域图片代理：`app/api/image-proxy/route.js`
- 详情页接入示例：`app/(main)/album/[albumId]/page.js`

## 使用方式

1. 打开任意专辑详情页。
2. 在顶部操作区选择海报风格：`玻璃` / `黑胶`。
3. 点击 `分享`，等待生成完成后浏览器会弹出下载。

## 文件名规则

默认命名：`专辑名_艺人_分享海报.png`。

会自动去除 Windows 不允许的文件名字符（如 `\\ / : * ? " < > |`）。

## 图片与跨域

生成海报时会使用同源图片代理 `/api/image-proxy?url=...` 拉取封面，避免因第三方图片未开放 CORS 导致 `html-to-image` 渲染失败。

## 性能建议

- 海报容器为离屏渲染，不会影响页面布局。
- `pixelRatio=2` 以保证高清输出，如需降低体积可将 `pixelRatio` 调低。

