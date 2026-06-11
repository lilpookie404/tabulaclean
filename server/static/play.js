const appState = {
  config: null,
  mode: "manual",
  runner: "deterministic",
  ui: {
    actionType: "inspect_table",
    tableView: "current",
  },
  manualSession: {
    socket: null,
    taskId: null,
    rawTable: [],
    observation: null,
    state: null,
    trajectory: [],
    status: "loading",
    lastError: null,
    pendingRawCapture: false,
  },
  autoRun: {
    source: null,
    taskId: null,
    rawTable: [],
    observation: null,
    state: null,
    trajectory: [],
    status: "idle",
    lastError: null,
    summary: null,
  },
}

const els = {}

document.addEventListener("DOMContentLoaded", () => {
  cacheElements()
  bindEvents()
  bootstrap().catch((error) => {
    console.error(error)
    setGlobalStatus("Error", "status-danger")
    els.stepStream.innerHTML = `<div class="stream-item"><header><strong>Bootstrap failed</strong></header><p>${escapeHtml(String(error))}</p></div>`
  })
})

function cacheElements() {
  const ids = [
    "task-select",
    "score-chip",
    "steps-chip",
    "status-chip",
    "copy-link-button",
    "reset-button",
    "start-auto-button",
    "clear-auto-button",
    "task-title",
    "task-difficulty",
    "task-description",
    "task-domain",
    "task-source",
    "task-rows",
    "task-next-stage",
    "before-count",
    "current-count",
    "before-table",
    "current-table",
    "issues-list",
    "validation-list",
    "step-stream",
    "run-summary",
    "audit-timeline",
    "review-queue",
    "action-form",
    "action-type",
    "action-fields",
    "action-preview",
    "quick-actions",
    "runner-chip",
    "llm-chip",
    "auto-helper-text",
    "workflow-progress",
  ]
  for (const id of ids) {
    els[toCamel(id)] = document.getElementById(id)
  }
  els.modeButtons = Array.from(document.querySelectorAll("[data-mode]"))
  els.runnerButtons = Array.from(document.querySelectorAll("[data-runner]"))
  els.modePanels = Array.from(document.querySelectorAll("[data-mode-panel]"))
  els.tableViewButtons = Array.from(document.querySelectorAll("[data-table-view]"))
}

function bindEvents() {
  els.taskSelect.addEventListener("change", async (event) => {
    const nextTask = sanitizeTaskId(event.target.value)
    appState.manualSession.taskId = nextTask
    appState.autoRun.taskId = nextTask
    clearAutoRun()
    syncQuery()
    await resetManualTask(nextTask)
  })

  els.modeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      appState.mode = button.dataset.mode || "manual"
      syncQuery()
      renderWorkbench()
    })
  })

  els.runnerButtons.forEach((button) => {
    button.addEventListener("click", () => {
      if (button.disabled) {
        return
      }
      appState.runner = button.dataset.runner || "deterministic"
      syncQuery()
      renderWorkbench()
    })
  })

  els.copyLinkButton.addEventListener("click", async () => {
    const link = buildShareUrl()
    try {
      await navigator.clipboard.writeText(link)
      els.copyLinkButton.textContent = "Copied!"
      window.setTimeout(() => {
        els.copyLinkButton.textContent = "Copy Link"
      }, 1200)
    } catch (_error) {
      window.prompt("Copy this workbench link", link)
    }
  })

  els.resetButton.addEventListener("click", async () => {
    clearAutoRun()
    await resetManualTask(appState.manualSession.taskId || appState.config.default_task_id)
  })

  els.startAutoButton.addEventListener("click", () => {
    startAutoRun()
  })

  els.clearAutoButton.addEventListener("click", () => {
    clearAutoRun()
    renderWorkbench()
  })

  els.actionType.addEventListener("change", () => {
    appState.ui.actionType = els.actionType.value
    renderActionFields()
    updateActionPreview()
  })

  els.actionForm.addEventListener("input", () => {
    updateActionPreview()
  })

  els.actionForm.addEventListener("click", (event) => {
    const target = event.target
    if (!(target instanceof HTMLElement)) {
      return
    }
    if (target.dataset.addReplacement === "true") {
      event.preventDefault()
      addReplacementRow()
      updateActionPreview()
    }
    if (target.dataset.removeReplacement === "true") {
      event.preventDefault()
      target.closest(".replacement-row")?.remove()
      updateActionPreview()
    }
  })

  els.actionForm.addEventListener("submit", (event) => {
    event.preventDefault()
    submitManualAction()
  })

  els.quickActions.addEventListener("click", (event) => {
    const target = event.target
    if (!(target instanceof HTMLElement)) {
      return
    }
    const suggestion = target.dataset.suggestion
    if (!suggestion) {
      return
    }
    submitManualAction(resolveSuggestionPayload(suggestion))
  })

  els.reviewQueue.addEventListener("click", (event) => {
    const target = event.target
    if (!(target instanceof HTMLElement)) {
      return
    }
    const action = target.dataset.reviewAction
    const changeId = target.dataset.changeId
    if (!action || !changeId) {
      return
    }
    if (action === "approve") {
      submitManualAction({ action_type: "approve_changes", change_id: changeId })
    }
    if (action === "reject") {
      submitManualAction({ action_type: "reject_change", change_id: changeId })
    }
  })
}

