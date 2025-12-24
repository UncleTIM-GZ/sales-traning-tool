import { cn } from "@/lib/utils";
import Link from "next/link";

interface TrainingCardProps {
  title: string;
  description: string;
  icon: string;
  type: "sales" | "social";
  href: string;
  className?: string;
}

export function TrainingCard({
  title,
  description,
  icon,
  type,
  href,
  className,
}: TrainingCardProps) {
  const typeColors = {
    sales: {
      border: "border-blue-500/20",
      hoverShadow: "hover:shadow-[0_0_30px_-10px_rgba(59,130,246,0.2)]",
      gradient: "from-blue-500/10",
      iconBg: "bg-blue-500/10 text-blue-500 border-blue-500/20",
      text: "text-blue-400",
    },
    social: {
      border: "border-emerald-500/20",
      hoverShadow: "hover:shadow-[0_0_30px_-10px_rgba(16,185,129,0.2)]",
      gradient: "from-emerald-500/10",
      iconBg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      text: "text-emerald-400",
    },
  };

  const colors = typeColors[type];

  return (
    <Link
      href={href}
      className={cn(
        "relative overflow-hidden rounded-xl bg-surface-card border p-8 flex flex-col justify-between min-h-[240px] group cursor-pointer transition-all",
        colors.border,
        colors.hoverShadow,
        className
      )}
    >
      {/* Hover Gradient */}
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-br to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500",
          colors.gradient
        )}
      />

      {/* Background Icon */}
      <div className="absolute top-0 right-0 p-6 opacity-20">
        <span
          className={cn("material-symbols-outlined text-[100px] leading-none", colors.text)}
          style={{ fontVariationSettings: "'FILL' 0, 'wght' 200" }}
        >
          {type === "sales" ? "handshake" : "record_voice_over"}
        </span>
      </div>

      {/* Content */}
      <div className="relative z-10">
        <div className={cn("w-fit p-3 rounded-lg mb-4 border", colors.iconBg)}>
          <span className="material-symbols-outlined text-3xl">{icon}</span>
        </div>
        <h3 className="text-2xl font-bold text-text-primary mb-2">{title}</h3>
        <p className="text-text-secondary text-sm leading-relaxed max-w-[85%]">{description}</p>
      </div>

      {/* CTA */}
      <div
        className={cn(
          "relative z-10 flex items-center gap-2 font-bold mt-6 text-sm uppercase tracking-wider group-hover:translate-x-1 transition-transform",
          colors.text
        )}
      >
        <span>{type === "sales" ? "进入实战" : "开始疗愈"}</span>
        <span className="material-symbols-outlined text-sm">arrow_forward</span>
      </div>
    </Link>
  );
}
