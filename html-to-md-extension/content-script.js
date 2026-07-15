(function () {
  'use strict';

  let pickerActive = false;
  let currentHovered = null;
  let pickerTooltip = null;

  // ── Debug mode ───────────────────────────────────────────────────────────
  let debugMode = false;

  chrome.storage.sync.get('debugMode', (data) => {
    debugMode = !!data.debugMode;
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes.debugMode) {
      debugMode = !!changes.debugMode.newValue;
    }
  });

  // TurndownService loaded via vendor/turndown.js (listed first in manifest)

  // Listen for commands from background service worker
  chrome.runtime.onMessage.addListener((request) => {
    if (request.command === 'convert-selection') {
      handleConvertSelection();
    } else if (request.command === 'pick-element') {
      if (!pickerActive) startElementPicker();
    }
  });

  // ── Scenario 1: Convert selected text ──────────────────────────────────

  function handleConvertSelection() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) {
      showToast('Please select some text first', 'warning');
      return;
    }

    const range = sel.getRangeAt(0);

    // Input / textarea selection → copy as plain text
    if (isInputOrTextarea(range)) {
      const value = getInputValue(range);
      if (value) {
        copyToClipboard(value);
        showToast('Copied as Markdown', 'success');
      } else {
        showToast('No content to convert', 'warning');
      }
      return;
    }

    const div = document.createElement('div');
    div.appendChild(range.cloneContents());
    const html = div.innerHTML;
    if (!html || !html.trim()) {
      showToast('No content to convert', 'warning');
      return;
    }

    convertAndCopy(html, { source: 'selection' });
  }

  function isInputOrTextarea(range) {
    const node = range.startContainer;
    if (node.nodeType === 3) {
      const el = node.parentElement;
      return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');
    }
    return node.nodeType === 1 &&
      (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA');
  }

  function getInputValue(range) {
    const el = range.startContainer.nodeType === 3
      ? range.startContainer.parentElement
      : range.startContainer;
    return el.value || '';
  }

  // ── Convert HTML → Markdown ────────────────────────────────────────────

  function htmlToMarkdown(html) {
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

    return turndownService.turndown(html);
  }

  function convertAndCopy(html, extra) {
    try {
      const markdown = htmlToMarkdown(html);
      copyToClipboard(markdown);
      showToast('Copied as Markdown', 'success');
      if (debugMode) saveDebugRecord({ source: extra?.source || 'selection', html, markdown, element: extra?.element });
    } catch (e) {
      showToast('Conversion failed', 'error');
      console.error('Markdown Grabber conversion error:', e);
    }
  }

  // ── Debug helpers ────────────────────────────────────────────────────────

  function getCssSelector(el) {
    const path = [];
    while (el && el.nodeType === 1) {
      let sel = el.tagName.toLowerCase();
      if (el.id) {
        sel += '#' + el.id;
        path.unshift(sel);
        break;
      }
      const parent = el.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children);
        const idx = siblings.indexOf(el);
        if (idx >= 0) {
          const sameTag = siblings.filter(function (s) { return s.tagName === el.tagName; });
          if (sameTag.length > 1) {
            sel += ':nth-child(' + (idx + 1) + ')';
          }
        }
      }
      path.unshift(sel);
      el = parent;
    }
    return path.join(' > ');
  }

  function saveDebugRecord(rec) {
    var record = {
      timestamp: Date.now(),
      source: rec.source,
      url: window.location.href,
      cssSelector: rec.element ? getCssSelector(rec.element) : '',
      html: rec.html,
      markdown: rec.markdown
    };

    console.group(
      '%c📝 MD Grabber Debug %c' + new Date().toLocaleTimeString(),
      'font-weight:bold;color:#4338ca',
      'font-weight:normal;color:#64748b'
    );
    console.log('Source:', record.source);
    console.log('URL:', record.url);
    if (record.cssSelector) console.log('CSS Selector:', record.cssSelector);
    console.log('HTML (%d chars):', record.html.length);
    console.log(record.html);
    console.log('Markdown (%d chars):', record.markdown.length);
    console.log(record.markdown);
    console.groupEnd();

    chrome.storage.local.get('debugHistory', function (data) {
      var history = data.debugHistory || [];
      history.unshift(record);
      chrome.storage.local.set({ debugHistory: history });
    });
  }

  // ── Clipboard: write via hidden textarea + execCommand ─────────────────

  function copyToClipboard(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }

  // ── Scenario 2: Element picker ─────────────────────────────────────────

  function startElementPicker() {
    pickerActive = true;

    pickerTooltip = document.createElement('div');
    pickerTooltip.id = '__mdg-tooltip';
    pickerTooltip.textContent = 'Click element ↓  Esc to cancel';
    document.body.appendChild(pickerTooltip);

    document.addEventListener('mousemove', onPickerMove, true);
    document.addEventListener('click', onPickerClick, true);
    document.addEventListener('keydown', onPickerKeydown, true);
  }

  function stopElementPicker() {
    pickerActive = false;
    if (pickerTooltip) {
      pickerTooltip.remove();
      pickerTooltip = null;
    }
    if (currentHovered) {
      currentHovered.style.outline = '';
      currentHovered = null;
    }
    document.removeEventListener('mousemove', onPickerMove, true);
    document.removeEventListener('click', onPickerClick, true);
    document.removeEventListener('keydown', onPickerKeydown, true);
  }

  function onPickerMove(e) {
    if (currentHovered) currentHovered.style.outline = '';
    currentHovered = e.target;
    currentHovered.style.outline = '2px solid #4338ca';

    const tag = e.target.tagName.toLowerCase();
    const id = e.target.id ? '#' + e.target.id : '';
    const cls = Array.from(e.target.classList).slice(0, 3).map(c => '.' + c).join('');
    pickerTooltip.textContent = '<' + tag + id + cls + '>';
    pickerTooltip.style.left = Math.min(e.clientX + 12, window.innerWidth - 300) + 'px';
    pickerTooltip.style.top = (e.clientY + 12) + 'px';
  }

  function onPickerClick(e) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    const target = e.target;
    const html = target.outerHTML;
    stopElementPicker();

    if (html && html.trim()) {
      convertAndCopy(html, { source: 'picker', element: target });
    }
  }

  function onPickerKeydown(e) {
    if (e.key === 'Escape') {
      stopElementPicker();
    }
  }

  // ── Toast notification ─────────────────────────────────────────────────

  function showToast(msg, type) {
    const old = document.getElementById('__mdg-toast');
    if (old) old.remove();

    const toast = document.createElement('div');
    toast.id = '__mdg-toast';
    toast.textContent = msg;
    toast.className = '__mdg-toast--' + (type || 'info');
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('__mdg-toast--fadeout');
      setTimeout(() => toast.remove(), 300);
    }, 1800);
  }
})();
