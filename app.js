// ── Storage ──────────────────────────────────────────────────────────────
const DB = {
  getJobs() { return JSON.parse(localStorage.getItem('ip_jobs') || '[]') },
  saveJobs(j) { localStorage.setItem('ip_jobs', JSON.stringify(j)) },
  getJob(id) { return this.getJobs().find(j => j.id === id) || null },
  saveJob(job) {
    const jobs = this.getJobs()
    const i = jobs.findIndex(j => j.id === job.id)
    if (i >= 0) jobs[i] = job; else jobs.push(job)
    this.saveJobs(jobs)
  },
  deleteJob(id) { this.saveJobs(this.getJobs().filter(j => j.id !== id)) },
  newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7) }
}

// ── State ─────────────────────────────────────────────────────────────────
let currentJobId = null
let activeDocTab = 'jobPosting'
let activeTagFilter = 'all'

// ── Router ────────────────────────────────────────────────────────────────
function navigate(hash) { window.location.hash = hash }

function handleRoute() {
  const hash = window.location.hash.replace('#', '') || '/'
  if (hash === '/' || hash === '') showDashboard()
  else if (hash.startsWith('/job/')) showJobDetail(hash.replace('/job/', ''))
}

window.addEventListener('hashchange', handleRoute)
window.addEventListener('DOMContentLoaded', handleRoute)

// ── Toast ─────────────────────────────────────────────────────────────────
function toast(msg, duration = 2200) {
  const el = document.createElement('div')
  el.className = 'toast'
  el.textContent = msg
  document.getElementById('toast-container').appendChild(el)
  setTimeout(() => el.remove(), duration)
}

// ── Dashboard ─────────────────────────────────────────────────────────────
function showDashboard() {
  document.getElementById('view-dashboard').classList.add('active')
  document.getElementById('view-job').classList.remove('active')
  currentJobId = null
  document.getElementById('topbar-crumb').textContent = ''
  renderDashboard()
}

function getAllTags() {
  const all = DB.getJobs().flatMap(j => j.tags || [])
  return [...new Set(all)].sort()
}

function renderDashboard() {
  const jobs = DB.getJobs()
  const grid = document.getElementById('jobs-grid')

  // Render tag filters
  const allTags = getAllTags()
  const tagBar = document.getElementById('tag-filter-bar')
  if (allTags.length > 0) {
    tagBar.style.display = 'flex'
    tagBar.innerHTML =
      `<button class="filter-chip ${activeTagFilter === 'all' ? 'active' : ''}" onclick="setTagFilter('all')">All</button>` +
      allTags.map(t => `<button class="filter-chip ${activeTagFilter === t ? 'active' : ''}" onclick="setTagFilter('${esc(t)}')">${esc(t)}</button>`).join('')
  } else {
    tagBar.style.display = 'none'
  }

  const filtered = activeTagFilter === 'all' ? jobs : jobs.filter(j => (j.tags || []).includes(activeTagFilter))

  if (filtered.length === 0) {
    grid.innerHTML = `<div class="empty-state">
      <div class="empty-icon">🌸</div>
      <h3>${jobs.length === 0 ? 'nothing here yet' : 'no jobs with this tag'}</h3>
      <p>${jobs.length === 0 ? 'add your first job to get started ✦' : 'try a different tag or add a new job'}</p>
      ${jobs.length === 0 ? `<button class="btn btn-primary" onclick="openAddJobModal()">+ add job</button>` : ''}
    </div>`
    return
  }

  grid.innerHTML = filtered.map(j => {
    const docs = j.documents || {}
    const docPills = [
      { key: 'jobPosting', label: 'job post' },
      { key: 'resume', label: 'resume' },
      { key: 'coverLetter', label: 'cover' }
    ].filter(d => docs[d.key]?.content || docs[d.key]?.fileData)
     .map(d => `<span class="doc-pill">${d.label}</span>`).join('')

    const qCount = (j.prepSections || []).reduce((n, s) => n + (s.cards?.length || 0), 0)
    const tags = (j.tags || []).map(t => `<span class="tag-chip">${esc(t)}</span>`).join('')

    return `<div class="job-card" onclick="navigate('/job/${j.id}')">
      <div class="job-company">${esc(j.company)}</div>
      <div class="job-role">${esc(j.role)}</div>
      ${tags ? `<div class="job-tags">${tags}</div>` : ''}
      ${qCount > 0 ? `<div class="job-prep-count">📝 ${qCount} prep question${qCount !== 1 ? 's' : ''}</div>` : ''}
      ${docPills ? `<div class="job-doc-pills">${docPills}</div>` : ''}
    </div>`
  }).join('')
}

