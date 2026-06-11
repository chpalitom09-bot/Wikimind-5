/* ═══════════════════════════════════════════════════════════════════
   WIKIMIND SCHEMAS ENGINE — schema.js
   Moteur SVG haute qualité : flowchart, mindmap, timeline,
   cycle, architecture, comparaison, hiérarchie, séquence
   ═══════════════════════════════════════════════════════════════════ */

(function () {
'use strict';

// ══════════════════════════════════════════
// CONSTANTES & PALETTE
// ══════════════════════════════════════════
const SC_PALETTE = [
  '#6366f1','#8b5cf6','#06b6d4','#10b981',
  '#f59e0b','#ef4444','#ec4899','#3b82f6',
  '#a78bfa','#34d399','#fbbf24','#f87171',
];

const SC_GRADIENTS = [
  { id:'scg0', from:'#6366f1', to:'#8b5cf6' },
  { id:'scg1', from:'#06b6d4', to:'#0ea5e9' },
  { id:'scg2', from:'#10b981', to:'#34d399' },
  { id:'scg3', from:'#f59e0b', to:'#fbbf24' },
  { id:'scg4', from:'#ef4444', to:'#f87171' },
  { id:'scg5', from:'#ec4899', to:'#f472b6' },
  { id:'scg6', from:'#3b82f6', to:'#60a5fa' },
  { id:'scg7', from:'#8b5cf6', to:'#a78bfa' },
];

// ══════════════════════════════════════════
// ÉTAT DU PANEL
// ══════════════════════════════════════════
let _scSchemas = [];         // liste de tous les schémas générés
let _scActiveIdx = -1;       // schéma actuellement affiché
let _scZoom = 1;
let _scPanX = 0, _scPanY = 0;
let _scIsDragging = false;
let _scDragStartX = 0, _scDragStartY = 0;
let _scPanStartX = 0, _scPanStartY = 0;
let _scSchemaEnabled = false;

// ══════════════════════════════════════════
// UTILITAIRES SVG
// ══════════════════════════════════════════
function svgEl(tag, attrs = {}, children = []) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  children.forEach(c => {
    if (typeof c === 'string') el.innerHTML += c;
    else if (c) el.appendChild(c);
  });
  return el;
}

function mkDefs(grads = []) {
  const defs = svgEl('defs');
  grads.forEach(g => {
    const lg = svgEl('linearGradient', { id: g.id, x1:'0%', y1:'0%', x2:'100%', y2:'100%' });
    lg.innerHTML = `<stop offset="0%" stop-color="${g.from}"/><stop offset="100%" stop-color="${g.to}"/>`;
    defs.appendChild(lg);
  });
  // Filtre glow
  const filter = svgEl('filter', { id:'sc-glow', x:'-30%', y:'-30%', width:'160%', height:'160%' });
  filter.innerHTML = `
    <feGaussianBlur stdDeviation="3" result="blur"/>
    <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>`;
  defs.appendChild(filter);
  // Filtre shadow
  const shadow = svgEl('filter', { id:'sc-shadow', x:'-20%', y:'-20%', width:'140%', height:'140%' });
  shadow.innerHTML = `
    <feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="rgba(0,0,0,0.5)"/>`;
  defs.appendChild(shadow);
  // Arrow markers
  SC_PALETTE.forEach((col, i) => {
    const marker = svgEl('marker', {
      id: `arr-${i}`, markerWidth:'10', markerHeight:'7',
      refX:'9', refY:'3.5', orient:'auto'
    });
    marker.innerHTML = `<polygon points="0 0, 10 3.5, 0 7" fill="${col}" opacity="0.9"/>`;
    defs.appendChild(marker);
  });
  // Arrow gris
  const markerGray = svgEl('marker', { id:'arr-gray', markerWidth:'10', markerHeight:'7', refX:'9', refY:'3.5', orient:'auto' });
  markerGray.innerHTML = `<polygon points="0 0, 10 3.5, 0 7" fill="rgba(255,255,255,0.25)"/>`;
  defs.appendChild(markerGray);
  // Arrow blanc
  const markerW = svgEl('marker', { id:'arr-white', markerWidth:'10', markerHeight:'7', refX:'9', refY:'3.5', orient:'auto' });
  markerW.innerHTML = `<polygon points="0 0, 10 3.5, 0 7" fill="rgba(255,255,255,0.7)"/>`;
  defs.appendChild(markerW);
  return defs;
}

function wrapText(text, maxW, lineH = 16) {
  // Retourne un array de <tspan> strings
  const words = String(text).split(' ');
  const lines = [];
  let cur = '';
  const avgCharW = 6.5;
  const maxChars = Math.floor(maxW / avgCharW);
  words.forEach(w => {
    if ((cur + ' ' + w).trim().length > maxChars && cur) {
      lines.push(cur.trim());
      cur = w;
    } else {
      cur = cur ? cur + ' ' + w : w;
    }
  });
  if (cur) lines.push(cur.trim());
  return lines;
}

function textBlock(x, y, text, opts = {}) {
  const { fill='#fff', fontSize=13, fontWeight=400, maxW=120, anchor='middle', dy=0 } = opts;
  const lines = wrapText(text, maxW);
  const totalH = lines.length * (fontSize + 4);
  const startY = y - (totalH / 2) + fontSize / 2 + dy;
  const g = svgEl('g');
  lines.forEach((line, i) => {
    const t = svgEl('text', {
      x, y: startY + i * (fontSize + 4),
      fill, 'font-size': fontSize, 'font-weight': fontWeight,
      'font-family': 'Geist, Inter, sans-serif',
      'text-anchor': anchor, 'dominant-baseline': 'central'
    });
    t.textContent = line;
    g.appendChild(t);
  });
  return g;
}

// ══════════════════════════════════════════
// PARSEUR DE BLOC ```schema```
// ══════════════════════════════════════════
function parseSchemaBlock(raw) {
  const lines = raw.trim().split('\n').map(l => l.trim()).filter(Boolean);
  const cfg = { type: 'flowchart', titre: '', nodes: [], edges: [], items: [], steps: [], cols: [] };

  lines.forEach(line => {
    const ci = line.indexOf(':');
    if (ci === -1) return;
    const key = line.slice(0, ci).trim().toLowerCase();
    const val = line.slice(ci + 1).trim();

    if (key === 'type') cfg.type = val.toLowerCase();
    else if (key === 'titre' || key === 'title') cfg.titre = val;
    else if (key === 'direction') cfg.direction = val.toLowerCase();

    // Flowchart / Architecture : noeud → node:id:label:shape?:color?
    else if (key === 'node') {
      const parts = val.split(':').map(s => s.trim());
      cfg.nodes.push({ id: parts[0], label: parts[1] || parts[0], shape: parts[2] || 'rect', color: parts[3] || null });
    }
    // Edge → edge:from:to:label?:style?
    else if (key === 'edge') {
      const parts = val.split(':').map(s => s.trim());
      cfg.edges.push({ from: parts[0], to: parts[1], label: parts[2] || '', style: parts[3] || 'solid' });
    }
    // Mind map : item:label:parent?
    else if (key === 'item') {
      const parts = val.split(':').map(s => s.trim());
      cfg.items.push({ label: parts[0], parent: parts[1] || null, detail: parts[2] || '' });
    }
    // Timeline / Cycle / Processus : step:label:detail?:color?
    else if (key === 'step') {
      const parts = val.split(':').map(s => s.trim());
      cfg.steps.push({ label: parts[0], detail: parts[1] || '', color: parts[2] || null });
    }
    // Comparaison : col:title:items (items séparés par |)
    else if (key === 'col') {
      const parts = val.split(':').map(s => s.trim());
      cfg.cols.push({ title: parts[0], items: (parts[1] || '').split('|').map(s => s.trim()) });
    }
    // Fallback générique
    else {
      cfg[key] = val;
    }
  });

  return cfg;
}

// ══════════════════════════════════════════
// RENDERERS
// ══════════════════════════════════════════

/* ── FLOWCHART ─────────────────────────── */
function renderFlowchart(cfg) {
  const isLR = (cfg.direction || 'tb') === 'lr';
  const W = 800, H = 560;
  const nodeW = 160, nodeH = 50;
  const gapX = isLR ? 220 : 200, gapY = isLR ? 130 : 110;

  const nodes = cfg.nodes.length ? cfg.nodes : [
    { id:'start', label:'Début', shape:'round', color:'0' },
    { id:'process', label:'Traitement', shape:'rect', color:'2' },
    { id:'decision', label:'Décision', shape:'diamond', color:'4' },
    { id:'end', label:'Fin', shape:'round', color:'1' },
  ];
  const edges = cfg.edges.length ? cfg.edges : [
    { from:'start', to:'process' }, { from:'process', to:'decision' },
    { from:'decision', to:'end', label:'Oui' }, { from:'decision', to:'process', label:'Non' }
  ];

  // Layout automatique (topological sort simplifié)
  const nodeMap = {};
  nodes.forEach((n, i) => { nodeMap[n.id] = { ...n, idx: i }; });

  // Niveaux par BFS
  const levels = {};
  const roots = nodes.filter(n => !edges.some(e => e.to === n.id));
  if (!roots.length) roots.push(nodes[0]);

  function assignLevel(id, lvl) {
    if (levels[id] === undefined || levels[id] < lvl) {
      levels[id] = lvl;
      edges.filter(e => e.from === id).forEach(e => assignLevel(e.to, lvl + 1));
    }
  }
  roots.forEach(r => assignLevel(r.id, 0));

  const byLevel = {};
  nodes.forEach(n => {
    const l = levels[n.id] ?? 0;
    if (!byLevel[l]) byLevel[l] = [];
    byLevel[l].push(n);
  });

  const maxL = Math.max(...Object.keys(byLevel).map(Number));
  const totalLevels = maxL + 1;

  // Positions
  const pos = {};
  Object.entries(byLevel).forEach(([lvl, ns]) => {
    const l = parseInt(lvl);
    ns.forEach((n, i) => {
      const span = ns.length;
      if (isLR) {
        pos[n.id] = { x: 80 + l * gapX, y: H / 2 + (i - (span - 1) / 2) * gapY };
      } else {
        pos[n.id] = { x: W / 2 + (i - (span - 1) / 2) * gapX, y: 70 + l * gapY };
      }
    });
  });

  const svgW = isLR ? Math.max(W, 80 + totalLevels * gapX + nodeW) : W;
  const svgH = isLR ? H : Math.max(H, 70 + totalLevels * gapY + nodeH);

  const svg = svgEl('svg', {
    viewBox: `0 0 ${svgW} ${svgH}`,
    width: svgW, height: svgH,
    xmlns: 'http://www.w3.org/2000/svg'
  });
  svg.appendChild(mkDefs(SC_GRADIENTS));

  // Fond
  svg.appendChild(svgEl('rect', { width: svgW, height: svgH, rx:16, fill:'#0d0d0f' }));

  // Titre
  if (cfg.titre) {
    svg.appendChild(svgEl('text', {
      x: svgW / 2, y: 28,
      fill: '#e0e0ff', 'font-size': 17, 'font-weight': 700,
      'font-family': 'Geist, Inter, sans-serif',
      'text-anchor': 'middle', opacity: 0.9
    })).textContent = cfg.titre;
  }

  // Edges
  const edgeG = svgEl('g');
  edges.forEach((e, ei) => {
    const fp = pos[e.from], tp = pos[e.to];
    if (!fp || !tp) return;
    const ci = ei % SC_PALETTE.length;
    const col = SC_PALETTE[ci];
    const isSelf = e.from === e.to;

    let d;
    if (isSelf) {
      const r = 40;
      d = `M ${fp.x + nodeW/2} ${fp.y} C ${fp.x + nodeW/2 + r*2} ${fp.y - r*2} ${fp.x + nodeW/2 + r*2} ${fp.y + r*2} ${fp.x + nodeW/2} ${fp.y}`;
    } else {
      const mid = isLR
        ? `C ${(fp.x + tp.x) / 2} ${fp.y} ${(fp.x + tp.x) / 2} ${tp.y}`
        : `C ${fp.x} ${(fp.y + tp.y) / 2} ${tp.x} ${(fp.y + tp.y) / 2}`;
      d = `M ${fp.x} ${fp.y} ${mid} ${tp.x} ${tp.y}`;
    }

    const path = svgEl('path', {
      d, fill: 'none',
      stroke: col, 'stroke-width': e.style === 'dashed' ? '1.5' : '2',
      'stroke-dasharray': e.style === 'dashed' ? '6,3' : 'none',
      opacity: 0.7,
      'marker-end': `url(#arr-${ci})`
    });
    edgeG.appendChild(path);

    if (e.label) {
      const mx = (fp.x + tp.x) / 2, my = (fp.y + tp.y) / 2 - 12;
      edgeG.appendChild(svgEl('rect', { x: mx - 22, y: my - 9, width: 44, height: 18, rx: 4, fill: 'rgba(13,13,15,0.85)' }));
      const lt = svgEl('text', {
        x: mx, y: my + 1, fill: col, 'font-size': 10, 'font-weight': 600,
        'font-family': 'Geist, sans-serif', 'text-anchor': 'middle', 'dominant-baseline': 'central'
      });
      lt.textContent = e.label;
      edgeG.appendChild(lt);
    }
  });
  svg.appendChild(edgeG);

  // Nodes
  const nodeG = svgEl('g');
  nodes.forEach((n, ni) => {
    const p = pos[n.id];
    if (!p) return;
    const ci = n.color !== null ? parseInt(n.color) : ni % SC_GRADIENTS.length;
    const gradId = `scg${ci % SC_GRADIENTS.length}`;
    const borderCol = SC_PALETTE[ci % SC_PALETTE.length];
    const g = svgEl('g');
    const hw = nodeW / 2, hh = nodeH / 2;

    // Halo
    g.appendChild(svgEl('ellipse', {
      cx: p.x, cy: p.y, rx: hw + 10, ry: hh + 8,
      fill: `url(#${gradId})`, opacity: 0.08
    }));

    if (n.shape === 'diamond') {
      const pts = `${p.x},${p.y - hh * 1.3} ${p.x + hw * 1.2},${p.y} ${p.x},${p.y + hh * 1.3} ${p.x - hw * 1.2},${p.y}`;
      g.appendChild(svgEl('polygon', { points: pts, fill: 'rgba(255,255,255,0.03)', stroke: borderCol, 'stroke-width': 1.5 }));
    } else if (n.shape === 'round' || n.shape === 'pill') {
      g.appendChild(svgEl('rect', { x: p.x - hw, y: p.y - hh, width: nodeW, height: nodeH, rx: nodeH / 2, fill: `url(#${gradId})`, opacity: 0.18 }));
      g.appendChild(svgEl('rect', { x: p.x - hw, y: p.y - hh, width: nodeW, height: nodeH, rx: nodeH / 2, fill: 'none', stroke: borderCol, 'stroke-width': 1.5 }));
    } else if (n.shape === 'cylinder') {
      const er = 10;
      g.appendChild(svgEl('rect', { x: p.x - hw, y: p.y - hh + er, width: nodeW, height: nodeH - er, fill: 'rgba(255,255,255,0.04)', stroke: borderCol, 'stroke-width': 1.5 }));
      g.appendChild(svgEl('ellipse', { cx: p.x, cy: p.y - hh + er, rx: hw, ry: er, fill: `url(#${gradId})`, opacity: 0.3, stroke: borderCol, 'stroke-width': 1.5 }));
    } else if (n.shape === 'parallelogram') {
      const sk = 14;
      g.appendChild(svgEl('polygon', {
        points: `${p.x - hw + sk},${p.y - hh} ${p.x + hw + sk},${p.y - hh} ${p.x + hw - sk},${p.y + hh} ${p.x - hw - sk},${p.y + hh}`,
        fill: 'rgba(255,255,255,0.04)', stroke: borderCol, 'stroke-width': 1.5
      }));
    } else {
      // rect par défaut
      g.appendChild(svgEl('rect', { x: p.x - hw, y: p.y - hh, width: nodeW, height: nodeH, rx: 10, fill: 'rgba(255,255,255,0.03)', stroke: borderCol, 'stroke-width': 1.5 }));
    }

    // Texte
    g.appendChild(textBlock(p.x, p.y, n.label, { fill: '#fff', fontSize: 12, fontWeight: 600, maxW: nodeW - 12 }));
    nodeG.appendChild(g);
  });
  svg.appendChild(nodeG);

  return svg;
}

/* ── MIND MAP ──────────────────────────── */
function renderMindmap(cfg) {
  const W = 860, H = 640;
  const items = cfg.items.length ? cfg.items : cfg.steps.length ? cfg.steps.map(s => ({ label: s.label, detail: s.detail })) : [
    { label: cfg.titre || 'Concept Central', parent: null },
    { label: 'Idée A', parent: cfg.titre || 'Concept Central', detail: 'Description A' },
    { label: 'Idée B', parent: cfg.titre || 'Concept Central', detail: 'Description B' },
    { label: 'Idée C', parent: cfg.titre || 'Concept Central', detail: 'Description C' },
    { label: 'Détail A1', parent: 'Idée A' },
    { label: 'Détail B1', parent: 'Idée B' },
  ];

  const cx = W / 2, cy = H / 2;
  // Trouver la racine
  const root = items.find(it => !it.parent) || items[0];
  const children = items.filter(it => it.parent === root.label || (it !== root && !it.parent && items.indexOf(it) > 0));

  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, xmlns: 'http://www.w3.org/2000/svg' });
  svg.appendChild(mkDefs(SC_GRADIENTS));
  svg.appendChild(svgEl('rect', { width: W, height: H, rx: 16, fill: '#0d0d0f' }));

  const n = children.length || 1;
  children.forEach((child, i) => {
    const angle = (2 * Math.PI * i / n) - Math.PI / 2;
    const r1 = 140, r2 = 270;
    const mx = cx + r1 * Math.cos(angle), my = cy + r1 * Math.sin(angle);
    const bx = cx + r2 * Math.cos(angle), by = cy + r2 * Math.sin(angle);
    const col = SC_PALETTE[i % SC_PALETTE.length];
    const gradId = `scg${i % SC_GRADIENTS.length}`;

    // Ligne principale
    const path = svgEl('path', {
      d: `M ${cx} ${cy} Q ${mx} ${my} ${bx} ${by}`,
      fill: 'none', stroke: col, 'stroke-width': '2', opacity: '0.5'
    });
    svg.appendChild(path);

    // Noeud enfant
    const bw = 130, bh = 44;
    svg.appendChild(svgEl('rect', { x: bx - bw/2, y: by - bh/2, width: bw, height: bh, rx: 10, fill: `url(#${gradId})`, opacity: 0.18 }));
    svg.appendChild(svgEl('rect', { x: bx - bw/2, y: by - bh/2, width: bw, height: bh, rx: 10, fill: 'none', stroke: col, 'stroke-width': 1.5 }));
    svg.appendChild(textBlock(bx, by, child.label, { fill: '#fff', fontSize: 12, fontWeight: 600, maxW: bw - 10 }));

    // Sous-enfants
    const grandChildren = items.filter(it => it.parent === child.label);
    grandChildren.forEach((gc, j) => {
      const subAngle = angle + (j - (grandChildren.length - 1) / 2) * 0.45;
      const r3 = 390;
      const gx = cx + r3 * Math.cos(subAngle), gy = cy + r3 * Math.sin(subAngle);
      svg.appendChild(svgEl('line', { x1: bx, y1: by, x2: gx, y2: gy, stroke: col, 'stroke-width': 1, opacity: 0.3 }));
      svg.appendChild(svgEl('circle', { cx: gx, cy: gy, r: 4, fill: col, opacity: 0.5 }));
      svg.appendChild(textBlock(gx, gy - 14, gc.label, { fill: col, fontSize: 10, fontWeight: 500, maxW: 90 }));
    });
  });

  // Noeud central
  svg.appendChild(svgEl('circle', { cx, cy, r: 68, fill: 'url(#scg0)', opacity: 0.2 }));
  svg.appendChild(svgEl('circle', { cx, cy, r: 66, fill: 'none', stroke: '#6366f1', 'stroke-width': 2, opacity: 0.7 }));
  svg.appendChild(svgEl('circle', { cx, cy, r: 55, fill: 'rgba(99,102,241,0.12)' }));
  svg.appendChild(textBlock(cx, cy, root.label, { fill: '#fff', fontSize: 15, fontWeight: 700, maxW: 100 }));

  return svg;
}

