import * as React from "react";
import { cn } from "@/lib/utils";

type BadgeProps = React.HTMLAttributes<HTMLDivElement> & {
  tone?: "neutral" | "accent" | "success" | "danger";
};

export function Badge({ className, tone = "neutral", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex h-6 items-center rounded-md border px-2 text-xs font-medium",
        tone === "neutral" && "border-border bg-background/[0.52] text-muted-foreground",
        tone === "accent" && "border-transparent bg-accent/[0.12] text-foreground",
        tone === "success" && "border-transparent bg-primary/[0.12] text-primary",
        tone === "danger" && "border-transparent bg-destructive/[0.12] text-destructive",
        className,
      )}
      {...props}
    />
  );
}