function setTagFilter(tag) {
  activeTagFilter = tag
  renderDashboard()
}

// ── Job Detail ────────────────────────────────────────────────────────────
function showJobDetail(id) {
  const job = DB.getJob(id)
  if (!job) { navigate('/'); return }
  currentJobId = id
  activeDocTab = 'jobPosting'

  document.getElementById('view-dashboard').classList.remove('active')
  document.getElementById('view-job').classList.add('active')
  document.getElementById('topbar-crumb').textContent = `${job.company} — ${job.role}`

  document.getElementById('prep-job-company').textContent = job.company
  document.getElementById('prep-job-role').textContent = job.role

  // Show tags in header
  const tagsEl = document.getElementById('prep-job-tags')
  tagsEl.innerHTML = (job.tags || []).map(t => `<span class="tag-chip">${esc(t)}</span>`).join('')

  renderDocSidebar(job)
  renderPrepSections(job)
}

// ── Document Sidebar ──────────────────────────────────────────────────────
function renderDocSidebar(job) {
  const docs = job.documents || {}
  const tabMap = { jobPosting: 'tab-job', resume: 'tab-resume', coverLetter: 'tab-cover' }
  Object.entries(tabMap).forEach(([key, tabId]) => {
    const tab = document.getElementById(tabId)
    const dot = tab.querySelector('.tab-dot')
    const has = !!(docs[key]?.content || docs[key]?.fileData)
    if (has && !dot) tab.insertAdjacentHTML('beforeend', '<span class="tab-dot"></span>')
    if (!has && dot) dot.remove()
  })
  switchDocTab(activeDocTab)
}

