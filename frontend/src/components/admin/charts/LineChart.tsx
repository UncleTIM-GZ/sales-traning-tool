"use client";

/**
 * 折线图组件 - 用于趋势展示
 */

import { Line, LineChart as RechartsLineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend } from "recharts";

interface LineChartProps {
  data: Array<Record<string, any>>;
  xKey: string;
  yKeys: Array<{ key: string; color: string; name: string }>;
  height?: number;
}

export default function LineChart({ data, xKey, yKeys, height = 300 }: LineChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsLineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
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
          <Line
            key={item.key}
            type="monotone"
            dataKey={item.key}
            stroke={item.color}
            strokeWidth={2}
            name={item.name}
            dot={{ fill: item.color, r: 3 }}
            activeDot={{ r: 5 }}
          />
        ))}
      </RechartsLineChart>
    </ResponsiveContainer>
  );
}
