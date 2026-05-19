// ============================================================
// CHECKLIST INITIALISER — uses student_checklists table
// Each school+course has its own isolated row. No namespace
// prefix collisions, no blob growth, works across school switches.
//
// Parameters:
//   containerSelector  — CSS selector for the parent containing .check-box items
//   itemIdPrefix       — prefix for auto-generated IDs e.g. 'bpp_chk_'
// ============================================================

async function initChecklist(containerSelector, itemIdPrefix) {
  const root = containerSelector ? document.querySelector(containerSelector) : document;
  if (!root) return;

  const checkBoxes = root.querySelectorAll('.check-box');
  if (!checkBoxes.length) return;

  // ── STEP 1: Load saved items for THIS school+course only ──
  let savedItems = {};
  try {
    if (typeof window.loadChecklistForCurrentPage === 'function') {
      savedItems = await window.loadChecklistForCurrentPage();
    }
  } catch (e) {
    console.warn('initChecklist: could not load checklist', e);
  }

  // ── STEP 2: Restore visual state ──
  checkBoxes.forEach((cb, index) => {
    const checkItem = cb.closest('.check-item');

    if (checkItem && !checkItem.id) {
      checkItem.id = `${itemIdPrefix || 'chk_'}${index}`;
    }
    const itemId = checkItem ? checkItem.id : `${itemIdPrefix || 'chk_'}${index}`;

    const titleEl = checkItem
      ? (checkItem.querySelector('.font-medium') ||
         checkItem.querySelector('.ct') ||
         checkItem.querySelector('p:first-of-type') ||
         checkItem.querySelector('p'))
      : null;
    const itemText = titleEl ? titleEl.textContent.trim() : null;

    // Key is the item text (clean, no namespace prefix needed — row IS the namespace)
    const savedKey = itemText || itemId;
    const isChecked = savedItems[savedKey] === true;

    if (isChecked) {
      cb.classList.add('done');
      if (titleEl) {
        titleEl.style.textDecoration = 'line-through';
        titleEl.style.color = 'var(--text-muted, #9e9e9e)';
      }
    }

    // ── STEP 3: Attach click listener ──
    cb.addEventListener('click', async () => {
      cb.classList.toggle('done');
      const nowChecked = cb.classList.contains('done');

      if (titleEl) {
        titleEl.style.textDecoration = nowChecked ? 'line-through' : '';
        titleEl.style.color = nowChecked ? 'var(--text-muted, #9e9e9e)' : '';
      }

      if (typeof updateProgress === 'function') updateProgress();
      if (typeof updProg === 'function') updProg();

      if (typeof window.saveChecklistItem === 'function') {
        await window.saveChecklistItem(itemId, nowChecked, itemText);
      }
    });
  });

  // ── STEP 4: Update progress bar ──
  if (typeof updateProgress === 'function') updateProgress();
  if (typeof updProg === 'function') updProg();
}

window._initChecklist = initChecklist;
