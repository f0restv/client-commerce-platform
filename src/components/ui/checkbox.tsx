"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export interface CheckboxProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  onCheckedChange?: (checked: boolean) => void;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, onCheckedChange, checked, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onCheckedChange?.(e.target.checked);
      props.onChange?.(e);
    };

    return (
      <div className="relative inline-flex items-center">
        <input
          type="checkbox"
          className="sr-only peer"
          ref={ref}
          checked={checked}
          onChange={handleChange}
          {...props}
        />
        <div
          className={cn(
            "h-4 w-4 shrink-0 rounded-sm border border-gray-300 ring-offset-white",
            "peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-amber-500 peer-focus-visible:ring-offset-2",
            "peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
            "peer-checked:bg-amber-600 peer-checked:border-amber-600",
            className
          )}
        >
          {checked && (
            <Check className="h-3 w-3 text-white absolute top-0.5 left-0.5" />
          )}
        </div>
      </div>
    );
  }
);
Checkbox.displayName = "Checkbox";

export { Checkbox };
