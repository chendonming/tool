importScripts('vendor/turndown.js');

chrome.commands.onCommand.addListener((command) => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id) {
      chrome.tabs.sendMessage(tabs[0].id, { command }).catch(() => {
        // Content script not available on this page (e.g., chrome:// pages)
      });
    }
  });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'convert') {
    const turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      emDelimiter: '*',
      bulletListMarker: '-'
    });

    // Custom rule: fenced code blocks with language detection
    turndownService.addRule('fencedCodeBlock', {
      filter: (node) => {
        return node.nodeName === 'PRE' && node.firstChild?.nodeName === 'CODE';
      },
      replacement: (content, node) => {
        const code = node.querySelector('code');
        const codeContent = code ? code.textContent : node.textContent;
        let lang = '';
        if (code?.className) {
          const m = code.className.match(/language-(\w+)/);
          if (m) lang = m[1];
        }
        return '\n```' + lang + '\n' + codeContent + '\n```\n';
      },
      priority: 100
    });

    const markdown = turndownService.turndown(request.html);
    sendResponse({ markdown });
    return true; // Keep channel open for async response
  }
});
