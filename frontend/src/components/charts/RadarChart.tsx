"use client";

import { useState, useEffect } from "react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";

interface AbilityData {
  ability: string;
  value: number;
  fullMark: number;
}

interface RadarChartProps {
  data: AbilityData[];
  color?: "blue" | "emerald";
}

export function AbilityRadarChart({ data, color = "blue" }: RadarChartProps) {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    // 延迟挂载确保父容器尺寸已计算
    const timer = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const strokeColor = color === "blue" ? "#3B82F6" : "#10B981";
  const fillColor = color === "blue" ? "rgba(59, 130, 246, 0.3)" : "rgba(16, 185, 129, 0.3)";

  if (!mounted) {
    return (
      <div className="w-full h-full min-h-[280px] flex items-center justify-center">
        <div className="animate-pulse bg-surface-card rounded-full w-32 h-32" />
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280} debounce={50}>
      <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
        <PolarGrid stroke="#272727" />
        <PolarAngleAxis
          dataKey="ability"
          tick={{ fill: "#9CA3AF", fontSize: 12 }}
          tickLine={false}
        />
        <PolarRadiusAxis
          angle={90}
          domain={[0, 100]}
          tick={{ fill: "#6B7280", fontSize: 10 }}
          tickCount={5}
          axisLine={false}
        />
        <Radar
          name="能力值"
          dataKey="value"
          stroke={strokeColor}
          fill={fillColor}
          strokeWidth={2}
          dot={{
            r: 4,
            fill: strokeColor,
            stroke: "#0F0F0F",
            strokeWidth: 2,
          }}
          animationDuration={1500}
          animationEasing="ease-out"
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
