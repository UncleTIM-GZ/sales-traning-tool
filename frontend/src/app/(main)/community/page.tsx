"use client";

import { useState, useEffect } from "react";
import { communityApi, PostItem, LeaderboardUser, ChallengeItem } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";

export default function CommunityPage() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<"feed" | "leaderboard" | "challenges">("feed");
  
  // 动态状态
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [newPostContent, setNewPostContent] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  
  // 排行榜状态
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);
  const [myRank, setMyRank] = useState<LeaderboardUser | null>(null);
  const [leaderboardPeriod, setLeaderboardPeriod] = useState<"weekly" | "monthly" | "all_time">("weekly");
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(false);
  
  // 挑战状态
  const [challenges, setChallenges] = useState<ChallengeItem[]>([]);
  const [isLoadingChallenges, setIsLoadingChallenges] = useState(false);

  // 加载动态
  useEffect(() => {
    const loadPosts = async () => {
      try {
        setIsLoadingPosts(true);
        const response = await communityApi.listPosts({ page: 1, size: 20 });
        setPosts(response.items);
      } catch (err) {
        console.error("Failed to load posts:", err);
      } finally {
        setIsLoadingPosts(false);
      }
    };
    
    if (activeTab === "feed") {
      loadPosts();
    }
  }, [activeTab]);

  // 加载排行榜
  useEffect(() => {
    const loadLeaderboard = async () => {
      try {
        setIsLoadingLeaderboard(true);
        const response = await communityApi.getLeaderboard(leaderboardPeriod);
        setLeaderboard(response.items);
        setMyRank(response.my_rank || null);
      } catch (err) {
        console.error("Failed to load leaderboard:", err);
      } finally {
        setIsLoadingLeaderboard(false);
      }
    };
    
    if (activeTab === "leaderboard") {
      loadLeaderboard();
    }
  }, [activeTab, leaderboardPeriod]);

  // 加载挑战
  useEffect(() => {
    const loadChallenges = async () => {
      try {
        setIsLoadingChallenges(true);
        const response = await communityApi.listChallenges();
        setChallenges(response.items);
      } catch (err) {
        console.error("Failed to load challenges:", err);
      } finally {
        setIsLoadingChallenges(false);
      }
    };
    
    if (activeTab === "challenges") {
      loadChallenges();
    }
  }, [activeTab]);

  // 发布动态
  const handlePost = async () => {
    if (!newPostContent.trim()) return;
    
    try {
      setIsPosting(true);
      const newPost = await communityApi.createPost({ content: newPostContent.trim() });
      setPosts([newPost, ...posts]);
      setNewPostContent("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "发布失败");
    } finally {
      setIsPosting(false);
    }
  };

  // 点赞/取消点赞
  const handleLike = async (postId: string, isLiked: boolean) => {
    try {
      if (isLiked) {
        await communityApi.unlikePost(postId);
      } else {
        await communityApi.likePost(postId);
      }
      
      // 更新本地状态
      setPosts(posts.map(post => {
        if (post.id === postId) {
          return {
            ...post,
            is_liked: !isLiked,
            likes_count: isLiked ? post.likes_count - 1 : post.likes_count + 1,
          };
        }
        return post;
      }));
    } catch (err) {
      console.error("Failed to toggle like:", err);
    }
  };

  // 切换评论展开
  const toggleComments = (postId: string) => {
    setExpandedComments(prev => {
      const next = new Set(prev);
      if (next.has(postId)) {
        next.delete(postId);
      } else {
        next.add(postId);
      }
      return next;
    });
  };

  // 分享帖子
  const handleShare = async (postId: string) => {
    const shareUrl = `${window.location.origin}/community?post=${postId}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      alert("链接已复制到剪贴板");
    } catch {
      // Fallback
      const input = document.createElement("input");
      input.value = shareUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      alert("链接已复制到剪贴板");
    }
  };

  // 参加挑战
  const handleJoinChallenge = async (challengeId: string) => {
    try {
      await communityApi.joinChallenge(challengeId);
      setChallenges(challenges.map(c => {
        if (c.id === challengeId) {
          return { ...c, is_joined: true, participant_count: c.participant_count + 1 };
        }
        return c;
      }));
    } catch (err) {
      alert(err instanceof Error ? err.message : "参加失败");
    }
  };

  // 格式化时间
  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffHours < 24) return `${diffHours}小时前`;
    if (diffDays < 7) return `${diffDays}天前`;
    return date.toLocaleDateString("zh-CN");
  };

  // 格式化挑战结束时间
  const formatEndTime = (endTime: string) => {
    const end = new Date(endTime);
    const now = new Date();
    const diffMs = end.getTime() - now.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return "已结束";
    if (diffDays === 0) return "今天结束";
    return `${diffDays}天后结束`;
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-text-primary mb-2">精英圈层</h1>
          <p className="text-text-secondary">与优秀学员交流，参与挑战赛，共同成长</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border-dark pb-4">
        {[
          { key: "feed", label: "动态", icon: "dynamic_feed" },
          { key: "leaderboard", label: "排行榜", icon: "leaderboard" },
          { key: "challenges", label: "挑战赛", icon: "emoji_events" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.key
                ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                : "text-text-secondary hover:text-text-primary hover:bg-surface-lighter"
            }`}
          >
            <span className="material-symbols-outlined text-lg">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* 动态Tab */}
          {activeTab === "feed" && (
            <>
              {/* 发布框 */}
              <div className="bg-surface-card border border-border-dark rounded-xl p-6">
                <textarea
                  value={newPostContent}
                  onChange={(e) => setNewPostContent(e.target.value)}
                  placeholder="分享你的学习心得..."
                  className="w-full bg-surface-dark border border-border-dark rounded-lg p-4 text-text-primary placeholder-text-muted resize-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50"
                  rows={3}
                />
                <div className="flex justify-end mt-4">
                  <button
                    onClick={handlePost}
                    disabled={!newPostContent.trim() || isPosting}
                    className="flex items-center gap-2 px-5 py-2 bg-blue-gradient rounded-lg text-text-primary font-bold text-sm disabled:opacity-50"
                  >
                    {isPosting && <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>}
                    发布动态
                  </button>
                </div>
              </div>

              {isLoadingPosts ? (
                <div className="space-y-4">
                  {[1,2,3].map(i => (
                    <div key={i} className="bg-surface-card border border-border-dark rounded-xl p-6 animate-pulse">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full bg-surface-dark"></div>
                        <div className="flex-1">
                          <div className="h-4 w-24 bg-surface-dark rounded"></div>
                          <div className="h-3 w-16 bg-surface-dark rounded mt-1"></div>
                        </div>
                      </div>
                      <div className="h-20 bg-surface-dark rounded"></div>
                    </div>
                  ))}
                </div>
              ) : posts.length === 0 ? (
                <div className="text-center py-16 bg-surface-card border border-border-dark rounded-xl">
                  <span className="material-symbols-outlined text-6xl text-text-muted mb-4">forum</span>
                  <p className="text-text-muted">暂无动态，成为第一个分享者吧！</p>
                </div>
              ) : (
                posts.map((post) => (
                  <div key={post.id} className="bg-surface-card border border-border-dark rounded-xl p-6">
                    {/* Author */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-sm">
                        {post.author.nickname.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-text-primary">{post.author.nickname}</span>
                          <span className="text-xs px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            {post.author.level}
                          </span>
                        </div>
                        <span className="text-xs text-text-muted">{formatTime(post.created_at)}</span>
                      </div>
                      {post.is_pinned && (
                        <span className="text-xs text-yellow-400 flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm">push_pin</span>
                          置顶
                        </span>
                      )}
                    </div>

                    {/* Content */}
                    <p className="text-text-primary text-sm leading-relaxed mb-4 whitespace-pre-wrap">{post.content}</p>

                    {/* Actions */}
                    <div className="flex items-center gap-6 pt-4 border-t border-border-dark">
                      <button
                        onClick={() => handleLike(post.id, post.is_liked)}
                        className={`flex items-center gap-2 text-sm transition-colors ${
                          post.is_liked ? "text-blue-500" : "text-text-muted hover:text-blue-400"
                        }`}
                      >
                        <span
                          className="material-symbols-outlined text-lg"
                          style={{ fontVariationSettings: post.is_liked ? "'FILL' 1" : "'FILL' 0" }}
                        >
                          thumb_up
                        </span>
                        {post.likes_count}
                      </button>
                      <button className="flex items-center gap-2 text-sm text-text-muted hover:text-text-primary transition-colors"
                        onClick={() => toggleComments(post.id)}
                      >
                        <span className="material-symbols-outlined text-lg">chat_bubble</span>
                        {post.comments_count}
                      </button>
                      <button 
                        onClick={() => handleShare(post.id)}
                        className="flex items-center gap-2 text-sm text-text-muted hover:text-text-primary transition-colors"
                      >
                        <span className="material-symbols-outlined text-lg">share</span>
                        分享
                      </button>
                    </div>

                    {/* 评论区 */}
                    {expandedComments.has(post.id) && (
                      <div className="mt-4 pt-4 border-t border-border-dark">
                        <div className="flex gap-3 mb-4">
                          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold">
                            {user?.nickname?.charAt(0) || "我"}
                          </div>
                          <div className="flex-1 flex gap-2">
                            <input
                              type="text"
                              value={commentInputs[post.id] || ""}
                              onChange={(e) => setCommentInputs(prev => ({ ...prev, [post.id]: e.target.value }))}
                              placeholder="写下你的评论..."
                              className="flex-1 px-4 py-2 bg-bg-elevated border border-border-dark rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary text-sm"
                            />
                            <button 
                              onClick={() => {
                                if (commentInputs[post.id]?.trim()) {
                                  alert("评论功能开发中");
                                  setCommentInputs(prev => ({ ...prev, [post.id]: "" }));
                                }
                              }}
                              className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-600 transition-colors"
                            >
                              发送
                            </button>
                          </div>
                        </div>
                        {post.comments_count === 0 ? (
                          <p className="text-text-muted text-sm text-center py-4">暂无评论，来发表第一条吧</p>
                        ) : (
                          <p className="text-text-muted text-sm text-center py-4">评论加载中...</p>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </>
          )}

          {/* 排行榜Tab */}
          {activeTab === "leaderboard" && (
            <div className="bg-surface-card border border-border-dark rounded-xl overflow-hidden">
              <div className="p-6 border-b border-border-dark">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-text-primary">综合能力排行榜</h3>
                  <div className="flex gap-2">
                    {(["weekly", "monthly", "all_time"] as const).map((period) => (
                      <button
                        key={period}
                        onClick={() => setLeaderboardPeriod(period)}
                        className={`px-3 py-1 text-xs font-medium rounded ${
                          leaderboardPeriod === period
                            ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                            : "text-text-muted hover:text-text-primary"
                        }`}
                      >
                        {period === "weekly" ? "周榜" : period === "monthly" ? "月榜" : "总榜"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              
              {isLoadingLeaderboard ? (
                <div className="p-4 space-y-4 animate-pulse">
                  {[1,2,3,4,5].map(i => (
                    <div key={i} className="flex items-center gap-4 p-4">
                      <div className="w-8 h-8 rounded-full bg-surface-dark"></div>
                      <div className="w-10 h-10 rounded-full bg-surface-dark"></div>
                      <div className="flex-1">
                        <div className="h-4 w-20 bg-surface-dark rounded"></div>
                        <div className="h-3 w-16 bg-surface-dark rounded mt-1"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : leaderboard.length === 0 ? (
                <div className="p-8 text-center text-text-muted">
                  <span className="material-symbols-outlined text-4xl mb-2">leaderboard</span>
                  <p>暂无排行数据</p>
                </div>
              ) : (
                <>
                  <div className="divide-y divide-border-dark">
                    {leaderboard.map((item) => (
                      <div key={item.user_id} className="flex items-center gap-4 p-4 hover:bg-surface-lighter transition-colors">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                          item.rank === 1 ? "bg-gradient-to-br from-yellow-400 to-yellow-600 text-white" :
                          item.rank === 2 ? "bg-gradient-to-br from-gray-300 to-gray-500 text-white" :
                          item.rank === 3 ? "bg-gradient-to-br from-orange-400 to-orange-600 text-white" :
                          "bg-surface-dark text-text-secondary border border-border-dark"
                        }`}>
                          {item.rank}
                        </div>
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-sm">
                          {item.nickname.charAt(0)}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-text-primary">{item.nickname}</div>
                          <div className="text-xs text-text-muted">{item.level}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-blue-500">{item.score.toLocaleString()}</div>
                          <div className={`text-xs flex items-center justify-end gap-1 ${
                            item.rank_change > 0 ? "text-green-400" : item.rank_change < 0 ? "text-red-400" : "text-text-muted"
                          }`}>
                            {item.rank_change > 0 && <span className="material-symbols-outlined text-xs">arrow_upward</span>}
                            {item.rank_change < 0 && <span className="material-symbols-outlined text-xs">arrow_downward</span>}
                            {item.rank_change === 0 ? "-" : Math.abs(item.rank_change)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* My Rank */}
                  {myRank && (
                    <div className="p-4 bg-blue-500/5 border-t border-blue-500/20">
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-full bg-surface-dark text-text-secondary border border-border-dark flex items-center justify-center font-bold text-sm">
                          {myRank.rank}
                        </div>
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-sm">
                          我
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-text-primary">我的排名</div>
                          <div className="text-xs text-text-muted">{myRank.level}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-blue-500">{myRank.score.toLocaleString()}</div>
                          <div className={`text-xs flex items-center justify-end gap-1 ${
                            myRank.rank_change > 0 ? "text-green-400" : myRank.rank_change < 0 ? "text-red-400" : "text-text-muted"
                          }`}>
                            {myRank.rank_change > 0 && <span className="material-symbols-outlined text-xs">arrow_upward</span>}
                            {myRank.rank_change < 0 && <span className="material-symbols-outlined text-xs">arrow_downward</span>}
                            {myRank.rank_change === 0 ? "-" : Math.abs(myRank.rank_change)}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* 挑战赛Tab */}
          {activeTab === "challenges" && (
            isLoadingChallenges ? (
              <div className="space-y-4 animate-pulse">
                {[1,2].map(i => (
                  <div key={i} className="bg-surface-card border border-border-dark rounded-xl p-6 h-40"></div>
                ))}
              </div>
            ) : challenges.length === 0 ? (
              <div className="text-center py-16 bg-surface-card border border-border-dark rounded-xl">
                <span className="material-symbols-outlined text-6xl text-text-muted mb-4">emoji_events</span>
                <p className="text-text-muted">暂无进行中的挑战赛</p>
              </div>
            ) : (
              <div className="space-y-4">
                {challenges.map((challenge) => (
                  <div key={challenge.id} className={`bg-surface-card border rounded-xl p-6 ${
                    challenge.is_joined ? "border-blue-500/30" : "border-border-dark"
                  }`}>
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div>
                        <h3 className="font-bold text-text-primary mb-1">{challenge.title}</h3>
                        <p className="text-sm text-text-secondary">{challenge.description}</p>
                      </div>
                      {challenge.is_joined ? (
                        <span className="flex items-center gap-1 px-3 py-1 text-xs font-medium bg-blue-500/10 text-blue-400 rounded-full border border-blue-500/20">
                          <span className="material-symbols-outlined text-sm">check</span>
                          已参加
                        </span>
                      ) : (
                        <button 
                          onClick={() => handleJoinChallenge(challenge.id)}
                          className="px-4 py-2 text-sm font-medium bg-blue-gradient text-white rounded-lg hover:shadow-lg hover:shadow-blue-500/20 transition-all"
                        >
                          立即参加
                        </button>
                      )}
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-4 text-xs text-text-muted">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">group</span>
                        {challenge.participant_count} 人参与
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">schedule</span>
                        {formatEndTime(challenge.end_time)}
                      </span>
                      <span className="flex items-center gap-1 text-blue-400">
                        <span className="material-symbols-outlined text-sm">redeem</span>
                        {challenge.reward}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* My Stats */}
          <div className="bg-surface-card border border-border-dark rounded-xl p-6">
            <h3 className="font-bold text-text-primary mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-500">person</span>
              我的社区数据
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-surface-dark rounded-lg">
                <div className="text-2xl font-bold text-blue-500">{myRank?.score || 0}</div>
                <div className="text-xs text-text-muted mt-1">总积分</div>
              </div>
              <div className="text-center p-4 bg-surface-dark rounded-lg">
                <div className="text-2xl font-bold text-text-primary">{myRank?.rank || "--"}</div>
                <div className="text-xs text-text-muted mt-1">当前排名</div>
              </div>
              <div className="text-center p-4 bg-surface-dark rounded-lg">
                <div className="text-2xl font-bold text-text-primary">{posts.filter(p => p.author.id === user?.id).length}</div>
                <div className="text-xs text-text-muted mt-1">发布动态</div>
              </div>
              <div className="text-center p-4 bg-surface-dark rounded-lg">
                <div className="text-2xl font-bold text-text-primary">{challenges.filter(c => c.is_joined).length}</div>
                <div className="text-xs text-text-muted mt-1">参与挑战</div>
              </div>
            </div>
          </div>

          {/* Top Users */}
          <div className="bg-surface-card border border-border-dark rounded-xl p-6">
            <h3 className="font-bold text-text-primary mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-500">military_tech</span>
              本周之星
            </h3>
            <div className="space-y-3">
              {leaderboard.slice(0, 3).map((item) => (
                <div key={item.user_id} className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    item.rank === 1 ? "bg-yellow-500 text-white" :
                    item.rank === 2 ? "bg-gray-400 text-white" :
                    "bg-orange-500 text-white"
                  }`}>
                    {item.rank}
                  </div>
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-xs">
                    {item.nickname.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-text-primary">{item.nickname}</div>
                    <div className="text-xs text-text-muted">{item.score.toLocaleString()} 分</div>
                  </div>
                </div>
              ))}
              {leaderboard.length === 0 && (
                <p className="text-sm text-text-muted text-center py-4">暂无数据</p>
              )}
            </div>
          </div>

          {/* Hot Topics */}
          <div className="bg-surface-card border border-border-dark rounded-xl p-6">
            <h3 className="font-bold text-text-primary mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-500">local_fire_department</span>
              热门话题
            </h3>
            <div className="space-y-3">
              {["#异议处理技巧", "#社恐蜕变记", "#销冠成长之路", "#本周挑战赛"].map((topic) => (
                <button
                  key={topic}
                  className="block text-sm text-text-secondary hover:text-blue-400 transition-colors"
                >
                  {topic}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
