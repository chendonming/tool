(function () {
  'use strict';

  let pickerActive = false;
  let currentHovered = null;
  let pickerTooltip = null;

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

    convertAndCopy(html);
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

  // ── Shared: convert HTML → Markdown via background worker ──────────────

  function convertAndCopy(html) {
    chrome.runtime.sendMessage({ action: 'convert', html }, (response) => {
      if (chrome.runtime.lastError) {
        showToast('Error: ' + chrome.runtime.lastError.message, 'error');
        return;
      }
      if (response && response.markdown) {
        copyToClipboard(response.markdown);
        showToast('Copied as Markdown', 'success');
      } else {
        showToast('Conversion failed', 'error');
      }
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
      convertAndCopy(html);
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

    const label = document.createElement('span');
    label.textContent = msg;
    toast.appendChild(label);

    toast.className = '__mdg-toast--' + (type || 'info');
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('__mdg-toast--fadeout');
      setTimeout(() => toast.remove(), 300);
    }, 1800);
  }
})();
