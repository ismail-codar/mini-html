import {
  createConnection,
  TextDocuments,
  Diagnostic,
  DiagnosticSeverity,
  ProposedFeatures,
  InitializeParams,
  DocumentSymbolParams,
  CompletionItem,
  CompletionParams,
  Range,
  TextDocument,
  TextDocumentContentChangeEvent,
  WorkspaceFolder
} from 'vscode-languageserver/node';
import { TextDocument as VscodeTextDocument } from 'vscode-languageserver-textdocument';

const connection = createConnection(ProposedFeatures.all);

const documents = new TextDocuments(VscodeTextDocument);

let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;

connection.onInitialize((params: InitializeParams) => {
  const capabilities = params.capabilities;

  hasWorkspaceFolderCapability = capabilities.workspace?.workspaceFolders ?? false;
  hasDiagnosticRelatedInformationCapability = capabilities.textDocument?.completion?.completionItem?.documentationFormat?.includes('markdown') ?? false;

  // Return a proper InitializeResult with ServerCapabilities.
  // completionProvider is a top-level ServerCapability (not nested under textDocument).
  return {
    capabilities: {
      // minimal textDocumentSync to satisfy the protocol (1 == Full), adjust if needed
      textDocumentSync: 1,
      // advertise completion support from the server
      completionProvider: {
        resolveProvider: true,
        triggerCharacters: ['<', '/']
      },
      // advertise workspace folders support if the client indicated it
      workspace: hasWorkspaceFolderCapability ? { workspaceFolders: { supported: true } } : undefined
    }
  };
});

documents.onDidChangeContent((change) => {
  validateTextDocument(change.document);
});

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
  const diagnostics: Diagnostic[] = [];
  const text = textDocument.getText();

  try {
    const lines = text.split('\n');
    let htmlStart = -1;
    let htmlEnd = -1;
    let headCount = 0;
    let bodyCount = 0;

    // Rule 1: Document must start with <html> and end with </html>
    if (!text.trim().startsWith('<html>')) {
      diagnostics.push({
        severity: DiagnosticSeverity.Error,
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 6 }
        },
        message: 'Document must start with <html>'
      });
    }

    if (!text.trim().endsWith('</html>')) {
      const lastLine = lines.length - 1;
      const lineLength = lines[lastLine]?.length || 0;
      diagnostics.push({
        severity: DiagnosticSeverity.Error,
        range: {
          start: { line: lastLine, character: Math.max(0, lineLength - 7) },
          end: { line: lastLine, character: lineLength }
        },
        message: 'Document must end with </html>'
      });
    }

    // Parse HTML structure
    const htmlRegex = /<\s*html[^>]*>([\s\S]*?)<\s*\/\s*html\s*>/gi;
    let match;

    while ((match = htmlRegex.exec(text)) !== null) {
      htmlStart = match.index;
      htmlEnd = match.index + match[0].length;
      const content = match[1];

      // Rule 2: Check for exactly one <head> and one <body>
      const headMatches = content.match(/<\s*head[^>]*>[\s\S]*?<\s*\/\s*head\s*>/gi);
      const bodyMatches = content.match(/<\s*body[^>]*>[\s\S]*?<\s*\/\s*body\s*>/gi);

      headCount = headMatches ? headMatches.length : 0;
      bodyCount = bodyMatches ? bodyMatches.length : 0;

      if (headCount !== 1) {
        const errorPos = content.indexOf('<head') !== -1 ? text.indexOf('<head') : 0;
        const line = text.substring(0, errorPos).split('\n').length - 1;
        diagnostics.push({
          severity: DiagnosticSeverity.Error,
          range: {
            start: { line, character: 0 },
            end: { line, character: 10 }
          },
          message: 'HTML must contain exactly one <head> element'
        });
      }

      if (bodyCount !== 1) {
        const errorPos = content.indexOf('<body') !== -1 ? text.indexOf('<body') : 0;
        const line = text.substring(0, errorPos).split('\n').length - 1;
        diagnostics.push({
          severity: DiagnosticSeverity.Error,
          range: {
            start: { line, character: 0 },
            end: { line, character: 10 }
          },
          message: 'HTML must contain exactly one <body> element'
        });
      }

      // Validate head and body content
      if (headMatches && headMatches.length === 1) {
        validateHeadContent(headMatches[0], text, diagnostics);
      }

      if (bodyMatches && bodyMatches.length === 1) {
        validateBodyContent(bodyMatches[0], text, diagnostics);
      }
    }
  } catch (error) {
    console.error('Validation error:', error);
  }

  connection.sendDiagnostics({
    uri: textDocument.uri,
    version: textDocument.version,
    diagnostics
  });
}

