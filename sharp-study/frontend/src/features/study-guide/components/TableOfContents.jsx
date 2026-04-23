import { useMemo } from 'react';

export default function TableOfContents({ content }) {
  const headings = useMemo(() => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/html');
    const els = doc.querySelectorAll('h2, h3, h4');
    return Array.from(els).map((el, i) => ({
      id: `heading-${i}`,
      text: el.textContent,
      level: Number(el.tagName[1]),
    }));
  }, [content]);

  if (!headings.length) {
    return <p className="text-xs text-[var(--muted)]">No headings yet.</p>;
  }

  return (
    <nav aria-label="Document outline">
      <ul className="space-y-1">
        {headings.map((h) => (
          <li key={h.id}>
            <a
              href={`#${h.id}`}
              className={`block text-xs text-[var(--muted)] hover:text-[var(--accent)]
                          transition-colors py-0.5 focus-visible:outline focus-visible:outline-2
                          focus-visible:outline-[var(--accent)] rounded
                          ${h.level === 3 ? 'pl-3' : h.level === 4 ? 'pl-6' : ''}`}
            >
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}