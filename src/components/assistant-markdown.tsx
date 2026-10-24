import type { ReactNode } from "react";

function safeLink(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

function renderInline(text: string): ReactNode[] {
  const pattern = /(\*\*[^*\n]+\*\*|__[^_\n]+__|~~[^~\n]+~~|`[^`\n]+`|\*[^*\n]+\*|_[^_\n]+_|\[[^\]\n]+\]\(https?:\/\/[^\s)]+\))/g;
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    if (match.index > cursor) nodes.push(text.slice(cursor, match.index));
    const token = match[0];
    const key = `inline-${match.index}`;
    if (token.startsWith("**") || token.startsWith("__")) {
      nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("~~")) {
      nodes.push(<del key={key}>{token.slice(2, -2)}</del>);
    } else if (token.startsWith("`")) {
      nodes.push(<code key={key} className="rounded bg-background/70 px-1 py-0.5 font-mono text-[0.9em]">{token.slice(1, -1)}</code>);
    } else if (token.startsWith("[")) {
      const link = token.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
      const href = link ? safeLink(link[2]!) : null;
      nodes.push(href
        ? <a key={key} href={href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">{link![1]}</a>
        : token);
    } else {
      nodes.push(<em key={key}>{token.slice(1, -1)}</em>);
    }
    cursor = match.index + token.length;
  }
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}

function startsBlock(line: string): boolean {
  return /^(#{1,6}\s|```|>\s?|[-*_]{3,}\s*$|\s*[-*+]\s+|\s*\d+[.)]\s+)/.test(line);
}

function renderBlocks(source: string, prefix = "block"): ReactNode[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let index = 0;
  let blockIndex = 0;
  while (index < lines.length) {
    const line = lines[index]!;
    if (!line.trim()) { index += 1; continue; }
    const key = `${prefix}-${blockIndex++}`;

    if (line.startsWith("```")) {
      const language = line.slice(3).trim().split(/\s+/)[0];
      index += 1;
      const code: string[] = [];
      while (index < lines.length && !lines[index]!.startsWith("```")) code.push(lines[index++]!);
      if (index < lines.length) index += 1;
      blocks.push(<pre key={key} className="my-2 max-w-full overflow-x-auto rounded-lg bg-background/70 p-3 text-xs leading-5"><code className={language ? `language-${language}` : undefined}>{code.join("\n")}</code></pre>);
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const level = heading[1]!.length;
      const Tag = `h${level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
      blocks.push(<Tag key={key} className="mb-1 mt-3 text-sm font-semibold leading-5 first:mt-0">{renderInline(heading[2]!)}</Tag>);
      index += 1;
      continue;
    }

    if (/^(?:[-*_]\s*){3,}$/.test(line.trim())) {
      blocks.push(<hr key={key} className="my-2 border-border" />);
      index += 1;
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      const quote: string[] = [];
      while (index < lines.length && /^\s*>\s?/.test(lines[index]!)) {
        quote.push(lines[index]!.replace(/^\s*>\s?/, ""));
        index += 1;
      }
      blocks.push(<blockquote key={key} className="my-2 border-l-2 border-border pl-3 text-muted-foreground">{renderBlocks(quote.join("\n"), key)}</blockquote>);
      continue;
    }

    const listMatch = line.match(/^\s*([-*+]|\d+[.)])\s+(.+)$/);
    if (listMatch) {
      const ordered = /^\d/.test(listMatch[1]!);
      const items: ReactNode[] = [];
      while (index < lines.length) {
        const item = lines[index]!.match(/^\s*([-*+]|\d+[.)])\s+(.+)$/);
        if (!item || /^\d/.test(item[1]!) !== ordered) break;
        items.push(<li key={`${key}-${items.length}`}>{renderInline(item[2]!)}</li>);
        index += 1;
      }
      const List = ordered ? "ol" : "ul";
      blocks.push(<List key={key} className={`my-2 space-y-1 pl-5 ${ordered ? "list-decimal" : "list-disc"}`}>{items}</List>);
      continue;
    }

    const paragraph = [line];
    index += 1;
    while (index < lines.length && lines[index]!.trim() && !startsBlock(lines[index]!)) paragraph.push(lines[index++]!);
    blocks.push(<p key={key} className="my-2 whitespace-pre-wrap first:mt-0 last:mb-0">{renderInline(paragraph.join("\n"))}</p>);
  }
  return blocks;
}

export function AssistantMarkdown({ content }: { content: string }) {
  return <div className="min-w-0 break-words [&_a]:text-primary [&_code]:break-all">{renderBlocks(content)}</div>;
}
