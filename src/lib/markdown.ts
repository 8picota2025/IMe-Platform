function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function inlineMarkdown(text: string): string {
  const escaped = escapeHtml(text);
  return (
    escaped
      .replace(
        /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
        '<a href="$2" target="_blank" rel="noreferrer noopener">$1</a>'
      )
      // Enlaces internos del sitio (/es/..., /en/...): misma pestaña. Sólo rutas
      // que empiezan por una única "/" (no "//host", que sería externo); el texto
      // ya viene escapado, así que no puede cerrar el atributo href.
      .replace(/\[([^\]]+)\]\((\/(?!\/)[^\s)]*)\)/g, '<a href="$2">$1</a>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, '$1<em>$2</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
  );
}

const TABLE_SEPARATOR = /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?$/;

function tableCells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map(cell => cell.trim());
}

function renderTable(lines: string[]): string {
  const [header = '', , ...rows] = lines;
  const th = tableCells(header)
    .map(cell => `<th scope="col">${inlineMarkdown(cell)}</th>`)
    .join('');
  const trs = rows
    .map(
      row =>
        `<tr>${tableCells(row)
          .map(cell => `<td>${inlineMarkdown(cell)}</td>`)
          .join('')}</tr>`
    )
    .join('');
  return `<div class="md-table"><table><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table></div>`;
}

/** "- [ ] texto" / "- [x] texto": casilla de checklist (estática, sólo lectura). */
function listItem(item: string): string {
  const task = item.match(/^\[( |x|X)\]\s+(.+)$/);
  if (!task) return `<li>${inlineMarkdown(item)}</li>`;
  const marca = task[1] === ' ' ? '☐' : '☑';
  return `<li class="md-task"><span class="md-task__box" aria-hidden="true">${marca}</span> ${inlineMarkdown(task[2]!)}</li>`;
}

export function renderMarkdown(markdown: string): string {
  const source = (markdown || '').replace(/\r\n/g, '\n');
  const lines = source.split('\n');
  const blocks: string[] = [];
  let paragraph: string[] = [];
  let listItems: string[] = [];
  let orderedItems: string[] = [];
  let quoteLines: string[] = [];
  let codeLines: string[] = [];
  let inCode = false;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push(`<p>${inlineMarkdown(paragraph.join(' ').trim())}</p>`);
    paragraph = [];
  };

  const flushList = () => {
    if (listItems.length) {
      blocks.push(`<ul>${listItems.map(listItem).join('')}</ul>`);
      listItems = [];
    }
    if (orderedItems.length) {
      blocks.push(
        `<ol>${orderedItems.map(item => `<li>${inlineMarkdown(item)}</li>`).join('')}</ol>`
      );
      orderedItems = [];
    }
  };

  const flushQuote = () => {
    if (!quoteLines.length) return;
    blocks.push(`<blockquote>${inlineMarkdown(quoteLines.join(' ').trim())}</blockquote>`);
    quoteLines = [];
  };

  const flushCode = () => {
    if (!codeLines.length) return;
    blocks.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
    codeLines = [];
  };

  let tableLines: string[] = [];
  const flushTable = () => {
    if (!tableLines.length) return;
    blocks.push(renderTable(tableLines));
    tableLines = [];
  };

  for (const [index, rawLine] of lines.entries()) {
    const line = rawLine.trimEnd();
    if (tableLines.length) {
      const separador = tableLines.length === 1 && TABLE_SEPARATOR.test(line.trim());
      if (separador || line.trim().startsWith('|')) {
        tableLines.push(line);
        continue;
      }
      flushTable();
    }
    if (
      !inCode &&
      line.trim().startsWith('|') &&
      TABLE_SEPARATOR.test((lines[index + 1] ?? '').trim())
    ) {
      flushParagraph();
      flushList();
      flushQuote();
      tableLines.push(line);
      continue;
    }
    if (line.startsWith('```')) {
      if (inCode) {
        flushCode();
        inCode = false;
      } else {
        flushParagraph();
        flushList();
        flushQuote();
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      codeLines.push(rawLine);
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      flushList();
      flushQuote();
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      flushQuote();
      const level = heading[1]!.length;
      const content = heading[2]!.trim();
      blocks.push(`<h${level}>${inlineMarkdown(content)}</h${level}>`);
      continue;
    }

    const ul = line.match(/^[-*]\s+(.+)$/);
    if (ul) {
      flushParagraph();
      flushQuote();
      listItems.push(ul[1]!.trim());
      continue;
    }

    const ol = line.match(/^\d+\.\s+(.+)$/);
    if (ol) {
      flushParagraph();
      flushQuote();
      orderedItems.push(ol[1]!.trim());
      continue;
    }

    const quote = line.match(/^>\s+(.+)$/);
    if (quote) {
      flushParagraph();
      flushList();
      quoteLines.push(quote[1]!.trim());
      continue;
    }

    flushList();
    flushQuote();
    paragraph.push(line.trim());
  }

  if (inCode) flushCode();
  flushTable();
  flushParagraph();
  flushList();
  flushQuote();

  return blocks.length ? blocks.join('') : '<p></p>';
}

export function stripMarkdown(markdown: string): string {
  return (markdown || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/[#>*_`|-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
