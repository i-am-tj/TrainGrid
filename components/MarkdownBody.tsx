import ReactMarkdown from "react-markdown";

export function MarkdownBody({ markdown }: { markdown: string }) {
  if (!markdown.trim()) {
    return <p className="text-sm text-stone-500">No workout details.</p>;
  }
  return (
    <div className="max-w-prose text-sm leading-relaxed text-stone-800">
      <ReactMarkdown
        components={{
          h1: ({ children }) => (
            <h2 className="mt-5 text-base font-semibold text-stone-900 first:mt-0">
              {children}
            </h2>
          ),
          h2: ({ children }) => (
            <h2 className="mt-5 text-base font-semibold text-stone-900 first:mt-0">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-4 text-sm font-semibold text-stone-900">{children}</h3>
          ),
          p: ({ children }) => <p className="mt-2 whitespace-pre-wrap">{children}</p>,
          ul: ({ children }) => <ul className="mt-2 list-disc pl-5">{children}</ul>,
          ol: ({ children }) => (
            <ol className="mt-2 list-decimal pl-5">{children}</ol>
          ),
          li: ({ children }) => <li className="mt-1">{children}</li>,
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
