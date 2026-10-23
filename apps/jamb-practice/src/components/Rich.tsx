import { Fragment, type ReactNode } from 'react';

// Lesson text supports three marks: **bold**, *italic* and [[underlined words]].
// Everything else is plain text; nothing is ever rendered as HTML.
const TOKEN = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|\[\[[^\]]+\]\])/g;

export function renderMarks(text: string): ReactNode[] {
  return text.split(TOKEN).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('[[') && part.endsWith(']]')) return <u key={i}>{part.slice(2, -2)}</u>;
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) return <em key={i}>{part.slice(1, -1)}</em>;
    return <Fragment key={i}>{part}</Fragment>;
  });
}

export function Rich({ text, as: Tag = 'span', className }: { text: string; as?: 'span' | 'p' | 'div'; className?: string }) {
  return <Tag className={className}>{renderMarks(text)}</Tag>;
}
