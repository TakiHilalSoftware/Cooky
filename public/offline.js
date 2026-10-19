// The offline page's script (PRD §4). Plain JS, no build step: it reads what
// the app stored in IndexedDB ("cooky-offline" / "kv", see
// src/components/offline/store.ts) and renders this person's shopping list
// and today's recipe in their language. Ticks are queued and replayed by the
// app on reconnect; the server keeps whichever change is newest.
(function () {
  "use strict";

  var app = document.getElementById("app");

  function open() {
    return new Promise(function (resolve, reject) {
      var request = indexedDB.open("cooky-offline", 1);
      request.onupgradeneeded = function () {
        request.result.createObjectStore("kv");
      };
      request.onsuccess = function () {
        resolve(request.result);
      };
      request.onerror = function () {
        reject(request.error);
      };
    });
  }

  function get(db, key) {
    return new Promise(function (resolve) {
      var request = db.transaction("kv", "readonly").objectStore("kv").get(key);
      request.onsuccess = function () {
        resolve(request.result);
      };
      request.onerror = function () {
        resolve(undefined);
      };
    });
  }

  function put(db, key, value) {
    return new Promise(function (resolve) {
      var tx = db.transaction("kv", "readwrite");
      tx.objectStore("kv").put(value, key);
      tx.oncomplete = resolve;
      tx.onerror = resolve;
    });
  }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (name) {
      if (name === "text") node.textContent = attrs[name];
      else node.setAttribute(name, attrs[name]);
    });
    (children || []).forEach(function (child) {
      if (child) node.appendChild(child);
    });
    return node;
  }

  function retryButton(label) {
    var button = el("button", { type: "button", text: label || "↻" });
    button.addEventListener("click", function () {
      location.reload();
    });
    return button;
  }

  function render(db, strings, owner, snapshot, recipe) {
    app.textContent = "";
    // Nothing usable stored (or it belongs to someone else): only offer to retry.
    if (!strings) {
      app.appendChild(el("h1", { text: "Cooky" }));
      app.appendChild(retryButton(null));
      return;
    }
    document.documentElement.lang = strings.lang;
    document.documentElement.dir = strings.dir;
    document.title = strings.title;

    app.appendChild(el("h1", { text: strings.title }));
    app.appendChild(el("p", { class: "banner", role: "status", text: strings.banner }));

    var mine = snapshot && snapshot.owner === owner ? snapshot : null;
    if (!mine) {
      app.appendChild(el("p", { text: strings.noList }));
    } else {
      var all = [];
      mine.groups.forEach(function (group) {
        all = all.concat(group.items);
      });
      var progress = el("p", { class: "progress", "aria-live": "polite" });
      var updateProgress = function () {
        var checked = all.filter(function (i) {
          return i.checked;
        }).length;
        progress.textContent = strings.progress
          .replace("{checked}", String(checked))
          .replace("{total}", String(all.length));
      };
      updateProgress();
      app.appendChild(progress);

      mine.groups.forEach(function (group) {
        app.appendChild(el("h2", { text: group.label }));
        var list = el("ul");
        group.items.forEach(function (item) {
          var box = el("input", { type: "checkbox" });
          box.checked = item.checked;
          var text = el("span", { class: item.checked ? "done" : "" }, [
            item.amount ? el("span", { class: "amount", text: item.amount + " " }) : null,
            el("span", { text: item.name }),
          ]);
          box.addEventListener("change", function () {
            item.checked = box.checked;
            text.className = item.checked ? "done" : "";
            updateProgress();
            get(db, "queue").then(function (queue) {
              var next = (queue || []).filter(function (q) {
                return q.itemId !== item.id;
              });
              next.push({ itemId: item.id, checked: item.checked, at: new Date().toISOString() });
              return put(db, "queue", next).then(function () {
                return put(db, "snapshot", mine);
              });
            });
          });
          list.appendChild(el("li", {}, [el("label", {}, [box, text])]));
        });
        app.appendChild(list);
      });
    }

    var today = new Date().toISOString().slice(0, 10);
    if (recipe && recipe.owner === owner && recipe.day === today) {
      app.appendChild(el("h2", { text: strings.recipe }));
      app.appendChild(el("h1", { text: recipe.name }));
      app.appendChild(el("h2", { text: strings.ingredients }));
      app.appendChild(
        el(
          "ul",
          { class: "plain" },
          recipe.ingredients.map(function (line) {
            return el("li", { text: line });
          }),
        ),
      );
      app.appendChild(el("h2", { text: strings.steps }));
      app.appendChild(
        el(
          "ol",
          {},
          recipe.steps.map(function (step) {
            return el("li", { text: step });
          }),
        ),
      );
    }
    app.appendChild(retryButton(strings.retry));
  }

  if (!("indexedDB" in window)) return render(null, null);
  open()
    .then(function (db) {
      return Promise.all([get(db, "strings"), get(db, "owner"), get(db, "snapshot"), get(db, "recipe")]).then(
        function (values) {
          render(db, values[0], values[1], values[2], values[3]);
        },
      );
    })
    .catch(function () {
      render(null, null);
    });

  // Back online: go back to the real page (the app then replays the queued ticks).
  window.addEventListener("online", function () {
    location.reload();
  });
})();
