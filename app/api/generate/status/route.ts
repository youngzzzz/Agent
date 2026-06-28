import { NextRequest, NextResponse } from "next/server";
import { getJob } from "@/lib/job-store";

export const runtime = "nodejs";

/** 轮询生成任务状态：GET /api/generate/status?id=<jobId> */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "缺少 id" }, { status: 400 });
  }

  const job = await getJob(id);
  if (!job) {
    // 任务不存在或已过期（结果保留窗口外）
    return NextResponse.json({ status: "expired" }, { status: 404 });
  }

  return NextResponse.json(job);
}
