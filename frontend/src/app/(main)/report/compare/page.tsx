"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/stores/authStore";

interface CompareData {
  report_a: {
    id: string;
    total_score: number;
    created_at: string;
  };
  report_b: {
    id: string;
    total_score: number;
    created_at: string;
  };
  score_change: number;
  dimension_changes: Record<string, {
    before: number;
    after: number;
    change: number;
  }>;
  dimension_names: Record<string, string>;
  improved_dimensions: string[];
  declined_dimensions: string[];
}

function CompareContent() {
  const searchParams = useSearchParams();
  const token = useAuthStore((state) => state.token);
  
  const beforeId = searchParams.get("before");
  const afterId = searchParams.get("after");
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CompareData | null>(null);

  useEffect(() => {
    const fetchCompare = async () => {
      if (!beforeId || !afterId) {
        setError("请选择两份报告进行对比");
        setLoading(false);
        return;
      }
      
      try {
        const res = await fetch(`/api/v1/reports/compare?before_id=${beforeId}&after_id=${afterId}`, {
          headers: { "Authorization": `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("加载失败");
        const result = await res.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "加载失败");
      } finally {
        setLoading(false);
      }
    };
    
    fetchCompare();
  }, [beforeId, afterId, token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-text-secondary">加载对比数据...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <span className="material-symbols-outlined text-6xl text-text-muted mb-4">compare</span>
        <p className="text-text-secondary mb-4">{error || "暂无对比数据"}</p>
        <Link href="/dashboard" className="px-4 py-2 bg-blue-500 text-white rounded-lg">
          返回历史记录
        </Link>
      </div>
    );
  }

  const dimensionLabels: Record<string, string> = data.dimension_names || {
    opening: "开场白",
    discovery: "需求挖掘",
    value_presentation: "价值呈现",
    objection_handling: "异议处理",
    closing: "促成成交",
    communication: "沟通表达",
  };

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="mb-8">
        <Link href="/dashboard" className="text-sm text-text-muted hover:text-blue-500 flex items-center gap-1 mb-4">
          <span className="material-symbols-outlined text-sm">arrow_back</span>
          返回历史记录
        </Link>
        <h1 className="text-2xl font-bold text-text-primary">Before/After 对比</h1>
        <p className="text-text-secondary mt-1">查看两次测评的进步情况</p>
      </div>

      {/* Score Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Before */}
        <div className="bg-surface-card border border-border-dark rounded-2xl p-6 text-center">
          <p className="text-text-secondary text-sm mb-2">之前</p>
          <p className="text-5xl font-bold text-text-secondary">{data.report_a.total_score}</p>
          <p className="text-xs text-text-muted mt-1">分</p>
          {data.report_a.created_at && (
            <p className="text-xs text-text-muted mt-2">{new Date(data.report_a.created_at).toLocaleDateString('zh-CN')}</p>
          )}
        </div>

        {/* Delta */}
        <div className={`bg-gradient-to-br ${data.score_change >= 0 ? 'from-emerald-500/20 to-blue-500/20 border-emerald-500/30' : 'from-red-500/20 to-orange-500/20 border-red-500/30'} border rounded-2xl p-6 text-center flex flex-col items-center justify-center`}>
          <span className={`material-symbols-outlined text-3xl mb-2 ${data.score_change >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
            {data.score_change >= 0 ? 'trending_up' : 'trending_down'}
          </span>
          <p className={`text-4xl font-bold ${data.score_change >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
            {data.score_change >= 0 ? `+${data.score_change}` : data.score_change}
          </p>
          <p className="text-sm text-text-secondary mt-1">分数变化</p>
        </div>

        {/* After */}
        <div className="bg-surface-card border border-blue-500/30 rounded-2xl p-6 text-center">
          <p className="text-blue-400 text-sm mb-2">之后</p>
          <p className="text-5xl font-bold text-blue-500">{data.report_b.total_score}</p>
          <p className="text-xs text-text-muted mt-1">分</p>
          {data.report_b.created_at && (
            <p className="text-xs text-text-muted mt-2">{new Date(data.report_b.created_at).toLocaleDateString('zh-CN')}</p>
          )}
        </div>
      </div>

      {/* Dimension Comparison */}
      <div className="bg-surface-card border border-border-dark rounded-2xl p-6 mb-8">
        <h2 className="text-text-primary font-bold text-lg mb-6 flex items-center gap-2">
          <span className="material-symbols-outlined text-blue-500">bar_chart</span>
          维度对比
        </h2>
        
        <div className="space-y-4">
          {Object.entries(data.dimension_changes).map(([name, dim]) => {
            const isImproved = dim.change > 0;
            const isDeclined = dim.change < 0;
            
            return (
              <div key={name} className="flex items-center gap-4">
                <div className="w-32 text-sm text-text-secondary">
                  {dimensionLabels[name] || name}
                </div>
                <div className="flex-1 flex items-center gap-2">
                  <div className="flex-1 h-6 bg-bg-elevated rounded-full overflow-hidden flex">
                    <div 
                      className="h-full bg-zinc-500 transition-all"
                      style={{ width: `${dim.before}%` }}
                    />
                  </div>
                  <span className="text-text-muted text-sm w-8">{dim.before}</span>
                </div>
                <span className="material-symbols-outlined text-text-muted">arrow_forward</span>
                <div className="flex-1 flex items-center gap-2">
                  <div className="flex-1 h-6 bg-bg-elevated rounded-full overflow-hidden flex">
                    <div 
                      className={`h-full transition-all ${isImproved ? "bg-emerald-500" : isDeclined ? "bg-red-400" : "bg-zinc-500"}`}
                      style={{ width: `${dim.after}%` }}
                    />
                  </div>
                  <span className={`text-sm w-8 ${isImproved ? "text-emerald-500" : isDeclined ? "text-red-400" : "text-text-secondary"}`}>
                    {dim.after}
                  </span>
                </div>
                <div className={`w-14 text-right text-sm font-medium ${
                  isImproved ? "text-emerald-500" : isDeclined ? "text-red-400" : "text-text-muted"
                }`}>
                  {dim.change > 0 ? `+${dim.change}` : dim.change}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Improved Dimensions */}
      {data.improved_dimensions.length > 0 && (
        <div className="bg-surface-card border border-border-dark rounded-2xl p-6 mb-8">
          <h2 className="text-text-primary font-bold text-lg mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-500">emoji_events</span>
            进步维度
          </h2>
          <div className="flex flex-wrap gap-2">
            {data.improved_dimensions.map((dim) => (
              <span 
                key={dim}
                className="px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 text-sm border border-emerald-500/20"
              >
                {dimensionLabels[dim] || dim}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Declined Dimensions */}
      {data.declined_dimensions.length > 0 && (
        <div className="bg-surface-card border border-border-dark rounded-2xl p-6 mb-8">
          <h2 className="text-text-primary font-bold text-lg mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-500">trending_down</span>
            需要注意
          </h2>
          <div className="flex flex-wrap gap-2">
            {data.declined_dimensions.map((dim) => (
              <span 
                key={dim}
                className="px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-400 text-sm border border-amber-500/20"
              >
                {dimensionLabels[dim] || dim}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ReportComparePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
      </div>
    }>
      <CompareContent />
    </Suspense>
  );
}
