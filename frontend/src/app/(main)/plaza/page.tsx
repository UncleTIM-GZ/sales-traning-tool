"use client";

/**
 * 开发：Excellent（11964948@qq.com）
 * 功能：场景广场页面
 * 作用：展示热门场景、推荐场景、搜索场景
 * 创建时间：2025-12-23
 * 最后修改：2025-12-24
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Flame,
  Star,
  Heart,
  MessageCircle,
  Bookmark,
  Play,
  Users,
  Filter,
  Loader2,
  Award,
  Sparkles,
  Crown,
  Zap,
  Target,
  ChevronRight,
  X,
  Mic,
  MessageSquare,
  Trash2,
  BookmarkMinus,
} from "lucide-react";
import { scenarioApi, userApi, plazaApi, PublicScenario } from "@/lib/api";
import {
  PointsDisplay,
  CheckinButton,
  TagCloud,
  LeaderboardPanel,
} from "./components";

type TabType = "my" | "official" | "hot" | "recommended" | "all";
type SortType = "hot" | "new" | "score";

export default function PlazaPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("all"); // 默认展示全部场景


  const [scenarios, setScenarios] = useState<PublicScenario[]>([]);
  const [loading, setLoading] = useState(true);
  
  // 分页状态
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const PAGE_SIZE = 21;

  // ... 其他状态保持不变 ...
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PublicScenario[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  // 筛选
  const [trackFilter, setTrackFilter] = useState<string>("");
  const [difficultyFilter, setDifficultyFilter] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<SortType>("hot");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);

  const [showTrainModal, setShowTrainModal] = useState(false);
  const [trainingMode, setTrainingMode] = useState<"train" | "exam">("train"); // New state

  const deleteScenario = async (id: string) => {
    if (!confirm("确定要删除这个场景吗？此操作无法撤销。")) return;
    try {
      await fetch(`/api/v1/scenarios/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${localStorage.getItem("auth-storage") ? JSON.parse(localStorage.getItem("auth-storage")!).state?.token : ""}` } });
      setScenarios(prev => prev.filter(s => s.id !== id));
    } catch (error) {
      console.error("删除失败:", error);
    }
  };

  const uncollect = async (id: string) => {
    if (!confirm("确定要移除这个收藏吗？")) return;
    try {
      await plazaApi.uncollectScenario(id);
      setScenarios(prev => prev.filter(s => s.id !== id));
    } catch (error) {
      console.error("取消收藏失败:", error);
    }
  };

  const loadScenarios = useCallback(async (pageNum: number = 1, append: boolean = false) => {
    if (pageNum === 1) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    
    try {
      let result: { items: PublicScenario[]; total: number };
      
      if (activeTab === "my") {
        // 加载我的场景
        const apiResult = await scenarioApi.list({
          scope: "mine",
          track: trackFilter || undefined,
          difficulty: difficultyFilter || undefined,
          page: pageNum,
          size: PAGE_SIZE
        });

        // 获取当前用户信息用于显示
        const me = await userApi.getMe();

        // 转换为 PublicScenario 格式
        const myScenarios: PublicScenario[] = apiResult.items.map(s => ({
          id: s.id,
          name: s.name,
          description: s.description,
          cover_image: s.config?.image || null,
          track: s.track,
          difficulty: s.difficulty,
          tags: s.config?.tags || [],
          creator: {
            id: s.created_by || me.id,
            user_id: s.created_by || me.id,
            nickname: s.created_by === me.id ? me.nickname : "未知/其他", // 简化的显示，如果是收藏的，可能需要额外API获取详情，但这里暂时简化
            avatar: s.created_by === me.id ? (me.avatar || null) : null,
            level: s.created_by === me.id ? me.level : "Lv.1",
            is_verified: false,
            scenario_count: 0,
            followers_count: 0
          },
          train_count: s.config?.practice_count || 0,
          likes_count: 0,
          comments_count: 0,
          fork_count: 0,
          avg_score: s.config?.rating || 0,
          is_liked: false,
          is_collected: s.created_by !== me.id, // 如果创建者不是我，那就是收藏的
          is_forked: false,
          is_official: false,
          is_featured: false,
          created_at: s.created_at || new Date().toISOString(),
          published_at: null,
          // Custom field hack for status display
          status: s.status as string,
          visibility: (s as { visibility?: string }).visibility // Ensure we have visibility
        }));
        result = { items: myScenarios, total: apiResult.total };
      } else if (activeTab === "all") {
        const apiResult = await scenarioApi.list({
          scope: "public", // Show all public
          track: trackFilter || undefined,
          difficulty: difficultyFilter || undefined,
          page: pageNum,
          size: PAGE_SIZE
        });
        const items = apiResult.items.map(s => ({
          ...s,
          cover_image: s.config?.image || null,
          tags: s.config?.tags || [],
          creator: (s as { creator?: PublicScenario["creator"] }).creator || (s.created_by ? { id: s.created_by, user_id: s.created_by, nickname: '加载中...', level: 'Lv.1', avatar: null, is_verified: false, scenario_count: 0, followers_count: 0 } : null),
          is_liked: false,
          is_collected: false,
          is_forked: false,
          is_official: s.created_by === null,
          is_featured: false,
          created_at: s.created_at || "",
          published_at: null,
          train_count: 0, likes_count: 0, comments_count: 0, fork_count: 0, avg_score: 0
        } as PublicScenario));
        result = { items, total: apiResult.total };
      } else if (activeTab === "official") {
        // 官方精选场景（is_official=true 或 is_featured=true）
        const apiResult = await scenarioApi.list({
          scope: "official",
          track: trackFilter || undefined,
          difficulty: difficultyFilter || undefined,
          page: pageNum,
          size: PAGE_SIZE
        });
        // 转换为 PublicScenario，保留原始的 is_official 和 is_featured 标记
        const officialScenarios: PublicScenario[] = apiResult.items.map(s => ({
          id: s.id,
          name: s.name,
          description: s.description,
          cover_image: s.config?.image || null,
          track: s.track,
          difficulty: s.difficulty,
          tags: s.config?.tags || [],
          creator: s.created_by ? { id: s.created_by, user_id: s.created_by, nickname: '创作者', level: 'Lv.1', avatar: null, is_verified: false, scenario_count: 0, followers_count: 0 } : null,
          train_count: s.config?.practice_count || 0,
          likes_count: 0,
          comments_count: 0,
          fork_count: 0,
          avg_score: s.config?.rating || 0,
          is_liked: false,
          is_collected: false,
          is_forked: false,
          is_official: (s as { is_official?: boolean }).is_official ?? false,
          is_featured: (s as { is_featured?: boolean }).is_featured ?? false,
          created_at: s.created_at || new Date().toISOString(),
          published_at: s.created_at || null
        }));
        result = { items: officialScenarios, total: apiResult.total };
      } else if (activeTab === "recommended") {
        const apiResult = await plazaApi.getRecommendedScenarios({ page: pageNum, size: PAGE_SIZE });
        result = { items: apiResult.items, total: apiResult.total };
      } else {
        // 热门 (hot)
        const apiResult = await plazaApi.getHotScenarios({
          track: trackFilter || undefined,
          difficulty: difficultyFilter || undefined,
          page: pageNum,
          size: PAGE_SIZE
        });
        result = { items: apiResult.items, total: apiResult.total };
      }
      
      // 更新场景列表
      if (append) {
        setScenarios(prev => [...prev, ...result.items]);
      } else {
        setScenarios(result.items);
      }
      
      // 判断是否还有更多
      const totalLoaded = append ? scenarios.length + result.items.length : result.items.length;
      setHasMore(totalLoaded < result.total);
      setPage(pageNum);
    } catch (error) {
      console.error("加载场景失败:", error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [activeTab, trackFilter, difficultyFilter, scenarios.length]);

  useEffect(() => {
    if (!showSearch) {
      setPage(1);
      setHasMore(true);
      loadScenarios(1, false);
    }
  }, [activeTab, trackFilter, difficultyFilter, showSearch]);
  
  // 加载更多
  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore && !showSearch) {
      loadScenarios(page + 1, true);
    }
  }, [loadingMore, hasMore, showSearch, page, loadScenarios]);
  
  // 无限滚动观察器
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  
  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }
    
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading && !showSearch) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );
    
    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }
    
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, loadingMore, loading, showSearch, loadMore]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setShowSearch(false);
      return;
    }
    setIsSearching(true);
    setShowSearch(true);
    try {
      const result = await plazaApi.searchScenarios({
        q: searchQuery.trim(),
        track: trackFilter || undefined,
        difficulty: difficultyFilter || undefined,
        sort: sortBy,
        page: 1,
        size: 50,
      });
      setSearchResults(result.items);
    } catch (error) {
      console.error("搜索失败:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleLike = async (scenario: PublicScenario) => {
    try {
      if (scenario.is_liked) {
        await plazaApi.unlikeScenario(scenario.id);
        scenario.is_liked = false;
        scenario.likes_count -= 1;
      } else {
        const result = await plazaApi.likeScenario(scenario.id);
        scenario.is_liked = true;
        scenario.likes_count = result.likes_count;
      }
      if (showSearch) {
        setSearchResults([...searchResults]);
      } else {
        setScenarios([...scenarios]);
      }
    } catch (error) {
      console.error("点赞失败:", error);
    }
  };

  const handleCollect = async (scenario: PublicScenario) => {
    try {
      if (scenario.is_collected) {
        await plazaApi.uncollectScenario(scenario.id);
        scenario.is_collected = false;
      } else {
        await plazaApi.collectScenario(scenario.id);
        scenario.is_collected = true;
      }
      if (showSearch) {
        setSearchResults([...searchResults]);
      } else {
        setScenarios([...scenarios]);
      }
    } catch (error) {
      console.error("收藏失败:", error);
    }
  };

  const handleFork = async (scenario: PublicScenario) => {
    try {
      const result = await plazaApi.forkScenario(scenario.id);
      if (result.success) {
        router.push(`/scenarios/${result.scenario_id}`);
      }
    } catch (error) {
      console.error("复制失败:", error);
    }
  };

  const handleTrain = (scenarioId: string) => {
    setSelectedScenarioId(scenarioId);
    setShowTrainModal(true);
  };

  const startTextTraining = () => {
    if (selectedScenarioId) {
      router.push(`/training/${selectedScenarioId}?mode=${trainingMode}`);
    }
    setShowTrainModal(false);
  };

  const startVoiceTraining = () => {
    if (selectedScenarioId) {
      router.push(`/training/${selectedScenarioId}/voice?mode=${trainingMode}`);
    }
    setShowTrainModal(false);
  };

  const displayScenarios = showSearch ? searchResults : scenarios;

  const getDifficultyInfo = (level: number) => {
    const difficulties = [
      { name: "入门", color: "text-emerald-400", bg: "bg-emerald-500/20", border: "border-emerald-500/30" },
      { name: "初级", color: "text-sky-400", bg: "bg-sky-500/20", border: "border-sky-500/30" },
      { name: "中级", color: "text-amber-400", bg: "bg-amber-500/20", border: "border-amber-500/30" },
      { name: "高级", color: "text-orange-400", bg: "bg-orange-500/20", border: "border-orange-500/30" },
      { name: "专家", color: "text-rose-400", bg: "bg-rose-500/20", border: "border-rose-500/30" },
    ];
    return difficulties[Math.min(level - 1, 4)] || difficulties[2];
  };

  const getTrackInfo = (track: string) => {
    return track === "sales"
      ? { name: "销售", icon: Target, color: "text-blue-400", bg: "bg-blue-500/10" }
      : { name: "社交", icon: Users, color: "text-purple-400", bg: "bg-purple-500/10" };
  };

  // Helper to check if I am creator
  const isMyScenario = (scenario: PublicScenario) => {
    // This is a bit hacky because we don't store current user ID in state globally easily here without hook
    // But in "loadScenarios" "my" tab, we fetched "me".
    // We can store "me" id or just rely on tab.
    return activeTab === "my" && !scenario.is_collected;
    // Wait, is_collected logic above: created_by !== me.id.
    // So if activeTab is "my" and NOT is_collected, it is Created By Me.
    // If activeTab is "my" and is_collected, it is Collected.
  };

  return (
    <div className="min-h-screen">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-bg-card border border-border-default mb-8">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%239C92AC%22%20fill-opacity%3D%220.05%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E')] opacity-50" />
        <div className="relative px-6 py-8 md:px-10 md:py-12">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/25">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-text-primary">
                    训练广场
                  </h1>
                  <p className="text-text-muted text-sm">发现优质训练场景，与精英一起成长</p>
                </div>
              </div>
            </div>



            {/* 搜索和操作栏 */}
            <div className="mt-6 md:mt-0">
              <div className="flex gap-3">
                {/* 快捷入口 - 创建场景按钮 (Moved here) */}
                <button
                  onClick={() => router.push("/scenarios/create")}
                  className="hidden md:flex items-center gap-2 px-4 py-3.5 bg-bg-active hover:bg-bg-elevated border border-border-dark rounded-xl text-text-primary text-sm font-medium transition-all whitespace-nowrap"
                >
                  <Zap className="w-4 h-4 text-yellow-400" />
                  创建场景
                </button>
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-text-muted" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    placeholder="搜索场景名称、描述、创作者..."
                    className="w-full pl-12 pr-4 py-3.5 bg-surface-card/80 backdrop-blur border border-border-dark rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => {
                        setSearchQuery("");
                        setShowSearch(false);
                      }}
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 text-text-muted hover:text-text-secondary"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <button
                  onClick={handleSearch}
                  className="px-6 py-3.5 bg-primary hover:bg-primary-600 text-white rounded-xl font-medium hover:shadow-lg hover:shadow-primary/25 transition-all"
                >
                  搜索
                </button>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`px-4 py-3.5 rounded-xl border transition-all ${showFilters
                    ? "bg-primary/20 border-primary text-primary"
                    : "bg-surface-card/80 backdrop-blur border-border-dark text-text-secondary hover:border-primary"
                    }`}
                >
                  <Filter className="w-5 h-5" />
                </button>
              </div>

              {/* 筛选面板 */}
              {showFilters && (
                <div className="mt-4 p-5 bg-surface-card/90 backdrop-blur border border-border-dark rounded-xl">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {/* 赛道筛选 */}
                    <div>
                      <label className="text-sm text-text-muted mb-2.5 block font-medium">赛道</label>
                      <div className="flex gap-2">
                        {[
                          { value: "", label: "全部", icon: null },
                          { value: "sales", label: "销售", icon: Target },
                          { value: "social", label: "社交", icon: Users },
                        ].map((item) => (
                          <button
                            key={item.value}
                            onClick={() => setTrackFilter(item.value)}
                            className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${trackFilter === item.value
                              ? "bg-primary text-white shadow-md shadow-primary/25"
                              : "bg-surface-lighter text-text-secondary hover:text-primary hover:bg-primary/10"
                              }`}
                          >
                            {item.icon && <item.icon className="w-3.5 h-3.5" />}
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 难度筛选 */}
                    <div>
                      <label className="text-sm text-text-muted mb-2.5 block font-medium">难度</label>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => setDifficultyFilter(null)}
                          className={`flex-1 py-2.5 px-2 rounded-lg text-sm font-medium transition-all ${difficultyFilter === null
                            ? "bg-primary text-white shadow-md shadow-primary/25"
                            : "bg-surface-lighter text-text-secondary hover:text-primary"
                            }`}
                        >
                          全部
                        </button>
                        {[1, 2, 3, 4, 5].map((d) => {
                          const info = getDifficultyInfo(d);
                          return (
                            <button
                              key={d}
                              onClick={() => setDifficultyFilter(d)}
                              className={`flex-1 py-2.5 px-2 rounded-lg text-sm font-medium transition-all ${difficultyFilter === d
                                ? `${info.bg} ${info.color} border ${info.border}`
                                : "bg-surface-lighter text-text-secondary hover:text-primary"
                                }`}
                            >
                              {info.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* 排序 */}
                    <div>
                      <label className="text-sm text-text-muted mb-2.5 block font-medium">排序</label>
                      <div className="flex gap-2">
                        {[
                          { value: "hot", label: "最热", icon: Flame },
                          { value: "new", label: "最新", icon: Sparkles },
                          { value: "score", label: "评分", icon: Star },
                        ].map((item) => (
                          <button
                            key={item.value}
                            onClick={() => setSortBy(item.value as SortType)}
                            className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${sortBy === item.value
                              ? "bg-primary text-white shadow-md shadow-primary/25"
                              : "bg-surface-lighter text-text-secondary hover:text-primary hover:bg-primary/10"
                              }`}
                          >
                            <item.icon className="w-3.5 h-3.5" />
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 标签页切换 */}
      {/* Note: The closing div above closes the Hero Banner */}
      {
        !showSearch && (
          <div className="flex items-center gap-1 p-1 bg-surface-card rounded-xl border border-border-dark mb-6 w-fit">
            {[
              { id: "my", label: "我的场景", icon: Zap, color: "text-purple-500" },
              { id: "official", label: "官方精选", icon: Crown, color: "text-yellow-500" },
              { id: "hot", label: "热门场景", icon: Flame, color: "text-orange-500" },
              { id: "all", label: "全部场景", icon: Sparkles, color: "text-blue-500" }, // New Tab
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm transition-all ${activeTab === tab.id
                  ? "bg-primary text-white shadow-md"
                  : "text-text-muted hover:text-text-secondary hover:bg-surface-lighter"
                  }`}
              >
                <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? "text-white" : tab.color}`} />
                {tab.label}
              </button>
            ))}
          </div>
        )
      }

      {/* 搜索结果标题 */}
      {
        showSearch && (
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Search className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-text-primary">
                  搜索结果
                </h2>
                <p className="text-sm text-text-muted">
                  找到 {searchResults.length} 个与 &ldquo;{searchQuery}&rdquo; 相关的场景
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setShowSearch(false);
                setSearchQuery("");
              }}
              className="text-primary hover:text-primary/80 text-sm font-medium flex items-center gap-1"
            >
              返回广场
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )
      }

      {/* 主内容区域 - 带侧边栏 */}
      <div className="flex gap-6">
        {/* 左侧主内容 */}
        <div className="flex-1 min-w-0">

      {/* 场景列表 */}
      {
        loading || isSearching ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
              <p className="text-text-muted">加载中...</p>
            </div>
          </div>
        ) : displayScenarios.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-primary/10 flex items-center justify-center">
              {activeTab === 'my' ? <Bookmark className="w-10 h-10 text-text-muted" /> : <Search className="w-10 h-10 text-text-muted" />}
            </div>
            <h3 className="text-lg font-medium text-text-primary mb-2">
              {showSearch ? "没有找到相关场景" : activeTab === 'my' ? "还没有任何场景" : "暂无场景"}
            </h3>
            <p className="text-text-muted mb-6">
              {showSearch
                ? "试试其他关键词吧"
                : activeTab === 'my'
                  ? "您创建或收藏的场景将显示在这里"
                  : "成为第一个创建场景的人"}
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => router.push("/scenarios/create")}
                className="px-6 py-3 bg-primary hover:bg-primary-600 text-white rounded-xl font-medium hover:shadow-lg hover:shadow-primary/25 transition-all inline-flex items-center gap-2"
              >
                <Zap className="w-4 h-4" />
                创建场景
              </button>
              {activeTab === 'my' && (
                <button
                  onClick={() => setActiveTab('all')}
                  className="px-6 py-3 bg-surface-lighter hover:bg-surface-hover border border-border-default rounded-xl font-medium transition-all inline-flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  浏览广场
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {displayScenarios.map((scenario, index) => {
              const diffInfo = getDifficultyInfo(scenario.difficulty);
              const trackInfo = getTrackInfo(scenario.track);
              return (
                <div
                  key={scenario.id}
                  className="group bg-surface-card border border-border-dark rounded-2xl overflow-hidden hover:border-primary/50 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  {/* 封面区域 */}
                  <div className="relative h-40 bg-gradient-to-br from-primary/20 to-primary/5 overflow-hidden">
                    {scenario.cover_image ? (
                      <img
                        src={scenario.cover_image}
                        alt={scenario.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-5xl font-black text-primary/20">
                          {scenario.name.slice(0, 2)}
                        </div>
                      </div>
                    )}

                    {/* 渐变遮罩 */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                    {/* 顶部标签 */}
                    <div className="absolute top-3 left-3 flex gap-2">
                      {scenario.is_official && (
                        <span className="px-2.5 py-1 bg-gradient-to-r from-yellow-500 to-amber-500 text-white text-xs font-medium rounded-lg flex items-center gap-1 shadow-lg shadow-yellow-500/25">
                          <Crown className="w-3 h-3" />
                          官方
                        </span>
                      )}
                      {scenario.is_featured && (
                        <span className="px-2.5 py-1 bg-primary text-white text-xs font-medium rounded-lg shadow-lg shadow-primary/25">
                          精选
                        </span>
                      )}
                      {activeTab === 'my' && (scenario as { visibility?: string }).visibility === 'pending' && (
                        <span className="px-2.5 py-1 bg-orange-500/90 text-white text-xs font-medium rounded-lg shadow-sm">
                          审核中
                        </span>
                      )}
                      {activeTab === 'my' && (scenario as { visibility?: string }).visibility === 'public' && isMyScenario(scenario) && (
                        <span className="px-2.5 py-1 bg-emerald-500/90 text-white text-xs font-medium rounded-lg shadow-sm">
                          已发布
                        </span>
                      )}
                      {activeTab === 'my' && (scenario as { visibility?: string }).visibility === 'private' && isMyScenario(scenario) && (
                        <span className="px-2.5 py-1 bg-zinc-500/90 text-white text-xs font-medium rounded-lg shadow-sm">
                          私有
                        </span>
                      )}
                      {activeTab === 'my' && scenario.is_collected && (
                        <span className="px-2.5 py-1 bg-blue-500/90 text-white text-xs font-medium rounded-lg shadow-sm">
                          已收藏
                        </span>
                      )}
                    </div>

                    {/* 右上角赛道 + 难度 */}
                    <div className="absolute top-3 right-3 flex gap-2">
                      <span className={`px-2 py-1 ${trackInfo.bg} ${trackInfo.color} text-xs font-medium rounded-lg backdrop-blur-sm border border-border-dark`}>
                        {trackInfo.name}
                      </span>
                      <span className={`px-2 py-1 ${diffInfo.bg} ${diffInfo.color} text-xs font-medium rounded-lg backdrop-blur-sm border border-border-dark`}>
                        {diffInfo.name}
                      </span>
                    </div>

                    {/* 底部数据 */}
                    <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white/90 text-xs">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <Play className="w-3.5 h-3.5" />
                          {scenario.train_count}
                        </span>
                        <span className="flex items-center gap-1">
                          <Heart className="w-3.5 h-3.5" />
                          {scenario.likes_count}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageCircle className="w-3.5 h-3.5" />
                          {scenario.comments_count}
                        </span>
                      </div>
                      {scenario.avg_score > 0 && (
                        <span className="flex items-center gap-1 text-yellow-300">
                          <Star className="w-3.5 h-3.5 fill-current" />
                          {scenario.avg_score.toFixed(1)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 内容区域 */}
                  <div className="p-4">
                    <h3 className="font-semibold text-text-primary text-lg line-clamp-1 group-hover:text-primary transition-colors">
                      {scenario.name}
                    </h3>
                    <p className="text-sm text-text-muted mt-1.5 line-clamp-2 min-h-[40px]">
                      {scenario.description || "暂无描述"}
                    </p>

                    {/* 创作者信息 */}
                    <div className="flex items-center gap-2.5 mt-4 pt-4 border-t border-border-dark">
                      {scenario.creator ? (
                        <>
                          <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center ring-2 ring-surface-card">
                            <span className="text-xs font-semibold text-primary">
                              {scenario.creator.nickname.slice(0, 1)}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-medium text-text-primary truncate">
                                {scenario.creator.nickname}
                              </span>
                              {scenario.creator.is_verified && (
                                <Award className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0" />
                              )}
                            </div>
                            <span className="text-xs text-text-muted">
                              {scenario.creator.level}
                            </span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="w-8 h-8 rounded-full bg-yellow-500/15 flex items-center justify-center ring-2 ring-surface-card">
                            <Crown className="w-4 h-4 text-yellow-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-medium text-text-primary truncate">
                                官方出品
                              </span>
                              <Award className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0" />
                            </div>
                            <span className="text-xs text-text-muted">
                              官方认证
                            </span>
                          </div>
                        </>
                      )}
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex items-center gap-2 mt-4">
                      <button
                        onClick={() => handleTrain(scenario.id)}
                        className="flex-1 py-2.5 bg-primary hover:bg-primary-600 text-white rounded-xl text-sm font-medium hover:shadow-lg hover:shadow-primary/25 transition-all flex items-center justify-center gap-1.5 active:scale-95"
                      >
                        <Play className="w-4 h-4" />
                        开始训练
                      </button>

                      {/* Actions based on ownership */}
                      {activeTab === "my" ? (
                        isMyScenario(scenario) ? (
                          // Created by me: Delete
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteScenario(scenario.id); }}
                            className="p-2.5 rounded-xl bg-surface-lighter text-text-muted hover:text-rose-500 hover:bg-rose-500/10 transition-all"
                            title="删除场景"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        ) : (
                          // Collected: Uncollect
                          <button
                            onClick={(e) => { e.stopPropagation(); uncollect(scenario.id); }}
                            className="p-2.5 rounded-xl bg-surface-lighter text-text-muted hover:text-rose-500 hover:bg-rose-500/10 transition-all"
                            title="移除收藏"
                          >
                            <BookmarkMinus className="w-4 h-4" />
                          </button>
                        )
                      ) : (
                        // Standard actions
                        <>
                          <button
                            onClick={() => handleLike(scenario)}
                            className={`p-2.5 rounded-xl transition-all ${scenario.is_liked
                              ? "bg-rose-500/20 text-rose-500 ring-1 ring-rose-500/30"
                              : "bg-surface-lighter text-text-muted hover:text-rose-500 hover:bg-rose-500/10"
                              }`}
                          >
                            <Heart className={`w-4 h-4 ${scenario.is_liked ? "fill-current" : ""}`} />
                          </button>
                          <button
                            onClick={() => handleCollect(scenario)}
                            className={`p-2.5 rounded-xl transition-all ${scenario.is_collected
                              ? "bg-amber-500/20 text-amber-500 ring-1 ring-amber-500/30"
                              : "bg-surface-lighter text-text-muted hover:text-amber-500 hover:bg-amber-500/10"
                              }`}
                          >
                            <Bookmark className={`w-4 h-4 ${scenario.is_collected ? "fill-current" : ""}`} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* 加载更多触发器 */}
          {!showSearch && (
            <div ref={loadMoreRef} className="py-8 flex justify-center">
              {loadingMore ? (
                <div className="flex items-center gap-3 text-text-muted">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  <span>加载更多...</span>
                </div>
              ) : hasMore ? (
                <button
                  onClick={loadMore}
                  className="px-6 py-2.5 bg-surface-lighter hover:bg-surface-hover border border-border-default rounded-xl text-text-secondary hover:text-text-primary transition-all"
                >
                  加载更多
                </button>
              ) : scenarios.length > 0 ? (
                <span className="text-text-muted text-sm">已加载全部场景</span>
              ) : null}
            </div>
          )}
          </>
        )
      }
        </div>

        {/* 右侧边栏 */}
        <div className="hidden lg:block w-80 flex-shrink-0 space-y-4">
          {/* 签到按钮 */}
          <CheckinButton />

          {/* 积分展示 */}
          <PointsDisplay />

          {/* 热门标签 */}
          <TagCloud
            onTagClick={(tag) => {
              setSearchQuery(tag);
              handleSearch();
            }}
          />

          {/* 排行榜 */}
          <LeaderboardPanel
            onScenarioClick={(scenarioId) => handleTrain(scenarioId)}
          />
        </div>
      </div>

      {/* 训练模式选择弹窗 */}
      {
        showTrainModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-surface-card border border-border-dark rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-text-primary">选择训练模式</h3>
                <button
                  onClick={() => setShowTrainModal(false)}
                  className="p-2 hover:bg-surface-lighter rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-text-muted" />
                </button>
              </div>

              {/* Mode Selection */}
              <div className="flex bg-surface-lighter p-1 rounded-xl mb-6">
                <button
                  onClick={() => setTrainingMode("train")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${trainingMode === "train"
                    ? "bg-bg-card text-emerald-500 shadow-sm ring-1 ring-border-default"
                    : "text-text-secondary hover:text-text-primary"
                    }`}
                >
                  <Zap className="w-4 h-4" />
                  刻意练习
                </button>
                <button
                  onClick={() => setTrainingMode("exam")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${trainingMode === "exam"
                    ? "bg-bg-card text-amber-500 shadow-sm ring-1 ring-border-default"
                    : "text-text-secondary hover:text-text-primary"
                    }`}
                >
                  <Award className="w-4 h-4" />
                  模拟考核
                </button>
              </div>

              <div className="mb-6 px-4 py-3 bg-opacity-50 rounded-lg text-sm leading-relaxed border border-border-default text-text-secondary bg-surface-lighter">
                {trainingMode === "train" ? (
                  <span className="flex gap-2">
                    <div className="w-1 bg-emerald-500 rounded-full h-full shrink-0"></div>
                    <span>包含AI教练实时指导、关键提示和无限重试。适合日常技能磨炼。</span>
                  </span>
                ) : (
                  <span className="flex gap-2">
                    <div className="w-1 bg-amber-500 rounded-full h-full shrink-0"></div>
                    <span>无提示、一次性通过、生成详细评分报告。适合验证学习成果。</span>
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* 文字训练 */}
                <button
                  onClick={startTextTraining}
                  className="flex flex-col items-center gap-3 p-6 bg-surface-lighter hover:bg-primary/10 border border-border-dark hover:border-primary/50 rounded-xl transition-all group"
                >
                  <div className="w-14 h-14 rounded-full bg-blue-500/15 flex items-center justify-center group-hover:bg-blue-500/25 transition-colors">
                    <MessageSquare className="w-7 h-7 text-blue-400" />
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-text-primary">文字训练</p>
                    <p className="text-xs text-text-muted mt-1">打字对话模式</p>
                  </div>
                </button>

                {/* 语音训练 */}
                <button
                  onClick={startVoiceTraining}
                  className="flex flex-col items-center gap-3 p-6 bg-surface-lighter hover:bg-primary/10 border border-border-dark hover:border-primary/50 rounded-xl transition-all group"
                >
                  <div className="w-14 h-14 rounded-full bg-emerald-500/15 flex items-center justify-center group-hover:bg-emerald-500/25 transition-colors">
                    <Mic className="w-7 h-7 text-emerald-400" />
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-text-primary">语音训练</p>
                    <p className="text-xs text-text-muted mt-1">实时语音对话</p>
                  </div>
                </button>
              </div>

              <p className="text-center text-text-muted text-xs mt-4">
                语音训练需要麦克风权限
              </p>
            </div>
          </div>
        )
      }
    </div>
  );
}
