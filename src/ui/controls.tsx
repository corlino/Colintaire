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
      className="control absolute flex cursor-pointer items-center justify-center rounded-lg bg-black text-text-primary transition-[transform,opacity] duration-(--duration-fast) select-none hover:ring-1 hover:ring-white/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white active:scale-96 disabled:cursor-default disabled:opacity-40 disabled:hover:ring-0 disabled:active:scale-100 motion-reduce:transition-none motion-reduce:active:scale-100"
    >
      {IconCmp ? <IconCmp className="size-6" strokeWidth={1.5} aria-hidden="true" /> : children}
    </button>
  );
}
