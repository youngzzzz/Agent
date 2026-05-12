# AI Transformation Canvas

把任意行业场景，拆成一套可落地的 AI 产品方案。Next.js 14 + React + TypeScript + Tailwind + lucide-react + Zustand。

## 启动

```bash
npm install
npm run dev
# 打开 http://localhost:3000
```

## 文件结构

```
app/
  page.tsx                 # 首页 / 创建分析
  workspace/[id]/page.tsx  # 四层拆解工作台
  history/page.tsx         # 历史项目
  templates/page.tsx       # 模板库
  help/page.tsx            # 帮助
components/
  top-nav.tsx              # 顶部导航
  workspace-sidebar.tsx    # 左侧 260px 导航
  layer-section.tsx        # 单层拆解 Section
  module-card.tsx          # 模块卡片
  chat-drawer.tsx          # 右侧 380px AI 对话抽屉
  module-detail-drawer.tsx # 模块详情抽屉
  ui/                      # button / primitives / toast
lib/
  types.ts                 # Project / Layer / Module / ChatMessage
  mock-data.ts             # 三个示例项目 + 模板生成器
  mock-api.ts              # mockGenerateAnalysis / chatWithModuleContext
  store.ts                 # Zustand + localStorage 持久化
  utils.ts                 # cn / uid / formatDate
```

## 接入真实 LLM

`lib/mock-api.ts` 已预留两个函数签名：

```ts
generateAnalysisWithLLM(input: GenerateAnalysisInput): Promise<Project>
chatWithModuleContext(messages, project, module): Promise<ChatMessage>
```

替换内部实现为真实模型 API 即可，UI 与数据结构无需改动。
