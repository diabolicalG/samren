import type { ComponentProps, ReactNode } from "react";
import { Link, type LinkProps } from "react-router-dom";

type SurfaceProps = ComponentProps<"section"> & { children: ReactNode };

export function Surface({ children, className = "", ...props }: SurfaceProps) {
  return <section className={`surface ${className}`.trim()} {...props}>{children}</section>;
}

type CardProps = ComponentProps<"article"> & { children: ReactNode };

export function Card({ children, className = "", ...props }: CardProps) {
  return <article className={`ui-card ${className}`.trim()} {...props}>{children}</article>;
}

type ButtonProps = ComponentProps<"button"> & { variant?: "primary" | "secondary" | "quiet" };

export function Button({ children, className = "", variant = "secondary", type = "button", ...props }: ButtonProps) {
  return <button className={`ui-button ui-button--${variant} ${className}`.trim()} type={type} {...props}>{children}</button>;
}

type TextFieldProps = Omit<ComponentProps<"input">, "id"> & {
  id: string;
  label: string;
  hint?: string;
};

export function TextField({ id, label, hint, className = "", ...props }: TextFieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className="ui-field">
      <label htmlFor={id}>{label}</label>
      <input id={id} className={`ui-input ${className}`.trim()} aria-describedby={hintId} {...props} />
      {hint ? <p className="ui-field-hint" id={hintId}>{hint}</p> : null}
    </div>
  );
}

type SkeletonProps = ComponentProps<"div"> & { label?: string };

export function Skeleton({ className = "", label = "Loading", ...props }: SkeletonProps) {
  return <div className={`ui-skeleton ${className}`.trim()} role="status" aria-label={label} {...props} />;
}

type DialogProps = Omit<ComponentProps<"dialog">, "open"> & {
  open: boolean;
  title: string;
  children: ReactNode;
};

export function Dialog({ open, title, children, className = "", ...props }: DialogProps) {
  return (
    <dialog open={open} aria-label={title} className={`ui-dialog ${className}`.trim()} {...props}>
      {children}
    </dialog>
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

type ActionLinkProps = LinkProps & { children: ReactNode; className?: string };

export function ActionLink({ children, className = "", ...props }: ActionLinkProps) {
  return <Link className={`action-link ${className}`.trim()} {...props}>{children}</Link>;
}