function switchDocTab(tabKey) {
  activeDocTab = tabKey
  document.querySelectorAll('.doc-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tabKey))
  document.querySelectorAll('.doc-panel').forEach(p => p.classList.toggle('active', p.dataset.panel === tabKey))
  if (currentJobId) renderDocPanel(tabKey)
}

function renderDocPanel(tabKey) {
  const job = DB.getJob(currentJobId)
  const doc = (job?.documents || {})[tabKey] || {}
  const panel = document.querySelector(`.doc-panel[data-panel="${tabKey}"]`)
  if (!panel) return

  const labels = { jobPosting: 'job posting', resume: 'resume', coverLetter: 'cover letter' }
  const label = labels[tabKey]

  if (doc.fileData) {
    const isText = doc.fileType === 'text'
    panel.innerHTML = `
      <div class="file-preview">
        <div class="file-preview-header">
          <div class="file-preview-name">
            <span class="file-icon">${isText ? '📄' : '📕'}</span>
            <span>${esc(doc.fileName || 'File')}</span>
          </div>
          <div style="display:flex;gap:4px;align-items:center">
            ${!isText ? `<button class="btn btn-ghost btn-sm" onclick="expandDoc('${tabKey}')" title="Expand">⤢ expand</button>` : ''}
            <button class="btn btn-ghost btn-sm" onclick="removeDoc('${tabKey}')">Remove</button>
          </div>
        </div>
        ${isText
          ? `<div class="file-text-content">${esc(doc.content)}</div>`
          : `<iframe class="file-embed" src="${doc.fileData}" title="${esc(doc.fileName || 'Document')}"></iframe>`}
      </div>
      <div style="text-align:center;margin-top:4px">
        <button class="btn btn-ghost btn-sm" onclick="removeDoc('${tabKey}')">Replace file</button>
      </div>`
  } else if (doc.content) {
    panel.innerHTML = `
      <div class="file-preview">
        <div class="file-preview-header">
          <div class="file-preview-name"><span class="file-icon">📝</span><span>Pasted text</span></div>
          <button class="btn btn-ghost btn-sm" onclick="editDocText('${tabKey}')">Edit</button>
        </div>
        <div class="file-text-content">${esc(doc.content)}</div>
      </div>`
  } else {
    panel.innerHTML = `
      <div class="doc-upload-zone" id="drop-zone-${tabKey}" onclick="triggerFileUpload('${tabKey}')"
        ondragover="onDragOver(event,'${tabKey}')" ondragleave="onDragLeave(event,'${tabKey}')" ondrop="onDrop(event,'${tabKey}')">
        <div class="upload-icon">☁️</div>
        <strong>Upload file</strong>
        <p>PDF, TXT, DOCX — drag & drop or click</p>
      </div>
      <input type="file" id="file-input-${tabKey}" accept=".pdf,.txt,.docx,.doc" style="display:none" onchange="onFileSelected(event,'${tabKey}')">
      <div class="doc-divider">or paste text</div>
      <textarea class="doc-textarea" id="paste-${tabKey}" placeholder="Paste your ${label} here…" rows="8"></textarea>
      <div class="doc-save-row">
        <button class="btn btn-primary btn-sm" onclick="saveDocText('${tabKey}')">Save text</button>
      </div>`
  }
}

// ── PDF Expand ────────────────────────────────────────────────────────────
function expandDoc(tabKey) {
  const job = DB.getJob(currentJobId)
  const doc = (job?.documents || {})[tabKey] || {}
  if (!doc.fileData) return

  const overlay = document.getElementById('modal-expand')
  document.getElementById('expand-iframe').src = doc.fileData
  document.getElementById('expand-filename').textContent = doc.fileName || 'Document'
  overlay.classList.add('open')
}

function closeExpandModal() {
  document.getElementById('modal-expand').classList.remove('open')
  document.getElementById('expand-iframe').src = ''
}

function triggerFileUpload(tabKey) { document.getElementById(`file-input-${tabKey}`)?.click() }
function onDragOver(e, tabKey) { e.preventDefault(); document.getElementById(`drop-zone-${tabKey}`)?.classList.add('drag-over') }
function onDragLeave(e, tabKey) { document.getElementById(`drop-zone-${tabKey}`)?.classList.remove('drag-over') }
function onDrop(e, tabKey) { e.preventDefault(); document.getElementById(`drop-zone-${tabKey}`)?.classList.remove('drag-over'); const f = e.dataTransfer.files[0]; if (f) processFile(f, tabKey) }
function onFileSelected(e, tabKey) { const f = e.target.files[0]; if (f) processFile(f, tabKey) }

function processFile(file, tabKey) {
  if (file.size / 1024 / 1024 > 8) { toast('File too large (max 8 MB)'); return }
  const reader = new FileReader()
  if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
    reader.onload = e => saveDocFile(tabKey, file.name, 'text', null, e.target.result)
    reader.readAsText(file)
  } else {
    reader.onload = e => saveDocFile(tabKey, file.name, 'binary', e.target.result, null)
    reader.readAsDataURL(file)
  }
}

function saveDocFile(tabKey, fileName, fileType, fileData, textContent) {
  const job = DB.getJob(currentJobId); if (!job) return
  job.documents = job.documents || {}
  job.documents[tabKey] = { fileName, fileType, fileData, content: textContent || '' }
  DB.saveJob(job); renderDocSidebar(job); toast('File saved ✓')
}

function saveDocText(tabKey) {
  const text = document.getElementById(`paste-${tabKey}`)?.value.trim()
  if (!text) { toast('Nothing to save'); return }
  const job = DB.getJob(currentJobId); if (!job) return
  job.documents = job.documents || {}
  job.documents[tabKey] = { content: text }
  DB.saveJob(job); renderDocSidebar(job); toast('Saved ✓')
}

