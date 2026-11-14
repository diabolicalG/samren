import type { ComponentProps, ReactNode } from "react";
import { Link, type LinkProps } from "react-router-dom";

type SurfaceProps = ComponentProps<"section"> & {
  children: ReactNode;
};

export function Surface({ children, className = "", ...props }: SurfaceProps) {
  return (
    <section className={`surface ${className}`.trim()} {...props}>
      {children}
    </section>
  );
}

type StatusBadgeProps = {
  children: ReactNode;
  tone?: "neutral" | "positive" | "warning";
  label?: string;
};

export function StatusBadge({ children, tone = "neutral", label }: StatusBadgeProps) {
  return (
    <span className="status-badge" data-tone={tone} role="status" aria-label={label}>
      <span className="status-badge-dot" aria-hidden="true" />
      {children}
    </span>
  );
}

type ActionLinkProps = LinkProps & {
  children: ReactNode;
  className?: string;
};

export function ActionLink({ children, className = "", ...props }: ActionLinkProps) {
  return (
    <Link className={`action-link ${className}`.trim()} {...props}>
      {children}
    </Link>
  );
}