async function bootstrap() {
  const response = await fetch("/play/api/config")
  appState.config = await response.json()
  const params = new URLSearchParams(window.location.search)
  appState.mode = sanitizeMode(params.get("mode"))
  appState.runner = sanitizeRunner(params.get("runner"))
  const taskId = sanitizeTaskId(params.get("task"))
  appState.manualSession.taskId = taskId
  appState.autoRun.taskId = taskId

  populateTaskSelect()
  applyControlState()
  setGlobalStatus("Connecting", "status-warning")
  await openManualSocket()
  await resetManualTask(taskId)
  renderWorkbench()
}

function populateTaskSelect() {
  els.taskSelect.innerHTML = appState.config.tasks
    .map(
      (task) => `<option value="${escapeHtml(task.task_id)}">${escapeHtml(task.task_id)} · ${escapeHtml(
        titleCase(task.difficulty)
      )}</option>`
    )
    .join("")
  els.taskSelect.value = appState.manualSession.taskId
  const taskIds = appState.config.tasks.map((task) => task.task_id)
  const availableActions = getActiveObservation()?.available_actions || ["inspect_table"]
  const selected = availableActions.includes(appState.ui.actionType) ? appState.ui.actionType : availableActions[0]
  appState.ui.actionType = selected
  els.actionType.innerHTML = availableActions
    .map((action) => `<option value="${escapeHtml(action)}">${escapeHtml(action)}</option>`)
    .join("")
  if (taskIds.length && !taskIds.includes(appState.manualSession.taskId)) {
    appState.manualSession.taskId = appState.config.default_task_id
  }
}

async function openManualSocket() {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
  const socket = new WebSocket(`${protocol}//${window.location.host}/ws`)
  appState.manualSession.socket = socket

  socket.addEventListener("open", () => {
    appState.manualSession.status = "connected"
    renderWorkbench()
  })

  socket.addEventListener("message", (event) => {
    const payload = JSON.parse(event.data)
    if (payload.type === "observation") {
      handleManualObservation(payload.data)
      requestManualState()
    } else if (payload.type === "state") {
      handleManualState(payload.data)
    } else if (payload.type === "error") {
      appState.manualSession.lastError = payload.data?.message || "Unknown socket error"
      appState.manualSession.status = "error"
      renderWorkbench()
    }
  })

  socket.addEventListener("close", () => {
    appState.manualSession.status = "disconnected"
    renderWorkbench()
  })

  socket.addEventListener("error", () => {
    appState.manualSession.status = "error"
    appState.manualSession.lastError = "WebSocket connection failed"
    renderWorkbench()
  })

  await waitForSocketOpen(socket)
}

function waitForSocketOpen(socket) {
  return new Promise((resolve, reject) => {
    if (socket.readyState === WebSocket.OPEN) {
      resolve()
      return
    }
    const timeout = window.setTimeout(() => {
      reject(new Error("WebSocket connection timed out"))
    }, 4000)
    socket.addEventListener(
      "open",
      () => {
        window.clearTimeout(timeout)
        resolve()
      },
      { once: true }
    )
    socket.addEventListener(
      "error",
      () => {
        window.clearTimeout(timeout)
        reject(new Error("WebSocket connection failed"))
      },
      { once: true }
    )
  })
}

async function resetManualTask(taskId) {
  appState.manualSession.taskId = taskId
  appState.manualSession.rawTable = []
  appState.manualSession.observation = null
  appState.manualSession.state = null
  appState.manualSession.trajectory = []
  appState.manualSession.lastError = null
  appState.manualSession.pendingRawCapture = true
  appState.manualSession.status = "resetting"
  renderWorkbench()
  sendManualMessage({ type: "reset", data: { task_id: taskId } })
}

function sendManualMessage(message) {
  const socket = appState.manualSession.socket
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    appState.manualSession.status = "error"
    appState.manualSession.lastError = "WebSocket session is not connected"
    renderWorkbench()
    return
  }
  socket.send(JSON.stringify(message))
}

function requestManualState() {
  sendManualMessage({ type: "state" })
}

function normalizeObservation(wrapper) {
  return {
    ...(wrapper.observation || {}),
    reward: wrapper.reward,
    done: wrapper.done,
  }
}

function handleManualObservation(wrapper) {
  const observation = normalizeObservation(wrapper)
  appState.manualSession.observation = observation
  if (observation.last_action) {
    appState.manualSession.trajectory.push({
      kind: "manual",
      step: observation.steps_taken,
      action: observation.last_action,
      actionText: formatAction(observation.last_action),
      reward: observation.reward,
      done: observation.done,
      error: observation.last_action_error || null,
    })
  }
  if (observation.last_action_error) {
    appState.manualSession.lastError = observation.last_action_error
  }
  if (observation.done) {
    appState.manualSession.status = observation.change_set_summary?.published ? "published" : "complete"
  } else {
    appState.manualSession.status = "ready"
  }
  populateActionChoices()
  renderWorkbench()
}

