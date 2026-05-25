import lightMark from '../../assets/logo/verso_logo.svg';
import lightWordmark from '../../assets/logo/verso_w_name.svg';
import darkMark from '../../assets/logo/verso_dark_log.svg';
import darkWordmark from '../../assets/logo/verso_dark_n.svg';
import styles from './VersoLogo.module.css';

const sizeClasses = {
  sm: {
    mark: styles.markSm,
    wordmark: styles.wordmarkSm,
  },
  md: {
    mark: styles.markMd,
    wordmark: styles.wordmarkMd,
  },
  lg: {
    mark: styles.markLg,
    wordmark: styles.wordmarkLg,
  },
  compact: {
    mark: styles.markCompact,
    wordmark: styles.wordmarkCompact,
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
    <span className={`${styles.root} ${className}`} aria-label={label} role="img">
      <img
        src={showText ? lightWordmark : lightMark}
        alt=""
        aria-hidden="true"
        className={`${styles.asset} ${lightVisibility} ${assetSizeClass} ${markClassName} ${textClassName}`}
      />
      <img
        src={showText ? darkWordmark : darkMark}
        alt=""
        aria-hidden="true"
        className={`${styles.asset} ${darkVisibility} ${assetSizeClass} ${markClassName} ${textClassName}`}
      />
    </span>
  );
}