/* ── TIMELINE ──────────────────────────── */
function renderTimeline(cfg) {
  const steps = cfg.steps.length ? cfg.steps : cfg.items.length ? cfg.items : [
    { label: 'Étape 1', detail: 'Début' }, { label: 'Étape 2', detail: 'Progression' },
    { label: 'Étape 3', detail: 'Développement' }, { label: 'Étape 4', detail: 'Fin' },
  ];
  const n = steps.length;
  const isV = n > 5; // Vertical si beaucoup
  const W = isV ? 660 : Math.max(740, n * 160 + 80), H = isV ? Math.max(400, n * 100 + 80) : 360;

  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, xmlns: 'http://www.w3.org/2000/svg' });
  svg.appendChild(mkDefs(SC_GRADIENTS));
  svg.appendChild(svgEl('rect', { width: W, height: H, rx: 16, fill: '#0d0d0f' }));

  if (cfg.titre) {
    svg.appendChild(svgEl('text', { x: W/2, y: 30, fill:'#e0e0ff', 'font-size':17, 'font-weight':700, 'font-family':'Geist,sans-serif', 'text-anchor':'middle', opacity:0.9 })).textContent = cfg.titre;
  }

  if (isV) {
    // Layout vertical
    const lx = 80, startY = 70, stepH = (H - 100) / Math.max(n - 1, 1);
    svg.appendChild(svgEl('line', { x1: lx, y1: startY, x2: lx, y2: H - 40, stroke:'rgba(255,255,255,0.1)', 'stroke-width':2 }));

    steps.forEach((s, i) => {
      const y = startY + i * stepH;
      const ci = i % SC_PALETTE.length;
      const col = s.color ? SC_PALETTE[parseInt(s.color) % SC_PALETTE.length] : SC_PALETTE[ci];

      svg.appendChild(svgEl('circle', { cx: lx, cy: y, r: 14, fill: col, opacity: 0.2 }));
      svg.appendChild(svgEl('circle', { cx: lx, cy: y, r: 10, fill: col, opacity: 0.8 }));
      svg.appendChild(svgEl('circle', { cx: lx, cy: y, r: 5, fill: '#fff' }));

      const bw = 460, bh = 52;
      const bx = lx + 40;
      svg.appendChild(svgEl('rect', { x: bx, y: y - bh/2, width: bw, height: bh, rx: 10, fill: 'rgba(255,255,255,0.03)', stroke: col, 'stroke-width': 1 }));
      svg.appendChild(svgEl('text', { x: bx + 16, y: y - 6, fill: col, 'font-size': 12, 'font-weight': 700, 'font-family': 'Geist,sans-serif' })).textContent = s.label;
      if (s.detail) svg.appendChild(svgEl('text', { x: bx + 16, y: y + 12, fill: 'rgba(255,255,255,0.4)', 'font-size': 11, 'font-family': 'Geist,sans-serif' })).textContent = s.detail;
    });
  } else {
    // Layout horizontal
    const ty = H / 2, startX = 80, totalW = W - 140;
    svg.appendChild(svgEl('line', { x1: startX, y1: ty, x2: W - 60, y2: ty, stroke:'rgba(255,255,255,0.1)', 'stroke-width':2 }));

    steps.forEach((s, i) => {
      const x = startX + (i / Math.max(n - 1, 1)) * totalW;
      const ci = i % SC_PALETTE.length;
      const col = s.color ? SC_PALETTE[parseInt(s.color) % SC_PALETTE.length] : SC_PALETTE[ci];
      const above = i % 2 === 0;
      const textY = above ? ty - 70 : ty + 70;

      // Ligne connecteur
      svg.appendChild(svgEl('line', { x1: x, y1: ty, x2: x, y2: textY + (above ? 20 : -20), stroke: col, 'stroke-width': 1, opacity: 0.4 }));

      // Bulle de texte
      const bw = 120, bh = 46;
      svg.appendChild(svgEl('rect', { x: x - bw/2, y: textY - bh/2, width: bw, height: bh, rx: 10, fill: 'rgba(255,255,255,0.03)', stroke: col, 'stroke-width': 1.2 }));
      svg.appendChild(textBlock(x, textY - 7, s.label, { fill: '#fff', fontSize: 11, fontWeight: 700, maxW: bw - 10 }));
      if (s.detail) svg.appendChild(textBlock(x, textY + 10, s.detail, { fill: 'rgba(255,255,255,0.4)', fontSize: 9.5, maxW: bw - 10 }));

      // Point
      svg.appendChild(svgEl('circle', { cx: x, cy: ty, r: 14, fill: col, opacity: 0.15 }));
      svg.appendChild(svgEl('circle', { cx: x, cy: ty, r: 10, fill: col }));
      svg.appendChild(svgEl('circle', { cx: x, cy: ty, r: 4, fill: '#fff' }));
    });
  }

  return svg;
}

