# 部署到 Vercel（带真实 LLM）

## 1. 本地准备

```bash
npm install
cp .env.example .env.local
# 编辑 .env.local，填入你的 ANTHROPIC_API_KEY
npm run dev
```

打开 http://localhost:3000 验证：
- 首页表单提交后能进入工作台并看到真实 LLM 生成的四层拆解
- 卡片"和 AI 讨论"打开侧栏，发送消息能看到流式回复

如果想先不接 LLM 跑通界面：在 `.env.local` 里设 `NEXT_PUBLIC_USE_REAL_LLM=false`，会自动走本地 mock。

## 2. 推送到 GitHub

```bash
git init
git add .
git commit -m "init: ai transformation canvas with real LLM"
git branch -M main
git remote add origin https://github.com/<你>/ai-transformation-canvas.git
git push -u origin main
```

## 3. Vercel 导入

1. 访问 https://vercel.com/new → 选择 GitHub 仓库 → Import
2. Framework Preset：**Next.js**（自动识别），无需改任何字段
3. **Environment Variables** 添加：

   | Key | Value | Environment |
   |---|---|---|
   | `ANTHROPIC_API_KEY` | `sk-ant-...` | Production / Preview / Development 全勾 |

4. 点 **Deploy**，1-2 分钟拿到 `xxx.vercel.app`

## 4. 关键文件

| 文件 | 作用 |
|---|---|
| [app/api/generate/route.ts](app/api/generate/route.ts) | 服务端：调 Claude 生成四层拆解 JSON |
| [app/api/chat/route.ts](app/api/chat/route.ts) | 服务端：模块对话，流式返回纯文本 |
| [lib/prompts.ts](lib/prompts.ts) | 系统提示词与 JSON Schema 约束 |
| [lib/mock-api.ts](lib/mock-api.ts) | 前端调用层：真实 API 失败自动回退 mock |

## 5. 模型与成本

- 默认模型：`claude-opus-4-7`，自适应思考 + `effort: high`
- 系统提示词使用 `cache_control: ephemeral`，重复生成同类模板时显著降本
- `app/api/generate` `maxDuration = 60s`（Vercel 默认上限，Hobby 计划够用）

如要降本，把 `route.ts` 里的 model 改成 `claude-sonnet-4-6`，effort 调成 `medium`。

## 6. 安全提醒

- `ANTHROPIC_API_KEY` **不要**加 `NEXT_PUBLIC_` 前缀，否则会被打包进前端 bundle
- 真实生产环境建议加：
  - 速率限制（Vercel KV / Upstash Ratelimit）
  - 请求体校验（Zod）
  - 用户鉴权（Clerk / NextAuth）
