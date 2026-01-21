(() => {
  "use strict";

  const form = document.getElementById("todoForm");
  const todoText = document.getElementById("todoText");
  const todoDate = document.getElementById("todoDate");
  const editingId = document.getElementById("editingId");

  const errText = document.getElementById("errText");
  const errDate = document.getElementById("errDate");

  const btnIcon = document.getElementById("btnIcon");
  const btnLabel = document.getElementById("btnLabel");

  const tbody = document.getElementById("todoTbody");

  const searchInput = document.getElementById("searchInput");
  const statusFilter = document.getElementById("statusFilter");
  const sortBy = document.getElementById("sortBy");
  const deleteAllBtn = document.getElementById("deleteAllBtn");

  const statTotal = document.getElementById("statTotal");
  const statDone = document.getElementById("statDone");
  const statPending = document.getElementById("statPending");
  const progressPercent = document.getElementById("progressPercent");

  const sortBtn = document.getElementById("sortBtn");
  const filterBtn = document.getElementById("filterBtn");
  const sortMenu = document.getElementById("sortMenu");
  const filterMenu = document.getElementById("filterMenu");

  const STORAGE_KEY = "todo_manager_v1";
  let todos = loadTodos();
  const expanded = new Set();

  function todayISO() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
  }

  function enforceMinDate() {
    const t = todayISO();
    todoDate.min = t;
    if (todoDate.value && todoDate.value < t) todoDate.value = "";
  }

  enforceMinDate();
  setInterval(enforceMinDate, 60000);

  todoDate.addEventListener("input", () => {
    if (todoDate.value && todoDate.value < todayISO()) {
      todoDate.value = "";
      errDate.textContent = "Tanggal tidak boleh sudah lewat.";
    } else if (errDate.textContent === "Tanggal tidak boleh sudah lewat.") {
      errDate.textContent = "";
    }
  });

  // Dropdown
  function closeMenus() {
    sortMenu?.classList.add("hidden");
    filterMenu?.classList.add("hidden");
    sortBtn?.setAttribute("aria-expanded","false");
    filterBtn?.setAttribute("aria-expanded","false");
  }

  sortBtn?.addEventListener("click", e => {
    e.stopPropagation();
    const open = sortMenu.classList.contains("hidden");
    closeMenus();
    if(open) { sortMenu.classList.remove("hidden"); sortBtn.setAttribute("aria-expanded","true"); }
  });
  sortMenu?.addEventListener("click", e => {
    const item = e.target.closest("[data-sort]");
    if(item?.dataset?.sort) {
      sortBy.value = item.dataset.sort;
      sortBy.dispatchEvent(new Event("change"));
      closeMenus();
    }
  });

  filterBtn?.addEventListener("click", e => {
    e.stopPropagation();
    const open = filterMenu.classList.contains("hidden");
    closeMenus();
    if(open) { filterMenu.classList.remove("hidden"); filterBtn.setAttribute("aria-expanded","true"); }
  });
  filterMenu?.addEventListener("click", e => {
    const item = e.target.closest("[data-filter]");
    if(item?.dataset?.filter) {
      statusFilter.value = item.dataset.filter;
      statusFilter.dispatchEvent(new Event("change"));
      closeMenus();
    }
  });

  document.addEventListener("click", closeMenus);
  document.addEventListener("keydown", e => { if(e.key==="Escape") closeMenus(); });

  // Modal helpers
  function openConfirm(title,message) { ... } // tetap sama
  function openSubtaskInput(title="",txt="",date=""){ ... } // tetap sama
  function escapeHtml(str){ ... } // tetap sama
  function formatDate(str){ ... } // tetap sama

  // Sync parent
  function syncParentCompletion(todo){
    if(todo.subtasks?.length) todo.completed = todo.subtasks.every(s=>s.completed);
  }

  function loadTodos(){ ... } // tetap sama
  function saveTodos(){ ... } // tetap sama

  // Form submit
  form.addEventListener("submit", e => {
    e.preventDefault();
    const text = todoText.value.trim();
    const date = todoDate.value;
    if(!validateForm(text,date)) return;
    if(editingId.value){
      const idx = todos.findIndex(t=>t.id===editingId.value);
      if(idx!==-1){ todos[idx].text=text; todos[idx].dueDate=date; }
      exitEditMode();
    } else {
      todos.unshift({id:crypto.randomUUID?.()||Date.now().toString(), text, dueDate:date, completed:false, createdAt:Date.now(), subtasks:[]});
    }
    saveTodos(); form.reset(); clearErrors(); enforceMinDate(); render();
  });

  searchInput.addEventListener("input", render);
  statusFilter.addEventListener("change", render);
  sortBy.addEventListener("change", render);
  deleteAllBtn.addEventListener("click", async () => {
    if(!todos.length) return;
    if(await openConfirm("Konfirmasi","Yakin mau hapus semua task?")) {
      todos=[]; saveTodos(); exitEditMode(); render();
    }
  });

  function validateForm(text,date){ ... } // tetap sama
  function clearErrors(){ errText.textContent=""; errDate.textContent=""; }
  function enterEditMode(todo){ ... } // tetap sama
  function exitEditMode(){ editingId.value=""; btnIcon.textContent="＋"; btnLabel.textContent="Add"; }

  function toggleComplete(id){ 
    const t = todos.find(x=>x.id===id); 
    if(!t) return; t.completed=!t.completed; 
    if(t.subtasks?.length) t.subtasks.forEach(s=>s.completed=t.completed); 
    saveTodos(); render(); 
  }

  async function addSubtask(parentId){ ... } // tetap sama, parent.completed=false
  function toggleSubComplete(parentId,subId){ 
    const p=todos.find(x=>x.id===parentId); 
    if(!p) return; 
    const s=p.subtasks.find(x=>x.id===subId); 
    if(!s) return; 
    s.completed=!s.completed; 
    syncParentCompletion(p); 
    saveTodos(); render(); 
  }

  async function editSubtask(parentId,subId){ ... }
  async function deleteSubtask(parentId,subId){ ... }
  async function deleteOne(id){ ... }

  function getFilteredTodos(){ ... } // tetap sama

  function render(){
    let total=0,done=0;
    todos.forEach(t=>{
      total+=1; if(t.completed) done+=1;
      if(t.subtasks?.length){ total+=t.subtasks.length; done+=t.subtasks.filter(s=>s.completed).length; }
    });
    statTotal.textContent=total;
    statDone.textContent=done;
    statPending.textContent=total-done;
    progressPercent.textContent=total?Math.round(done/total*100):0;

    const list=getFilteredTodos();
    tbody.innerHTML="";
    if(!list.length){ tbody.innerHTML=`<tr class="emptyRow"><td colspan="5">No task found</td></tr>`; return; }

    list.forEach((t,i)=>{
      const tr=document.createElement("tr");
      if(!Array.isArray(t.subtasks)) t.subtasks=[];
      const statusBadge=t.completed?`<span class="badge completed">● Completed</span>`:`<span class="badge pending">● Pending</span>`;
      const hasSubs=t.subtasks.length>0;
      const isOpen=expanded.has(t.id);
      tr.innerHTML=`
        <td>${i+1}</td>
        <td>
          <div style="display:flex; align-items:center; gap:10px;">
            ${hasSubs?`<button class="actionBtn toggleSub" type="button" style="height:28px;padding:0 8px;">${isOpen?"▾":"▸"}</button>`:""}
            <div style="font-weight:900;${t.completed?"text-decoration:line-through;color:#64748b":""}">${escapeHtml(t.text)}${hasSubs?`<span style="margin-left:8px;font-size:12px;font-weight:900;color:#0f172a;background:#e2e8f0;padding:2px 8px;border-radius:999px;">${t.subtasks.length}</span>`:""}</div>
          </div>
        </td>
        <td>${formatDate(t.dueDate)}</td>
        <td>${statusBadge}</td>
        <td>
          <div class="actions">
            <button class="actionBtn subtask" type="button">＋</button>
            <button class="actionBtn complete" type="button">${t.completed?"Undo":"Complete"}</button>
            <button class="actionBtn edit" type="button">Edit</button>
            <button class="actionBtn delete" type="button">Delete</button>
          </div>
        </td>
      `;
      const btnToggle=tr.querySelector(".toggleSub");
      const btnSub=tr.querySelector(".actionBtn.subtask");
      const btnComplete=tr.querySelector(".actionBtn.complete");
      const btnEdit=tr.querySelector(".actionBtn.edit");
      const btnDelete=tr.querySelector(".actionBtn.delete");

      btnToggle?.addEventListener("click",()=>{ if(expanded.has(t.id)) expanded.delete(t.id); else expanded.add(t.id); render(); });
      btnSub?.addEventListener("click",()=>addSubtask(t.id));
      btnComplete.addEventListener("click",()=>toggleComplete(t.id));
      btnEdit.addEventListener("click",()=>enterEditMode(t));
      btnDelete.addEventListener("click",()=>deleteOne(t.id));

      tbody.appendChild(tr);

      if(hasSubs && expanded.has(t.id)){
        t.subtasks.forEach(s=>{
          const subTr=document.createElement("tr"); subTr.className="subRow";
          const subStatus=s.completed?`<span class="badge completed">● Completed</span>`:`<span class="badge pending">● Pending</span>`;
          subTr.innerHTML=`
            <td></td>
            <td class="subTaskText"><span class="subTag"><span class="subDot"></span>${escapeHtml(s.text)}</span></td>
            <td>${s.dueDate?formatDate(s.dueDate):"No due date"}</td>
            <td>${subStatus}</td>
            <td>
              <div class="actions">
                <button class="actionBtn complete" type="button">${s.completed?"Undo":"Complete"}</button>
                <button class="actionBtn edit" type="button">Edit</button>
                <button class="actionBtn delete" type="button">Delete</button>
              </div>
            </td>
          `;
          const [bComplete,bEdit,bDelete]=subTr.querySelectorAll("button");
          bComplete.addEventListener("click",()=>toggleSubComplete(t.id,s.id));
          bEdit.addEventListener("click",()=>editSubtask(t.id,s.id));
          bDelete.addEventListener("click",()=>deleteSubtask(t.id,s.id));
          tbody.appendChild(subTr);
        });
      }
    });
  }

  render();

})();