/* ── CYCLE ─────────────────────────────── */
function renderCycle(cfg) {
  const steps = cfg.steps.length ? cfg.steps : cfg.items.length ? cfg.items : [
    { label: 'Planifier' }, { label: 'Exécuter' }, { label: 'Vérifier' }, { label: 'Améliorer' }
  ];
  const n = steps.length;
  const W = 700, H = 600;
  const cx = W / 2, cy = H / 2 + 10;
  const r = 190, nodeR = 52;

  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, xmlns: 'http://www.w3.org/2000/svg' });
  svg.appendChild(mkDefs(SC_GRADIENTS));
  svg.appendChild(svgEl('rect', { width: W, height: H, rx: 16, fill: '#0d0d0f' }));

  if (cfg.titre) {
    svg.appendChild(svgEl('text', { x: W/2, y: 32, fill:'#e0e0ff', 'font-size':17, 'font-weight':700, 'font-family':'Geist,sans-serif', 'text-anchor':'middle', opacity:0.9 })).textContent = cfg.titre;
  }

  // Cercle guide
  svg.appendChild(svgEl('circle', { cx, cy, r: r + 5, fill:'none', stroke:'rgba(255,255,255,0.04)', 'stroke-width':40, 'stroke-dasharray':'2,4' }));

  steps.forEach((s, i) => {
    const angle = (2 * Math.PI * i / n) - Math.PI / 2;
    const nx = cx + r * Math.cos(angle);
    const ny = cy + r * Math.sin(angle);
    const ci = i % SC_PALETTE.length;
    const col = s.color ? SC_PALETTE[parseInt(s.color) % SC_PALETTE.length] : SC_PALETTE[ci];
    const gradId = `scg${i % SC_GRADIENTS.length}`;

    // Arc de connexion vers suivant
    const nextAngle = (2 * Math.PI * ((i + 1) % n) / n) - Math.PI / 2;
    const midA = angle + (nextAngle - angle) * 0.5;
    const arcR = r + 2;
    const x1 = cx + arcR * Math.cos(angle + 0.3), y1 = cy + arcR * Math.sin(angle + 0.3);
    const x2 = cx + arcR * Math.cos(nextAngle - 0.3), y2 = cy + arcR * Math.sin(nextAngle - 0.3);
    const laf = Math.abs(nextAngle - angle) > Math.PI ? 1 : 0;
    svg.appendChild(svgEl('path', {
      d: `M ${x1} ${y1} A ${arcR} ${arcR} 0 ${laf} 1 ${x2} ${y2}`,
      fill: 'none', stroke: col, 'stroke-width': '2.5', opacity: '0.45',
      'marker-end': `url(#arr-${ci})`
    }));

    // Halo
    svg.appendChild(svgEl('circle', { cx: nx, cy: ny, r: nodeR + 12, fill: col, opacity: 0.07 }));
    // Noeud
    svg.appendChild(svgEl('circle', { cx: nx, cy: ny, r: nodeR, fill: `url(#${gradId})`, opacity: 0.2 }));
    svg.appendChild(svgEl('circle', { cx: nx, cy: ny, r: nodeR, fill: 'none', stroke: col, 'stroke-width': 2 }));

    // Numéro
    svg.appendChild(svgEl('text', {
      x: nx, y: ny - 14, fill: col, 'font-size': 11, 'font-weight': 700,
      'font-family': 'Geist Mono, monospace', 'text-anchor': 'middle', opacity: 0.7
    })).textContent = `0${i + 1}`;

    svg.appendChild(textBlock(nx, ny + 4, s.label, { fill: '#fff', fontSize: 12, fontWeight: 700, maxW: nodeR * 2 - 10 }));
    if (s.detail) svg.appendChild(textBlock(nx, ny + 22, s.detail, { fill: 'rgba(255,255,255,0.4)', fontSize: 9.5, maxW: nodeR * 2 - 10 }));
  });

  // Centre
  svg.appendChild(svgEl('circle', { cx, cy, r: 42, fill: 'rgba(99,102,241,0.08)', stroke: 'rgba(99,102,241,0.3)', 'stroke-width': 1 }));
  if (cfg.titre) {
    svg.appendChild(textBlock(cx, cy, cfg.titre.slice(0, 12), { fill: 'rgba(255,255,255,0.3)', fontSize: 10, maxW: 70 }));
  }

  return svg;
}