function editDocText(tabKey) {
  const job = DB.getJob(currentJobId)
  const doc = (job?.documents || {})[tabKey] || {}
  const panel = document.querySelector(`.doc-panel[data-panel="${tabKey}"]`)
  panel.innerHTML = `
    <textarea class="doc-textarea" id="paste-${tabKey}" rows="10">${esc(doc.content)}</textarea>
    <div class="doc-save-row">
      <button class="btn btn-ghost btn-sm" onclick="renderDocSidebar(DB.getJob(currentJobId))">Cancel</button>
      <button class="btn btn-primary btn-sm" onclick="saveDocText('${tabKey}')">Save</button>
    </div>`
}

function removeDoc(tabKey) {
  const job = DB.getJob(currentJobId); if (!job) return
  job.documents = job.documents || {}
  job.documents[tabKey] = {}
  DB.saveJob(job); renderDocSidebar(job); toast('Removed')
}

// ── Prep Sections ─────────────────────────────────────────────────────────
function renderPrepSections(job) {
  const body = document.getElementById('prep-body')
  const sections = job.prepSections || []
  body.innerHTML = sections.map((sec, si) => renderSectionHTML(sec, si)).join('') +
    `<div class="prep-add-toolbar" onclick="openAddSectionModal()">
      <span style="font-size:18px">+</span> add a prep section
    </div>`
}

function renderSectionHTML(sec, si) {
  const count = sec.cards?.length || 0
  return `<div class="prep-section" id="sec-${sec.id}">
    <div class="prep-section-header" onclick="toggleSection('${sec.id}')">
      <span class="section-toggle open" id="toggle-${sec.id}">▶</span>
      <span class="section-title">${esc(sec.title)}</span>
      <span class="section-count">${count} question${count !== 1 ? 's' : ''}</span>
      <div class="section-actions" onclick="event.stopPropagation()">
        <button class="btn btn-ghost btn-icon btn-sm" title="Add question" onclick="openAddCardModal('${sec.id}')">+</button>
        <button class="btn btn-ghost btn-icon btn-sm" title="Delete section" onclick="confirmDeleteSection('${sec.id}')">🗑</button>
      </div>
    </div>
    <div class="prep-section-body open" id="body-${sec.id}">
      <div class="qa-list" id="qa-list-${sec.id}">
        ${(sec.cards || []).map((c, ci) => renderCardHTML(c, ci, sec.id)).join('')}
      </div>
      <div class="qa-add-row">
        <button class="btn btn-ghost btn-sm" onclick="openAddCardModal('${sec.id}')">+ add question</button>
      </div>
    </div>
  </div>`
}

function renderCardHTML(card, ci, secId) {
  return `<div class="qa-card" id="card-${card.id}">
    <div class="qa-card-header" onclick="toggleCard('${card.id}')">
      <div class="qa-num">${ci + 1}</div>
      <div class="qa-question">${esc(card.question)}</div>
      <span class="qa-card-toggle open" id="ctoggle-${card.id}">▶</span>
    </div>
    <div class="qa-card-body open" id="cbody-${card.id}">
      <div class="qa-notes-label">My Notes / Answer</div>
      <textarea class="qa-notes" placeholder="Add your answer, key words, talking points…"
        onchange="saveCardNote('${secId}','${card.id}',this.value)"
        onblur="saveCardNote('${secId}','${card.id}',this.value)">${esc(card.answer || '')}</textarea>
      <div class="qa-card-footer">
        <button class="btn btn-ghost btn-sm" onclick="confirmDeleteCard('${secId}','${card.id}')">Remove</button>
      </div>
    </div>
  </div>`
}

function toggleSection(secId) {
  document.getElementById(`body-${secId}`)?.classList.toggle('open')
  document.getElementById(`toggle-${secId}`)?.classList.toggle('open')
}

function toggleCard(cardId) {
  document.getElementById(`cbody-${cardId}`)?.classList.toggle('open')
  document.getElementById(`ctoggle-${cardId}`)?.classList.toggle('open')
}

function saveCardNote(secId, cardId, value) {
  const job = DB.getJob(currentJobId); if (!job) return
  const card = (job.prepSections || []).find(s => s.id === secId)?.cards?.find(c => c.id === cardId)
  if (!card) return
  card.answer = value
  DB.saveJob(job)
}

