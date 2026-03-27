"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type PasswordInputProps = Omit<React.ComponentProps<"input">, "type"> & {
  containerClassName?: string;
};

const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, containerClassName, disabled, ...props }, ref) => {
    const [visible, setVisible] = React.useState(false);

    return (
      <div className={cn("relative flex w-full items-center", containerClassName)}>
        <input
          type={visible ? "text" : "password"}
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background py-2 pl-3 pr-11 text-base ring-offset-background transition-colors duration-200 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
            className
          )}
          ref={ref}
          disabled={disabled}
          {...props}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-0.5 h-9 w-9 shrink-0 text-muted-foreground"
          disabled={disabled}
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
      </div>
    );
  }
);
PasswordInput.displayName = "PasswordInput";

export { PasswordInput };