function handleManualState(statePayload) {
  appState.manualSession.state = statePayload
  if (appState.manualSession.pendingRawCapture) {
    appState.manualSession.rawTable = deepCopy(statePayload.current_table || [])
    appState.manualSession.pendingRawCapture = false
  }
  renderWorkbench()
}

function startAutoRun() {
  clearAutoRun()
  const taskId = appState.autoRun.taskId || appState.manualSession.taskId || appState.config.default_task_id
  const runner = appState.runner
  appState.mode = "auto"
  appState.autoRun.taskId = taskId
  appState.autoRun.status = "running"
  appState.autoRun.lastError = null
  syncQuery()
  renderWorkbench()

  const url = `/play/api/autorun-stream?task=${encodeURIComponent(taskId)}&runner=${encodeURIComponent(runner)}`
  const source = new EventSource(url)
  appState.autoRun.source = source

  source.addEventListener("start", (event) => {
    const payload = JSON.parse(event.data)
    appState.autoRun.rawTable = deepCopy(payload.raw_table || [])
    appState.autoRun.observation = payload.observation || null
    appState.autoRun.state = payload.state || null
    appState.autoRun.trajectory = []
    appState.autoRun.summary = null
    appState.autoRun.status = "running"
    renderWorkbench()
  })

  source.addEventListener("step", (event) => {
    const payload = JSON.parse(event.data)
    appState.autoRun.observation = payload.observation || null
    appState.autoRun.state = payload.state || null
    appState.autoRun.trajectory.push({
      kind: "auto",
      step: payload.step,
      action: payload.action,
      actionText: payload.action_text || formatAction(payload.action),
      reward: payload.reward,
      done: payload.done,
      error: payload.error === "null" ? null : payload.error,
    })
    renderWorkbench()
  })

  source.addEventListener("end", (event) => {
    const payload = JSON.parse(event.data)
    appState.autoRun.summary = payload
    appState.autoRun.observation = payload.final_observation || appState.autoRun.observation
    appState.autoRun.state = payload.final_state || appState.autoRun.state
    appState.autoRun.status = payload.success ? "published" : "complete"
    source.close()
    appState.autoRun.source = null
    renderWorkbench()
  })

  source.addEventListener("error", (event) => {
    if (!("data" in event) || !event.data) {
      return
    }
    const payload = JSON.parse(event.data)
    appState.autoRun.lastError = payload.message || "Auto run failed"
    appState.autoRun.status = "error"
    renderWorkbench()
  })

  source.onerror = () => {
    if (appState.autoRun.status === "running") {
      appState.autoRun.lastError = appState.autoRun.lastError || "Stream connection interrupted"
      appState.autoRun.status = "error"
      renderWorkbench()
    }
  }
}

function clearAutoRun() {
  if (appState.autoRun.source) {
    appState.autoRun.source.close()
  }
  appState.autoRun.source = null
  appState.autoRun.rawTable = []
  appState.autoRun.observation = null
  appState.autoRun.state = null
  appState.autoRun.trajectory = []
  appState.autoRun.status = "idle"
  appState.autoRun.lastError = null
  appState.autoRun.summary = null
}

function submitManualAction(overridePayload = null) {
  const payload = overridePayload || buildActionPayload()
  if (!payload.action_type) {
    return
  }
  appState.manualSession.status = "stepping"
  renderWorkbench()
  sendManualMessage({ type: "step", data: payload })
}

function buildActionPayload() {
  const actionType = els.actionType.value
  const payload = { action_type: actionType }
  const read = (name) => {
    const element = els.actionForm.querySelector(`[name="${name}"]`)
    return element ? element.value.trim() : ""
  }

  if (actionType === "inspect_table") {
    const previewRows = Number(read("preview_rows") || "5")
    if (previewRows) {
      payload.preview_rows = previewRows
    }
  }

  if (actionType === "inspect_column") {
    payload.column = read("column")
  }

  if (actionType === "rename_column") {
    payload.column = read("column")
    payload.new_name = read("new_name")
  }

  if (actionType === "normalize_case") {
    payload.column = read("column")
    payload.case_mode = read("case_mode")
  }

  if (actionType === "replace_values") {
    payload.column = read("column")
    payload.replacements = collectReplacementPairs()
  }

  if (actionType === "standardize_date") {
    const column = read("column")
    if (column) {
      payload.column = column
    }
  }

  if (actionType === "fill_missing") {
    const column = read("column")
    const fillValue = read("fill_value")
    if (column) {
      payload.column = column
    }
    if (fillValue) {
      payload.fill_value = fillValue
    }
  }

  if (actionType === "fill_forward") {
    const column = read("column")
    if (column) {
      payload.column = column
    }
  }

  if (actionType === "cast_dtype") {
    payload.column = read("column")
    payload.dtype = read("dtype")
  }

  if (actionType === "sort_rows") {
    const sortBy = read("sort_by")
    const ascending = els.actionForm.querySelector(`[name="ascending"]`)?.checked !== false
    payload.sort_by = sortBy ? sortBy.split(",").map((item) => item.trim()).filter(Boolean) : []
    payload.ascending = ascending
  }

  if (actionType === "approve_changes" || actionType === "reject_change") {
    payload.change_id = read("change_id")
  }

  if (actionType === "export_cleaned_table") {
    const destination = read("destination")
    if (destination) {
      payload.destination = destination
    }
  }

  return pruneEmptyFields(payload)
}

