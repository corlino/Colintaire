import type { ComponentType, ReactNode, SVGProps } from 'react';

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

/** Rounded-square black control with a white outline icon (Style Guide 6.2, TAD §13). */
export function ControlButton({
  label,
  icon: IconCmp,
  children,
  disabled,
  onClick,
  style,
}: {
  label: string;
  icon?: Icon;
  children?: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-disabled={disabled || undefined}
      disabled={disabled}
      onClick={onClick}
      style={style}
      className="control absolute flex items-center justify-center rounded-lg bg-black text-text-primary transition-[transform,opacity] duration-(--duration-fast) select-none active:scale-96 disabled:opacity-40 disabled:active:scale-100"
    >
      {IconCmp ? <IconCmp className="size-6" strokeWidth={1.5} aria-hidden="true" /> : children}
    </button>
  );
}