function validateHeadContent(headContent: string, fullText: string, diagnostics: Diagnostic[]): void {
  // Rule 3: <head> may contain only <title> or <meta>
  const elements = headContent.match(/<\s*\/?\s*([a-zA-Z][a-zA-Z0-9]*)[^>]*\/?\s*>/gi);

  if (elements) {
    for (let i = 0; i < elements.length; i++) {
      const element = elements[i];
      const tagName = element.match(/<\s*\/?\s*([a-zA-Z][a-zA-Z0-9]*)/i);

      if (tagName) {
        const name = tagName[1].toLowerCase();
        if (name !== 'title' && name !== 'meta' && !element.includes('/>')) {
          const errorPos = fullText.indexOf(element);
          const line = fullText.substring(0, errorPos).split('\n').length - 1;
          diagnostics.push({
            severity: DiagnosticSeverity.Error,
            range: {
              start: { line, character: 0 },
              end: { line, character: element.length }
            },
            message: '<head> may contain only <title> or <meta> elements'
          });
        }
      }
    }
  }
}

function validateBodyContent(bodyContent: string, fullText: string, diagnostics: Diagnostic[]): void {
  // Rule 4: <body> may contain only <div> or <span>
  const elements = bodyContent.match(/<\s*\/?\s*([a-zA-Z][a-zA-Z0-9]*)[^>]*\/?\s*>/gi);

  if (elements) {
    for (let i = 0; i < elements.length; i++) {
      const element = elements[i];
      const tagName = element.match(/<\s*\/?\s*([a-zA-Z][a-zA-Z0-9]*)/i);

      if (tagName) {
        const name = tagName[1].toLowerCase();
        if (name !== 'div' && name !== 'span' && !element.includes('/>')) {
          const errorPos = fullText.indexOf(element);
          const line = fullText.substring(0, errorPos).split('\n').length - 1;
          diagnostics.push({
            severity: DiagnosticSeverity.Error,
            range: {
              start: { line, character: 0 },
              end: { line, character: element.length }
            },
            message: '<body> may contain only <div> or <span> elements'
          });
        }
      }
    }
  }

  // Validate nested structure for div and span
  validateNesting(bodyContent, fullText, diagnostics, []);
}