function collectReplacementPairs() {
  const rows = Array.from(els.actionFields.querySelectorAll(".replacement-row"))
  const replacements = {}
  rows.forEach((row) => {
    const from = row.querySelector('[name="replacement_from"]')?.value.trim()
    const to = row.querySelector('[name="replacement_to"]')?.value.trim()
    if (from) {
      replacements[from] = to || ""
    }
  })
  return replacements
}

function updateActionPreview() {
  els.actionPreview.textContent = JSON.stringify(buildActionPayload(), null, 2)
}

function populateActionChoices() {
  const actions = getActiveObservation()?.available_actions || ["inspect_table"]
  const selected = actions.includes(appState.ui.actionType) ? appState.ui.actionType : actions[0]
  appState.ui.actionType = selected
  els.actionType.innerHTML = actions
    .map((action) => `<option value="${escapeHtml(action)}">${escapeHtml(action)}</option>`)
    .join("")
  els.actionType.value = selected
  renderActionFields()
}

function renderActionFields() {
  const taskRules = getManualObservation()?.task_rules || {}
  const pendingChanges = getManualObservation()?.proposed_changes_summary || []
  const columns = getManualState()?.current_columns || getManualObservation()?.table_columns || []
  const actionType = appState.ui.actionType
  let html = ""

  const columnOptions = (includeBlank = false) => {
    const options = columns.map((column) => `<option value="${escapeHtml(column)}">${escapeHtml(column)}</option>`)
    if (includeBlank) {
      options.unshift('<option value="">Use task defaults</option>')
    }
    return options.join("")
  }

  if (actionType === "inspect_table") {
    html = fieldTemplate("Preview Rows", '<input class="text-input" type="number" name="preview_rows" min="1" max="10" value="5">')
  } else if (actionType === "inspect_column") {
    html = fieldTemplate("Column", `<select class="select-control" name="column">${columnOptions()}</select>`)
  } else if (actionType === "rename_column") {
    html = [
      fieldTemplate("Column", `<select class="select-control" name="column">${columnOptions()}</select>`),
      fieldTemplate("New Name", '<input class="text-input" name="new_name" placeholder="contact_name">'),
    ].join("")
  } else if (actionType === "normalize_case") {
    html = [
      fieldTemplate("Column", `<select class="select-control" name="column">${columnOptions()}</select>`),
      fieldTemplate(
        "Case Mode",
        '<select class="select-control" name="case_mode"><option value="lower">lower</option><option value="upper">upper</option><option value="title">title</option></select>'
      ),
    ].join("")
  } else if (actionType === "replace_values") {
    html = [
      fieldTemplate("Column", `<select class="select-control" name="column">${columnOptions()}</select>`),
      '<div class="field-block"><span class="field-label">Replacement Pairs</span><div id="replacement-pairs"></div><button type="button" class="secondary-button" data-add-replacement="true">Add Pair</button></div>',
    ].join("")
  } else if (actionType === "standardize_date") {
    html = fieldTemplate("Column", `<select class="select-control" name="column">${columnOptions(true)}</select>`)
  } else if (actionType === "fill_missing") {
    html = [
      fieldTemplate("Column", `<select class="select-control" name="column">${columnOptions(true)}</select>`),
      fieldTemplate(
        "Fill Value",
        `<input class="text-input" name="fill_value" value="${escapeHtml(defaultFillValue(taskRules))}" placeholder="UNKNOWN">`
      ),
    ].join("")
  } else if (actionType === "fill_forward") {
    html = fieldTemplate("Column", `<select class="select-control" name="column">${columnOptions()}</select>`)
  } else if (actionType === "cast_dtype") {
    html = [
      fieldTemplate("Column", `<select class="select-control" name="column">${columnOptions()}</select>`),
      fieldTemplate(
        "Dtype",
        '<select class="select-control" name="dtype"><option value="float">float</option><option value="int">int</option><option value="str">str</option></select>'
      ),
    ].join("")
  } else if (actionType === "sort_rows") {
    html = [
      fieldTemplate(
        "Sort By",
        `<input class="text-input" name="sort_by" value="${escapeHtml(
          (taskRules.recommended_sort || []).join(", ")
        )}" placeholder="customer_id">`
      ),
      '<label class="field-block"><span class="field-label">Ascending</span><input type="checkbox" name="ascending" checked></label>',
    ].join("")
  } else if (actionType === "approve_changes" || actionType === "reject_change") {
    html = fieldTemplate(
      "Change ID",
      `<select class="select-control" name="change_id">${pendingChanges
        .map((change) => `<option value="${escapeHtml(change.change_id)}">${escapeHtml(change.change_id)}</option>`)
        .join("")}</select>`
    )
  } else if (actionType === "export_cleaned_table") {
    html = fieldTemplate(
      "Destination",
      `<input class="text-input" name="destination" value="${escapeHtml(
        taskRules.default_export_destination || ""
      )}" placeholder="warehouse_ready_json">`
    )
  }

  els.actionFields.innerHTML = html
  if (actionType === "replace_values") {
    const pairsContainer = document.getElementById("replacement-pairs")
    pairsContainer.innerHTML = ""
    addReplacementRow()
  }
  updateActionPreview()
}