/* ── ARCHITECTURE ──────────────────────── */
function renderArchitecture(cfg) {
  const nodes = cfg.nodes.length ? cfg.nodes : [
    { id:'client', label:'Client Web', shape:'rect', color:'0' },
    { id:'lb', label:'Load Balancer', shape:'diamond', color:'2' },
    { id:'api1', label:'API Server 1', shape:'rect', color:'1' },
    { id:'api2', label:'API Server 2', shape:'rect', color:'1' },
    { id:'db', label:'Base de Données', shape:'cylinder', color:'3' },
    { id:'cache', label:'Cache Redis', shape:'pill', color:'4' },
  ];
  const edges = cfg.edges.length ? cfg.edges : [
    { from:'client', to:'lb' }, { from:'lb', to:'api1' }, { from:'lb', to:'api2' },
    { from:'api1', to:'db' }, { from:'api2', to:'db' }, { from:'api1', to:'cache' }
  ];
  return renderFlowchart({ ...cfg, nodes, edges, direction: cfg.direction || 'tb' });
}

/* ── COMPARAISON ───────────────────────── */
function renderComparison(cfg) {
  const cols = cfg.cols.length ? cfg.cols : [
    { title: 'Option A', items: ['Avantage 1', 'Avantage 2', 'Avantage 3'] },
    { title: 'Option B', items: ['Avantage A', 'Avantage B', 'Avantage C'] },
  ];
  const n = cols.length;
  const colW = 220, rowH = 44, headerH = 60;
  const maxItems = Math.max(...cols.map(c => c.items.length));
  const W = n * colW + (n + 1) * 20 + 40;
  const H = headerH + maxItems * rowH + 80;

  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, xmlns: 'http://www.w3.org/2000/svg' });
  svg.appendChild(mkDefs(SC_GRADIENTS));
  svg.appendChild(svgEl('rect', { width: W, height: H, rx: 16, fill: '#0d0d0f' }));

  if (cfg.titre) {
    svg.appendChild(svgEl('text', { x: W/2, y: 28, fill:'#e0e0ff', 'font-size':16, 'font-weight':700, 'font-family':'Geist,sans-serif', 'text-anchor':'middle', opacity:0.9 })).textContent = cfg.titre;
  }

  const startY = cfg.titre ? 48 : 20;

  cols.forEach((col, ci) => {
    const x = 30 + ci * (colW + 20);
    const col_color = SC_PALETTE[ci % SC_PALETTE.length];
    const gradId = `scg${ci % SC_GRADIENTS.length}`;

    // Header
    svg.appendChild(svgEl('rect', { x, y: startY, width: colW, height: headerH, rx: 12, fill: `url(#${gradId})`, opacity: 0.2 }));
    svg.appendChild(svgEl('rect', { x, y: startY, width: colW, height: headerH, rx: 12, fill: 'none', stroke: col_color, 'stroke-width': 1.5 }));
    svg.appendChild(svgEl('text', { x: x + colW/2, y: startY + headerH/2 + 2, fill: col_color, 'font-size': 15, 'font-weight': 700, 'font-family': 'Geist,sans-serif', 'text-anchor': 'middle', 'dominant-baseline': 'central' })).textContent = col.title;

    // Rows
    col.items.forEach((item, ri) => {
      const ry = startY + headerH + ri * rowH + 8;
      const isEven = ri % 2 === 0;
      svg.appendChild(svgEl('rect', { x, y: ry, width: colW, height: rowH - 4, rx: 8, fill: isEven ? 'rgba(255,255,255,0.025)' : 'rgba(255,255,255,0.01)' }));

      // Pastille
      svg.appendChild(svgEl('circle', { cx: x + 18, cy: ry + rowH/2 - 2, r: 4, fill: col_color, opacity: 0.7 }));
      svg.appendChild(svgEl('text', {
        x: x + 32, y: ry + rowH/2 - 2,
        fill: 'rgba(255,255,255,0.75)', 'font-size': 11.5, 'font-family': 'Geist,sans-serif',
        'dominant-baseline': 'central'
      })).textContent = item.length > 24 ? item.slice(0, 22) + '…' : item;
    });
  });

  return svg;
}

