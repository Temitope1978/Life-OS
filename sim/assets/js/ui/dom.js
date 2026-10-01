/* ============================================================
   DOM helpers — tiny hyperscript, no framework
   ============================================================ */
(function () {
  'use strict';

  function el(tag, attrs, children) {
    var parts = tag.split(/([#.])/);
    var node = document.createElement(parts[0] || 'div');
    for (var i = 1; i < parts.length; i += 2) {
      if (parts[i] === '.') {
        String(parts[i + 1]).split(/\s+/).forEach(function (cls) {
          if (cls) node.classList.add(cls);
        });
      } else if (parts[i + 1]) {
        node.id = parts[i + 1];
      }
    }
    /* el('div', [child]) — second argument may actually be children */
    if (attrs instanceof Node || Array.isArray(attrs) || typeof attrs === 'string' || typeof attrs === 'number') {
      children = attrs;
      attrs = null;
    }
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === 'class') node.className += (node.className ? ' ' : '') + v;
        else if (k === 'html') node.innerHTML = v;
        else if (k === 'text') node.textContent = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') {
          node.addEventListener(k.slice(2).toLowerCase(), v);
        } else node.setAttribute(k, v === true ? '' : v);
      });
    }
    append(node, children);
    return node;
  }

  function append(node, children) {
    if (children === null || children === undefined || children === false || children === true) return node;
    if (Array.isArray(children)) { children.forEach(function (c) { append(node, c); }); return node; }
    if (children instanceof Node) { node.appendChild(children); return node; }
    node.appendChild(document.createTextNode(String(children)));
    return node;
  }

  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  function on(node, ev, sel, fn) {
    node.addEventListener(ev, function (e) {
      var t = e.target.closest(sel);
      if (t && node.contains(t)) fn(e, t);
    });
  }

  window.$ = { el: el, append: append, esc: esc, clear: clear, on: on };
})();