function addReplacementRow() {
  const pairsContainer = document.getElementById("replacement-pairs")
  if (!pairsContainer) {
    return
  }
  const row = document.createElement("div")
  row.className = "replacement-row button-grid"
  row.innerHTML = `
    <input class="text-input" name="replacement_from" placeholder="from">
    <input class="text-input" name="replacement_to" placeholder="to">
    <button type="button" class="secondary-button" data-remove-replacement="true">Remove</button>
  `
  pairsContainer.appendChild(row)
}

function renderWorkbench() {
  applyControlState()
  renderTaskOverview()
  renderWorkflowProgress()
  renderQuickActions()
  renderTables()
  renderIssues()
  renderValidation()
  renderReviewQueue()
  renderTrajectory()
  renderTimeline()
  renderRunSummary()
  updateActionPreview()
}

function applyControlState() {
  els.taskSelect.value = appState.manualSession.taskId || appState.config.default_task_id
  els.modeButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === appState.mode)
  })
  els.runnerButtons.forEach((button) => {
    const isActive = button.dataset.runner === appState.runner
    button.classList.toggle("active", isActive)
    if (button.dataset.runner === "llm") {
      button.disabled = !appState.config.llm_available
    }
  })
  els.modePanels.forEach((panel) => {
    panel.classList.toggle("hidden", panel.dataset.modePanel !== appState.mode)
  })
  els.runnerChip.textContent = appState.runner
  els.llmChip.textContent = appState.config.llm_available ? "Available" : "Disabled"
  els.autoHelperText.textContent = appState.config.llm_available
    ? "Switch between deterministic and LLM-backed automated runs from the toolbar."
    : appState.config.llm_reason || "LLM mode is unavailable in this deployment."
}

function renderWorkflowProgress() {
  const observation = getActiveObservation()
  if (!observation) {
    els.workflowProgress.innerHTML = '<div class="wf-step"><div class="wf-dot"></div><span class="wf-label">Waiting for task state</span></div>'
    return
  }
  const stages = ["profile", "clean", "review", "validate", "export", "publish"]
  const nextStage = observation.change_set_summary?.next_stage || "profile"
  const currentIndex = observation.change_set_summary?.published ? stages.length : Math.max(stages.indexOf(nextStage), 0)
  els.workflowProgress.innerHTML = stages
    .map((stage, index) => {
      const dotClass = index < currentIndex ? "wf-dot done" : index === currentIndex ? "wf-dot current" : "wf-dot"
      const labelClass = index < currentIndex ? "wf-label done" : index === currentIndex ? "wf-label current" : "wf-label"
      return `<div class="wf-step"><div class="${dotClass}"></div><span class="${labelClass}">${escapeHtml(titleCase(stage))}</span></div>`
    })
    .join("")
}

function renderTaskOverview() {
  const activeTaskId = getActiveTaskId()
  const taskMeta = taskConfig(activeTaskId)
  const activeObservation = getActiveObservation()
  const activeState = getActiveState()
  const rowCount = activeObservation?.row_count ?? activeState?.current_table?.length ?? 0
  const nextStage = activeObservation?.change_set_summary?.next_stage || "profile"
  const scoreValue = activeObservation?.current_score_estimate ?? activeState?.current_score ?? null
  const stepsValue = activeObservation?.steps_taken ?? activeState?.step_count ?? 0

  els.taskTitle.textContent = activeTaskId
  els.taskDifficulty.textContent = titleCase(taskMeta?.difficulty || "manual")
  els.taskDescription.textContent = activeObservation?.task_description || taskMeta?.description || ""
  els.taskDomain.textContent = taskMeta?.domain || "--"
  els.taskSource.textContent = activeObservation?.source_system || taskMeta?.source_system || "--"
  els.taskRows.textContent = `${rowCount} rows`
  els.taskNextStage.textContent = titleCase(nextStage.replace(/_/g, " "))
  els.scoreChip.textContent = scoreValue == null ? "--" : Number(scoreValue).toFixed(2)
  els.stepsChip.textContent = String(stepsValue)
  setGlobalStatus(globalStatusLabel(), globalStatusClass())
}

