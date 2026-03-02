import React, { ButtonHTMLAttributes, ReactNode } from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/src/utils";

interface TechButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: LucideIcon | React.ElementType;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  active?: boolean;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  children?: ReactNode;
  className?: string;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  title?: string;
  iconSize?: number;
}

export function TechButton({
  children,
  icon: Icon,
  variant = "secondary",
  active,
  size = "md",
  className,
  iconSize,
  ...props
}: TechButtonProps) {
  const variants = {
    primary: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20",
    secondary: "border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white",
    danger: "border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20",
    ghost: "border-transparent bg-transparent text-white/50 hover:text-white",
  };

  const sizes = {
    sm: "px-2 py-1 min-h-[2rem] min-w-[2rem] md:min-h-0 md:min-w-0 text-xs gap-1.5",
    md: "px-4 py-2 min-h-[2.75rem] min-w-[2.75rem] md:min-h-0 md:min-w-0 text-sm gap-2",
    lg: "px-6 py-3 min-h-[3rem] min-w-[3rem] md:min-h-0 md:min-w-0 text-base gap-3",
  };

  const resolvedIconSize = iconSize ?? (size === "sm" ? 12 : size === "md" ? 14 : 18);

  return (
    <button
      className={cn(
        "btn-tech flex items-center justify-center rounded-md font-medium",
        variants[variant],
        sizes[size],
        active && "bg-white/20 text-white border-white/40",
        className
      )}
      {...props}
    >
      {Icon && <Icon size={resolvedIconSize} />}
      {children}
      {active && (
        <span className="absolute top-1 right-1 w-1 h-1 rounded-full bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,1)]" />
      )}
    </button>
  );
}
