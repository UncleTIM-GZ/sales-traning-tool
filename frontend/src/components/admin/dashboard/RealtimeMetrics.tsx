'use client';

import { useQuery } from '@tanstack/react-query';
import {
    Users,
    Activity,
    TrendingUp,
    BookOpen,
    MessageSquare,
    Award,
    ArrowUp,
    ArrowDown,
} from 'lucide-react';
import { getAdminToken } from '@/lib/api/admin';

interface RealtimeStats {
    total_users: number;
    active_users: number;
    new_users_today: number;
    total_sessions: number;
    sessions_today: number;
    avg_score: number;
    total_scenarios: number;
    total_courses: number;
    total_posts: number;
}

async function fetchRealtimeStats(): Promise<RealtimeStats> {
    const token = getAdminToken();
    const response = await fetch('/api/v1/admin/dashboard/realtime', {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
    if (!response.ok) throw new Error('Failed to fetch stats');
    return response.json();
}

export function RealtimeMetrics() {
    const { data: stats, isLoading } = useQuery({
        queryKey: ['admin', 'dashboard', 'realtime'],
        queryFn: fetchRealtimeStats,
        refetchInterval: 30000, // 30秒刷新
    });

    if (isLoading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[1, 2, 3, 4].map((i) => (
                    <div
                        key={i}
                        className="bg-bg-card rounded-xl border border-border-default p-6 animate-pulse"
                    >
                        <div className="h-4 bg-bg-elevated rounded w-24 mb-4"></div>
                        <div className="h-8 bg-bg-elevated rounded w-16"></div>
                    </div>
                ))}
            </div>
        );
    }

    if (!stats) return null;

    const metrics = [
        {
            label: '总用户数',
            value: stats.total_users.toLocaleString(),
            change: `今日新增 ${stats.new_users_today}`,
            icon: Users,
            color: 'text-blue-400',
            bgColor: 'bg-blue-500/10',
        },
        {
            label: '活跃用户',
            value: stats.active_users.toLocaleString(),
            change: `${((stats.active_users / stats.total_users) * 100).toFixed(1)}% 活跃率`,
            icon: Activity,
            color: 'text-green-400',
            bgColor: 'bg-green-500/10',
        },
        {
            label: '训练会话',
            value: stats.total_sessions.toLocaleString(),
            change: `今日 ${stats.sessions_today} 次`,
            icon: TrendingUp,
            color: 'text-purple-400',
            bgColor: 'bg-purple-500/10',
        },
        {
            label: '平均得分',
            value: stats.avg_score.toFixed(1),
            change: '全平台平均',
            icon: Award,
            color: 'text-amber-400',
            bgColor: 'bg-amber-500/10',
        },
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {metrics.map((metric) => {
                const Icon = metric.icon;
                return (
                    <div
                        key={metric.label}
                        className="bg-bg-card rounded-xl border border-border-default p-6 hover:border-border-strong transition-colors"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-sm text-text-muted">{metric.label}</span>
                            <div className={`p-2 rounded-lg ${metric.bgColor}`}>
                                <Icon className={`size-5 ${metric.color}`} />
                            </div>
                        </div>
                        <div className="flex items-end justify-between">
                            <div>
                                <div className="text-3xl font-bold text-text-primary mb-1">
                                    {metric.value}
                                </div>
                                <div className="text-xs text-text-muted flex items-center gap-1">
                                    {metric.change}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