function renderTables() {
  const active = getActiveSession()
  const currentTable = active.state?.current_table || []
  const rawTable = active.rawTable || []
  els.beforeCount.textContent = `${rawTable.length} rows`
  els.currentCount.textContent = `${currentTable.length} rows`
  els.beforeTable.className = rawTable.length ? "table-shell" : "table-shell empty-state"
  els.currentTable.className = currentTable.length ? "table-shell" : "table-shell empty-state"
  els.beforeTable.innerHTML = renderTable(rawTable, currentTable, getPrimaryKey(), "before")
  els.currentTable.innerHTML = renderTable(currentTable, rawTable, getPrimaryKey(), "current")
}

function renderIssues() {
  const issues = getActiveObservation()?.issues_summary || []
  if (!issues.length) {
    els.issuesList.innerHTML = "<li>No issues reported.</li>"
    return
  }
  els.issuesList.innerHTML = issues.map((issue) => `<li>${escapeHtml(issue)}</li>`).join("")
}

function renderValidation() {
  const checks = getActiveObservation()?.validation_checks || getActiveState()?.validation_results || []
  if (!checks.length) {
    els.validationList.innerHTML = "Run validations to populate checks."
    els.validationList.className = "validation-list empty-state"
    return
  }
  els.validationList.className = "validation-list"
  els.validationList.innerHTML = checks
    .map((check) => {
      const passed = check.passed === true || check.status === "passed"
      const message = check.message || check.rule_message || check.description || ""
      const title = check.check_id || check.rule_id || check.id || "validation"
      return `
        <article class="validation-item ${passed ? "pass" : "fail"}">
          <header><strong>${escapeHtml(title)}</strong><span>${passed ? "Pass" : "Needs review"}</span></header>
          <p>${escapeHtml(message)}</p>
        </article>
      `
    })
    .join("")
}

function renderReviewQueue() {
  const queue = getManualObservation()?.proposed_changes_summary || []
  if (!queue.length) {
    els.reviewQueue.className = "review-queue empty-state"
    els.reviewQueue.textContent = "No risky changes waiting for review."
    return
  }
  els.reviewQueue.className = "review-queue"
  els.reviewQueue.innerHTML = queue
    .map(
      (change) => `
        <article class="review-item">
          <header>
            <div>
              <strong>${escapeHtml(change.change_id)}</strong>
              <div class="eyebrow">${escapeHtml(change.action_type)} · ${escapeHtml(change.risk_category || "review")}</div>
            </div>
            <span>${escapeHtml(String(change.affected_row_count || 0))} rows</span>
          </header>
          <p>${escapeHtml(change.reason || "Review required before continuing.")}</p>
          <div class="review-actions">
            <button type="button" class="primary-button" data-review-action="approve" data-change-id="${escapeHtml(
              change.change_id
            )}">Approve</button>
            <button type="button" class="secondary-button" data-review-action="reject" data-change-id="${escapeHtml(
              change.change_id
            )}">Reject</button>
          </div>
        </article>
      `
    )
    .join("")
}

function renderQuickActions() {
  const observation = getManualObservation()
  if (!observation) {
    els.quickActions.innerHTML = '<div class="empty-state">Reset a task to load action suggestions.</div>'
    return
  }

  const safe = observation.change_set_summary?.suggested_safe_actions || observation.workflow_metadata?.suggested_safe_actions || []
  const risky = observation.change_set_summary?.suggested_risky_actions || observation.workflow_metadata?.suggested_risky_actions || []
  const entries = [
    ...safe.map((suggestion) => ({ suggestion, risky: false })),
    ...risky.map((suggestion) => ({ suggestion, risky: true })),
  ]

  if (!entries.length) {
    els.quickActions.innerHTML = '<div class="empty-state">No quick actions available for the current state.</div>'
    return
  }

  els.quickActions.innerHTML = entries
    .map(({ suggestion, risky }) => {
      const label = suggestion.replaceAll("_", " ").replaceAll(":", " -> ")
      return `
        <button
          type="button"
          class="${risky ? "secondary-button risky-button" : "secondary-button"}"
          data-suggestion="${escapeHtml(suggestion)}"
        >
          ${escapeHtml(titleCase(label))}
        </button>
      `
    })
    .join("")
}

function renderTrajectory() {
  const trajectory = getActiveSession().trajectory || []
  if (!trajectory.length) {
    els.stepStream.className = "log-stream empty-state"
    els.stepStream.textContent = appState.mode === "auto" ? "Start an auto run to stream steps live." : "Take a step to build a trajectory."
    return
  }
  els.stepStream.className = "log-stream"
  els.stepStream.innerHTML = trajectory
    .map(
      (entry) => `
        <article class="stream-item">
          <header>
            <strong>Step ${escapeHtml(String(entry.step))}</strong>
            <span>reward ${Number(entry.reward || 0).toFixed(2)}</span>
          </header>
          <p>${escapeHtml(entry.actionText)}</p>
          <p>${escapeHtml(entry.done ? "done=true" : "done=false")} · ${escapeHtml(entry.error || "error=null")}</p>
        </article>
      `
    )
    .join("")
}

