document$.subscribe(function () {
  var root = document.querySelector(
    ".md-sidebar--primary .md-nav--primary > .md-nav__list"
  );
  if (!root || root.dataset.sortInit) return;
  root.dataset.sortInit = "1";

  var KEY = "wiki-menu-v2";
  var state;
  try { state = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { state = {}; }
  state.customGroups = state.customGroups || [];
  state.names = state.names || {};

  function label(li) {
    if (li.dataset.id) return li.dataset.id;
    var el = li.querySelector(":scope > a, :scope > label");
    return el ? el.textContent.trim() : "";
  }
  function subList(li) {
    return li.querySelector(":scope > nav > ul");
  }

  function save() {
    var layout = { root: [], groups: {} };
    Array.from(root.children).forEach(function (li) {
      layout.root.push(label(li));
      var ul = subList(li);
      if (ul) layout.groups[label(li)] = Array.from(ul.children).map(label);
    });
    state.layout = layout;
    localStorage.setItem(KEY, JSON.stringify(state));
  }

  var groupsEl = {};
  var pages = {};

  function initGroup(li) {
    var ul = subList(li);
    if (!ul) return;
    new Sortable(ul, {
      group: {
        name: "menu",
        put: function (to, from, el) {
          return !el.classList.contains("md-nav__item--section");
        }
      },
      animation: 150,
      fallbackOnBody: true,
      swapThreshold: 0.65,
      onEnd: save
    });
  }

  function makeGroup(name) {
    var li = document.createElement("li");
    li.className = "md-nav__item md-nav__item--section md-nav__item--nested wiki-custom";
    li.dataset.id = name;

    var lab = document.createElement("label");
    lab.className = "md-nav__link";
    lab.setAttribute("for", "__wiki_" + Date.now());
    var span = document.createElement("span");
    span.className = "md-ellipsis";
    span.textContent = name;
    lab.appendChild(span);

    var nav = document.createElement("nav");
    nav.className = "md-nav";
    nav.setAttribute("data-md-level", "1");
    var ul = document.createElement("ul");
    ul.className = "md-nav__list";
    nav.appendChild(ul);

    var del = document.createElement("button");
    del.className = "wiki-del";
    del.type = "button";
    del.title = "Supprimer le groupe";
    del.textContent = "✕";
    del.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      var shown = span.textContent;
      if (!confirm('Supprimer le groupe "' + shown + '" ? Les pages reviennent à la racine.')) return;
      Array.from(ul.children).forEach(function (c) { root.appendChild(c); });
      state.customGroups = state.customGroups.filter(function (n) { return n !== name; });
      delete state.names[name];
      delete groupsEl[name];
      li.remove();
      save();
    });

    li.appendChild(lab);
    li.appendChild(del);
    li.appendChild(nav);
    return li;
  }

  state.customGroups.forEach(function (name) {
    root.appendChild(makeGroup(name));
  });

  Array.from(root.children).forEach(function (li) {
    if (li.classList.contains("md-nav__item--section")) {
      if (!li.dataset.id) {
        var l = li.querySelector(":scope > label, :scope > a");
        li.dataset.id = l ? l.textContent.trim() : "";
      }
      groupsEl[li.dataset.id] = li;
    }
  });
  root.querySelectorAll("li.md-nav__item").forEach(function (li) {
    if (!li.querySelector(":scope > nav")) pages[label(li)] = li;
  });

  Object.keys(groupsEl).forEach(function (id) {
    var lab = groupsEl[id].querySelector(":scope > label");
    if (!lab) return;
    lab.title = "Double-clic pour renommer";
    var span = lab.querySelector(".md-ellipsis");
    if (span && state.names[id]) span.textContent = state.names[id];
  });

  if (state.layout) {
    Object.keys(state.layout.groups).forEach(function (g) {
      var el = groupsEl[g];
      if (!el) return;
      var ul = subList(el);
      state.layout.groups[g].forEach(function (n) {
        if (pages[n]) ul.appendChild(pages[n]);
      });
    });
    state.layout.root.forEach(function (n) {
      var el = pages[n] || groupsEl[n];
      if (el) root.appendChild(el);
    });
  }

  function startRename(li) {
    var lab = li.querySelector(":scope > label");
    if (!lab || lab.querySelector("input")) return;
    var span = lab.querySelector(".md-ellipsis");
    if (!span) return;
    var id = label(li);
    var current = span.textContent;

    var input = document.createElement("input");
    input.type = "text";
    input.className = "wiki-edit";
    input.value = current;
    span.style.display = "none";
    lab.appendChild(input);
    input.focus();
    input.select();

    var done = false;
    function finish(ok) {
      if (done) return;
      done = true;
      var val = input.value.trim();
      input.remove();
      span.style.display = "";
      if (ok && val && val !== current) {
        span.textContent = val;
        if (val === id) delete state.names[id];
        else state.names[id] = val;
        save();
      }
    }
    input.addEventListener("keydown", function (e) {
      e.stopPropagation();
      if (e.key === "Enter") finish(true);
      else if (e.key === "Escape") finish(false);
    });
    input.addEventListener("blur", function () { finish(true); });
    input.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
    });
  }

  root.addEventListener("dblclick", function (e) {
    var lab = e.target.closest("label.md-nav__link");
    if (!lab) return;
    var li = lab.parentElement;
    if (!li || !li.classList.contains("md-nav__item--section")) return;
    e.preventDefault();
    startRename(li);
  });

  new Sortable(root, {
    group: "menu",
    animation: 150,
    fallbackOnBody: true,
    swapThreshold: 0.65,
    filter: ".wiki-del, .wiki-edit",
    preventOnFilter: false,
    onEnd: save
  });
  Object.keys(groupsEl).forEach(function (g) { initGroup(groupsEl[g]); });

  var old = document.querySelector(".wiki-tools");
  if (old) old.remove();
  var tools = document.createElement("div");
  tools.className = "wiki-tools";

  var add = document.createElement("button");
  add.type = "button";
  add.textContent = "+ Nouveau groupe";
  add.addEventListener("click", function () {
    var name = (prompt("Nom du groupe :") || "").trim();
    if (!name || groupsEl[name] || pages[name]) return;
    state.customGroups.push(name);
    var li = makeGroup(name);
    root.appendChild(li);
    groupsEl[name] = li;
    li.querySelector(":scope > label").title = "Double-clic pour renommer";
    initGroup(li);
    save();
  });

  tools.appendChild(add);
  root.parentNode.appendChild(tools);
});

/* Croix de la recherche : vider sans rouvrir la barre */
document$.subscribe(function () {
  var input = document.querySelector(".md-search__input");
  var toggle = document.querySelector("[data-md-toggle=search]");
  var reset = document.querySelector(".md-search__options button[type=reset]");
  if (!input || !reset || reset.dataset.clearInit) return;
  reset.dataset.clearInit = "1";

  reset.addEventListener("click", function (e) {
    e.preventDefault();
    e.stopImmediatePropagation();
    input.value = "";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.blur();
    if (toggle && toggle.checked) {
      toggle.checked = false;
      toggle.dispatchEvent(new Event("change"));
    }
  }, true);
});