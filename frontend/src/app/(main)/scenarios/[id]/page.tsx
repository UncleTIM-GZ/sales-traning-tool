"use client";

/**
 * 场景详情页面
 */

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { scenarioApi, Scenario } from "@/lib/api";

export default function ScenarioDetailPage() {
  const params = useParams();
  const router = useRouter();
  const scenarioId = params.id as string;

  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModeModal, setShowModeModal] = useState(false);
  const [selectedType, setSelectedType] = useState<"voice" | "text">("text");

  useEffect(() => {
    const fetchScenario = async () => {
      try {
        setLoading(true);
        const data = await scenarioApi.get(scenarioId);
        setScenario(data);
      } catch (err) {
        setError("场景不存在或加载失败");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchScenario();
  }, [scenarioId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-text-secondary">加载场景中...</p>
        </div>
      </div>
    );
  }

  if (error || !scenario) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-text-secondary">
        <span className="material-symbols-outlined text-6xl mb-4">error</span>
        <p className="text-lg font-medium">{error || "场景不存在"}</p>
        <Link href="/scenarios" className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg text-sm">
          返回场景列表
        </Link>
      </div>
    );
  }

  const isSales = scenario.track === "sales";
  const tags = scenario.config?.tags || [];
  const channel = scenario.config?.channel || "";
  const aiName = scenario.config?.ai_name || scenario.config?.persona || "";
  const background = scenario.config?.background || "";
  const objective = scenario.config?.objective || "";
  const aiPainPoints = scenario.config?.ai_pain_points || [];
  const successCriteria = scenario.config?.success_criteria || [];

  return (
    <div className="max-w-4xl mx-auto pb-20">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => router.back()}
          className="w-10 h-10 rounded-xl bg-surface-card border border-border-dark flex items-center justify-center text-text-secondary hover:text-text-primary hover:border-zinc-600 transition-all"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
              isSales ? "bg-blue-500/20 text-blue-400" : "bg-emerald-500/20 text-emerald-400"
            }`}>
              {isSales ? "销冠培养" : "社恐培养"}
            </span>
            {scenario.is_custom && (
              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-purple-500/20 text-purple-400">
                自定义场景
              </span>
            )}
            <div className="flex items-center gap-0.5 ml-2">
              {[1, 2, 3, 4, 5].map((level) => (
                <div
                  key={level}
                  className={`w-2 h-2 rounded-full ${
                    level <= scenario.difficulty
                      ? isSales ? "bg-blue-500" : "bg-emerald-500"
                      : "bg-bg-active"
                  }`}
                />
              ))}
            </div>
          </div>
          <h1 className="text-text-primary text-2xl font-bold">{scenario.name}</h1>
        </div>
      </div>

      {/* 场景信息卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* 左侧：基础信息 */}
        <div className="bg-surface-card border border-border-dark rounded-2xl p-6">
          <h2 className="text-text-primary font-bold text-lg mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-500">info</span>
            场景介绍
          </h2>
          
          <p className="text-text-primary text-sm leading-relaxed mb-4">
            {scenario.description || "暂无描述"}
          </p>

          {channel && (
            <div className="flex items-center gap-2 text-text-secondary text-sm mb-3">
              <span className="material-symbols-outlined text-lg">
                {channel === "电话" ? "call" : channel === "面对面" ? "groups" : "videocam"}
              </span>
              沟通渠道：{channel}
            </div>
          )}

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {tags.map((tag: string) => (
                <span key={tag} className="px-2 py-1 bg-bg-elevated rounded text-xs text-text-secondary">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 右侧：AI角色 */}
        <div className={`rounded-2xl p-6 ${
          isSales ? "bg-blue-500/10 border border-blue-500/20" : "bg-emerald-500/10 border border-emerald-500/20"
        }`}>
          <h2 className={`font-bold text-lg mb-4 flex items-center gap-2 ${
            isSales ? "text-blue-400" : "text-emerald-400"
          }`}>
            <span className="material-symbols-outlined">smart_toy</span>
            AI 角色
          </h2>

          {aiName && (
            <div className="mb-4">
              <div className="text-text-primary font-bold text-lg">{aiName}</div>
              <div className="text-text-secondary text-sm">{scenario.config?.persona}</div>
            </div>
          )}

          {scenario.config?.ai_personality && (
            <p className="text-text-primary text-sm mb-4">{scenario.config.ai_personality}</p>
          )}

          {aiPainPoints.length > 0 && (
            <div className="mb-4">
              <div className="text-text-muted text-xs uppercase tracking-wider mb-2">角色顾虑</div>
              {aiPainPoints.map((point: string, i: number) => (
                <div key={i} className="flex items-center gap-2 text-sm text-text-primary py-1">
                  <span className="material-symbols-outlined text-orange-500 text-sm">warning</span>
                  {point}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 场景背景 */}
      {background && (
        <div className="bg-surface-card border border-border-dark rounded-2xl p-6 mb-8">
          <h2 className="text-text-primary font-bold text-lg mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-purple-500">description</span>
            场景背景
          </h2>
          <p className="text-text-primary text-sm leading-relaxed">{background}</p>
          
          {objective && (
            <div className="mt-4 p-4 bg-purple-500/10 rounded-xl border border-purple-500/20">
              <div className="text-purple-400 text-xs uppercase tracking-wider mb-1">训练目标</div>
              <div className="text-text-primary">{objective}</div>
            </div>
          )}

          {successCriteria.length > 0 && (
            <div className="mt-4">
              <div className="text-text-muted text-xs uppercase tracking-wider mb-2">成功标准</div>
              {successCriteria.map((c: string, i: number) => (
                <div key={i} className="flex items-center gap-2 text-sm text-text-primary py-1">
                  <span className="material-symbols-outlined text-emerald-500 text-sm">check_circle</span>
                  {c}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex gap-4">
        <button
          onClick={() => {
            setSelectedType("voice");
            setShowModeModal(true);
          }}
          className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-xl font-medium transition-all ${
            isSales
              ? "bg-blue-500 hover:bg-blue-400 text-white shadow-lg shadow-blue-500/25"
              : "bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/25"
          }`}
        >
          <span className="material-symbols-outlined">mic</span>
          开始语音训练
        </button>
        <button
          onClick={() => {
            setSelectedType("text");
            setShowModeModal(true);
          }}
          className="flex-1 flex items-center justify-center gap-2 py-4 rounded-xl font-medium bg-bg-elevated hover:bg-bg-active text-text-primary transition-all"
        >
          <span className="material-symbols-outlined">chat</span>
          开始文字训练
        </button>
      </div>

      {/* 模式选择弹窗 */}
      {showModeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-surface-card border border-border-dark rounded-2xl p-6 w-full max-w-md mx-4 animate-fadeIn">
            <h3 className="text-text-primary text-xl font-bold mb-2">选择训练模式</h3>
            <p className="text-text-secondary text-sm mb-6">训练模式有AI教练实时提示，考试模式无提示且记录成绩</p>
            
            <div className="space-y-3 mb-6">
              {/* 训练模式 */}
              <button
                onClick={() => {
                  const path = selectedType === "voice" 
                    ? `/training/${scenarioId}/voice?mode=train`
                    : `/training/${scenarioId}?mode=train`;
                  router.push(path);
                }}
                className="w-full p-4 rounded-xl border-2 border-border-dark bg-surface-card hover:border-blue-500/50 hover:bg-blue-500/5 transition-all text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-emerald-500 text-2xl">school</span>
                  </div>
                  <div className="flex-1">
                    <div className="text-text-primary font-bold">训练模式</div>
                    <div className="text-text-secondary text-sm">有AI教练实时提示，可暂停、重练</div>
                  </div>
                  <span className="material-symbols-outlined text-text-muted group-hover:text-blue-500 transition-colors">chevron_right</span>
                </div>
              </button>

              {/* 考试模式 */}
              <button
                onClick={() => {
                  const path = selectedType === "voice" 
                    ? `/training/${scenarioId}/voice?mode=exam`
                    : `/training/${scenarioId}?mode=exam`;
                  router.push(path);
                }}
                className="w-full p-4 rounded-xl border-2 border-border-dark bg-surface-card hover:border-amber-500/50 hover:bg-amber-500/5 transition-all text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-amber-500 text-2xl">quiz</span>
                  </div>
                  <div className="flex-1">
                    <div className="text-text-primary font-bold">考试模式</div>
                    <div className="text-text-secondary text-sm">无提示、不可暂停，成绩记录入档</div>
                  </div>
                  <span className="material-symbols-outlined text-text-muted group-hover:text-amber-500 transition-colors">chevron_right</span>
                </div>
              </button>
            </div>

            <button
              onClick={() => setShowModeModal(false)}
              className="w-full py-3 rounded-lg bg-bg-elevated text-text-secondary hover:bg-bg-active transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
