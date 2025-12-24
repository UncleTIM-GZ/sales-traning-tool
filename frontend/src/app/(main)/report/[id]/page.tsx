"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { reportApi, type ReportDetail } from "@/lib/api";

export default function ReportPage() {
  const params = useParams();
  const reportId = params.id as string;

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ReportDetail | null>(null);

  useEffect(() => {
    const loadReport = async () => {
      try {
        setIsLoading(true);
        const data = await reportApi.get(reportId);
        setReport(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "加载失败");
      } finally {
        setIsLoading(false);
      }
    };

    if (reportId) {
      loadReport();
    }
  }, [reportId]);

  // 加载状态
  if (isLoading) {
    return (
      <div className="flex flex-col gap-8 pb-20 animate-pulse">
        <div className="h-8 bg-surface-card rounded w-64" />
        <div className="h-40 bg-surface-card rounded-xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-36 bg-surface-card rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-72 bg-surface-card rounded-xl" />
          <div className="h-72 bg-surface-card rounded-xl" />
        </div>
      </div>
    );
  }

  // 错误状态
  if (error || !report) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <span className="material-symbols-outlined text-6xl text-red-400 mb-4">error</span>
        <p className="text-text-secondary mb-4">{error || "报告不存在"}</p>
        <Link
          href="/dashboard"
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          返回记录列表
        </Link>
      </div>
    );
  }

  // 从 dimensions 提取分数
  const getDimensionScore = (name: string): number => {
    const dim = report.dimensions?.find((d) => d.name === name);
    if (!dim) return 0;
    return Math.round((dim.score / dim.max_score) * 100);
  };

  const scores = [
    {
      title: "本次总得分",
      value: report.total_score,
      icon: "grade",
      color: "blue",
      subtitle: "综合表现评分",
    },
    {
      title: "表达能力",
      value: getDimensionScore("communication") || getDimensionScore("opening"),
      icon: "sentiment_satisfied",
      color: "emerald",
      subtitle: "语言组织与情绪",
    },
    {
      title: "逻辑思维",
      value: getDimensionScore("discovery") || getDimensionScore("value_presentation"),
      icon: "psychology_alt",
      color: "blue",
      subtitle: "需求挖掘与分析",
    },
    {
      title: "应对能力",
      value: getDimensionScore("objection_handling") || getDimensionScore("closing"),
      icon: "speed",
      color: "emerald",
      subtitle: "异议处理与促成",
    },
  ];

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="flex flex-col gap-8 pb-20">
      {/* Breadcrumb */}
      <div className="flex flex-wrap items-center gap-2 px-1">
        <Link href="/dashboard" className="text-text-muted hover:text-blue-500 text-xs md:text-sm font-medium transition-colors flex items-center gap-1">
          <span className="material-symbols-outlined text-sm">home</span> 首页
        </Link>
        <span className="material-symbols-outlined text-text-muted text-xs">chevron_right</span>
        <Link href="/dashboard" className="text-text-muted hover:text-blue-500 text-xs md:text-sm font-medium transition-colors">历史记录</Link>
        <span className="material-symbols-outlined text-text-muted text-xs">chevron_right</span>
        <span className="text-text-primary text-xs md:text-sm font-medium">训练报告详情</span>
      </div>

      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 pb-6 border-b border-border-dark">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/10 text-blue-500 border border-blue-500/30 tracking-wide">
              训练报告
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-surface-lighter text-text-secondary border border-border-dark tracking-wide">
              v{report.rubric_version}
            </span>
          </div>
          <h1 className="text-text-primary text-3xl md:text-4xl font-bold leading-tight tracking-tight">
            训练报告
          </h1>
          <div className="flex flex-wrap items-center gap-4 text-text-muted text-sm font-medium">
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-blue-500 text-base">calendar_today</span>
              {formatDate(report.created_at)}
            </span>
          </div>
        </div>
        <div className="flex gap-3 w-full lg:w-auto">
          {report.session_id && (
            <Link
              href={`/replay?session=${report.session_id}`}
              className="flex-1 lg:flex-none cursor-pointer items-center justify-center gap-2 rounded-lg h-10 px-6 bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold transition-colors flex shadow-lg shadow-blue-500/20"
            >
              <span className="material-symbols-outlined text-lg">play_circle</span>
              <span className="truncate">查看回放</span>
            </Link>
          )}
          <Link
            href="/dashboard"
            className="flex-1 lg:flex-none cursor-pointer items-center justify-center gap-2 rounded-lg h-10 px-6 bg-surface-lighter hover:bg-surface-card border border-border-dark hover:border-gray-500 text-gray-200 text-sm font-bold transition-colors flex"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
            <span className="truncate">返回列表</span>
          </Link>
        </div>
      </div>

      {/* Score Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {scores.map((score) => (
          <div
            key={score.title}
            className={`flex flex-col justify-between rounded-xl p-6 bg-surface-dark border border-border-dark relative overflow-hidden group hover:border-${score.color}-500/30 transition-all duration-300`}
          >
            <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <span className={`material-symbols-outlined text-9xl text-${score.color}-500`}>{score.icon}</span>
            </div>
            <div>
              <p className="text-text-muted text-sm font-medium uppercase tracking-wider">{score.title}</p>
              <div className="flex items-baseline gap-2 mt-2">
                <span className={`text-5xl font-bold leading-none ${score.color === "blue" ? "text-blue-500" : "text-emerald-500"}`}>
                  {score.value || "--"}
                </span>
                {score.value > 0 && <span className="text-xs font-bold text-text-muted">/ 100</span>}
              </div>
            </div>
            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border-dark">
              <p className="text-xs text-text-muted">{score.subtitle}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Dimensions Detail */}
      {report.dimensions && report.dimensions.length > 0 && (
        <div className="rounded-xl border border-border-dark bg-surface-dark p-6">
          <h3 className="text-text-primary text-lg font-bold mb-6 flex items-center gap-2">
            <span className="w-1 h-5 bg-blue-500 rounded-full"></span>
            能力维度分析
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {report.dimensions.map((dim, i) => (
              <div key={i} className="p-4 bg-surface-lighter rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-text-primary font-medium">{dim.name}</span>
                  <span className={`font-bold ${dim.score >= dim.max_score * 0.8 ? "text-blue-500" : dim.score >= dim.max_score * 0.6 ? "text-emerald-400" : "text-text-secondary"}`}>
                    {dim.score}/{dim.max_score}
                  </span>
                </div>
                <div className="h-2 bg-surface-dark rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${dim.score >= dim.max_score * 0.8 ? "bg-blue-500" : dim.score >= dim.max_score * 0.6 ? "bg-emerald-500" : "bg-zinc-500"}`}
                    style={{ width: `${(dim.score / dim.max_score) * 100}%` }}
                  />
                </div>
                {dim.evidence && dim.evidence.length > 0 && (
                  <p className="text-xs text-text-muted mt-2 line-clamp-2">
                    {dim.evidence[0].text}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Highlights & Improvements */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Highlights */}
        {report.highlights && report.highlights.length > 0 && (
          <div className="flex flex-col rounded-xl border border-border-dark bg-surface-dark p-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-blue-500 to-transparent"></div>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500 border border-blue-500/20">
                <span className="material-symbols-outlined">thumb_up</span>
              </div>
              <h3 className="text-text-primary text-lg font-bold">亮点表现</h3>
            </div>
            <ul className="flex flex-col gap-5">
              {report.highlights.map((item, i) => (
                <li key={i} className="flex gap-4 text-sm text-text-secondary">
                  <span className="material-symbols-outlined text-blue-500 text-lg mt-0.5 shrink-0">check_circle</span>
                  <span>
                    <strong className="text-gray-100 block mb-1">{item.title || item.content || '亮点'}</strong>
                    {item.why || item.content}
                    {item.example && (
                      <span className="block mt-1 text-text-muted italic">&ldquo;{item.example}&rdquo;</span>
                    )}
                    {item.turn_id && (
                      <span className="block mt-1 text-xs text-text-muted">第 {item.turn_id} 轮</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Issues */}
        {report.issues && report.issues.length > 0 && (
          <div className="flex flex-col rounded-xl border border-border-dark bg-surface-dark p-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-amber-500 to-transparent"></div>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20">
                <span className="material-symbols-outlined">tips_and_updates</span>
              </div>
              <h3 className="text-text-primary text-lg font-bold">待改进项</h3>
            </div>
            <ul className="flex flex-col gap-5">
              {report.issues.map((item, i) => (
                <li key={i} className="flex gap-4 text-sm text-text-secondary">
                  <span className={`material-symbols-outlined text-lg mt-0.5 shrink-0 ${item.severity === 'high' ? 'text-red-500' : 'text-amber-500'}`}>warning</span>
                  <span>
                    <strong className="text-gray-100 block mb-1">{item.title || item.content || '待改进'}</strong>
                    {item.why || item.content}
                    {item.original_text && (
                      <span className="block mt-1 text-text-muted italic">原话: &ldquo;{item.original_text}&rdquo;</span>
                    )}
                    {(item.fix || item.better_version) && (
                      <span className="block mt-2 text-emerald-400 text-xs">
                        💡 建议: {item.fix || item.better_version}
                      </span>
                    )}
                    {item.turn_id && (
                      <span className="block mt-1 text-xs text-text-muted">第 {item.turn_id} 轮</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* 证据句 - 对话分析 */}
      {report.evidence_sentences && report.evidence_sentences.length > 0 && (
        <div className="rounded-xl border border-border-dark bg-surface-dark overflow-hidden">
          <div className="px-6 py-5 border-b border-border-dark bg-surface-lighter">
            <h3 className="text-text-primary text-lg font-bold flex items-center gap-2">
              <span className="material-symbols-outlined text-purple-500">format_quote</span>
              对话证据分析
            </h3>
            <p className="text-text-muted text-sm mt-1">从对话中提取的亮点与问题话术</p>
          </div>
          <div className="divide-y divide-border-dark">
            {report.evidence_sentences.map((item, i) => (
              <div key={i} className={`p-5 ${item.is_highlight ? 'bg-blue-500/5' : 'bg-amber-500/5'}`}>
                <div className="flex items-start gap-4">
                  <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${item.is_highlight ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'}`}>
                    #{item.turn_id}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs px-2 py-0.5 rounded ${item.speaker === 'user' ? 'bg-blue-500/20 text-blue-400' : 'bg-zinc-500/20 text-text-secondary'}`}>
                        {item.speaker === 'user' ? '销售' : '客户'}
                      </span>
                      {item.dimension && (
                        <span className="text-xs text-text-muted">{item.dimension}</span>
                      )}
                      {item.is_highlight ? (
                        <span className="text-xs text-blue-400 flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm">thumb_up</span> 亮点
                        </span>
                      ) : (
                        <span className="text-xs text-amber-400 flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm">warning</span> 待改进
                        </span>
                      )}
                    </div>
                    <p className="text-text-primary text-sm mb-2">&ldquo;{item.original_text}&rdquo;</p>
                    {item.issue && (
                      <p className="text-amber-400/80 text-xs mb-2">问题: {item.issue}</p>
                    )}
                    {item.better_version && (
                      <div className="mt-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                        <p className="text-xs text-emerald-400 font-medium mb-1">✨ 更优表达</p>
                        <p className="text-text-primary text-sm">&ldquo;{item.better_version}&rdquo;</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 改写建议 */}
      {report.rewrite_suggestions && report.rewrite_suggestions.length > 0 && (
        <div className="rounded-xl border border-border-dark bg-surface-dark overflow-hidden">
          <div className="px-6 py-5 border-b border-border-dark bg-surface-lighter">
            <h3 className="text-text-primary text-lg font-bold flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-500">edit_note</span>
              话术改写建议
            </h3>
            <p className="text-text-muted text-sm mt-1">基于您的对话，AI 提供的具体改进方案</p>
          </div>
          <div className="divide-y divide-border-dark">
            {report.rewrite_suggestions.map((item, i) => (
              <div key={i} className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xs px-2 py-0.5 rounded bg-bg-active text-text-secondary">第 {item.turn_id} 轮</span>
                  {item.dimension && (
                    <span className="text-xs text-text-muted">{item.dimension}</span>
                  )}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-lg">
                    <p className="text-xs text-red-400 font-bold mb-2 flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">close</span>
                      原表达
                    </p>
                    <p className="text-text-primary text-sm">&ldquo;{item.original}&rdquo;</p>
                  </div>
                  <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-lg">
                    <p className="text-xs text-emerald-400 font-bold mb-2 flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">check</span>
                      改进建议
                    </p>
                    <p className="text-text-primary text-sm">&ldquo;{item.improved}&rdquo;</p>
                  </div>
                </div>
                {item.reason && (
                  <div className="mt-3 flex items-start gap-2">
                    <span className="material-symbols-outlined text-blue-400 text-base mt-0.5">lightbulb</span>
                    <p className="text-xs text-text-secondary">{item.reason}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Replacements (兼容旧数据) */}
      {report.replacements && report.replacements.length > 0 && (
        <div className="rounded-xl border border-border-dark bg-surface-dark overflow-hidden">
          <div className="px-6 py-5 border-b border-border-dark bg-surface-lighter">
            <h3 className="text-text-primary text-lg font-bold flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-500">auto_awesome</span>
              话术改写建议
            </h3>
            <p className="text-text-muted text-sm mt-1">AI 建议的更优表达方式</p>
          </div>
          <div className="divide-y divide-border-dark">
            {report.replacements.map((item, i) => (
              <div key={i} className="p-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-lg">
                    <p className="text-xs text-red-400 font-bold mb-2 flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">close</span>
                      原表达
                    </p>
                    <p className="text-text-primary text-sm">&ldquo;{item.original}&rdquo;</p>
                  </div>
                  <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-lg">
                    <p className="text-xs text-emerald-400 font-bold mb-2 flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">check</span>
                      优化建议
                    </p>
                    <p className="text-text-primary text-sm">&ldquo;{item.better}&rdquo;</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 训练处方 */}
      {report.training_prescription && (
        <div className="rounded-xl border border-border-dark bg-gradient-to-br from-surface-dark to-blue-500/5 overflow-hidden">
          <div className="px-6 py-5 border-b border-border-dark">
            <h3 className="text-text-primary text-lg font-bold flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-500">medical_services</span>
              个性化训练处方
            </h3>
            <p className="text-text-muted text-sm mt-1">基于您的表现，为您定制的专属训练计划</p>
          </div>
          <div className="p-6 space-y-6">
            {/* 薄弱维度 */}
            {report.training_prescription.weak_dimensions && report.training_prescription.weak_dimensions.length > 0 && (
              <div>
                <h4 className="text-text-primary font-medium mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-amber-400 text-base">target</span>
                  重点提升领域
                </h4>
                <div className="flex flex-wrap gap-2">
                  {report.training_prescription.weak_dimensions.map((dim, i) => (
                    <span key={i} className="px-3 py-1.5 rounded-full text-sm font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      {dim}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 推荐场景 */}
            {report.training_prescription.recommended_scenarios && report.training_prescription.recommended_scenarios.length > 0 && (
              <div>
                <h4 className="text-text-primary font-medium mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-400 text-base">school</span>
                  推荐训练场景
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {report.training_prescription.recommended_scenarios.map((scenario, i) => (
                    <div key={i} className="p-4 bg-surface-lighter rounded-lg border border-border-dark hover:border-blue-500/30 transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-text-primary font-medium">{scenario.scenario_type}</span>
                        {scenario.priority === 1 && (
                          <span className="text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-400">优先</span>
                        )}
                      </div>
                      <p className="text-xs text-text-muted">{scenario.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 练习建议 */}
            {report.training_prescription.practice_tips && report.training_prescription.practice_tips.length > 0 && (
              <div>
                <h4 className="text-text-primary font-medium mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-400 text-base">tips_and_updates</span>
                  练习小贴士
                </h4>
                <ul className="space-y-2">
                  {report.training_prescription.practice_tips.map((tip, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                      <span className="material-symbols-outlined text-emerald-400 text-base mt-0.5">check_circle</span>
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 实战任务 */}
            {report.training_prescription.real_world_task && (
              <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <h4 className="text-blue-400 font-medium mb-2 flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">rocket_launch</span>
                  本周实战任务
                </h4>
                <p className="text-text-primary text-sm">{report.training_prescription.real_world_task}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 对话评分回顾 */}
      {report.conversation_scores && report.conversation_scores.length > 0 && (
        <div className="rounded-xl border border-border-dark bg-surface-dark overflow-hidden">
          <div className="px-6 py-5 border-b border-border-dark bg-surface-lighter">
            <h3 className="text-text-primary text-lg font-bold flex items-center gap-2">
              <span className="material-symbols-outlined text-cyan-500">chat</span>
              对话评分回顾
            </h3>
            <p className="text-text-muted text-sm mt-1">查看每轮对话的详细评分和反馈</p>
          </div>
          <div className="p-6 space-y-4">
            {report.conversation_scores.map((turn, i) => (
              <div key={i} className={`flex gap-4 ${turn.speaker === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] ${turn.speaker === 'user' ? 'order-2' : ''}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded ${turn.speaker === 'user' ? 'bg-blue-500/20 text-blue-400' : 'bg-bg-active text-text-secondary'}`}>
                      {turn.speaker === 'user' ? '销售' : '客户'} - 第{turn.turn_id}轮
                    </span>
                    {turn.score != null && (
                      <span className={`text-xs font-bold ${turn.score >= 8 ? 'text-blue-400' : turn.score >= 6 ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {turn.score}分
                      </span>
                    )}
                  </div>
                  <div className={`p-3 rounded-lg ${turn.speaker === 'user' ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-surface-lighter border border-border-dark'}`}>
                    <p className="text-sm text-text-primary">{turn.content}</p>
                  </div>
                  {turn.feedback && (
                    <p className="mt-1 text-xs text-text-muted italic">{turn.feedback}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Next Actions */}
      {report.next_actions && (
        <div>
          <h3 className="text-text-primary text-xl font-bold mb-6 flex items-center gap-3">
            <span className="material-symbols-outlined text-blue-500">check_circle</span>
            下一步建议
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {report.next_actions.recommended_scenarios && report.next_actions.recommended_scenarios.length > 0 && (
              <div className="rounded-xl bg-surface-dark border border-border-dark p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded bg-blue-500/10 text-blue-500 border border-blue-500/20">
                    <span className="material-symbols-outlined">school</span>
                  </div>
                  <h4 className="text-text-primary font-bold">推荐练习场景</h4>
                </div>
                <ul className="space-y-2">
                  {report.next_actions.recommended_scenarios.map((scenario, i) => (
                    <li key={i} className="flex items-center gap-2 text-text-secondary text-sm">
                      <span className="material-symbols-outlined text-blue-500 text-base">arrow_right</span>
                      {typeof scenario === 'string' ? scenario : (
                        <span>
                          <span className="text-text-primary">{scenario.name}</span>
                          {scenario.reason && <span className="text-text-muted text-xs ml-2">- {scenario.reason}</span>}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {report.next_actions.real_world_task && (
              <div className="rounded-xl bg-surface-dark border border-border-dark p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                    <span className="material-symbols-outlined">task_alt</span>
                  </div>
                  <h4 className="text-text-primary font-bold">实战任务</h4>
                </div>
                <p className="text-text-secondary text-sm">{report.next_actions.real_world_task}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty State for new users */}
      {!report.highlights?.length && !report.issues?.length && !report.replacements?.length && (
        <div className="text-center py-10 text-text-muted">
          <span className="material-symbols-outlined text-4xl mb-2">analytics</span>
          <p>详细分析数据将在更多训练后生成</p>
        </div>
      )}
    </div>
  );
}
