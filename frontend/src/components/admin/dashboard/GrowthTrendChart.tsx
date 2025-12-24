'use client';

import { useQuery } from '@tanstack/react-query';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getAdminToken } from '@/lib/api/admin';

interface TrendPoint {
    date: string;
    new_users: number;
    sessions: number;
}

async function fetchGrowthTrend(days: number = 30): Promise<TrendPoint[]> {
    const token = getAdminToken();
    const response = await fetch(`/api/v1/admin/dashboard/growth-trend?days=${days}`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
    if (!response.ok) throw new Error('Failed to fetch trend');
    return response.json();
}

export function GrowthTrendChart() {
    const { data: trendData, isLoading } = useQuery({
        queryKey: ['admin', 'dashboard', 'growth-trend', 30],
        queryFn: () => fetchGrowthTrend(30),
        refetchInterval: 60000, // 1分钟刷新
    });

    if (isLoading) {
        return (
            <div className="bg-bg-card rounded-xl border border-border-default p-6">
                <div className="h-4 bg-bg-elevated rounded w-32 mb-4"></div>
                <div className="h-64 bg-bg-elevated rounded animate-pulse"></div>
            </div>
        );
    }

    if (!trendData || trendData.length === 0) {
        return (
            <div className="bg-bg-card rounded-xl border border-border-default p-6">
                <h3 className="text-lg font-bold text-text-primary mb-4">增长趋势</h3>
                <div className="h-64 flex items-center justify-center text-text-muted">
                    暂无数据
                </div>
            </div>
        );
    }

    return (
        <div className="bg-bg-card rounded-xl border border-border-default p-6">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-text-primary">增长趋势（最近30天）</h3>
                <div className="flex gap-4 text-sm">
                    <div className="flex items-center gap-2">
                        <div className="size-3 rounded-full bg-blue-500"></div>
                        <span className="text-text-muted">新增用户</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="size-3 rounded-full bg-purple-500"></div>
                        <span className="text-text-muted">训练会话</span>
                    </div>
                </div>
            </div>

            <ResponsiveContainer width="100%" height={300}>
                <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis
                        dataKey="date"
                        stroke="#888"
                        tick={{ fill: '#888', fontSize: 12 }}
                    />
                    <YAxis
                        stroke="#888"
                        tick={{ fill: '#888', fontSize: 12 }}
                    />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: '#1a1a1a',
                            border: '1px solid #333',
                            borderRadius: '8px',
                        }}
                        labelStyle={{ color: '#fff' }}
                    />
                    <Legend />
                    <Line
                        type="monotone"
                        dataKey="new_users"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dot={{ fill: '#3b82f6', r: 3 }}
                        name="新增用户"
                    />
                    <Line
                        type="monotone"
                        dataKey="sessions"
                        stroke="#a855f7"
                        strokeWidth={2}
                        dot={{ fill: '#a855f7', r: 3 }}
                        name="训练会话"
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}
