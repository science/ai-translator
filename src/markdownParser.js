export function extractHeaders(content) {
  const lines = content.split('\n');
  const headers = [];

  lines.forEach((line, index) => {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      headers.push({
        level: match[1].length,
        text: match[2],
        line: index
      });
    }
  });

  return headers;
}

export function buildHierarchy(headers) {
  if (headers.length === 0) return [];

  const root = [];
  const stack = [];

  for (const header of headers) {
    const node = {
      ...header,
      children: []
    };

    while (stack.length > 0 && stack[stack.length - 1].level >= node.level) {
      stack.pop();
    }

    if (stack.length === 0) {
      root.push(node);
    } else {
      stack[stack.length - 1].children.push(node);
    }

    stack.push(node);
  }

  return root;
}

export function parseMarkdownStructure(content) {
  const headers = extractHeaders(content);
  const hierarchy = buildHierarchy(headers);

  const links = extractLinks(content);
  const formatting = extractFormatting(content);
  const code = extractCode(content);
  const lists = extractLists(content);

  return {
    headers,
    hierarchy,
    links,
    formatting,
    code,
    lists
  };
}

function extractLinks(content) {
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const links = [];
  let match;

  while ((match = linkRegex.exec(content)) !== null) {
    links.push({
      text: match[1],
      url: match[2],
      position: match.index
    });
  }

  return links;
}

function extractFormatting(content) {
  const bold = [];
  const italic = [];

  const boldItalicRegex = /\*\*\*([^*]+)\*\*\*/g;
  const boldRegex = /\*\*([^*]+)\*\*/g;
  const italicRegex = /\*([^*]+)\*/g;

  let match;
  let workingContent = content;

  while ((match = boldItalicRegex.exec(content)) !== null) {
    bold.push({
      text: match[1],
      position: match.index
    });
    italic.push({
      text: match[1],
      position: match.index
    });
  }

  workingContent = content.replace(boldItalicRegex, '');

  boldRegex.lastIndex = 0;
  while ((match = boldRegex.exec(workingContent)) !== null) {
    bold.push({
      text: match[1],
      position: match.index
    });
  }

  workingContent = workingContent.replace(boldRegex, '');

  italicRegex.lastIndex = 0;
  while ((match = italicRegex.exec(workingContent)) !== null) {
    italic.push({
      text: match[1],
      position: match.index
    });
  }

  return { bold, italic };
}

function extractCode(content) {
  const codeBlockRegex = /```(\w+)?\n([\s\S]+?)```/g;
  const inlineCodeRegex = /`([^`]+)`/g;

  const inline = [];
  const blocks = [];

  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    blocks.push({
      language: match[1] || '',
      code: match[2].trim(),
      position: match.index
    });
  }

  const contentWithoutBlocks = content.replace(codeBlockRegex, '');

  inlineCodeRegex.lastIndex = 0;
  while ((match = inlineCodeRegex.exec(contentWithoutBlocks)) !== null) {
    inline.push({
      text: match[1],
      position: match.index
    });
  }

  return { inline, blocks };
}

function extractLists(content) {
  const lines = content.split('\n');
  const unordered = [];
  const ordered = [];

  let currentUnorderedList = null;
  let currentOrderedList = null;

  lines.forEach((line, index) => {
    const unorderedMatch = line.match(/^(\s*)[-*+]\s+(.+)$/);
    const orderedMatch = line.match(/^(\s*)\d+\.\s+(.+)$/);

    if (unorderedMatch) {
      if (!currentUnorderedList || currentUnorderedList.endLine < index - 1) {
        currentUnorderedList = {
          startLine: index,
          endLine: index,
          items: []
        };
        unordered.push(currentUnorderedList);
      }
      currentUnorderedList.items.push({
        text: unorderedMatch[2],
        indent: unorderedMatch[1].length,
        line: index
      });
      currentUnorderedList.endLine = index;
    } else {
      currentUnorderedList = null;
    }

    if (orderedMatch) {
      if (!currentOrderedList || currentOrderedList.endLine < index - 1) {
        currentOrderedList = {
          startLine: index,
          endLine: index,
          items: []
        };
        ordered.push(currentOrderedList);
      }
      currentOrderedList.items.push({
        text: orderedMatch[2],
        indent: orderedMatch[1].length,
        line: index
      });
      currentOrderedList.endLine = index;
    } else {
      currentOrderedList = null;
    }
  });

  return { unordered, ordered };
}
