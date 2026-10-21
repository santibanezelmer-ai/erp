import { cn } from "@/lib/utils";

export function Logo({
  className = "h-8 w-8",
  showText = false,
  textClassName = "font-extrabold text-lg tracking-tight",
}: {
  className?: string;
  showText?: boolean;
  textClassName?: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div className={cn("relative overflow-hidden rounded-xl shrink-0 shadow-xs bg-background border border-border/50", className)}>
        <img
          src="/icon-192.png"
          alt="Operix ERP"
          className="w-full h-full object-cover"
        />
      </div>
      {showText && (
        <span className={cn("text-foreground leading-tight", textClassName)}>
          Operix <span className="text-primary font-bold">ERP</span>
        </span>
      )}
    </div>
  );
}
