# Mini HTML VSCode Extension

A VSCode Language Server extension for validating simplified HTML documents with specific structural rules.

## Features

- **Language ID**: `mini-html`
- **File Extension**: `.mhtml`
- **Validation**: Enforces 7 HTML structural rules
- **Completion**: Smart completion provider for HTML elements
- **Diagnostics**: Real-time validation feedback

## Validation Rules

1. Document must start with `<html>` and end with `</html>`
2. `<html>` must contain exactly one `<head>` and one `<body>`
3. `<head>` may contain only `<title>` or `<meta>`
4. `<body>` may contain only `<div>` or `<span>`
5. `<title>` can contain only text
6. `<span>` cannot contain `<div>` — only `<span>` or text allowed
7. `<div>` may contain `<div>`, `<span>`, or text

## Installation

### Development Setup

1. Open the extension folder in VSCode
2. Run `npm install` in the root directory
3. Run `npm run compile` to build the extension
4. Press `F5` to launch the extension in debug mode

### Package Installation

```bash
# Install dependencies
npm install

# Compile the extension
npm run compile
```

## Usage

1. Create a new file with `.mhtml` extension
2. Start typing Mini HTML code
3. Violations will be highlighted with red squiggly lines
4. Use Ctrl+Space (or Cmd+Space on Mac) for intelligent completion

## Example Mini HTML

```html
<html>
  <head>
    <title>My Page</title>
    <meta charset="utf-8">
  </head>
  <body>
    <div>
      <span>Hello World</span>
      <div>
        <span>Nested content</span>
      </div>
    </div>
  </body>
</html>
```

## Commands

- `npm run compile` - Build both client and server
- `npm run watch` - Watch mode for development
- `npm run watch:client` - Watch client changes only
- `npm run watch:server` - Watch server changes only

## File Structure

```
mini-html/
├── package.json                    # Extension manifest
├── tsconfig.json                   # Root TypeScript config
├── tsconfig.client.json            # Client TypeScript config  
├── tsconfig.server.json            # Server TypeScript config
├── language-configuration.json     # Language rules
├── client/
│   ├── package.json               # Client dependencies
│   └── src/
│       └── extension.ts           # Extension entry point
├── server/
│   ├── package.json               # Server dependencies
│   └── src/
│       └── server.ts              # Language server
├── syntaxes/
│   └── mini-html.tmLanguage.json  # Syntax highlighting
└── .vscode/
    ├── launch.json                # Debug configuration
    └── tasks.json                 # Build tasks
```

## Development

The extension uses the Language Server Protocol (LSP) architecture:

- **Client**: Handles VSCode integration and user interface
- **Server**: Provides validation, completion, and diagnostics
- **Communication**: JSON-RPC over IPC

## License

MIT