/* ── HIERARCHY ─────────────────────────── */
function renderHierarchy(cfg) {
  const items = cfg.items.length ? cfg.items : [
    { label: 'PDG', parent: null },
    { label: 'CTO', parent: 'PDG' }, { label: 'CFO', parent: 'PDG' }, { label: 'CMO', parent: 'PDG' },
    { label: 'Dev Lead', parent: 'CTO' }, { label: 'Ops Lead', parent: 'CTO' },
    { label: 'Comptable', parent: 'CFO' },
  ];

  // Build tree
  const map = {};
  items.forEach(it => { map[it.label] = { ...it, children: [] }; });
  const roots = [];
  items.forEach(it => {
    if (it.parent && map[it.parent]) map[it.parent].children.push(map[it.label]);
    else roots.push(map[it.label]);
  });

  const nodeW = 140, nodeH = 44, gapX = 30, gapY = 80;

  function calcWidth(node) {
    if (!node.children.length) return nodeW + gapX;
    return Math.max(nodeW + gapX, node.children.reduce((s, c) => s + calcWidth(c), 0));
  }
  function calcDepth(node) {
    if (!node.children.length) return 1;
    return 1 + Math.max(...node.children.map(calcDepth));
  }

  const totalW = Math.max(600, roots.reduce((s, r) => s + calcWidth(r), 0) + 60);
  const depth = Math.max(...roots.map(calcDepth));
  const H = depth * (nodeH + gapY) + 60;

  const svg = svgEl('svg', { viewBox: `0 0 ${totalW} ${H}`, width: totalW, height: H, xmlns: 'http://www.w3.org/2000/svg' });
  svg.appendChild(mkDefs(SC_GRADIENTS));
  svg.appendChild(svgEl('rect', { width: totalW, height: H, rx: 16, fill: '#0d0d0f' }));

  if (cfg.titre) {
    svg.appendChild(svgEl('text', { x: totalW/2, y: 26, fill:'#e0e0ff', 'font-size':16, 'font-weight':700, 'font-family':'Geist,sans-serif', 'text-anchor':'middle', opacity:0.9 })).textContent = cfg.titre;
  }

  let nodeIdx = 0;
  function drawNode(node, x, y, level) {
    const ci = level % SC_PALETTE.length;
    const col = SC_PALETTE[ci];
    const gradId = `scg${ci % SC_GRADIENTS.length}`;
    const nx = x, ny = (cfg.titre ? 40 : 16) + y;
    nodeIdx++;

    svg.appendChild(svgEl('rect', { x: nx - nodeW/2, y: ny, width: nodeW, height: nodeH, rx: 9, fill: `url(#${gradId})`, opacity: 0.15 }));
    svg.appendChild(svgEl('rect', { x: nx - nodeW/2, y: ny, width: nodeW, height: nodeH, rx: 9, fill: 'none', stroke: col, 'stroke-width': 1.5 }));
    svg.appendChild(textBlock(nx, ny + nodeH/2, node.label, { fill: '#fff', fontSize: 12, fontWeight: 600, maxW: nodeW - 12 }));

    if (node.children.length) {
      const totalChildW = node.children.reduce((s, c) => s + calcWidth(c), 0);
      let childX = nx - totalChildW / 2;
      node.children.forEach(child => {
        const cw = calcWidth(child);
        const cx2 = childX + cw / 2;
        const cy2 = ny + nodeH + gapY;
        svg.appendChild(svgEl('path', {
          d: `M ${nx} ${ny + nodeH} C ${nx} ${ny + nodeH + gapY/2} ${cx2} ${ny + nodeH + gapY/2} ${cx2} ${cy2}`,
          fill: 'none', stroke: col, 'stroke-width': 1.5, opacity: 0.4
        }));
        drawNode(child, cx2, y + nodeH + gapY, level + 1);
        childX += cw;
      });
    }
  }

  let rootX = 30;
  roots.forEach(root => {
    const rw = calcWidth(root);
    drawNode(root, rootX + rw / 2, 0, 0);
    rootX += rw;
  });

  return svg;
}

