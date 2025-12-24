"use client";

/**
 * 柱状图组件 - 用于对比展示
 */

import { Bar, BarChart as RechartsBarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend } from "recharts";

interface BarChartProps {
  data: Array<Record<string, any>>;
  xKey: string;
  yKeys: Array<{ key: string; color: string; name: string }>;
  height?: number;
}

export default function BarChart({ data, xKey, yKeys, height = 300 }: BarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsBarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
        <XAxis dataKey={xKey} stroke="#71717a" style={{ fontSize: 12 }} />
        <YAxis stroke="#71717a" style={{ fontSize: 12 }} />
        <Tooltip
          contentStyle={{
            backgroundColor: "#18181b",
            border: "1px solid #3f3f46",
            borderRadius: "8px",
            fontSize: 12,
          }}
          labelStyle={{ color: "#a1a1aa" }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {yKeys.map((item) => (
          <Bar key={item.key} dataKey={item.key} fill={item.color} name={item.name} radius={[4, 4, 0, 0]} />
        ))}
      </RechartsBarChart>
    </ResponsiveContainer>
  );
}