// ── Add Section Modal ─────────────────────────────────────────────────────
function openAddSectionModal() {
  document.getElementById('section-title-input').value = ''
  document.getElementById('section-ai-input').value = ''
  document.getElementById('parse-preview').style.display = 'none'
  document.getElementById('parse-preview-list').innerHTML = ''
  openModal('modal-add-section')
}

function parseAIContent() {
  const raw = document.getElementById('section-ai-input').value.trim()
  if (!raw) { toast('Paste some content first'); return }

  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean)
  const questions = []
  const numberedRe = /^(\d+[\.\):]|\-|\*|•)\s+(.+)/
  let currentQ = null

  for (const line of lines) {
    const m = line.match(numberedRe)
    if (m) {
      if (currentQ) questions.push(currentQ)
      currentQ = m[2]
    } else if (line.endsWith('?') && line.length < 200) {
      if (currentQ) questions.push(currentQ)
      currentQ = line
    } else if (currentQ && line.endsWith(':') && line.length < 80) {
      questions.push(currentQ)
      currentQ = line.replace(/:$/, '')
    } else if (!currentQ && line.length > 20 && line.length < 300) {
      questions.push(line)
    }
  }
  if (currentQ) questions.push(currentQ)

  const deduped = [...new Set(questions)].slice(0, 50)
  if (deduped.length === 0) { toast('No questions detected — try numbered or question-format content'); return }

  document.getElementById('parse-count').textContent = `${deduped.length} question${deduped.length !== 1 ? 's' : ''} detected`
  document.getElementById('parse-preview-list').innerHTML = deduped.map((q, i) =>
    `<div class="parse-item"><div class="parse-item-num">${i + 1}</div><div>${esc(q)}</div></div>`
  ).join('')

  const preview = document.getElementById('parse-preview')
  preview.style.display = 'block'
  preview.dataset.parsed = JSON.stringify(deduped)
}

function saveSection() {
  const title = document.getElementById('section-title-input').value.trim()
  if (!title) { toast('Give this section a title'); return }

  const preview = document.getElementById('parse-preview')
  let cards = []
  if (preview.style.display !== 'none' && preview.dataset.parsed) {
    cards = JSON.parse(preview.dataset.parsed).map(q => ({ id: DB.newId(), question: q, answer: '' }))
  }

  const job = DB.getJob(currentJobId); if (!job) return
  job.prepSections = job.prepSections || []
  job.prepSections.push({ id: DB.newId(), title, cards })
  DB.saveJob(job)
  closeModal('modal-add-section')
  renderPrepSections(job)
  toast(`"${title}" added ✓`)
}

// ── Add Card Modal ────────────────────────────────────────────────────────
let addCardTargetSection = null

function openAddCardModal(secId) {
  addCardTargetSection = secId
  document.getElementById('card-question-input').value = ''
  openModal('modal-add-card')
}

function saveCard() {
  const q = document.getElementById('card-question-input').value.trim()
  if (!q) { toast('Enter a question'); return }
  const job = DB.getJob(currentJobId); if (!job) return
  const sec = (job.prepSections || []).find(s => s.id === addCardTargetSection); if (!sec) return
  sec.cards = sec.cards || []
  sec.cards.push({ id: DB.newId(), question: q, answer: '' })
  DB.saveJob(job)
  closeModal('modal-add-card')
  renderPrepSections(job)
}

// ── Delete Confirms ───────────────────────────────────────────────────────
let pendingDelete = null

function confirmDeleteSection(secId) {
  pendingDelete = { type: 'section', secId }
  document.getElementById('confirm-msg').textContent = 'Delete this prep section and all its questions?'
  openModal('modal-confirm')
}

function confirmDeleteCard(secId, cardId) {
  pendingDelete = { type: 'card', secId, cardId }
  document.getElementById('confirm-msg').textContent = 'Remove this question?'
  openModal('modal-confirm')
}

function confirmDeleteJob() {
  const job = DB.getJob(currentJobId)
  pendingDelete = { type: 'job' }
  document.getElementById('confirm-msg').textContent = `Delete "${job?.role}" at "${job?.company}"? This cannot be undone.`
  openModal('modal-confirm')
}