function renderTimeline() {
  const timeline = getActiveState()?.transformation_log || []
  if (!timeline.length) {
    els.auditTimeline.className = "timeline empty-state"
    els.auditTimeline.textContent = "Audit events will appear here."
    return
  }
  els.auditTimeline.className = "timeline"
  els.auditTimeline.innerHTML = timeline
    .slice()
    .reverse()
    .map(
      (entry) => `
        <article class="timeline-item">
          <header>
            <strong>${escapeHtml(entry.change_id || "audit")}</strong>
            <span>step ${escapeHtml(String(entry.step || 0))}</span>
          </header>
          <p>${escapeHtml(entry.action_type || "action")} · ${escapeHtml(entry.status || entry.reason || "recorded")}</p>
        </article>
      `
    )
    .join("")
}

function renderRunSummary() {
  const session = getActiveSession()
  const summary = appState.mode === "auto" ? appState.autoRun.summary : buildManualSummary()
  if (!summary) {
    els.runSummary.className = "run-summary empty-state"
    els.runSummary.textContent = "No run has completed yet."
    return
  }
  els.runSummary.className = "run-summary"
  const rewardsText = (summary.rewards || []).map((value) => Number(value).toFixed(2)).join(", ")
  els.runSummary.innerHTML = `
    <div class="summary-grid">
      <div><span class="summary-label">Success</span><strong class="${summary.success ? "status-success" : "status-danger"}">${summary.success ? "true" : "false"}</strong></div>
      <div><span class="summary-label">Published</span><strong>${summary.published ? "true" : "false"}</strong></div>
      <div><span class="summary-label">Steps</span><strong>${escapeHtml(String(summary.steps || 0))}</strong></div>
      <div><span class="summary-label">Score</span><strong>${summary.score == null ? "--" : Number(summary.score).toFixed(2)}</strong></div>
    </div>
    <div class="validation-item">
      <header><strong>Rewards</strong><span>${escapeHtml(appState.mode)}</span></header>
      <p>${escapeHtml(rewardsText || "No rewards emitted.")}</p>
    </div>
    ${
      session.lastError || summary.error
        ? `<div class="validation-item fail"><header><strong>Latest Error</strong></header><p>${escapeHtml(
            session.lastError || summary.error
          )}</p></div>`
        : ""
    }
  `
}

function buildManualSummary() {
  const state = appState.manualSession.state
  const observation = appState.manualSession.observation
  if (!state || !observation) {
    return null
  }
  return {
    success: Boolean(state.published),
    published: Boolean(state.published),
    steps: observation.steps_taken || state.step_count || 0,
    score: state.current_score,
    rewards: appState.manualSession.trajectory.map((entry) => entry.reward),
    error: appState.manualSession.lastError,
  }
}

function renderTable(primaryRows, comparisonRows, primaryKey, side) {
  if (!primaryRows || !primaryRows.length) {
    return "No rows to display."
  }
  const columns = orderedColumns(primaryRows)
  const comparisonMap = rowMap(comparisonRows, primaryKey)
  const tableHtml = primaryRows
    .map((row, index) => {
      const key = rowKey(row, primaryKey, index)
      const comparison = comparisonMap.get(key)
      const cells = columns
        .map((column) => {
          const value = row[column]
          const normalizedValue = value == null || value === "" ? "EMPTY" : String(value)
          const comparisonValue = comparison ? comparison[column] : undefined
          const classes = []
          if (value == null || value === "") {
            classes.push("missing-cell")
          }
          if (comparison && String(comparisonValue ?? "") !== String(value ?? "")) {
            classes.push("mutated-cell")
          }
          if (!comparison && side === "current") {
            classes.push("mutated-cell")
          }
          return `<td class="${classes.join(" ")}">${escapeHtml(normalizedValue)}</td>`
        })
        .join("")
      return `<tr>${cells}</tr>`
    })
    .join("")
  return `
    <table class="data-grid">
      <thead>
        <tr>${columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("")}</tr>
      </thead>
      <tbody>${tableHtml}</tbody>
    </table>
  `
}

function rowMap(rows, primaryKey) {
  const map = new Map()
  ;(rows || []).forEach((row, index) => {
    map.set(rowKey(row, primaryKey, index), row)
  })
  return map
}

function rowKey(row, primaryKey, index) {
  if (primaryKey && primaryKey.length) {
    return primaryKey.map((column) => String(row?.[column] ?? "")).join("::")
  }
  return `row-${index}`
}

function orderedColumns(rows) {
  const seen = new Set()
  const columns = []
  rows.forEach((row) => {
    Object.keys(row || {}).forEach((key) => {
      if (!seen.has(key)) {
        seen.add(key)
        columns.push(key)
      }
    })
  })
  return columns
}

