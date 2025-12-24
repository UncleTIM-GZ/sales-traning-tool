"use client";

/**
 * 开发：Excellent（11964948@qq.com）
 * 功能：好友管理页面
 * 作用：查看好友列表、添加好友、处理好友请求
 * 创建时间：2025-12-23
 * 最后修改：2025-12-23
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  UserPlus,
  Search,
  Bell,
  Check,
  X,
  Loader2,
  MessageCircle,
  UserMinus,
  ChevronRight,
  Inbox,
  Send,
  Heart,
} from "lucide-react";
import { useAuthStore } from "@/stores/authStore";

interface UserBrief {
  id: string;
  nickname: string;
  avatar: string | null;
  phone: string | null;
}

interface Friend {
  id: string;
  user: UserBrief;
  remark: string | null;
  created_at: string;
}

interface FriendRequest {
  id: string;
  sender: UserBrief;
  receiver: UserBrief;
  message: string | null;
  status: string;
  created_at: string;
}

interface SearchUser {
  id: string;
  nickname: string;
  avatar: string | null;
  phone: string | null;
  is_friend: boolean;
}

type TabType = "friends" | "requests" | "add";

const API_BASE = "";

export default function FriendsPage() {
  const router = useRouter();
  const { token } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabType>("friends");
  const [loading, setLoading] = useState(true);

  // 好友列表
  const [friends, setFriends] = useState<Friend[]>([]);

  // 好友请求
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [requestType, setRequestType] = useState<"received" | "sent">("received");

  // 搜索添加
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [requestMessage, setRequestMessage] = useState("");
  const [sendingTo, setSendingTo] = useState<string | null>(null);

  // 请求数量
  const [requestCount, setRequestCount] = useState(0);

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  // 加载好友列表
  const loadFriends = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/friends/friends`, { headers });
      const data = await res.json();
      setFriends(data.items || []);
    } catch (error) {
      console.error("加载好友失败:", error);
    } finally {
      setLoading(false);
    }
  };

  // 加载好友请求
  const loadRequests = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/friends/friends/requests?type=${requestType}`, { headers });
      const data = await res.json();
      setRequests(data.items || []);
      if (requestType === "received") {
        setRequestCount(data.total || 0);
      }
    } catch (error) {
      console.error("加载请求失败:", error);
    } finally {
      setLoading(false);
    }
  };

  // 搜索用户
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/friends/friends/search?q=${encodeURIComponent(searchQuery)}`, { headers });
      const data = await res.json();
      setSearchResults(data.items || []);
    } catch (error) {
      console.error("搜索失败:", error);
    } finally {
      setIsSearching(false);
    }
  };

  // 发送好友请求
  const handleSendRequest = async (userId: string) => {
    setSendingTo(userId);
    try {
      const res = await fetch(`${API_BASE}/api/v1/friends/friends/request`, {
        method: "POST",
        headers,
        body: JSON.stringify({ friend_id: userId, message: requestMessage }),
      });
      const data = await res.json();
      if (data.success) {
        // 更新搜索结果
        setSearchResults(prev => prev.map(u =>
          u.id === userId ? { ...u, is_friend: true } : u
        ));
        setRequestMessage("");
      }
    } catch (error) {
      console.error("发送请求失败:", error);
    } finally {
      setSendingTo(null);
    }
  };

  // 处理好友请求
  const handleRequest = async (requestId: string, action: "accept" | "reject") => {
    try {
      await fetch(`${API_BASE}/api/v1/friends/friends/requests/${requestId}`, {
        method: "POST",
        headers,
        body: JSON.stringify({ action }),
      });
      loadRequests();
    } catch (error) {
      console.error("处理请求失败:", error);
    }
  };

  // 删除好友
  const handleRemoveFriend = async (friendId: string) => {
    if (!confirm("确定要删除这位好友吗？")) return;
    try {
      await fetch(`${API_BASE}/api/v1/friends/friends/${friendId}`, {
        method: "DELETE",
        headers,
      });
      loadFriends();
    } catch (error) {
      console.error("删除好友失败:", error);
    }
  };

  useEffect(() => {
    if (activeTab === "friends") {
      loadFriends();
    } else if (activeTab === "requests") {
      loadRequests();
    }
  }, [activeTab, requestType]);

  // 初始加载请求数
  useEffect(() => {
    fetch(`${API_BASE}/api/v1/friends/friends/requests?type=received`, { headers })
      .then(res => res.json())
      .then(data => setRequestCount(data.total || 0))
      .catch(() => { });
  }, []);

  return (
    <div className="max-w-4xl mx-auto">
      {/* 页面标题 */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center shadow-lg shadow-primary/25">
            <Users className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">好友</h1>
            <p className="text-text-muted text-sm">与好友分享精英圈层场景</p>
          </div>
        </div>
      </div>

      {/* 标签页 */}
      <div className="flex items-center gap-1 p-1 bg-surface-card rounded-xl border border-border-dark mb-6 w-fit">
        {[
          { id: "friends", label: "我的好友", icon: Users, count: friends.length },
          { id: "requests", label: "好友请求", icon: Bell, count: requestCount },
          { id: "add", label: "添加好友", icon: UserPlus },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabType)}
            className={`relative flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm transition-all ${activeTab === tab.id
                ? "bg-primary text-white shadow-md"
                : "text-text-muted hover:text-text-secondary hover:bg-surface-lighter"
              }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && activeTab !== tab.id && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-xs rounded-full flex items-center justify-center">
                {tab.count > 99 ? "99+" : tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 好友列表 */}
      {activeTab === "friends" && (
        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
          ) : friends.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary/10 to-blue-500/10 flex items-center justify-center">
                <Heart className="w-10 h-10 text-text-muted" />
              </div>
              <h3 className="text-lg font-medium text-text-primary mb-2">还没有好友</h3>
              <p className="text-text-muted mb-6">添加好友后可以分享精英圈层场景</p>
              <button
                onClick={() => setActiveTab("add")}
                className="px-6 py-3 bg-gradient-to-r from-primary to-blue-600 text-white rounded-xl font-medium hover:shadow-lg hover:shadow-primary/25 transition-all inline-flex items-center gap-2"
              >
                <UserPlus className="w-4 h-4" />
                添加好友
              </button>
            </div>
          ) : (
            <div className="grid gap-3">
              {friends.map((friend) => (
                <div
                  key={friend.id}
                  className="flex items-center gap-4 p-4 bg-surface-card border border-border-dark rounded-xl hover:border-primary/30 transition-all group"
                >
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-blue-500/20 flex items-center justify-center ring-2 ring-surface-card">
                    <span className="text-lg font-semibold text-primary">
                      {friend.user.nickname.slice(0, 1)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-text-primary">
                      {friend.remark || friend.user.nickname}
                    </h3>
                    {friend.remark && (
                      <p className="text-sm text-text-muted">{friend.user.nickname}</p>
                    )}
                    <p className="text-xs text-text-muted">
                      {friend.user.phone}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleRemoveFriend(friend.user.id)}
                      className="p-2 text-text-muted hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all"
                      title="删除好友"
                    >
                      <UserMinus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 好友请求 */}
      {activeTab === "requests" && (
        <div className="space-y-4">
          {/* 切换收到/发出 */}
          <div className="flex gap-2">
            <button
              onClick={() => setRequestType("received")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${requestType === "received"
                  ? "bg-primary/10 text-primary"
                  : "text-text-muted hover:text-text-secondary"
                }`}
            >
              <Inbox className="w-4 h-4" />
              收到的请求
            </button>
            <button
              onClick={() => setRequestType("sent")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${requestType === "sent"
                  ? "bg-primary/10 text-primary"
                  : "text-text-muted hover:text-text-secondary"
                }`}
            >
              <Send className="w-4 h-4" />
              发出的请求
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-surface-lighter flex items-center justify-center">
                <Bell className="w-8 h-8 text-text-muted" />
              </div>
              <p className="text-text-muted">
                {requestType === "received" ? "暂无好友请求" : "暂无发出的请求"}
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {requests.map((request) => (
                <div
                  key={request.id}
                  className="flex items-center gap-4 p-4 bg-surface-card border border-border-dark rounded-xl"
                >
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-blue-500/20 flex items-center justify-center">
                    <span className="text-lg font-semibold text-primary">
                      {(requestType === "received" ? request.sender : request.receiver).nickname.slice(0, 1)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-text-primary">
                      {(requestType === "received" ? request.sender : request.receiver).nickname}
                    </h3>
                    {request.message && (
                      <p className="text-sm text-text-muted line-clamp-1">
                        {request.message}
                      </p>
                    )}
                    <p className="text-xs text-text-muted mt-1">
                      {new Date(request.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  {requestType === "received" && request.status === "pending" && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleRequest(request.id, "accept")}
                        className="p-2 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 rounded-lg transition-all"
                        title="接受"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleRequest(request.id, "reject")}
                        className="p-2 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 rounded-lg transition-all"
                        title="拒绝"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  {request.status !== "pending" && (
                    <span className={`text-xs px-2 py-1 rounded-full ${request.status === "accepted"
                        ? "bg-emerald-500/10 text-emerald-500"
                        : "bg-rose-500/10 text-rose-500"
                      }`}>
                      {request.status === "accepted" ? "已接受" : "已拒绝"}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 添加好友 */}
      {activeTab === "add" && (
        <div className="space-y-6">
          {/* 搜索框 */}
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="搜索昵称或手机号..."
                className="w-full pl-12 pr-4 py-3.5 bg-surface-card border border-border-dark rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={isSearching}
              className="px-6 py-3.5 bg-gradient-to-r from-primary to-blue-600 text-white rounded-xl font-medium hover:shadow-lg hover:shadow-primary/25 transition-all disabled:opacity-50"
            >
              {isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : "搜索"}
            </button>
          </div>

          {/* 搜索结果 */}
          {searchResults.length > 0 ? (
            <div className="grid gap-3">
              {searchResults.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center gap-4 p-4 bg-surface-card border border-border-dark rounded-xl"
                >
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-blue-500/20 flex items-center justify-center">
                    <span className="text-lg font-semibold text-primary">
                      {user.nickname.slice(0, 1)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-text-primary">{user.nickname}</h3>
                    <p className="text-sm text-text-muted">{user.phone}</p>
                  </div>
                  {user.is_friend ? (
                    <span className="text-sm text-text-muted">已是好友</span>
                  ) : (
                    <button
                      onClick={() => handleSendRequest(user.id)}
                      disabled={sendingTo === user.id}
                      className="px-4 py-2 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg text-sm font-medium transition-all disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {sendingTo === user.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <UserPlus className="w-4 h-4" />
                          添加
                        </>
                      )}
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : searchQuery && !isSearching ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-surface-lighter flex items-center justify-center">
                <Search className="w-8 h-8 text-text-muted" />
              </div>
              <p className="text-text-muted">没有找到相关用户</p>
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary/10 to-blue-500/10 flex items-center justify-center">
                <UserPlus className="w-10 h-10 text-primary/50" />
              </div>
              <h3 className="text-lg font-medium text-text-primary mb-2">搜索好友</h3>
              <p className="text-text-muted">通过昵称或手机号搜索并添加好友</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
