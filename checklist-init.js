// ============================================================
// FIXED CHECKLIST INITIALISER — drop-in for all school pages
// Drop this function into each school page's DOMContentLoaded,
// replacing the old checklist setup block.
//
// Parameters:
//   containerSelector  — CSS selector for the parent containing .check-box items
//                        default: document (searches whole page)
//   itemIdPrefix       — prefix for auto-generated IDs e.g. 'bpp_chk_'
// ============================================================

async function initChecklist(containerSelector, itemIdPrefix) {
  const root = containerSelector ? document.querySelector(containerSelector) : document;
  if (!root) return;

  const checkBoxes = root.querySelectorAll('.check-box');
  if (!checkBoxes.length) return;

  // ── STEP 1: Load saved progress ONCE before touching any DOM ──
  let savedStatus = {};
  if (typeof window.loadSavedProgress === 'function') {
    try {
      const ns = window.getProgressNamespace ? window.getProgressNamespace() : '';
      const progress = await window.loadSavedProgress();
      if (progress?.checklist_status) {
        // Only load keys for this namespace (namespaced keys start with ns + '::')
        for (const [k, v] of Object.entries(progress.checklist_status)) {
          if (ns && k.startsWith(ns + '::')) {
            savedStatus[k] = v;
          } else if (!ns) {
            savedStatus[k] = v;
          }
        }
      }
    } catch (e) {
      console.warn('initChecklist: could not load progress', e);
    }
  }

  // ── STEP 2: Restore visual state for each checkbox ──
  checkBoxes.forEach((cb, index) => {
    const checkItem = cb.closest('.check-item');

    // Ensure each item has a stable ID
    if (checkItem && !checkItem.id) {
      checkItem.id = `${itemIdPrefix || 'chk_'}${index}`;
    }
    const itemId = checkItem ? checkItem.id : `${itemIdPrefix || 'chk_'}${index}`;

    // Get the label text for the namespaced key
    const titleEl = checkItem
      ? (checkItem.querySelector('.font-medium') ||
         checkItem.querySelector('.ct') ||
         checkItem.querySelector('p:first-of-type') ||
         checkItem.querySelector('p'))
      : null;
    const itemText = titleEl ? titleEl.textContent.trim() : null;

    const ns = window.getProgressNamespace ? window.getProgressNamespace() : '';
    const savedKey = ns ? `${ns}::${itemText || itemId}` : (itemText || itemId);

    // Apply saved state NOW (before listener is attached — this prevents double-toggle)
    const isChecked = savedStatus[savedKey] === true;
    if (isChecked) {
      cb.classList.add('done');
      if (titleEl) {
        titleEl.style.textDecoration = 'line-through';
        titleEl.style.color = 'var(--text-muted, #9e9e9e)';
      }
    }

    // ── STEP 3: Attach ONE click listener per checkbox ──
    // The listener ONLY toggles + saves. It never reads from DB.
    cb.addEventListener('click', async () => {
      cb.classList.toggle('done');
      const nowChecked = cb.classList.contains('done');

      if (titleEl) {
        titleEl.style.textDecoration = nowChecked ? 'line-through' : '';
        titleEl.style.color = nowChecked ? 'var(--text-muted, #9e9e9e)' : '';
      }

      // Update progress bar if available
      if (typeof updateProgress === 'function') updateProgress();
      if (typeof updProg === 'function') updProg();

      // Save to Supabase
      if (typeof window.saveChecklistItem === 'function') {
        await window.saveChecklistItem(itemId, nowChecked, itemText);
      }
    });
  });

  // ── STEP 4: Update progress bar once after restoring ──
  if (typeof updateProgress === 'function') updateProgress();
  if (typeof updProg === 'function') updProg();
}

window._initChecklist = initChecklist;