function validateNesting(content: string, fullText: string, diagnostics: Diagnostic[], context: string[]): void {
  // Rule 5: <title> can contain only text
  const titleMatches = content.match(/<\s*title[^>]*>([\s\S]*?)<\s*\/\s*title\s*>/gi);

  if (titleMatches) {
    for (const titleMatch of titleMatches) {
      const innerContent = titleMatch.match(/<\s*title[^>]*>([\s\S]*?)<\s*\/\s*title\s*>/i);
      if (innerContent && innerContent[1].includes('<')) {
        const errorPos = fullText.indexOf(titleMatch);
        const line = fullText.substring(0, errorPos).split('\n').length - 1;
        diagnostics.push({
          severity: DiagnosticSeverity.Error,
          range: {
            start: { line, character: 0 },
            end: { line, character: titleMatch.length }
          },
          message: '<title> can contain only text'
        });
      }
    }
  }

  // Rule 6: <span> cannot contain <div> — only <span> or text allowed
  // Rule 7: <div> may contain <div>, <span>, or text
  const spanMatches = content.match(/<\s*span[^>]*>[\s\S]*?<\s*\/\s*span\s*>/gi);

  if (spanMatches) {
    for (const spanMatch of spanMatches) {
      const innerContent = spanMatch.match(/<\s*span[^>]*>([\s\S]*?)<\s*\/\s*span\s*>/i);
      if (innerContent) {
        const inner = innerContent[1];
        const divMatches = inner.match(/<\s*div[^>]*>/gi);
        if (divMatches) {
          const errorPos = fullText.indexOf(spanMatch);
          const line = fullText.substring(0, errorPos).split('\n').length - 1;
          diagnostics.push({
            severity: DiagnosticSeverity.Error,
            range: {
              start: { line, character: 0 },
              end: { line, character: spanMatch.length }
            },
            message: '<span> cannot contain <div> elements'
          });
        }
      }
    }
  }

  // Recursively validate nested content
  const divMatches = content.match(/<\s*div[^>]*>([\s\S]*?)<\s*\/\s*div\s*>/gi);
  if (divMatches) {
    for (const divMatch of divMatches) {
      const innerContent = divMatch.match(/<\s*div[^>]*>([\s\S]*?)<\s*\/\s*div\s*>/i);
      if (innerContent) {
        validateNesting(innerContent[1], fullText, diagnostics, [...context, 'div']);
      }
    }
  }

  const spanMatchesRecursive = content.match(/<\s*span[^>]*>([\s\S]*?)<\s*\/\s*span\s*>/gi);
  if (spanMatchesRecursive) {
    for (const spanMatch of spanMatchesRecursive) {
      const innerContent = spanMatch.match(/<\s*span[^>]*>([\s\S]*?)<\s*\/\s*span\s*>/i);
      if (innerContent) {
        validateNesting(innerContent[1], fullText, diagnostics, [...context, 'span']);
      }
    }
  }
}

connection.onCompletion((params: CompletionParams) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) {
    return [];
  }

  const completions: CompletionItem[] = [];

  // HTML structure completions
  completions.push({
    label: 'html',
    kind: 25,
    detail: 'Mini HTML document root',
    insertText: '<html>\n  ${1:head}\n  ${2:body}\n</html>',
    insertTextFormat: 2,
    documentation: 'Mini HTML document root element'
  });

  completions.push({
    label: 'head',
    kind: 25,
    detail: 'Document head section',
    insertText: '<head>\n  ${1:meta or title}\n</head>',
    insertTextFormat: 2,
    documentation: 'Document head - contains meta tags or title'
  });

  completions.push({
    label: 'body',
    kind: 25,
    detail: 'Document body section',
    insertText: '<body>\n  ${1:div or span}\n</body>',
    insertTextFormat: 2,
    documentation: 'Document body - contains div or span elements'
  });

  completions.push({
    label: 'title',
    kind: 25,
    detail: 'Document title',
    insertText: '<title>${1:Page Title}</title>',
    insertTextFormat: 2,
    documentation: 'Page title - contains only text'
  });

  completions.push({
    label: 'meta',
    kind: 25,
    detail: 'Meta tag',
    insertText: '<meta ${1:property="value"}>',
    insertTextFormat: 2,
    documentation: 'Meta information tag'
  });

  completions.push({
    label: 'div',
    kind: 25,
    detail: 'Division container',
    insertText: '<div>\n  ${1:div, span or text}\n</div>',
    insertTextFormat: 2,
    documentation: 'Container that can hold div, span, or text'
  });

  completions.push({
    label: 'span',
    kind: 25,
    detail: 'Inline container',
    insertText: '<span>${1:span or text}</span>',
    insertTextFormat: 2,
    documentation: 'Inline container that can hold span or text (not div)'
  });

  return completions;
});

documents.listen(connection);

connection.listen();