function executePendingDelete() {
  if (!pendingDelete) return
  const { type, secId, cardId } = pendingDelete

  if (type === 'section') {
    const job = DB.getJob(currentJobId)
    job.prepSections = (job.prepSections || []).filter(s => s.id !== secId)
    DB.saveJob(job); closeModal('modal-confirm'); renderPrepSections(job); toast('Section deleted')
  } else if (type === 'card') {
    const job = DB.getJob(currentJobId)
    const sec = (job.prepSections || []).find(s => s.id === secId)
    if (sec) sec.cards = (sec.cards || []).filter(c => c.id !== cardId)
    DB.saveJob(job); closeModal('modal-confirm'); renderPrepSections(job); toast('Question removed')
  } else if (type === 'job') {
    DB.deleteJob(currentJobId); closeModal('modal-confirm'); navigate('/'); toast('Job deleted')
  }
  pendingDelete = null
}

// ── Add/Edit Job Modal ────────────────────────────────────────────────────
let editingJobId = null

function openAddJobModal() {
  editingJobId = null
  document.getElementById('modal-job-title').textContent = 'Add Job'
  document.getElementById('job-form').reset()
  document.getElementById('tags-preview').innerHTML = ''
  openModal('modal-job')
}

function openEditJobModal() {
  const job = DB.getJob(currentJobId); if (!job) return
  editingJobId = job.id
  document.getElementById('modal-job-title').textContent = 'Edit Job'
  document.getElementById('job-company').value = job.company || ''
  document.getElementById('job-role').value = job.role || ''
  document.getElementById('job-notes').value = job.notes || ''
  // Render existing tags
  const preview = document.getElementById('tags-preview')
  preview.innerHTML = ''
  ;(job.tags || []).forEach(t => addTagChipToPreview(t))
  openModal('modal-job')
}

// ── Tag input logic ───────────────────────────────────────────────────────
function handleTagKeydown(e) {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault()
    const val = e.target.value.trim().replace(/,$/, '')
    if (val) { addTagChipToPreview(val); e.target.value = '' }
  }
}

function addTagChipToPreview(tag) {
  const preview = document.getElementById('tags-preview')
  // Don't add duplicates
  const existing = [...preview.querySelectorAll('.tag-chip-edit')].map(el => el.dataset.tag)
  if (existing.includes(tag)) return
  const chip = document.createElement('span')
  chip.className = 'tag-chip-edit'
  chip.dataset.tag = tag
  chip.innerHTML = `${esc(tag)} <button type="button" onclick="this.parentElement.remove()" style="background:none;border:none;cursor:pointer;font-size:12px;color:inherit;padding:0;margin-left:2px">×</button>`
  preview.appendChild(chip)
}

function getTagsFromPreview() {
  return [...document.querySelectorAll('#tags-preview .tag-chip-edit')].map(el => el.dataset.tag)
}

function saveJob() {
  const company = document.getElementById('job-company').value.trim()
  const role = document.getElementById('job-role').value.trim()
  if (!company || !role) { toast('Company and role are required'); return }

  // Also capture any unsubmitted tag input
  const tagInput = document.getElementById('job-tags-input')
  if (tagInput.value.trim()) { addTagChipToPreview(tagInput.value.trim()); tagInput.value = '' }

  const job = editingJobId ? DB.getJob(editingJobId) : { id: DB.newId(), documents: {}, prepSections: [] }
  job.company = company
  job.role = role
  job.notes = document.getElementById('job-notes').value.trim()
  job.tags = getTagsFromPreview()

  DB.saveJob(job)
  closeModal('modal-job')
  if (editingJobId) { showJobDetail(job.id); toast('Saved ✓') }
  else navigate(`/job/${job.id}`)
}

// ── Modal Helpers ─────────────────────────────────────────────────────────
function openModal(id) { document.getElementById(id)?.classList.add('open') }
function closeModal(id) { document.getElementById(id)?.classList.remove('open') }

document.addEventListener('click', e => { if (e.target.classList.contains('modal-overlay')) e.target.classList.remove('open') })
document.addEventListener('keydown', e => { if (e.key === 'Escape') document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open')) })

// ── Utility ───────────────────────────────────────────────────────────────
function esc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}
