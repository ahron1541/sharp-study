import lightMark from '../../assets/logo/verso_logo.svg';
import lightWordmark from '../../assets/logo/verso_w_name.svg';
import darkMark from '../../assets/logo/verso_dark_log.svg';
import darkWordmark from '../../assets/logo/verso_dark_n.svg';
import styles from './VersoLogo.module.css';

const sizeClasses = {
  sm: {
    mark: 'h-6 w-6',
    wordmark: 'h-7 max-w-[6.8rem]',
  },
  md: {
    mark: 'h-8 w-8',
    wordmark: 'h-9 max-w-[8.5rem]',
  },
  lg: {
    mark: 'h-10 w-10',
    wordmark: 'h-11 max-w-[10.5rem]',
  },
  compact: {
    mark: 'h-7 w-7',
    wordmark: 'h-8 max-w-[7.5rem]',
  },
};

function getVisibilityClass(mode, assetMode) {
  if (mode === assetMode) return styles.forceVisible;
  if (mode !== 'auto') return styles.forceHidden;
  return assetMode === 'light' ? styles.lightAsset : styles.darkAsset;
}

export default function VersoLogo({
  size = 'md',
  showText = true,
  mode = 'auto',
  className = '',
  markClassName = '',
  textClassName = '',
  label = 'Verso',
}) {
  const classes = sizeClasses[size] || sizeClasses.md;
  const lightVisibility = getVisibilityClass(mode, 'light');
  const darkVisibility = getVisibilityClass(mode, 'dark');
  const assetSizeClass = showText ? classes.wordmark : classes.mark;

  return (
    <span className={`inline-flex min-w-0 items-center ${className}`} aria-label={label} role="img">
      <img
        src={showText ? lightWordmark : lightMark}
        alt=""
        aria-hidden="true"
        className={`${lightVisibility} ${assetSizeClass} w-auto shrink-0 object-contain ${markClassName} ${textClassName}`}
      />
      <img
        src={showText ? darkWordmark : darkMark}
        alt=""
        aria-hidden="true"
        className={`${darkVisibility} ${assetSizeClass} w-auto shrink-0 object-contain ${markClassName} ${textClassName}`}
      />
    </span>
  );
}
