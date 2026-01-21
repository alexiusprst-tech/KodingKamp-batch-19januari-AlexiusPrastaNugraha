document.addEventListener("DOMContentLoaded", () => {
  console.log("✅ app.js loaded");
  // alert("JS jalan ✅"); // kalau sudah yakin jalan, boleh hapus

  // ===== Helper
  const $ = (id) => document.getElementById(id);

  const escapeHtml = (str) =>
    String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  const makeId = () =>
    (window.crypto && typeof window.crypto.randomUUID === "function")
      ? window.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const todayISO = () => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const formatDate = (yyyyMmDd) => {
    const [y, m, d] = (yyyyMmDd || "").split("-");
    if (!y || !m || !d) return yyyyMmDd || "";
    return `${d}/${m}/${y}`;
  };

  // ===== Elements
  const form = $("todoForm");
  const todoText = $("todoText");
  const todoDate = $("todoDate");
  const editingId = $("editingId");

  const errText = $("errText");
  const errDate = $("errDate");

  const btnIcon = $("btnIcon");
  const btnLabel = $("btnLabel");

  const tbody = $("todoTbody");

  const searchInput = $("searchInput");
  const statusFilter = $("statusFilter");
  const sortBy = $("sortBy");
  const deleteAllBtn = $("deleteAllBtn");

  const statTotal = $("statTotal");
  const statDone = $("statDone");
  const statPending = $("statPending");
  const progressPercent = $("progressPercent");

  const sortBtn = $("sortBtn");
  const filterBtn = $("filterBtn");
  const sortMenu = $("sortMenu");
  const filterMenu = $("filterMenu");

  // ===== Guard wajib (kalau ini gagal, berarti ID HTML kamu tidak cocok / JS tidak connect)
  const required = { form, todoText, todoDate, editingId, tbody, searchInput, statusFilter, sortBy, deleteAllBtn };
  for (const [name, el] of Object.entries(required)) {
    if (!el) {
      console.error(`❌ Element #${name} tidak ditemukan. Cek id HTML kamu.`);
      alert(`ERROR: element "${name}" tidak ketemu. Cek id HTML.`);
      return;
    }
  }

  // ===== Storage
  const STORAGE_KEY = "todo_manager_v1";
  let todos = loadTodos();
  const expanded = new Set();

  // ===== date min guard
  let currentDay = todayISO();

  function enforceMinDateInputs() {
    const t = todayISO();
    todoDate.min = t;
    if (todoDate.value && todoDate.value < t) {
      todoDate.value = "";
      if (errDate) errDate.textContent = "Tanggal tidak boleh sudah lewat.";
    }
  }

  enforceMinDateInputs();

  setInterval(() => {
    const t = todayISO();
    if (t !== currentDay) {
      currentDay = t;
      enforceMinDateInputs();
      render();
    }
  }, 1000);

  // ===== Dropdown
  function closeMenus() {
    sortMenu?.classList.add("hidden");
    filterMenu?.classList.add("hidden");
    sortBtn?.setAttribute("aria-expanded", "false");
    filterBtn?.setAttribute("aria-expanded", "false");
  }

  sortBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    const willOpen = sortMenu.classList.contains("hidden");
    closeMenus();
    if (willOpen) {
      sortMenu.classList.remove("hidden");
      sortBtn.setAttribute("aria-expanded", "true");
    }
  });

  sortMenu?.addEventListener("click", (e) => {
    const item = e.target.closest("[data-sort]");
    if (!item) return;
    sortBy.value = item.getAttribute("data-sort");
    sortBy.dispatchEvent(new Event("change"));
    closeMenus();
  });

  filterBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    const willOpen = filterMenu.classList.contains("hidden");
    closeMenus();
    if (willOpen) {
      filterMenu.classList.remove("hidden");
      filterBtn.setAttribute("aria-expanded", "true");
    }
  });

  filterMenu?.addEventListener("click", (e) => {
    const item = e.target.closest("[data-filter]");
    if (!item) return;
    statusFilter.value = item.getAttribute("data-filter");
    statusFilter.dispatchEvent(new Event("change"));
    closeMenus();
  });

  document.addEventListener("click", closeMenus);
  document.addEventListener("keydown", (e) => e.key === "Escape" && closeMenus());

  // ===== Modal confirm (simple)
  function openConfirm(title, message) {
    return new Promise((resolve) => {
      const modal = document.createElement("div");
      modal.className = "modal";
      modal.innerHTML = `
        <div class="modalOverlay" data-close="1"></div>
        <div class="modalCard" role="dialog" aria-modal="true">
          <h3 class="modalTitle">${escapeHtml(title)}</h3>
          <p class="modalMessage">${escapeHtml(message)}</p>
          <div class="modalActions">
            <button class="modalBtn" data-cancel="1" type="button">Cancel</button>
            <button class="modalBtn modalBtnDanger" data-ok="1" type="button">OK</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      const close = (val) => { modal.remove(); resolve(val); };

      modal.addEventListener("click", (e) => {
        if (e.target?.dataset?.close) close(false);
        if (e.target?.dataset?.cancel) close(false);
        if (e.target?.dataset?.ok) close(true);
      });
    });
  }

  // ===== Subtask input
  function openSubtaskInput(title = "Add Subtask") {
    return new Promise((resolve) => {
      const modal = document.createElement("div");
      modal.className = "modal";
      const minDate = todayISO();

      modal.innerHTML = `
        <div class="modalOverlay" data-close="1"></div>
        <div class="modalCard" role="dialog" aria-modal="true">
          <h3 class="modalTitle">${escapeHtml(title)}</h3>

          <div style="margin:10px 0 14px; display:flex; flex-direction:column; gap:10px;">
            <div>
              <input id="__subText" class="input" type="text" placeholder="Contoh: Beli kabel..." />
              <small id="__subErr" class="error" style="min-height:14px;margin-top:8px"></small>
            </div>

            <div>
              <label style="display:block;font-weight:800;font-size:13px;margin-bottom:6px;color:#111827;">
                Due Date (opsional)
              </label>
              <input id="__subDate" class="input" type="date" min="${minDate}" />
              <small id="__subErrDate" class="error" style="min-height:14px;margin-top:8px"></small>
            </div>
          </div>

          <div class="modalActions">
            <button class="modalBtn" data-cancel="1" type="button">Cancel</button>
            <button class="modalBtn modalBtnDanger" data-ok="1" type="button">OK</button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      const textEl = modal.querySelector("#__subText");
      const dateEl = modal.querySelector("#__subDate");
      const errEl = modal.querySelector("#__subErr");
      const errDateEl = modal.querySelector("#__subErrDate");

      textEl.focus();

      const close = (val) => { modal.remove(); resolve(val); };

      const submit = () => {
        const text = (textEl.value || "").trim();
        const dueDate = (dateEl.value || "").trim();
        const minNow = todayISO();

        errEl.textContent = "";
        errDateEl.textContent = "";

        if (!text) return (errEl.textContent = "Wajib diisi.");
        if (dueDate && dueDate < minNow) return (errDateEl.textContent = "Tanggal tidak boleh sudah lewat.");

        close({ text, dueDate });
      };

      modal.addEventListener("click", (e) => {
        if (e.target?.dataset?.close) return close(null);
        if (e.target?.dataset?.cancel) return close(null);
        if (e.target?.dataset?.ok) return submit();
      });

      modal.addEventListener("keydown", (e) => {
        if (e.key === "Escape") close(null);
        if (e.key === "Enter") submit();
      });
    });
  }

  function syncParentCompletion(todo) {
    if (!Array.isArray(todo.subtasks) || todo.subtasks.length === 0) return;
    todo.completed = todo.subtasks.every((s) => s.completed);
  }

  // ===== FORM submit (ini yang bikin "Add" jalan)
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    console.log("🟢 submit fired"); // debug penting

    clearErrors();
    const text = todoText.value.trim();
    const date = todoDate.value;

    if (!text) { errText.textContent = "Wajib diisi."; return; }
    if (!date) { errDate.textContent = "Due Date wajib diisi."; return; }
    if (date < todayISO()) { errDate.textContent = "Tanggal tidak boleh sudah lewat."; return; }

    const isEditing = Boolean(editingId.value);

    if (isEditing) {
      const idx = todos.findIndex((t) => t.id === editingId.value);
      if (idx !== -1) {
        todos[idx].text = text;
        todos[idx].dueDate = date;
      }
      exitEditMode();
    } else {
      todos.unshift({
        id: makeId(),
        text,
        dueDate: date,
        completed: false,
        createdAt: Date.now(),
        subtasks: [],
      });
    }

    saveTodos();
    form.reset();
    enforceMinDateInputs();
    render();
  });

  searchInput.addEventListener("input", render);
  statusFilter.addEventListener("change", render);
  sortBy.addEventListener("change", render);

  deleteAllBtn.addEventListener("click", async () => {
    if (todos.length === 0) return;
    const ok = await openConfirm("Konfirmasi", "Yakin mau hapus semua task?");
    if (!ok) return;

    todos = [];
    saveTodos();
    exitEditMode();
    render();
  });

  function clearErrors() {
    errText.textContent = "";
    errDate.textContent = "";
  }

  function enterEditMode(todo) {
    editingId.value = todo.id;
    todoText.value = todo.text;
    todoDate.value = todo.dueDate;
    btnIcon.textContent = "✎";
    btnLabel.textContent = "Update";
    todoText.focus();
  }

  function exitEditMode() {
    editingId.value = "";
    btnIcon.textContent = "＋";
    btnLabel.textContent = "Add";
  }

  function toggleComplete(id) {
    const t = todos.find((x) => x.id === id);
    if (!t) return;

    const next = !t.completed;

    if (Array.isArray(t.subtasks) && t.subtasks.length > 0) {
      t.subtasks.forEach((s) => (s.completed = next));
    }
    t.completed = next;

    saveTodos();
    render();
  }

  async function addSubtask(parentId) {
    const parent = todos.find((x) => x.id === parentId);
    if (!parent) return;

    const result = await openSubtaskInput("Add Subtask");
    if (!result) return;

    parent.subtasks ||= [];
    parent.subtasks.push({
      id: makeId(),
      text: result.text,
      dueDate: result.dueDate || "",
      completed: false,
      createdAt: Date.now(),
    });

    parent.completed = false;
    expanded.add(parentId);

    saveTodos();
    render();
  }

  function toggleSubComplete(parentId, subId) {
    const parent = todos.find((x) => x.id === parentId);
    if (!parent) return;

    const s = parent.subtasks?.find((x) => x.id === subId);
    if (!s) return;

    s.completed = !s.completed;
    syncParentCompletion(parent);

    saveTodos();
    render();
  }

  async function deleteOne(id) {
    const t = todos.find((x) => x.id === id);
    if (!t) return;

    const ok = await openConfirm("Konfirmasi", `Hapus task "${t.text}"?`);
    if (!ok) return;

    todos = todos.filter((x) => x.id !== id);
    saveTodos();
    if (editingId.value === id) exitEditMode();
    expanded.delete(id);
    render();
  }

  function getFilteredTodos() {
    const q = searchInput.value.trim().toLowerCase();
    const status = statusFilter.value;

    let list = [...todos];

    if (q) {
      list = list.filter((t) => t.text.toLowerCase().includes(q) || (t.dueDate || "").includes(q));
    }

    if (status === "pending") list = list.filter((t) => !t.completed);
    if (status === "completed") list = list.filter((t) => t.completed);

    const sort = sortBy.value;
    if (sort === "newest") list.sort((a, b) => b.createdAt - a.createdAt);
    if (sort === "oldest") list.sort((a, b) => a.createdAt - b.createdAt);
    if (sort === "duedateAsc") list.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    if (sort === "duedateDesc") list.sort((a, b) => b.dueDate.localeCompare(a.dueDate));
    if (sort === "az") list.sort((a, b) => a.text.localeCompare(b.text, undefined, { sensitivity: "base" }));
    if (sort === "za") list.sort((a, b) => b.text.localeCompare(a.text, undefined, { sensitivity: "base" }));

    return list;
  }

  function render() {
    let total = 0, done = 0;

    todos.forEach((t) => {
      total += 1;
      if (t.completed) done += 1;
      if (Array.isArray(t.subtasks)) {
        total += t.subtasks.length;
        done += t.subtasks.filter((s) => s.completed).length;
      }
    });

    statTotal.textContent = String(total);
    statDone.textContent = String(done);
    statPending.textContent = String(total - done);
    progressPercent.textContent = String(total === 0 ? 0 : Math.round((done / total) * 100));

    const list = getFilteredTodos();

    if (list.length === 0) {
      tbody.innerHTML = `<tr class="emptyRow"><td colspan="5">No task found</td></tr>`;
      return;
    }

    tbody.innerHTML = "";

    list.forEach((t, i) => {
      t.subtasks ||= [];

      const tr = document.createElement("tr");
      const hasSubs = t.subtasks.length > 0;
      const isOpen = expanded.has(t.id);

      tr.innerHTML = `
        <td>${i + 1}</td>
        <td>
          <div style="display:flex; align-items:center; gap:10px;">
            ${
              hasSubs
                ? `<button class="actionBtn toggleSub" type="button" style="height:28px;padding:0 8px;">
                    ${isOpen ? "▾" : "▸"}
                   </button>`
                : ``
            }
            <div style="font-weight:900; ${t.completed ? "text-decoration:line-through; color:#64748b;" : ""}">
              ${escapeHtml(t.text)}
              ${
                hasSubs
                  ? `<span style="margin-left:8px;font-size:12px;font-weight:900;color:#0f172a;background:#e2e8f0;padding:2px 8px;border-radius:999px;">
                      ${t.subtasks.length}
                    </span>`
                  : ``
              }
            </div>
          </div>
        </td>
        <td>${formatDate(t.dueDate)}</td>
        <td>${t.completed ? `<span class="badge completed">● Completed</span>` : `<span class="badge pending">● Pending</span>`}</td>
        <td>
          <div class="actions">
            <button class="actionBtn subtask" type="button" title="Add Subtask">＋</button>
            <button class="actionBtn complete" type="button">${t.completed ? "Undo" : "Complete"}</button>
            <button class="actionBtn edit" type="button">Edit</button>
            <button class="actionBtn delete" type="button">Delete</button>
          </div>
        </td>
      `;

      tr.querySelector(".toggleSub")?.addEventListener("click", () => {
        if (expanded.has(t.id)) expanded.delete(t.id);
        else expanded.add(t.id);
        render();
      });

      tr.querySelector(".subtask")?.addEventListener("click", () => addSubtask(t.id));
      tr.querySelector(".complete")?.addEventListener("click", () => toggleComplete(t.id));
      tr.querySelector(".edit")?.addEventListener("click", () => enterEditMode(t));
      tr.querySelector(".delete")?.addEventListener("click", () => deleteOne(t.id));

      tbody.appendChild(tr);

      if (hasSubs && expanded.has(t.id)) {
        t.subtasks.forEach((s) => {
          const subTr = document.createElement("tr");
          subTr.className = "subRow";

          subTr.innerHTML = `
            <td></td>
            <td class="subTaskText"><span class="subTag"><span class="subDot"></span>${escapeHtml(s.text)}</span></td>
            <td>${s.dueDate ? formatDate(s.dueDate) : "No due date"}</td>
            <td>${s.completed ? `<span class="badge completed">● Completed</span>` : `<span class="badge pending">● Pending</span>`}</td>
            <td>
              <div class="actions">
                <button class="actionBtn complete" type="button">${s.completed ? "Undo" : "Complete"}</button>
                <button class="actionBtn delete" type="button">Delete</button>
              </div>
            </td>
          `;

          const [bComplete, bDelete] = subTr.querySelectorAll("button");
          bComplete.addEventListener("click", () => toggleSubComplete(t.id, s.id));
          bDelete.addEventListener("click", async () => {
            const ok = await openConfirm("Konfirmasi", `Hapus subtask "${s.text}"?`);
            if (!ok) return;
            t.subtasks = t.subtasks.filter(x => x.id !== s.id);
            if (t.subtasks.length === 0) expanded.delete(t.id);
            syncParentCompletion(t);
            saveTodos();
            render();
          });

          tbody.appendChild(subTr);
        });
      }
    });
  }

  function loadTodos() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.map((x) => ({ ...x, subtasks: Array.isArray(x.subtasks) ? x.subtasks : [] }));
    } catch {
      return [];
    }
  }

  function saveTodos() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
  }

  // INIT
  render();
});