/* ── SEQUENCE ──────────────────────────── */
function renderSequence(cfg) {
  const items = cfg.items.length ? cfg.items : cfg.steps.length ? cfg.steps : [
    { label: 'Utilisateur', parent: null },
    { label: 'Serveur', parent: null },
    { label: 'DB', parent: null },
  ];
  // Acteurs = items sans parent
  const actors = items.filter(it => !it.parent);
  // Interactions = items avec parent (format: "ActorA → ActorB : Label")
  const messages = items.filter(it => it.parent);

  const actorW = 100, actorH = 44, actorGap = 180;
  const msgH = 55, startY = 80;
  const totalActors = actors.length || 2;
  const totalMsgs = messages.length || 3;
  const W = Math.max(600, totalActors * actorGap + 80);
  const H = startY + (totalMsgs + 1) * msgH + 80;

  const actorX = {};
  actors.forEach((a, i) => { actorX[a.label] = 60 + i * actorGap; });

  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, xmlns: 'http://www.w3.org/2000/svg' });
  svg.appendChild(mkDefs(SC_GRADIENTS));
  svg.appendChild(svgEl('rect', { width: W, height: H, rx: 16, fill: '#0d0d0f' }));

  if (cfg.titre) {
    svg.appendChild(svgEl('text', { x: W/2, y: 28, fill:'#e0e0ff', 'font-size':16, 'font-weight':700, 'font-family':'Geist,sans-serif', 'text-anchor':'middle', opacity:0.9 })).textContent = cfg.titre;
  }

  // Lifelines
  actors.forEach((a, i) => {
    const x = actorX[a.label] || (60 + i * actorGap);
    const col = SC_PALETTE[i % SC_PALETTE.length];
    // Box acteur
    svg.appendChild(svgEl('rect', { x: x - actorW/2, y: startY - actorH, width: actorW, height: actorH, rx: 9, fill: 'rgba(255,255,255,0.04)', stroke: col, 'stroke-width': 1.5 }));
    svg.appendChild(svgEl('text', { x, y: startY - actorH/2, fill: col, 'font-size': 12, 'font-weight': 700, 'font-family': 'Geist,sans-serif', 'text-anchor': 'middle', 'dominant-baseline': 'central' })).textContent = a.label;
    // Lifeline
    svg.appendChild(svgEl('line', { x1: x, y1: startY, x2: x, y2: H - 30, stroke: col, 'stroke-width': 1, 'stroke-dasharray': '4,4', opacity: 0.3 }));
  });

  // Messages
  messages.forEach((msg, i) => {
    // Essayer de parser "from → to" depuis parent ou label
    let fromActor = actors[0]?.label, toActor = actors[1]?.label, label = msg.label;
    const arrow = (msg.parent || '').split('→');
    if (arrow.length >= 2) { fromActor = arrow[0].trim(); toActor = arrow[1].trim(); }
    const y = startY + (i + 1) * msgH;
    const x1 = actorX[fromActor] || 60;
    const x2 = actorX[toActor] || (60 + actorGap);
    const ci = i % SC_PALETTE.length;
    const col = SC_PALETTE[ci];
    const dir = x2 > x1 ? 1 : -1;

    svg.appendChild(svgEl('line', {
      x1: x1 + dir*20, y1: y, x2: x2 - dir*20, y2: y,
      stroke: col, 'stroke-width': 1.8, opacity: 0.7,
      'marker-end': `url(#arr-${ci})`
    }));
    // Label au milieu
    const mx = (x1 + x2) / 2;
    svg.appendChild(svgEl('rect', { x: mx - 50, y: y - 15, width: 100, height: 14, rx: 3, fill: 'rgba(13,13,15,0.9)' }));
    svg.appendChild(svgEl('text', { x: mx, y: y - 7, fill: col, 'font-size': 9.5, 'font-weight': 600, 'font-family': 'Geist,sans-serif', 'text-anchor': 'middle', 'dominant-baseline': 'central' })).textContent = label;
  });

  return svg;
}

/* ── DISPATCHER ────────────────────────── */
function renderSchema(cfg) {
  const t = (cfg.type || 'flowchart').toLowerCase();
  try {
    if (t === 'flowchart' || t === 'flow' || t === 'diagramme') return renderFlowchart(cfg);
    if (t === 'mindmap' || t === 'mind' || t === 'carte mentale') return renderMindmap(cfg);
    if (t === 'timeline' || t === 'chronologie') return renderTimeline(cfg);
    if (t === 'cycle' || t === 'processus') return renderCycle(cfg);
    if (t === 'architecture' || t === 'infra') return renderArchitecture(cfg);
    if (t === 'comparison' || t === 'comparaison' || t === 'tableau') return renderComparison(cfg);
    if (t === 'hierarchy' || t === 'hiérarchie' || t === 'organigramme' || t === 'org') return renderHierarchy(cfg);
    if (t === 'sequence' || t === 'séquence') return renderSequence(cfg);
    // Par défaut
    return renderFlowchart(cfg);
  } catch (err) {
    console.error('[WMSchema] renderError', err);
    return null;
  }
}

// ══════════════════════════════════════════
// PANEL INTERACTIONS
// ══════════════════════════════════════════
function resetView() {
  _scZoom = 1; _scPanX = 0; _scPanY = 0;
  applyTransform();
}

function applyTransform() {
  const wrap = document.getElementById('sc-canvas-wrap');
  if (!wrap) return;
  wrap.style.transform = `translate(${_scPanX}px, ${_scPanY}px) scale(${_scZoom})`;
  const zl = document.getElementById('sc-zoom-label');
  if (zl) zl.textContent = Math.round(_scZoom * 100) + '%';
}

function openPanel() {
  document.getElementById('sc-panel')?.classList.add('open');
  document.getElementById('sc-overlay')?.classList.add('open');
}

function closePanel() {
  document.getElementById('sc-panel')?.classList.remove('open');
  document.getElementById('sc-overlay')?.classList.remove('open');
}

function showSchema(idx) {
  const s = _scSchemas[idx];
  if (!s) return;
  _scActiveIdx = idx;

  const wrap = document.getElementById('sc-canvas-wrap');
  const empty = document.getElementById('sc-empty');
  if (!wrap) return;

  wrap.innerHTML = '';
  if (s.svg) {
    wrap.appendChild(s.svg.cloneNode(true));
    if (empty) empty.style.display = 'none';
  }

  resetView();
  renderSchemaList();
}

function renderSchemaList() {
  const list = document.getElementById('sc-list-section');
  if (!list || !_scSchemas.length) return;
  const label = list.querySelector('#sc-list-label');
  const items = _scSchemas.map((s, i) => `
    <div class="sc-list-item ${i === _scActiveIdx ? 'active' : ''}" data-idx="${i}">
      <div class="sc-list-item-dot"></div>
      <div class="sc-list-item-title">${escHtml(s.titre || 'Schéma ' + (i + 1))}</div>
      <div class="sc-list-item-type">${escHtml(s.type)}</div>
    </div>
  `).join('');
  list.innerHTML = (label?.outerHTML || '<div id="sc-list-label">Schémas générés</div>') + items;
  list.querySelectorAll('.sc-list-item').forEach(el => {
    el.addEventListener('click', () => showSchema(parseInt(el.dataset.idx)));
  });
}

// Export SVG / PNG
function exportSVG() {
  const s = _scSchemas[_scActiveIdx];
  if (!s) return;
  const svgStr = new XMLSerializer().serializeToString(s.svg);
  const blob = new Blob([svgStr], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url;
  a.download = `wikimind-schema-${Date.now()}.svg`; a.click();
  URL.revokeObjectURL(url);
  showExportToast('SVG exporté !');
}

function exportPNG() {
  const s = _scSchemas[_scActiveIdx];
  if (!s) return;
  const svgStr = new XMLSerializer().serializeToString(s.svg);
  const img = new Image();
  const blob = new Blob([svgStr], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = img.width * 2; canvas.height = img.height * 2;
    const ctx = canvas.getContext('2d');
    ctx.scale(2, 2);
    ctx.fillStyle = '#0d0d0f';
    ctx.fillRect(0, 0, img.width, img.height);
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);
    canvas.toBlob(b => {
      const a = document.createElement('a'); a.href = URL.createObjectURL(b);
      a.download = `wikimind-schema-${Date.now()}.png`; a.click();
    });
  };
  img.src = url;
  showExportToast('PNG exporté !');
}

