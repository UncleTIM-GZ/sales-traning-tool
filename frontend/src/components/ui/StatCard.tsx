import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  unit?: string;
  change?: {
    value: string;
    type: "up" | "down" | "neutral";
  };
  subtitle?: string;
  icon: string;
  iconColor?: "blue" | "emerald" | "zinc";
  className?: string;
}

export function StatCard({
  title,
  value,
  unit,
  change,
  subtitle,
  icon,
  iconColor = "blue",
  className,
}: StatCardProps) {
  const iconColorClasses = {
    blue: "text-blue-500",
    emerald: "text-emerald-500",
    zinc: "text-text-muted",
  };

  const borderHoverClasses = {
    blue: "hover:border-blue-500/30",
    emerald: "hover:border-emerald-500/30",
    zinc: "hover:border-zinc-500/30",
  };

  const changeColorClasses = {
    up: "text-emerald-500 bg-emerald-900/20",
    down: "text-red-500 bg-red-900/20",
    neutral: "text-text-muted bg-bg-card/20",
  };

  const dotColor = {
    blue: "bg-blue-500",
    emerald: "bg-emerald-500",
    zinc: "bg-zinc-500",
  };

  return (
    <div
      className={cn(
        "bg-surface-card border border-border-dark rounded-xl p-6 relative overflow-hidden group transition-colors",
        borderHoverClasses[iconColor],
        className
      )}
    >
      {/* Background Icon */}
      <div className="absolute right-0 top-0 p-4 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
        <span className={cn("material-symbols-outlined text-8xl", iconColorClasses[iconColor])}>
          {icon}
        </span>
      </div>

      {/* Content */}
      <div className="relative z-10">
        <p className="text-text-secondary text-xs font-medium uppercase tracking-wider">{title}</p>
        <div className="flex items-baseline gap-3 mt-2">
          <span className={cn("text-4xl font-extrabold text-text-primary tracking-tight", iconColor === "blue" && "text-glow-blue")}>
            {value}
          </span>
          {unit && <span className="text-text-muted text-sm font-normal">{unit}</span>}
          {change && (
            <span
              className={cn(
                "text-xs font-bold flex items-center px-2 py-0.5 rounded border border-current/20",
                changeColorClasses[change.type]
              )}
            >
              <span className="material-symbols-outlined text-xs mr-1">
                {change.type === "up" ? "trending_up" : change.type === "down" ? "trending_down" : "trending_flat"}
              </span>
              {change.value}
            </span>
          )}
        </div>

        {/* Subtitle or Progress */}
        {subtitle && (
          <p className="text-[11px] text-text-muted mt-4 flex items-center gap-1">
            <span className={cn("w-1.5 h-1.5 rounded-full", dotColor[iconColor])}></span>
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}
