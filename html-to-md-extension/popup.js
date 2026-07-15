(function () {
  'use strict';

  // ── DOM refs ──────────────────────────────────────────────────────────────
  const debugToggle = document.getElementById('debugToggle');
  const recordCount = document.getElementById('recordCount');
  const clearBtn = document.getElementById('clearBtn');
  const recordsEl = document.getElementById('records');

  // ── Debug mode toggle ────────────────────────────────────────────────────
  chrome.storage.sync.get('debugMode', (data) => {
    debugToggle.checked = !!data.debugMode;
  });
  debugToggle.addEventListener('change', () => {
    chrome.storage.sync.set({ debugMode: debugToggle.checked });
  });

  // ── Render records ───────────────────────────────────────────────────────
  function render() {
    chrome.storage.local.get('debugHistory', (data) => {
      const history = data.debugHistory || [];
      recordCount.textContent = history.length + ' record' + (history.length !== 1 ? 's' : '');

      if (history.length === 0) {
        recordsEl.innerHTML =
          '<div class="empty">' +
          '<strong>No debug records</strong>' +
          'Enable Debug Mode above, then use Ctrl+M (selection) or Ctrl+Shift+E (picker) to convert.<br/>' +
          'Records will appear here.</div>';
        return;
      }

      recordsEl.innerHTML = history.map((rec, index) => {
        const time = new Date(rec.timestamp).toLocaleTimeString();
        const escapedHtml = escapeHtml(rec.html);
        const escapedMd = escapeHtml(rec.markdown);
        const urlDisplay = rec.url ? truncate(rec.url, 60) : '';
        const cssDisplay = rec.cssSelector || '';

        return (
          '<div class="record" data-index="' + index + '">' +
            '<div class="record-head">' +
              '<div class="record-meta">' +
                '<span class="record-time">' + time + '</span>' +
                '<span class="record-source">' + escapeHtml(rec.source) + '</span>' +
              '</div>' +
              '<span class="record-arrow">▶</span>' +
            '</div>' +
            '<div class="record-body">' +
              (urlDisplay ? '<div class="info-line"><span class="label">URL</span>' + escapeHtml(urlDisplay) + '</div>' : '') +
              (cssDisplay ? '<div class="info-line"><span class="label">CSS</span>' + escapeHtml(cssDisplay) + '</div>' : '') +
              '<div class="code-block">' +
                '<div class="code-block-header">' +
                  '<span class="lang">HTML</span>' +
                  '<button class="copy-btn" data-copy="html-' + index + '">Copy</button>' +
                '</div>' +
                '<pre>' + escapedHtml + '</pre>' +
              '</div>' +
              '<div class="code-block">' +
                '<div class="code-block-header">' +
                  '<span class="lang">Markdown</span>' +
                  '<button class="copy-btn" data-copy="md-' + index + '">Copy</button>' +
                '</div>' +
                '<pre>' + escapedMd + '</pre>' +
              '</div>' +
            '</div>' +
          '</div>'
        );
      }).join('');

      // Attach event listeners via delegation
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function truncate(str, max) {
    return str.length > max ? str.slice(0, max) + '…' : str;
  }

  // ── Event delegation (click) ──────────────────────────────────────────────
  recordsEl.addEventListener('click', (e) => {
    // Expand / collapse
    const head = e.target.closest('.record-head');
    if (head) {
      const record = head.closest('.record');
      const body = record.querySelector('.record-body');
      const arrow = record.querySelector('.record-arrow');
      body.classList.toggle('open');
      arrow.classList.toggle('open');
      return;
    }

    // Copy buttons
    const copyBtn = e.target.closest('.copy-btn');
    if (copyBtn) {
      const key = copyBtn.dataset.copy;
      chrome.storage.local.get('debugHistory', (data) => {
        const history = data.debugHistory || [];
        const idx = parseInt(key.split('-')[1], 10);
        const field = key.startsWith('html-') ? 'html' : 'markdown';
        const text = history[idx] ? history[idx][field] : '';
        if (text) {
          navigator.clipboard.writeText(text).then(() => {
            const orig = copyBtn.textContent;
            copyBtn.textContent = 'Copied!';
            setTimeout(() => { copyBtn.textContent = orig; }, 1200);
          });
        }
      });
      return;
    }
  });

  // ── Clear all ─────────────────────────────────────────────────────────────
  clearBtn.addEventListener('click', () => {
    chrome.storage.local.set({ debugHistory: [] }, render);
  });

  // ── Initial render ────────────────────────────────────────────────────────
  render();

  // Re-render when storage changes (e.g. new record added in content script)
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.debugHistory) {
      render();
    }
  });
})();
