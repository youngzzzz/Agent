# 部署到 Vercel

## 一、配置环境变量

无论本地还是 Vercel，都需要这 3 个变量：

| Key | 说明 | 示例 |
|---|---|---|
| `LLM_API_KEY` | 你在供应商后台申请的 API Key | `sk-xxx` / `eyJ...` |
| `LLM_BASE_URL` | OpenAI 兼容 base URL | `https://api.minimaxi.com/v1` |
| `LLM_MODEL` | 模型名 | `MiniMax-Text-01` |

### 各家 Provider 速查

| Provider | LLM_BASE_URL | LLM_MODEL 示例 | Key 申请 |
|---|---|---|---|
| **MiniMax** | `https://api.minimaxi.com/v1` | `MiniMax-Text-01` / `abab6.5s-chat` | https://platform.minimaxi.com/ |
| **DeepSeek** | `https://api.deepseek.com/v1` | `deepseek-chat` / `deepseek-reasoner` | https://platform.deepseek.com/ |
| **智谱 GLM** | `https://open.bigmodel.cn/api/paas/v4` | `glm-4-flash`（免费）/ `glm-4-plus` | https://bigmodel.cn/ |
| **通义千问** | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen-plus` / `qwen-turbo` | https://dashscope.aliyun.com/ |
| **Moonshot** | `https://api.moonshot.cn/v1` | `moonshot-v1-32k` | https://platform.moonshot.cn/ |
| **OpenRouter** | `https://openrouter.ai/api/v1` | `anthropic/claude-sonnet-4` 等 | https://openrouter.ai/ |
| **OpenAI** | `https://api.openai.com/v1` | `gpt-4o-mini` | https://platform.openai.com/ |

> 切换 Provider：**只改这 3 个环境变量**，代码一行不动。

## 二、本地调试

```bash
cp .env.example .env.local
# 编辑 .env.local 填入你的 LLM_API_KEY / LLM_BASE_URL / LLM_MODEL
npm install
npm run dev
```

打开 http://localhost:3000，提交表单看真实生成。

如果想先不接 LLM 跑通界面：在 `.env.local` 里设 `NEXT_PUBLIC_USE_REAL_LLM=false`，全部走本地 mock。

## 三、Vercel 部署

1. 访问 https://vercel.com/new → 选你的 GitHub 仓库 → **Import**
2. Framework Preset：**Next.js**（自动识别），不用改
3. **Environment Variables** 加上面 3 条（Production / Preview / Development 全勾）
4. 点 **Deploy**，等 1-2 分钟

之后每次 `git push origin main` 自动重新部署。

## 四、想换 Provider 怎么办？

- **本地**：改 `.env.local` 里的 3 个变量 → 重启 `npm run dev`
- **Vercel**：Project → Settings → Environment Variables → 改完 → Deployments → 最新一条点 "Redeploy"

代码完全不用动。

## 五、关键文件

| 文件 | 作用 |
|---|---|
| [lib/llm.ts](lib/llm.ts) | LLM 适配层，读环境变量返回 OpenAI client |
| [app/api/generate/route.ts](app/api/generate/route.ts) | 生成四层拆解 JSON |
| [app/api/chat/route.ts](app/api/chat/route.ts) | 模块对话流式接口 |
| [lib/prompts.ts](lib/prompts.ts) | 系统提示词与 JSON Schema 约束 |
| [lib/mock-api.ts](lib/mock-api.ts) | 前端调用层，真实 API 失败自动回退 mock |

## 六、安全

- `LLM_API_KEY` **不要**加 `NEXT_PUBLIC_` 前缀，否则会被打包进前端 bundle 暴露给所有人
- 路由都标了 `export const runtime = "nodejs"`，确保 Key 只在服务端可见
- 真实生产建议加：速率限制（Vercel KV / Upstash）、请求体校验、用户鉴权
