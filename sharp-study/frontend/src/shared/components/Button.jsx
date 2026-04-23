const variants = {
  primary:   'bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white focus-visible:ring-[var(--accent)]',
  secondary: 'bg-transparent border border-[var(--card-border)] hover:bg-[var(--card-bg)] text-[var(--text-color)]',
  danger:    'bg-red-600 hover:bg-red-700 text-white focus-visible:ring-red-400',
  ghost:     'bg-transparent hover:bg-[var(--card-border)] text-[var(--text-color)]',
};

const sizes = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-base',
  lg: 'px-6 py-3 text-lg',
};

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon = null,
  onClick,
  type = 'button',
  className = '',
  ariaLabel,
  ...rest
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      aria-label={ariaLabel}
      aria-busy={loading}
      className={`
        inline-flex items-center justify-center gap-2 font-medium rounded-lg
        transition-all duration-200 focus-visible:outline-none focus-visible:ring-2
        focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed
        ${variants[variant]} ${sizes[size]} ${className}
      `}
      {...rest}
    >
      {loading ? (
        <span
          className="inline-block w-4 h-4 border-2 border-current border-t-transparent
                     rounded-full animate-spin"
          aria-hidden="true"
        />
      ) : icon ? (
        <span aria-hidden="true">{icon}</span>
      ) : null}
      {children}
    </button>
  );
}