function showExportToast(msg) {
  const t = document.getElementById('sc-export-toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

// ══════════════════════════════════════════
// INIT DU PANEL
// ══════════════════════════════════════════
function initPanel() {
  const body = document.getElementById('sc-body');
  if (!body) return;

  // Drag (pan)
  body.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    _scIsDragging = true;
    _scDragStartX = e.clientX; _scDragStartY = e.clientY;
    _scPanStartX = _scPanX; _scPanStartY = _scPanY;
    body.style.cursor = 'grabbing';
  });
  window.addEventListener('mousemove', e => {
    if (!_scIsDragging) return;
    _scPanX = _scPanStartX + (e.clientX - _scDragStartX);
    _scPanY = _scPanStartY + (e.clientY - _scDragStartY);
    applyTransform();
  });
  window.addEventListener('mouseup', () => {
    _scIsDragging = false;
    if (body) body.style.cursor = 'grab';
  });

  // Scroll zoom
  body.addEventListener('wheel', e => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    _scZoom = Math.min(4, Math.max(0.2, _scZoom * delta));
    applyTransform();
  }, { passive: false });

  // Touch pan/zoom
  let lastTouchDist = null;
  body.addEventListener('touchstart', e => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastTouchDist = Math.sqrt(dx*dx + dy*dy);
    }
  }, { passive: true });
  body.addEventListener('touchmove', e => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (lastTouchDist) { _scZoom = Math.min(4, Math.max(0.2, _scZoom * (dist / lastTouchDist))); applyTransform(); }
      lastTouchDist = dist;
    }
  }, { passive: true });

  // Boutons toolbar
  document.getElementById('sc-zoom-in')?.addEventListener('click', () => { _scZoom = Math.min(4, _scZoom * 1.2); applyTransform(); });
  document.getElementById('sc-zoom-out')?.addEventListener('click', () => { _scZoom = Math.max(0.2, _scZoom / 1.2); applyTransform(); });
  document.getElementById('sc-reset-view')?.addEventListener('click', resetView);
  document.getElementById('sc-export-svg')?.addEventListener('click', exportSVG);
  document.getElementById('sc-export-png')?.addEventListener('click', exportPNG);
  document.getElementById('sc-close-btn')?.addEventListener('click', closePanel);
  document.getElementById('sc-overlay')?.addEventListener('click', closePanel);
}

// ══════════════════════════════════════════
// INTÉGRATION CHAT — détection et rendu
// ══════════════════════════════════════════
function processSchemaBlocks(bubble) {
  if (!_scSchemaEnabled) return;
  const regex = /```schema\s*([\s\S]+?)```/gi;
  let match;
  while ((match = regex.exec(bubble.innerHTML || '')) !== null) { break; } // reset
  // On travaille sur le texte brut du contenu
  if (!bubble._scProcessed) {
    bubble._scProcessed = true;
    _tryRenderSchemasInBubble(bubble);
  }
}

function _tryRenderSchemasInBubble(bubble) {
  // Chercher les blocs code avec class language-schema ou balise pre>code.language-schema
  bubble.querySelectorAll('pre code.language-schema, code.language-schema').forEach(codeEl => {
    const raw = codeEl.textContent;
    const cfg = parseSchemaBlock(raw);
    const svgEl2 = renderSchema(cfg);
    if (!svgEl2) return;

    const schemaIdx = _scSchemas.length;
    _scSchemas.push({ titre: cfg.titre || ('Schéma ' + (schemaIdx + 1)), type: cfg.type || 'flowchart', svg: svgEl2, cfg });

    // Créer la preview inline
    const preview = document.createElement('div');
    preview.className = 'wm-schema-preview';
    const svgClone = svgEl2.cloneNode(true);
    preview.appendChild(svgClone);
    const bar = document.createElement('div');
    bar.className = 'wm-schema-preview-bar';
    bar.innerHTML = `<span class="wm-schema-preview-label">${cfg.type || 'flowchart'}</span><button class="wm-schema-preview-open">Ouvrir →</button>`;
    preview.appendChild(bar);

    preview.addEventListener('click', () => { openPanel(); showSchema(schemaIdx); });
    bar.querySelector('.wm-schema-preview-open')?.addEventListener('click', e => { e.stopPropagation(); openPanel(); showSchema(schemaIdx); });

    const pre = codeEl.closest('pre');
    if (pre) pre.parentNode?.replaceChild(preview, pre);
    else codeEl.parentNode?.replaceChild(preview, codeEl);

    if (_scActiveIdx === -1) { _scActiveIdx = schemaIdx; }
  });
}

// Patch sur renderContent pour capturer les blocs schema avant marked
function patchRenderContent() {
  if (!window.renderContent) return;
  const orig = window.renderContent;
  window.renderContent = function(text) {
    // Remplacer ```schema ... ``` par un bloc code language-schema que marked va convertir
    text = text.replace(/```schema\s*([\s\S]+?)```/gi, (_, block) => {
      return '```schema\n' + block.trim() + '\n```';
    });
    return orig.call(this, text);
  };
}

// Patch addCodeButtons pour détecter et rendre les schémas
function patchAddCodeButtons() {
  if (!window.addCodeButtons) return;
  const orig = window.addCodeButtons;
  window.addCodeButtons = function(bubble) {
    orig.call(this, bubble);
    if (_scSchemaEnabled && bubble) _tryRenderSchemasInBubble(bubble);
  };
}

// ══════════════════════════════════════════
// SYSTEM PROMPT INJECTION
// ══════════════════════════════════════════
function getSchemaSystemPrompt() {
  return `\n\n--- OUTIL SCHÉMAS WIKIMIND ---
Tu peux générer de magnifiques schémas SVG en utilisant des blocs \`\`\`schema.
Syntaxe générale :
\`\`\`schema
type: [flowchart|mindmap|timeline|cycle|architecture|comparaison|hiérarchie|sequence]
titre: Titre du schéma
node: id:Label:shape:colorIndex   (shape: rect|round|diamond|cylinder|pill|parallelogram)
edge: fromId:toId:Label:solid|dashed
item: Label:parentLabel:detail   (mindmap/hierarchy)
step: Label:detail:colorIndex    (timeline/cycle)
col: Titre:item1|item2|item3     (comparaison)
\`\`\`

Exemples de types disponibles :
- flowchart / diagramme : organigrammes, processus métier
- mindmap / carte mentale : brainstorming, concepts
- timeline / chronologie : historique, planning
- cycle / processus : cycles récurrents (PDCA, Agile...)
- architecture / infra : systèmes techniques
- comparaison / tableau : VS, pros/cons
- hiérarchie / organigramme : organigrammes
- sequence / séquence : interactions entre acteurs

Génère automatiquement un schéma SVG quand l'utilisateur demande de visualiser, schématiser, représenter, créer un diagramme, une carte mentale, un organigramme, une chronologie, une comparaison, etc.
Choisis le type le plus adapté à la demande. Utilise des nœuds et connexions pertinents.
--- FIN OUTIL SCHÉMAS ---`;
}

// Patch buildSystemPrompt
function patchSystemPrompt() {
  if (!window.buildSystemPrompt && !window.getSystemPrompt) return;
  // Les system prompts sont construits inline dans doStream, on expose la function
  window._wmSchemaSystemPrompt = getSchemaSystemPrompt;
}

// ══════════════════════════════════════════
// TOGGLE TOOL
// ══════════════════════════════════════════
function setSchemaEnabled(val) {
  _scSchemaEnabled = val;
  window._scSchemaEnabled = val;
  // Persist
  try { localStorage.setItem('wm_tool_schema', val ? '1' : '0'); } catch {}
  updateBadge();
}

function updateBadge() {
  const badge = document.getElementById('pm-outils-badge');
  if (!badge) return;
  // Compter les outils actifs
  const tools = ['wm_tool_schema'];
  const activeCount = tools.filter(k => { try { return localStorage.getItem(k) === '1'; } catch { return false; } }).length;
  badge.style.display = activeCount > 0 ? 'flex' : 'none';
}

