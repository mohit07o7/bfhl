

const API_BASE = 'https://bfhl-backend.onrender.com'; 


const EXAMPLES = {
  basic:   'A->B, A->C, B->D, C->E',
  cycle:   'X->Y, Y->Z, Z->X',
  full:    'A->B, A->C, B->D, C->E, E->F, X->Y, Y->Z, Z->X, P->Q, Q->R, G->H, G->H, G->I, hello, 1->2, A->',
  diamond: 'A->D, B->D, A->C, C->E'
};


function parseInput(raw) {
  return raw
    .split(/[\n,]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

function updateCount() {
  const raw    = document.getElementById('node-input').value;
  const count  = parseInput(raw).length;
  document.getElementById('entry-count').textContent = `${count} entr${count === 1 ? 'y' : 'ies'}`;
}

function loadExample(key) {
  document.getElementById('node-input').value = EXAMPLES[key];
  updateCount();
  // flash the textarea
  const ta = document.getElementById('node-input');
  ta.style.transition = 'box-shadow .2s';
  ta.style.boxShadow  = '0 0 0 3px rgba(124,111,255,.4)';
  setTimeout(() => { ta.style.boxShadow = ''; }, 400);
}

function clearAll() {
  document.getElementById('node-input').value = '';
  updateCount();
  document.getElementById('results-section').classList.add('hidden');
  document.getElementById('error-banner').classList.add('hidden');
}

function copyRaw() {
  const text = document.getElementById('raw-json').textContent;
  navigator.clipboard.writeText(text).catch(() => {});
  const btn = event.target;
  btn.textContent = 'Copied!';
  setTimeout(() => { btn.textContent = 'Copy'; }, 1800);
}

// ─── Tab Switching ─────────────────────────────────────────────────────────────
function switchTab(name) {
  ['trees','issues','identity','raw'].forEach(t => {
    document.getElementById(`tab-${t}`).classList.toggle('active', t === name);
    document.getElementById(`panel-${t}`).classList.toggle('hidden', t !== name);
  });
}

// ─── Tree Renderer (recursive) ─────────────────────────────────────────────────
function renderTreeLines(obj, prefix = '', isLast = true) {
  const keys = Object.keys(obj);
  if (!keys.length) return '';
  let html = '';
  keys.forEach((key, i) => {
    const last       = i === keys.length - 1;
    const connector  = last ? '└─ ' : '├─ ';
    const childPfx   = last ? '   ' : '│  ';
    html += `<div class="tree-line"><span class="tree-connector">${prefix}${connector}</span><span class="tree-node-label">${key}</span></div>`;
    html += renderTreeLines(obj[key], prefix + childPfx, last);
  });
  return html;
}

function buildTreeCardHTML(h, index) {
  const isCyclic = !!h.has_cycle;
  const rootChildren = h.tree[h.root] || {};

  let treeHTML = '';
  if (isCyclic) {
    treeHTML = `<div class="cycle-badge">♻ Cycle Detected — no tree structure</div>`;
  } else {
    const childKeys = Object.keys(rootChildren);
    treeHTML = `<div class="tree-visual">
      <div><span class="tree-node-label">${h.root}</span></div>
      ${renderTreeLines(rootChildren)}
    </div>`;
  }

  const depthTag = !isCyclic
    ? `<span class="depth-badge">depth&nbsp;${h.depth}</span>`
    : '';

  return `
  <div class="tree-card ${isCyclic ? 'cyclic' : ''}" style="animation-delay:${index * 60}ms">
    <div class="tree-card-header">
      <div class="tree-root-badge">${h.root}</div>
      <div>
        <div class="tree-card-title">Root: <code style="color:var(--accent-2);font-family:'JetBrains Mono',monospace">${h.root}</code></div>
        <div class="tree-card-meta">${isCyclic ? '⚠ Cyclic group' : `Tree · ${countNodes(h.tree)} node${countNodes(h.tree)!==1?'s':''}`}</div>
      </div>
    </div>
    <div style="margin-bottom:12px;display:flex;gap:8px;flex-wrap:wrap">
      ${isCyclic ? '<span class="cycle-badge">♻ Cycle</span>' : depthTag}
    </div>
    ${treeHTML}
  </div>`;
}

function countNodes(treeObj) {
  let count = 0;
  function walk(o) { for (const k of Object.keys(o)) { count++; walk(o[k]); } }
  walk(treeObj);
  return count;
}

// ─── Main Submit ────────────────────────────────────────────────────────────────
async function submitData() {
  const raw = document.getElementById('node-input').value.trim();
  if (!raw) { showError('Please enter at least one edge string.'); return; }

  const data = parseInput(raw);
  hideError();
  setLoading(true);

  try {
    const res = await fetch(`${API_BASE}/bfhl`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ data })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Server returned ${res.status}`);
    }

    const json = await res.json();
    renderResults(json);
  } catch (err) {
    showError(err.message || 'Could not reach the API. Is the backend running?');
  } finally {
    setLoading(false);
  }
}

// ─── Render Results ─────────────────────────────────────────────────────────────
function renderResults(data) {
  // Summary bar
  document.getElementById('val-trees').textContent   = data.summary.total_trees;
  document.getElementById('val-cycles').textContent  = data.summary.total_cycles;
  document.getElementById('val-largest').textContent = data.summary.largest_tree_root || '—';
  document.getElementById('val-invalid').textContent = data.invalid_entries.length;
  document.getElementById('val-dups').textContent    = data.duplicate_edges.length;

  // Tree cards
  const grid = document.getElementById('tree-grid');
  if (!data.hierarchies.length) {
    grid.innerHTML = '<p class="empty-msg" style="padding:20px;color:var(--text-muted)">No valid hierarchies found.</p>';
  } else {
    grid.innerHTML = data.hierarchies.map((h, i) => buildTreeCardHTML(h, i)).join('');
  }

  // Issues
  const listInvalid = document.getElementById('list-invalid');
  const listDups    = document.getElementById('list-dups');
  listInvalid.innerHTML = data.invalid_entries.length
    ? data.invalid_entries.map(e => `<li><span class="tag tag-invalid">${escHtml(e)}</span></li>`).join('')
    : '<li class="empty-msg">None</li>';
  listDups.innerHTML = data.duplicate_edges.length
    ? data.duplicate_edges.map(e => `<li><span class="tag tag-dup">${escHtml(e)}</span></li>`).join('')
    : '<li class="empty-msg">None</li>';

  // Identity
  document.getElementById('identity-grid').innerHTML = `
    <div class="id-row"><span class="id-key">User ID</span><span class="id-val">${escHtml(data.user_id)}</span></div>
    <div class="id-row"><span class="id-key">Email</span><span class="id-val">${escHtml(data.email_id)}</span></div>
    <div class="id-row"><span class="id-key">Roll Number</span><span class="id-val">${escHtml(data.college_roll_number)}</span></div>
    <div class="id-row"><span class="id-key">Total Hierarchies</span><span class="id-val">${data.hierarchies.length}</span></div>
  `;

  // Raw JSON
  document.getElementById('raw-json').textContent = JSON.stringify(data, null, 2);

  // Show section, switch to trees tab
  document.getElementById('results-section').classList.remove('hidden');
  switchTab('trees');
  document.getElementById('results-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ─── UI Helpers ─────────────────────────────────────────────────────────────────
function showError(msg) {
  const banner = document.getElementById('error-banner');
  document.getElementById('error-msg').textContent = msg;
  banner.classList.remove('hidden');
}
function hideError() {
  document.getElementById('error-banner').classList.add('hidden');
}
function setLoading(on) {
  const btn = document.getElementById('submit-btn');
  btn.classList.toggle('loading', on);
  btn.disabled = on;
  btn.querySelector('.btn-text').textContent = on ? 'Analysing…' : 'Analyse';
  btn.querySelector('.btn-icon').textContent  = on ? '↻' : '→';
}
function escHtml(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ─── Event Listeners ────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('node-input').addEventListener('input', updateCount);
  document.getElementById('node-input').addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submitData();
  });
  updateCount();
});