function resolveSuggestionPayload(suggestion) {
  const taskRules = getManualObservation()?.task_rules || {}
  const state = getManualState()
  const [actionName, argument] = suggestion.split(":")
  const currentColumns = state?.current_columns || getManualObservation()?.table_columns || []

  if (actionName === "strip_whitespace") {
    return { action_type: "strip_whitespace" }
  }
  if (actionName === "standardize_date") {
    return { action_type: "standardize_date" }
  }
  if (actionName === "run_validations") {
    return { action_type: "run_validations" }
  }
  if (actionName === "publish_table") {
    return { action_type: "publish_table" }
  }
  if (actionName === "rename_column") {
    const renameMap = taskRules.rename_map || {}
    const nextEntry = Object.entries(renameMap).find(([source, target]) => currentColumns.includes(source) && !currentColumns.includes(target))
    if (nextEntry) {
      return { action_type: "rename_column", column: nextEntry[0], new_name: nextEntry[1] }
    }
  }
  if (actionName === "normalize_case" && argument) {
    return { action_type: "normalize_case", column: argument, case_mode: taskRules.case_columns?.[argument] || "title" }
  }
  if (actionName === "replace_values" && argument) {
    return { action_type: "replace_values", column: argument, replacements: taskRules.normalization_hints?.[argument] || {} }
  }
  if (actionName === "fill_missing") {
    if (argument) {
      return {
        action_type: "fill_missing",
        column: argument,
        fill_value: taskRules.fill_defaults?.[argument] || defaultFillValue(taskRules),
      }
    }
    return { action_type: "fill_missing", fill_value: defaultFillValue(taskRules) }
  }
  return { action_type: actionName }
}

function getActiveSession() {
  return appState.mode === "auto" ? appState.autoRun : appState.manualSession
}

function getActiveObservation() {
  return getActiveSession().observation
}

function getManualObservation() {
  return appState.manualSession.observation
}

function getActiveState() {
  return getActiveSession().state
}

function getManualState() {
  return appState.manualSession.state
}

function getActiveTaskId() {
  return getActiveSession().taskId || appState.manualSession.taskId || appState.config.default_task_id
}

function getPrimaryKey() {
  return getActiveObservation()?.task_rules?.primary_key || []
}

function sanitizeTaskId(candidate) {
  const taskIds = appState.config?.tasks?.map((task) => task.task_id) || []
  if (taskIds.includes(candidate)) {
    return candidate
  }
  return appState.config?.default_task_id || "easy_contacts_cleanup"
}

function sanitizeMode(candidate) {
  return candidate === "auto" ? "auto" : "manual"
}

function sanitizeRunner(candidate) {
  if (candidate === "llm" && appState.config?.llm_available) {
    return "llm"
  }
  return "deterministic"
}

function syncQuery() {
  const params = new URLSearchParams()
  params.set("task", appState.manualSession.taskId || appState.config.default_task_id)
  params.set("mode", appState.mode)
  params.set("runner", appState.runner)
  window.history.replaceState({}, "", `${window.location.pathname}?${params.toString()}`)
}

function buildShareUrl() {
  const url = new URL(window.location.href)
  url.searchParams.set("task", appState.manualSession.taskId || appState.config.default_task_id)
  url.searchParams.set("mode", appState.mode)
  url.searchParams.set("runner", appState.runner)
  return url.toString()
}

function setGlobalStatus(label, className) {
  els.statusChip.textContent = label
  els.statusChip.className = ["status-value", className].filter(Boolean).join(" ")
}

function globalStatusLabel() {
  const session = getActiveSession()
  if (session.status === "running") {
    return "Running"
  }
  if (session.status === "published") {
    return "Published"
  }
  if (session.status === "complete") {
    return "Complete"
  }
  if (session.status === "error") {
    return "Error"
  }
  if (session.status === "resetting") {
    return "Resetting"
  }
  if (session.status === "stepping") {
    return "Stepping"
  }
  if (session.status === "connected" || session.status === "ready") {
    return "Ready"
  }
  if (session.status === "idle") {
    return "Idle"
  }
  return titleCase(session.status || "loading")
}

function globalStatusClass() {
  const session = getActiveSession()
  if (session.status === "published") {
    return "status-success"
  }
  if (session.status === "error") {
    return "status-danger"
  }
  if (session.status === "running" || session.status === "stepping" || session.status === "resetting") {
    return "status-warning"
  }
  return ""
}

function taskConfig(taskId) {
  return appState.config?.tasks?.find((task) => task.task_id === taskId) || null
}

function defaultFillValue(taskRules) {
  const values = Object.values(taskRules.fill_defaults || {})
  return values[0] || "UNKNOWN"
}

function fieldTemplate(label, content) {
  return `<label class="field-block"><span class="field-label">${escapeHtml(label)}</span>${content}</label>`
}

function pruneEmptyFields(payload) {
  const output = {}
  Object.entries(payload).forEach(([key, value]) => {
    if (value == null) {
      return
    }
    if (typeof value === "string" && !value.trim()) {
      return
    }
    if (Array.isArray(value) && !value.length) {
      return
    }
    if (typeof value === "object" && !Array.isArray(value) && !Object.keys(value).length) {
      return
    }
    output[key] = value
  })
  return output
}

function formatAction(action) {
  return JSON.stringify(action || {})
}

function titleCase(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function deepCopy(value) {
  return JSON.parse(JSON.stringify(value))
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function toCamel(value) {
  return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())
}
