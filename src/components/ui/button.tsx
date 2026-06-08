import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-[0.45]",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/[0.92]",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/[0.78]",
        ghost: "hover:bg-muted text-foreground",
        outline: "border border-border bg-background/40 hover:bg-muted",
        accent: "bg-accent text-accent-foreground hover:bg-accent/[0.92]",
        danger: "bg-destructive text-destructive-foreground hover:bg-destructive/[0.92]",
      },
      size: {
        default: "h-9 px-3.5",
        sm: "h-8 px-3 text-xs",
        icon: "h-8 w-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    const buttonProps = asChild ? props : { type: "button" as const, ...props };

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...buttonProps}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
