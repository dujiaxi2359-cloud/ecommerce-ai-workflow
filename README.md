# 电商设计生图工作流

基于 Next.js App Router、TypeScript、Tailwind CSS 和 OpenAI Node SDK 的电商 AI 生图工作台。它面向电商设计师、运营和 AIGC 设计师，重点不是普通文生图，而是产品主图、详情页套图、海报、参考图模仿和同一产品多风格展示。

## 工作流

- 文本生图：适合背景图、概念海报、活动图和非严格产品一致性的创意图。
- 参考图模仿生图：参考图只用于风格、构图、排版、色调和氛围；产品图作为唯一真实主体。
- 产品图工作流：生成白底图、场景图、高级质感图、电商主图。
- 产品风格变体：上传同一产品，生成不同背景、光影、场景和海报感展示。
- 电商详情图：四步式套图流程，支持产品资料、套图规划、蓝图编辑、批量生成。
- 海报工作流：上传产品图和 logo，生成促销、活动、节日、上新、品牌海报。

## 产品保护逻辑

所有产品相关工作流默认开启产品保护：产品主体锁定、颜色严格保留、结构严格保留、logo 严格保留、配件严格保留。

系统会在 prompt 中自动加入约束：上传产品图是固定主产品主体，保持外观、颜色、结构、按键、屏幕、接口、logo、配件和轮廓一致；只改变背景、光影、场景、排版、氛围、卖点卡片和装饰元素，不能重新设计或替换产品。

## 详情图蓝图

详情图工作流支持：

- 平台：TikTok Shop、Shopee、Lazada、Amazon / 亚马逊、WB/OZON、独立站、小红书、抖音、通用电商。
- 数量：3 张基础版、5 张标准版、9 张完整版、12 张强化版。
- 语言：中文、英文、葡语（巴西）、西语（墨西哥）、俄文。
- 文字模式：默认可编辑文字层，减少 AI 直接生成文字导致的错字和乱码。

Amazon / 亚马逊平台已内置专业、清晰、白底优先、参数明确、避免夸张营销词的详情图规划风格。

## 项目结构

```text
app/
  page.tsx
  api/
    generate-image/route.ts
    generate-reference/route.ts
    reference-mimic/route.ts
    product-workflow/route.ts
    product-variant/route.ts
    detail-blueprint/route.ts
    detail-generate/route.ts
    detail-batch-generate/route.ts
    detail-export/route.ts
    poster-generate/route.ts
    check-openai/route.ts
    openai-status/route.ts
lib/
  openai.ts
  image-generation.ts
  promptBuilders.ts
  prompt-builders.ts
  detailBlueprintBuilder.ts
  history.ts
  imageUtils.ts
  templates/
    platformPresets.ts
    stylePresets.ts
    detailLayouts.ts
    detailTypes.ts
    posterTypes.ts
    productVariantStyles.ts
types/
  workflow.ts
  detail.ts
  history.ts
```

## 安装依赖

```bash
npm install
```

当前工作区也带便携 npm：

```bash
.tools\node-v24.14.0-win-x64\npm.cmd install
```

## 配置环境变量

复制 `.env.example` 为 `.env.local`，然后填写密钥。

OpenAI 官方或兼容网关：

```bash
OPENAI_API_KEY=sk-your-api-key
OPENAI_BASE_URL=
OPENAI_IMAGE_MODEL=gpt-image-2
```

Azure OpenAI 图片服务：

```bash
AZURE_OPENAI_ENDPOINT=https://your-resource.cognitiveservices.azure.com/
AZURE_OPENAI_API_KEY=your-azure-openai-key
OPENAI_API_VERSION=2025-04-01-preview
DEPLOYMENT_NAME=gpt-image-2
```

如果同时配置 Azure 和 OpenAI，本项目图片生成优先使用 Azure，OpenAI 官方或兼容网关走独立路径。

## 启动

```bash
npm run dev
```

或：

```bash
.tools\node-v24.14.0-win-x64\npm.cmd run dev
```

浏览器打开：

```text
http://localhost:3000
```

## 稳定运行

如果希望本机服务自动保活，使用：

```bash
npm run start:keepalive
```

或使用便携 Node：

```bash
.tools\node-v24.14.0-win-x64\node.exe scripts\keep-alive.js
```

该模式会监听 `3000` 端口，服务意外退出后会自动重启，并把日志写入 `logs/server-keepalive.log`。

## 给同事访问

局域网临时共享：

```bash
npm run build
npm run start:lan
```

同事访问你的电脑局域网 IP，例如：

```text
http://你的局域网IP:3000
```

## 连接检测

页面内可以点击“检测图片服务”，也可以请求：

```text
GET /api/check-openai
GET /api/openai-status
```

会返回 API Key 缺失、Key 错误、403 权限或地区限制、timeout、network error、DNS error、baseURL 配置错误、连接成功等中文提示。接口不会输出完整 API Key。

## 常见问题

- `429 servicing too many requests`：服务端额度或区域负载限制，降低数量和质量，稍后重试，或换 Azure 区域/部署。
- `Invalid size`：图片接口要求宽高能被 16 整除，项目会自动把不合规尺寸修正到最近可用尺寸。
- 参考图生成不像产品：必须使用支持图片编辑/参考图输入的服务端接口；只有纯文生图接口无法保证产品一致。
- 同事没有历史记录：历史记录会同步到服务端 `data/history`，但每台电脑浏览器 localStorage 不共享；同事需要访问同一个运行中的服务端。
