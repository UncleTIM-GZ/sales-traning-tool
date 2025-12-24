"use client";

import { useState, useEffect } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface TrendData {
  date: string;
  value: number;
}

interface TrendChartProps {
  data: TrendData[];
  color?: "blue" | "emerald" | "green";
  showGrid?: boolean;
  height?: number;
}

export function TrendChart({ data, color = "blue", showGrid = true, height = 200 }: TrendChartProps) {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    // 延迟挂载确保父容器尺寸已计算
    const timer = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const colors = {
    blue: { stroke: "#3B82F6", fill: "url(#blueGradient)" },
    emerald: { stroke: "#10B981", fill: "url(#emeraldGradient)" },
    green: { stroke: "#22C55E", fill: "url(#greenGradient)" },
  };

  const { stroke, fill } = colors[color];

  if (!mounted) {
    return (
      <div className="w-full flex items-center justify-center" style={{ height, minHeight: height }}>
        <div className="animate-pulse bg-surface-card rounded w-full h-full" />
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height} debounce={50}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="blueGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="emeraldGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10B981" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="greenGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22C55E" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#22C55E" stopOpacity={0} />
          </linearGradient>
        </defs>
        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#272727" vertical={false} />}
        <XAxis
          dataKey="date"
          axisLine={false}
          tickLine={false}
          tick={{ fill: "#6B7280", fontSize: 11 }}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fill: "#6B7280", fontSize: 11 }}
          domain={["dataMin - 5", "dataMax + 5"]}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#141414",
            border: "1px solid #272727",
            borderRadius: "8px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
          }}
          labelStyle={{ color: "#9CA3AF", fontSize: 12 }}
          itemStyle={{ color: stroke, fontSize: 13, fontWeight: 600 }}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={stroke}
          strokeWidth={2}
          fill={fill}
          animationDuration={1500}
          animationEasing="ease-out"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
