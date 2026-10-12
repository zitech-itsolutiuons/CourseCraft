"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useFormStatus } from "react-dom";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

type PendingSubmitButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  pendingLabel: string;
  align?: "center" | "start";
};

export default function PendingSubmitButton({
  children,
  pendingLabel,
  disabled,
  align = "center",
  className = "",
  ...props
}: PendingSubmitButtonProps) {
  const { pending } = useFormStatus();
  const alignment = align === "start" ? "justify-start" : "justify-center";

  return (
    <button
      {...props}
      type="submit"
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      className={`inline-flex items-center ${alignment} gap-2 disabled:cursor-wait ${className}`}
    >
      {pending && <LoadingSpinner />}
      <span>{pending ? pendingLabel : children}</span>
    </button>
  );
}
