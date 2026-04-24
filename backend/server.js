'use strict';

const express = require('express');
const cors    = require('cors');
const app     = express();

app.use(cors());
app.use(express.json());



const USER_ID             = 'mohitkumar_1042004';       // fullname_ddmmyyyy
const EMAIL_ID            = 'my@srmist.edu.in'; // your college email
const COLLEGE_ROLL_NUMBER = 'RA2311026010846';            // your roll number


const VALID_EDGE_RE = /^([A-Z])->([A-Z])$/;

function processData(data) {
  const invalidEntries = [];
  const duplicateEdges = [];
  const seenEdges      = new Set();
  const seenDups       = new Set();
  const parentOf       = {};  
  const adjList        = {}; 
  const nodeOrder      = [];  
  const nodeSet        = new Set();
  const acceptedEdges  = [];

  const addNode = (n) => { if (!nodeSet.has(n)) { nodeSet.add(n); nodeOrder.push(n); } };


  for (const rawEntry of data) {
    if (typeof rawEntry !== 'string') { invalidEntries.push(String(rawEntry)); continue; }

    const trimmed = rawEntry.trim();
    const match   = VALID_EDGE_RE.exec(trimmed);


    if (!match || match[1] === match[2]) { invalidEntries.push(rawEntry); continue; }

    const [, from, to] = match;
    const key = `${from}->${to}`;


    if (seenEdges.has(key)) {
      if (!seenDups.has(key)) { duplicateEdges.push(key); seenDups.add(key); }
      continue;
    }
    seenEdges.add(key);


    if (Object.prototype.hasOwnProperty.call(parentOf, to)) continue;
    parentOf[to] = from;

    if (!adjList[from]) adjList[from] = [];
    adjList[from].push(to);

    addNode(from); addNode(to);
    acceptedEdges.push({ from, to });
  }


  const undirected = {};
  for (const n of nodeOrder) undirected[n] = new Set();
  for (const { from, to } of acceptedEdges) {
    undirected[from].add(to);
    undirected[to].add(from);
  }

  const childSet  = new Set(acceptedEdges.map(e => e.to));
  const compVisit = new Set();
  const components = [];

  for (const start of nodeOrder) {
    if (compVisit.has(start)) continue;
    const comp  = new Set();
    const queue = [start];
    while (queue.length) {
      const n = queue.shift();
      if (comp.has(n)) continue;
      comp.add(n); compVisit.add(n);
      for (const nb of undirected[n]) if (!comp.has(nb)) queue.push(nb);
    }
    components.push(comp);
  }


  function hasCycle(comp) {
    const vis = new Set(), rec = new Set();
    function dfs(node) {
      vis.add(node); rec.add(node);
      for (const child of (adjList[node] || [])) {
        if (!vis.has(child)) { if (dfs(child)) return true; }
        else if (rec.has(child)) return true;
      }
      rec.delete(node); return false;
    }
    for (const node of comp) if (!vis.has(node) && dfs(node)) return true;
    return false;
  }

  function buildTree(node) {
    const sub = {};
    for (const child of (adjList[node] || [])) sub[child] = buildTree(child);
    return sub;
  }

  function calcDepth(node) {
    const ch = adjList[node] || [];
    if (!ch.length) return 1;
    return 1 + Math.max(...ch.map(calcDepth));
  }

  const hierarchies = [];
  let totalTrees = 0, totalCycles = 0, largestRoot = null, largestDepth = -1;

  for (const comp of components) {

    const roots = [...comp].filter(n => !childSet.has(n)).sort();
    const root  = roots.length ? roots[0] : [...comp].sort()[0];

    if (hasCycle(comp)) {
      totalCycles++;
      hierarchies.push({ root, tree: {}, has_cycle: true });
    } else {
      const tree  = { [root]: buildTree(root) };
      const depth = calcDepth(root);
      totalTrees++;

      if (largestRoot === null || depth > largestDepth || (depth === largestDepth && root < largestRoot)) {
        largestDepth = depth; largestRoot = root;
      }

      hierarchies.push({ root, tree, depth });
    }
  }

  return {
    user_id: USER_ID,
    email_id: EMAIL_ID,
    college_roll_number: COLLEGE_ROLL_NUMBER,
    hierarchies,
    invalid_entries: invalidEntries,
    duplicate_edges: duplicateEdges,
    summary: {
      total_trees: totalTrees,
      total_cycles: totalCycles,
      largest_tree_root: largestRoot || ''
    }
  };
}

app.post('/bfhl', (req, res) => {
  const { data } = req.body || {};
  if (!Array.isArray(data)) return res.status(400).json({ error: '"data" must be an array.' });
  res.json(processData(data));
});

app.get('/', (req, res) => res.json({ status: 'BFHL API is running', endpoint: 'POST /bfhl' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`  BFHL API listening on http://localhost:${PORT}`));
