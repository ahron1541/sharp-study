import { useNavigate } from 'react-router-dom';
import { BookOpen, CreditCard, HelpCircle, ExternalLink } from 'lucide-react';

const TYPE_CONFIG = {
  study_guide: {
    icon:  BookOpen,
    label: 'Study Guide',
    route: '/study-guide',
    color: 'text-blue-500',
    bg:    'bg-blue-50',
  },
  flashcard_set: {
    icon:  CreditCard,
    label: 'Flashcards',
    route: '/flashcards',
    color: 'text-purple-500',
    bg:    'bg-purple-50',
  },
  quiz: {
    icon:  HelpCircle,
    label: 'Quiz',
    route: '/quiz',
    color: 'text-green-500',
    bg:    'bg-green-50',
  },
};

/**
 * Material card shown in the dashboard grid.
 *
 * Props:
 *   id       — UUID
 *   title    — string
 *   type     — 'study_guide' | 'flashcard_set' | 'quiz'
 *   createdAt — ISO string
 */
export default function MaterialCard({ id, title, type, createdAt }) {
  const navigate = useNavigate();
  const config   = TYPE_CONFIG[type] ?? TYPE_CONFIG.study_guide;
  const Icon     = config.icon;

  const date = new Date(createdAt).toLocaleDateString('en-PH', {
    year: 'numeric', month: 'short', day: 'numeric',
  });

  const handleOpen = () => navigate(`${config.route}/${id}`);

  return (
    <article
      className="
        bg-surface rounded-2xl p-5 shadow-card
        hover:shadow-card-hover transition-shadow duration-200
        flex flex-col gap-3 cursor-pointer group
        focus-within:ring-2 focus-within:ring-accent
        focus-within:ring-offset-2
      "
      aria-label={`${config.label}: ${title}`}
    >
      {/* Type badge */}
      <div className="flex items-center gap-2">
        <div className={`w-8 h-8 rounded-lg ${config.bg} flex items-center justify-center`}>
          <Icon size={16} className={config.color} aria-hidden="true" />
        </div>
        <span className={`text-xs font-semibold ${config.color}`}>
          {config.label}
        </span>
      </div>

      {/* Title */}
      <h3 className="text-sm font-semibold text-text line-clamp-2 flex-1">
        {title}
      </h3>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <time
          dateTime={createdAt}
          className="text-xs text-muted"
        >
          {date}
        </time>
        <button
          onClick={handleOpen}
          aria-label={`Open ${title}`}
          className="
            flex items-center gap-1 text-xs font-semibold text-accent
            hover:text-accent-hover transition-colors
            focus-visible:outline-none focus-visible:underline
          "
        >
          Open
          <ExternalLink size={12} aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}