# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Markdown Grabber** — a Chrome Extension (Manifest V3) that converts selected HTML content to Markdown and copies it to the clipboard. Two modes: select text and convert (Ctrl+Shift+M), or pick an element interactively (Ctrl+Shift+E).

## Commands

- **Load in Chrome**: `chrome://extensions` → Enable Developer mode → Load unpacked → select this directory
- **No build step, no package.json, no tests** — this is a vanilla extension with zero dependencies.
- **turndown.js** is vendored (not npm-managed). To update, replace `vendor/turndown.js` manually.

## Architecture

### Files

| File | Role |
|---|---|
| `manifest.json` | Extension manifest v3. Defines permissions (`activeTab`, `clipboardWrite`, `storage`), keyboard shortcuts, and loads the content script + background service worker. |
| `background.js` | Service worker (~10 lines). On keyboard command, relays it to the active tab's content script via `chrome.tabs.sendMessage`. |
| `content-script.js` | Core logic in an IIFE. Two scenarios handled via `chrome.runtime.onMessage`: (1) selection-to-Markdown, (2) element picker. |
| `styles.css` | Styles for the picker tooltip (indigo bar showing CSS selector) and the toast notification (bottom-right, color-coded by type). |
| `vendor/turndown.js` | Vendored Turndown library (HTML→Markdown). Listed first in manifest so it loads before `content-script.js`. |
| `icons/` | PNG icons at 16×16, 48×48, 128×128. |

### content-script.js details

- **Selection mode**: Gets `window.getSelection()`, clones the range contents, converts via `TurndownService`, writes to clipboard via `document.execCommand('copy')` on a hidden textarea.
- **Input/textarea edge case**: Reads `.value` directly and copies as plain text (no HTML→Markdown conversion).
- **Element picker mode**: Sets capture-phase listeners (`mousemove`, `click`, `keydown`). Hovering outlines the element and shows a tooltip with the tag + ID + up to 3 class names. Clicking copies the outerHTML converted to Markdown. Escape cancels.
- **TurndownService config**: ATX headings, fenced code blocks (with a custom priority-100 rule that detects `language-*` class for syntax highlighting), `*` emphasis, `-` list markers.
- **Clipboard**: Uses `document.execCommand('copy')` (not the modern Clipboard API) for maximum compatibility.
- **Toast**: Self-removing notification, auto-fades after 1.8 seconds.
