// Page-level geometry rules for the story steps (owner 2026-11-10: "新做的这些界面统统检查一下").
// `pageRules(spec)` runs inside the page (Playwright evaluate), so it must stay self-contained.
// spec: {
//   root:   the step's content element (first visible match),
//   edges:  selectors whose visible ink must start at one x (title, toolbar, grid),
//   cards:  selector for cards: one visual row shares top and height, gaps are even,
//   panel:  'none' (the shot panel must be closed) or 'fit' (open, nothing sideways),
//   need:   selectors that must be visible and inside the window (next step, Inky),
// }
// Every rule returns plain sentences; an empty list means the screen passes.
export function pageRules(spec) {
  const out = [];
  const vw = document.documentElement.clientWidth;
  const shown = (el) => {
    if (!el || !el.getClientRects().length) return false;
    const s = getComputedStyle(el);
    if (s.visibility === 'hidden' || Number(s.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width >= 1 && r.height >= 1;
  };
  const silent = (el) => el.closest('[aria-hidden="true"], .sr-only, .visually-hidden, a.skip');
  const first = (sel) => [...document.querySelectorAll(sel)].find(shown) || null;
  const label = (el) => {
    const text = (el.innerText || el.getAttribute('aria-label') || el.getAttribute('title') || '')
      .trim()
      .replace(/\s+/g, ' ');
    const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/)[0] : '';
    return `${el.tagName.toLowerCase()}${cls ? '.' + cls : ''} "${text.slice(0, 24)}"`;
  };
  const px = (n) => `${Math.round(n * 10) / 10}px`;
  // Menus, dialogs and popovers sit above the page on purpose; compare things within one layer.
  const layerOf = (el) =>
    el.closest('dialog, [role="dialog"], [role="menu"], [role="listbox"], [popover], .sb-portal') ||
    document.body;
  const scrollsX = (el) => /(auto|scroll)/.test(getComputedStyle(el).overflowX);
  const inScrollerX = (el, stop) => {
    for (let p = el.parentElement; p && p !== stop && p !== document.body; p = p.parentElement)
      if (scrollsX(p) && p.scrollWidth > p.clientWidth + 1) return true;
    return false;
  };
  // Where an element's visible ink starts: its own box when it draws one (border, background,
  // picture), otherwise its first visible text or child. Padding alone draws nothing.
  const draws = (el) => {
    const s = getComputedStyle(el);
    return (
      /^(IMG|VIDEO|CANVAS|SVG|BUTTON)$/i.test(el.tagName) ||
      (parseFloat(s.borderLeftWidth) > 0 &&
        !/transparent|rgba\(.*, 0\)$/.test(s.borderLeftColor)) ||
      !/transparent|rgba\(.*, 0\)$/.test(s.backgroundColor) ||
      s.backgroundImage !== 'none' ||
      s.boxShadow !== 'none'
    );
  };
  // The part of a box its clipping ancestors actually show (an ellipsis line, a clipped strip).
  const visible = (el, r) => {
    let { left, right, top, bottom } = r;
    for (let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement) {
      const s = getComputedStyle(p);
      if (s.overflowX === 'visible' && s.overflowY === 'visible') continue;
      const pr = p.getBoundingClientRect();
      const pl = pr.left + p.clientLeft,
        pt = pr.top + p.clientTop;
      if (s.overflowX !== 'visible') {
        left = Math.max(left, pl);
        right = Math.min(right, pl + p.clientWidth);
      }
      if (s.overflowY !== 'visible') {
        top = Math.max(top, pt);
        bottom = Math.min(bottom, pt + p.clientHeight);
      }
    }
    return right - left > 0 && bottom - top > 0 ? { left, right, top, bottom } : null;
  };
  const inkLeft = (el) => {
    if (draws(el)) return el.getBoundingClientRect().left;
    // A bare text field shows its words where its padding ends.
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) {
      const s = getComputedStyle(el);
      return (
        el.getBoundingClientRect().left + parseFloat(s.paddingLeft) + parseFloat(s.borderLeftWidth)
      );
    }
    let left = Infinity;
    for (const node of el.childNodes) {
      if (node.nodeType === 3 && node.textContent.trim()) {
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const r of range.getClientRects()) if (r.width > 0) left = Math.min(left, r.left);
      } else if (node.nodeType === 1 && shown(node) && !silent(node))
        left = Math.min(left, inkLeft(node));
    }
    return left;
  };

  const root = first(spec.root);
  if (!root) return [`${spec.root} not found`];
  const rootRect = root.getBoundingClientRect();

  // 1. One left content edge: title, toolbar and grid start at the same x.
  let contentLeft = rootRect.left + parseFloat(getComputedStyle(root).paddingLeft);
  if (spec.edges?.length) {
    const lefts = [];
    for (const sel of spec.edges) {
      const el = first(sel);
      if (!el) {
        out.push(`edge: ${sel} not found`);
        continue;
      }
      lefts.push([sel, inkLeft(el)]);
    }
    if (lefts.length) {
      contentLeft = Math.min(...lefts.map(([, x]) => x));
      for (const [sel, x] of lefts)
        if (x - contentLeft > 1)
          out.push(
            `left edge: ${sel} starts at ${px(x)}, ${px(x - contentLeft)} right of the page edge ${px(contentLeft)}`,
          );
    }
  }

  // 2. Nothing clipped by the window or its container; nothing starts left of the content edge.
  const bar = first('header.wbar');
  const scopes = [root, ...(bar ? [bar] : [])];
  const targets = new Set();
  const CONTROL = 'button, a[href], input:not([type="hidden"]), select, textarea, [role="tab"]';
  for (const scope of scopes)
    for (const el of [scope, ...scope.querySelectorAll('*')]) {
      if (!shown(el) || silent(el)) continue;
      const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (ownText || el.matches(CONTROL)) targets.add(el);
    }
  // One line per kind of cut (container and element class), with a count and one example.
  const cuts = new Map();
  const tag = (el) => label(el).split(' ')[0];
  const cut = (kind, el, detail) => {
    const key = `${kind} ${tag(el)}`;
    const seen = cuts.get(key);
    if (seen) seen.n++;
    else cuts.set(key, { n: 1, text: `${kind}: ${label(el)} ${detail}` });
  };
  for (const el of targets) {
    const r = el.getBoundingClientRect();
    if (getComputedStyle(el).position !== 'fixed' && (r.left < -0.5 || r.right > vw + 0.5)) {
      cut('cut by the window', el, `spans ${px(r.left)}..${px(r.right)}`);
      continue;
    }
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const s = getComputedStyle(p);
      if (s.overflowX === 'visible' && s.overflowY === 'visible') continue;
      const pr = p.getBoundingClientRect();
      const left = pr.left + p.clientLeft,
        right = left + p.clientWidth,
        top = pr.top + p.clientTop,
        bottom = top + p.clientHeight;
      const hiddenX = /(hidden|clip)/.test(s.overflowX),
        hiddenY = /(hidden|clip)/.test(s.overflowY);
      // An ellipsis cuts its own text on purpose; a box cut by its container does not.
      const ellipsis = s.textOverflow === 'ellipsis' && /inline/.test(getComputedStyle(el).display);
      // Inline text an ellipsis shortens is accounted for there; outer boxes do not cut it again.
      if (ellipsis && (r.left < left - 1 || r.right > right + 1)) break;
      if (hiddenX && (r.left < left - 1 || r.right > right + 1)) {
        cut(
          `cut by ${tag(p)}`,
          el,
          `spans ${px(r.left)}..${px(r.right)}, container ${px(left)}..${px(right)}`,
        );
        break;
      }
      if (hiddenY && (r.top < top - 1 || r.bottom > bottom + 1)) {
        cut(
          `cut by ${tag(p)}`,
          el,
          `spans ${px(r.top)}..${px(r.bottom)} high, container ${px(top)}..${px(bottom)}`,
        );
        break;
      }
      // A scroller can never show what sits left of its start.
      if (scrollsX(p) && p.scrollLeft === 0 && r.left < left - 1) {
        cut(`out of reach left of ${tag(p)}`, el, `starts ${px(left - r.left)} before it`);
        break;
      }
    }
    if (root.contains(el) && !inScrollerX(el, root) && layerOf(el) === document.body) {
      const ink = inkLeft(el);
      if (ink < contentLeft - 1)
        cut('left of the content edge', el, `starts at ${px(ink)}, edge ${px(contentLeft)}`);
    }
  }
  for (const { n, text } of cuts.values())
    out.push(n > 1 ? `${text} (and ${n - 1} more like it)` : text);

  // 3. No overlap: interactive elements, and text with text (within one layer).
  const interactive = [
    ...targets,
    ...root.querySelectorAll('[tabindex="0"], [role="button"]'),
  ].filter(
    (el, i, all) =>
      all.indexOf(el) === i &&
      shown(el) &&
      el.matches(`${CONTROL}, [tabindex="0"], [role="button"]`) &&
      !el.disabled,
  );
  const hit = (a, b, tol) =>
    Math.min(a.right, b.right) - Math.max(a.left, b.left) > tol &&
    Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > tol;
  const boxes = interactive
    .map((el) => [el, visible(el, el.getBoundingClientRect()), layerOf(el)])
    .filter(([, r]) => r);
  const overlaps = new Set();
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++) {
      const [a, ra, la] = boxes[i],
        [b, rb, lb] = boxes[j];
      if (la !== lb || a.contains(b) || b.contains(a)) continue;
      if (hit(ra, rb, 1)) overlaps.add(`controls overlap: ${label(a)} and ${label(b)}`);
    }
  const texts = [];
  for (const scope of scopes) {
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const el = node.parentElement;
      if (!node.textContent.trim() || !el || !shown(el) || silent(el)) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const r of range.getClientRects()) {
        const seen = r.width > 0 && r.height > 0 && visible(node, r);
        if (seen) texts.push([el, seen, layerOf(el)]);
      }
    }
  }
  for (let i = 0; i < texts.length && overlaps.size < 40; i++)
    for (let j = i + 1; j < texts.length; j++) {
      const [a, ra, la] = texts[i],
        [b, rb, lb] = texts[j];
      if (a === b || la !== lb) continue;
      if (hit(ra, rb, 2)) overlaps.add(`text overlaps text: ${label(a)} and ${label(b)}`);
    }
  out.push(...overlaps);

  // 4. Cards in one visual row share top and height; gutters are even; no stretched cards.
  if (spec.cards) {
    const cards = [...root.querySelectorAll(spec.cards)].filter(shown);
    const rects = cards
      .map((el) => [el, el.getBoundingClientRect()])
      .sort((a, b) => a[1].top - b[1].top);
    const rows = [];
    for (const item of rects) {
      const row = rows.find((x) => item[1].top < x.bottom - 1 && item[1].bottom > x.top + 1);
      if (row) {
        row.items.push(item);
        row.bottom = Math.max(row.bottom, item[1].bottom);
      } else rows.push({ top: item[1].top, bottom: item[1].bottom, items: [item] });
    }
    rows.forEach((row, n) => {
      const [, r0] = row.items[0];
      for (const [el, r] of row.items.slice(1)) {
        if (Math.abs(r.top - r0.top) > 1)
          out.push(`row ${n + 1}: ${label(el)} starts ${px(r.top - r0.top)} below the row top`);
        else if (Math.abs(r.height - r0.height) > 1)
          out.push(`row ${n + 1}: ${label(el)} is ${px(r.height)} high, the row ${px(r0.height)}`);
      }
    });
    // A card stretched to its neighbours' height shows a band of nothing at its foot.
    for (const [el, r] of rects) {
      let bottom = r.top;
      for (const child of el.querySelectorAll('*'))
        if (shown(child) && !silent(child))
          bottom = Math.max(bottom, child.getBoundingClientRect().bottom);
      const gap = r.bottom - parseFloat(getComputedStyle(el).paddingBottom) - bottom;
      if (gap > 24)
        out.push(`stretched card: ${label(el)} has ${px(gap)} of empty space at its foot`);
    }
    // Gutters, per grid (a group band is its own): every gap between neighbours in a row, and
    // between rows, is one size.
    const groups = new Map();
    for (const [el, r] of rects) {
      const grid = el.parentElement;
      if (!groups.has(grid)) groups.set(grid, []);
      groups.get(grid).push(r);
    }
    for (const [grid, list] of groups) {
      const across = [],
        down = [];
      for (const a of list) {
        const right = list
          .filter(
            (b) =>
              b !== a &&
              b.left >= a.right - 1 &&
              hit({ ...b.toJSON(), left: a.left, right: a.right + 1e4 }, a, 1),
          )
          .sort((x, y) => x.left - y.left)[0];
        if (right) across.push(right.left - a.right);
        const below = list
          .filter(
            (b) =>
              b !== a &&
              b.top >= a.bottom - 1 &&
              Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1,
          )
          .sort((x, y) => x.top - y.top)[0];
        if (below) down.push(below.top - a.bottom);
      }
      const spread = (xs) => (xs.length ? Math.max(...xs) - Math.min(...xs) : 0);
      if (spread(across) > 1)
        out.push(
          `uneven gutters in ${label(grid)}: across ${[...new Set(across.map(Math.round))].join('/')}px`,
        );
      if (spread(down) > 1)
        out.push(
          `uneven gutters in ${label(grid)}: down ${[...new Set(down.map(Math.round))].join('/')}px`,
        );
      if (across.length && down.length && Math.abs(Math.min(...across) - Math.min(...down)) > 1)
        out.push(
          `gutters differ in ${label(grid)}: ${Math.round(Math.min(...across))}px across, ${Math.round(Math.min(...down))}px down`,
        );
    }
  }

  // 5. No orphaned floating controls: a row of only buttons sits next to what it acts on.
  const contentRects = [];
  for (const el of root.querySelectorAll('*')) {
    if (!shown(el) || silent(el)) continue;
    const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (
      ownText ||
      /^(IMG|VIDEO|CANVAS|INPUT|SELECT|TEXTAREA)$/.test(el.tagName) ||
      (spec.cards && el.matches(spec.cards))
    )
      contentRects.push([el, el.getBoundingClientRect()]);
  }
  for (const row of root.querySelectorAll('*')) {
    if (!shown(row) || row.matches(CONTROL) || layerOf(row) !== document.body) continue;
    if (spec.cards && row.closest(spec.cards)) continue;
    // A row: every visible child is a button, or a wrapper holding only buttons.
    const kids = [...row.children].filter(shown);
    const onlyButtons = (k) =>
      k.matches('button') ||
      (!!k.querySelector('button') &&
        ![...k.querySelectorAll('*')].some(
          (d) =>
            shown(d) &&
            !d.closest('button') &&
            [...d.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()),
        ) &&
        ![...k.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()));
    if (!kids.length || !kids.every(onlyButtons)) continue;
    // Report the outermost such row only.
    if (
      row.parentElement !== root &&
      [...row.parentElement.children].filter(shown).every(onlyButtons)
    )
      continue;
    const buttons = kids.flatMap((k) =>
      k.matches('button') ? [k] : [...k.querySelectorAll('button')].filter(shown),
    );
    const span = buttons.map((b) => b.getBoundingClientRect());
    const box = {
      left: Math.min(...span.map((r) => r.left)),
      right: Math.max(...span.map((r) => r.right)),
      top: Math.min(...span.map((r) => r.top)),
      bottom: Math.max(...span.map((r) => r.bottom)),
    };
    const near = contentRects.filter(([el]) => !row.contains(el) && !el.contains(row));
    const sameLine = near.some(([, r]) => r.top < box.bottom - 1 && r.bottom > box.top + 1);
    const above = near
      .filter(
        ([, r]) =>
          r.bottom <= box.top + 1 && Math.min(r.right, box.right) - Math.max(r.left, box.left) > 0,
      )
      .map(([, r]) => box.top - r.bottom);
    if (!sameLine && above.length && Math.min(...above) > 64)
      out.push(
        `floating controls: ${label(row)} sits ${px(Math.min(...above))} below the nearest content above it`,
      );
  }

  // 6. Panels: the shot panel belongs to the storyboard only; when open, it fits.
  const drawer = first('aside.drawer');
  if (spec.panel === 'none' && drawer)
    out.push(`shot panel is open on this step (${label(drawer)})`);
  if (spec.panel === 'fit') {
    if (!drawer) out.push('shot panel is not open');
    else {
      const r = drawer.getBoundingClientRect();
      if (r.left < -0.5 || r.right > vw + 0.5)
        out.push(`shot panel spans ${px(r.left)}..${px(r.right)}, outside the window`);
      for (const el of [drawer, ...drawer.querySelectorAll('*')]) {
        if (!shown(el) || !scrollsX(el)) continue;
        if (el.scrollWidth > el.clientWidth + 1 && !el.matches(spec.sideways || ':not(*)'))
          out.push(
            `shot panel scrolls sideways: ${label(el)} by ${el.scrollWidth - el.clientWidth}px`,
          );
      }
    }
  }

  // 7. Things every step must show, inside the window.
  for (const sel of spec.need || []) {
    const el = first(sel);
    if (!el) out.push(`missing: ${sel}`);
    else {
      const r = el.getBoundingClientRect();
      if (r.left < -0.5 || r.right > vw + 0.5) out.push(`${sel} is outside the window`);
    }
  }
  return [...new Set(out)];
}

// Boxes that must not move when pictures load late or fail (layout-stability rule).
export function mediaBoxes(selector) {
  return [...document.querySelectorAll(selector)]
    .filter((el) => el.getClientRects().length)
    .map((el) => {
      const r = el.getBoundingClientRect();
      const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/)[0] : '';
      return {
        key: `${el.tagName.toLowerCase()}${cls ? '.' + cls : ''}`,
        x: r.left,
        y: r.top,
        w: r.width,
        h: r.height,
      };
    });
}
