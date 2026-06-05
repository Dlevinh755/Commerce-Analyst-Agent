import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const markdownComponents = {
  h1: ({ children }) => <h1 className="mt-4 text-lg font-bold text-slate-900 first:mt-0">{children}</h1>,
  h2: ({ children }) => <h2 className="mt-4 text-base font-bold text-slate-900 first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="mt-3 text-sm font-semibold text-slate-900 first:mt-0">{children}</h3>,
  p: ({ children }) => <p className="mt-3 leading-6 first:mt-0">{children}</p>,
  ul: ({ children }) => <ul className="mt-3 list-disc space-y-1 pl-5 first:mt-0">{children}</ul>,
  ol: ({ children }) => <ol className="mt-3 list-decimal space-y-1 pl-5 first:mt-0">{children}</ol>,
  li: ({ children }) => <li className="leading-6">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
  em: ({ children }) => <em className="italic text-slate-700">{children}</em>,
  blockquote: ({ children }) => (
    <blockquote className="mt-3 border-l-4 border-slate-300 bg-slate-50 px-4 py-2 text-slate-700 first:mt-0">
      {children}
    </blockquote>
  ),
  code: ({ inline, children }) =>
    inline ? (
      <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.92em] text-slate-800">{children}</code>
    ) : (
      <code className="font-mono text-slate-100">{children}</code>
    ),
  pre: ({ children }) => (
    <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-950 px-4 py-3 text-xs leading-6 text-slate-100 first:mt-0">
      {children}
    </pre>
  ),
  hr: () => <hr className="my-4 border-slate-200" />,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="font-medium text-blue-600 underline decoration-blue-300 underline-offset-2"
    >
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div className="mt-3 overflow-x-auto first:mt-0">
      <table className="min-w-full border-collapse overflow-hidden rounded-xl border border-slate-200 bg-white text-left text-sm">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-slate-100 text-slate-700">{children}</thead>,
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => <tr className="border-t border-slate-200">{children}</tr>,
  th: ({ children }) => <th className="px-3 py-2 font-semibold">{children}</th>,
  td: ({ children }) => <td className="px-3 py-2 align-top text-slate-700">{children}</td>,
};

export default function MarkdownMessage({ content, className = '' }) {
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {content || ''}
      </ReactMarkdown>
    </div>
  );
}