// ══════════════════════════════════════════
// INJECTION HTML DU PANEL (si pas déjà dans index.html)
// ══════════════════════════════════════════
function injectPanelHTML() {
  if (document.getElementById('sc-panel')) return; // Déjà injecté

  const overlay = document.createElement('div');
  overlay.id = 'sc-overlay';
  document.body.appendChild(overlay);

  const panel = document.createElement('div');
  panel.id = 'sc-panel';
  panel.innerHTML = `
    <div id="sc-head">
      <div id="sc-head-icon">
        <img src="schema.png" alt="Schemas" onerror="this.style.display='none';this.parentNode.innerHTML='<svg width=&quot;18&quot; height=&quot;18&quot; viewBox=&quot;0 0 24 24&quot; fill=&quot;none&quot; stroke=&quot;#818cf8&quot; stroke-width=&quot;2&quot;><rect x=&quot;3&quot; y=&quot;3&quot; width=&quot;6&quot; height=&quot;6&quot; rx=&quot;2&quot;/><rect x=&quot;15&quot; y=&quot;3&quot; width=&quot;6&quot; height=&quot;6&quot; rx=&quot;2&quot;/><rect x=&quot;9&quot; y=&quot;15&quot; width=&quot;6&quot; height=&quot;6&quot; rx=&quot;2&quot;/><line x1=&quot;6&quot; y1=&quot;9&quot; x2=&quot;12&quot; y2=&quot;15&quot;/><line x1=&quot;18&quot; y1=&quot;9&quot; x2=&quot;12&quot; y2=&quot;15&quot;/></svg>'">
      </div>
      <div id="sc-head-title">
        <h2>Schémas</h2>
        <p>Visualisations IA · ${_scSchemas.length} schéma${_scSchemas.length !== 1 ? 's' : ''}</p>
      </div>
      <button id="sc-close-btn" title="Fermer">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
    <div id="sc-toolbar">
      <button class="sc-tb-btn" id="sc-zoom-in" title="Zoom +">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
      </button>
      <button class="sc-tb-btn" id="sc-zoom-out" title="Zoom -">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
      </button>
      <button class="sc-tb-btn" id="sc-reset-view" title="Réinitialiser la vue">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
      </button>
      <span id="sc-zoom-label">100%</span>
      <div id="sc-toolbar-right">
        <button class="sc-tb-btn primary" id="sc-export-png" title="Exporter PNG">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          PNG
        </button>
        <button class="sc-tb-btn" id="sc-export-svg" title="Exporter SVG">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          SVG
        </button>
      </div>
    </div>
    <div id="sc-body">
      <div id="sc-canvas-wrap"></div>
      <div id="sc-empty">
        <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
          <rect x="3" y="3" width="6" height="6" rx="1.5"/><rect x="15" y="3" width="6" height="6" rx="1.5"/>
          <rect x="9" y="15" width="6" height="6" rx="1.5"/>
          <line x1="6" y1="9" x2="12" y2="15"/><line x1="18" y1="9" x2="12" y2="15"/>
        </svg>
        <div id="sc-empty-title">Aucun schéma pour l'instant</div>
        <div id="sc-empty-sub">Demande à Wikimind de créer un diagramme,<br>une carte mentale, une timeline…</div>
      </div>
      <div id="sc-export-toast"></div>
    </div>
    <div id="sc-list-section">
      <div id="sc-list-label">Schémas générés</div>
    </div>
  `;
  document.body.appendChild(panel);
}

// ══════════════════════════════════════════
// INJECTION DU TOGGLE DANS LE MENU OUTILS
// ══════════════════════════════════════════
function injectToolToggle() {
  // Cherche le sous-panel outils
  const outilsSub = document.getElementById('pm-outils-sub');
  if (!outilsSub) {
    // Réessayer plus tard
    setTimeout(injectToolToggle, 600);
    return;
  }
  if (outilsSub.querySelector('[data-tool="schema"]')) return;

  const enabled = (() => { try { return localStorage.getItem('wm_tool_schema') === '1'; } catch { return false; } })();
  _scSchemaEnabled = enabled;
  window._scSchemaEnabled = enabled;

  const item = document.createElement('div');
  item.className = 'pm-item';
  item.dataset.tool = 'schema';
  item.style.cssText = 'display:flex;align-items:center;gap:12px;cursor:pointer;padding:8px 14px;border-radius:8px;font-size:0.85rem;color:var(--text2);transition:background 0.1s;';
  item.innerHTML = `
    <img src="schema.png" alt="Schemas" width="18" height="18" style="border-radius:4px;object-fit:contain;flex-shrink:0;"
      onerror="this.outerHTML='<svg width=&quot;16&quot; height=&quot;16&quot; viewBox=&quot;0 0 24 24&quot; fill=&quot;none&quot; stroke=&quot;currentColor&quot; stroke-width=&quot;2&quot; style=&quot;flex-shrink:0&quot;><rect x=&quot;3&quot; y=&quot;3&quot; width=&quot;6&quot; height=&quot;6&quot; rx=&quot;1.5&quot;/><rect x=&quot;15&quot; y=&quot;3&quot; width=&quot;6&quot; height=&quot;6&quot; rx=&quot;1.5&quot;/><rect x=&quot;9&quot; y=&quot;15&quot; width=&quot;6&quot; height=&quot;6&quot; rx=&quot;1.5&quot;/><line x1=&quot;6&quot; y1=&quot;9&quot; x2=&quot;12&quot; y2=&quot;15&quot;/><line x1=&quot;18&quot; y1=&quot;9&quot; x2=&quot;12&quot; y2=&quot;15&quot;/></svg>'">
    <span style="flex:1">Schémas</span>
    <div class="sc-tool-toggle ${enabled ? 'on' : ''}" id="sc-tool-toggle-btn"
      style="width:32px;height:18px;border-radius:9px;background:${enabled ? '#6366f1' : 'rgba(255,255,255,0.12)'};border:1px solid ${enabled ? '#6366f1' : 'rgba(255,255,255,0.15)'};position:relative;transition:all 0.2s;flex-shrink:0;">
      <div style="position:absolute;top:2px;left:${enabled ? '14px' : '2px'};width:12px;height:12px;border-radius:50%;background:#fff;transition:left 0.2s;box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div>
    </div>
  `;

  item.addEventListener('click', e => {
    e.stopPropagation();
    const newVal = !_scSchemaEnabled;
    setSchemaEnabled(newVal);
    const toggle = item.querySelector('.sc-tool-toggle');
    const knob = toggle.querySelector('div');
    toggle.style.background = newVal ? '#6366f1' : 'rgba(255,255,255,0.12)';
    toggle.style.borderColor = newVal ? '#6366f1' : 'rgba(255,255,255,0.15)';
    knob.style.left = newVal ? '14px' : '2px';
    if (typeof window.toast === 'function') window.toast(newVal ? 'Schémas activés ✦' : 'Schémas désactivés');
  });

  outilsSub.appendChild(item);
  updateBadge();
}

// Injection du prompt schéma dans le system prompt de doStream
function patchDoStream() {
  if (!window.doStream) {
    setTimeout(patchDoStream, 800);
    return;
  }
  // On ne rewrite pas doStream, on expose la prompt via window
  window._wmSchemaSystemPrompt = getSchemaSystemPrompt;
  // Surveille _scSchemaEnabled pour l'injecter dans le prochain system prompt
  // La vraie injection se fait via hook sur le system prompt (voir patchSystemPromptInjection)
}

// ══════════════════════════════════════════
// ESCAPE HTML
// ══════════════════════════════════════════
function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ══════════════════════════════════════════
// INIT
// ══════════════════════════════════════════
function init() {
  injectPanelHTML();
  initPanel();
  patchAddCodeButtons();
  patchDoStream();

  // Lire l'état sauvegardé
  try {
    const saved = localStorage.getItem('wm_tool_schema');
    if (saved === '1') { _scSchemaEnabled = true; window._scSchemaEnabled = true; }
  } catch {}

  injectToolToggle();

  // Exposer les APIs publiques
  window.SchemaEngine = {
    openPanel,
    closePanel,
    showSchema,
    addSchema(cfg) {
      const svg = renderSchema(cfg);
      if (!svg) return null;
      const idx = _scSchemas.length;
      _scSchemas.push({ titre: cfg.titre || ('Schéma ' + (idx + 1)), type: cfg.type || 'flowchart', svg, cfg });
      renderSchemaList();
      if (_scActiveIdx === -1) showSchema(idx);
      return idx;
    },
    isEnabled: () => _scSchemaEnabled,
    setEnabled: setSchemaEnabled,
    getSchemaSystemPrompt,
    parseBlock: parseSchemaBlock,
    render: renderSchema,
  };

  console.log('[WikiMind] Schema Engine chargé ✦');
}

// DOMContentLoaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

})(); // IIFE
