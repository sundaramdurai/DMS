// Main orchestration engine
const TimeTrackOrchestrator = (() => {
  const SYSTEM_PROJECT_MARKER = 'NO_PROJECT';
  const SYSTEM_PROJECT_LABEL = 'No Project';
  const NAME_LIMIT = 50;
  const TICK_INTERVAL = 60000; // 60 seconds in milliseconds
  const MIN_DURATION_THRESHOLD = 1;

  let projectCatalog = [];
  let taskCatalog = [];
  let entryArchive = [];
  let activeTimerContext = null;
  let clockTickerHandle = null;

  const initializeApplication = () => {
    loadPersistedData();
    ensureSystemProject();
    renderProjectDropdowns();
    renderTaskTable();
    renderProjectManagementList();
    restoreActiveTimer();
    attachEventHandlers();
    refreshSummaryView();
  };

  const loadPersistedData = () => {
    projectCatalog = PersistenceLayer.fetchProjectRegistry();
    taskCatalog = PersistenceLayer.fetchTaskRegistry();
    entryArchive = PersistenceLayer.fetchTimeEntryLog();
  };

  const ensureSystemProject = () => {
    if (!projectCatalog.find(p => p.id === SYSTEM_PROJECT_MARKER)) {
      projectCatalog.unshift({
        id: SYSTEM_PROJECT_MARKER,
        label: SYSTEM_PROJECT_LABEL,
        isSystem: true
      });
      PersistenceLayer.commitProjectRegistry(projectCatalog);
    }
  };

  const generateUniqueId = () => {
    return `id_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  };

  const attachEventHandlers = () => {
    document.getElementById('btn-create-project').addEventListener('click', openProjectDialog);
    document.getElementById('btn-create-task').addEventListener('click', openTaskDialog);
    document.getElementById('btn-save-project').addEventListener('click', saveProject);
    document.getElementById('btn-cancel-project').addEventListener('click', closeProjectDialog);
    document.getElementById('btn-save-task').addEventListener('click', saveTask);
    document.getElementById('btn-cancel-task').addEventListener('click', closeTaskDialog);
  };

  const openProjectDialog = () => {
    document.getElementById('project-name-input').value = '';
    document.getElementById('project-dialog').classList.remove('hidden');
  };

  const closeProjectDialog = () => {
    document.getElementById('project-dialog').classList.add('hidden');
  };

  const saveProject = () => {
    const nameInput = document.getElementById('project-name-input').value.trim();
    
    if (!nameInput) {
      alert('Project name cannot be empty');
      return;
    }
    
    if (nameInput.length > NAME_LIMIT) {
      alert(`Project name must be ${NAME_LIMIT} characters or less`);
      return;
    }

    const newProject = {
      id: generateUniqueId(),
      label: nameInput,
      isSystem: false
    };

    projectCatalog.push(newProject);
    PersistenceLayer.commitProjectRegistry(projectCatalog);
    renderProjectDropdowns();
    renderProjectManagementList();
    closeProjectDialog();
  };

  const openTaskDialog = () => {
    const projSelect = document.getElementById('task-project-select');
    projSelect.innerHTML = '';
    
    const defaultProjId = determineDefaultProject();
    
    projectCatalog.forEach(proj => {
      const opt = document.createElement('option');
      opt.value = proj.id;
      opt.textContent = proj.label;
      if (proj.id === defaultProjId) {
        opt.selected = true;
      }
      projSelect.appendChild(opt);
    });

    document.getElementById('task-name-input').value = '';
    document.getElementById('task-dialog').classList.remove('hidden');
  };

  const closeTaskDialog = () => {
    document.getElementById('task-dialog').classList.add('hidden');
  };

  const determineDefaultProject = () => {
    const lastSelected = PersistenceLayer.fetchLastSelectedProj();
    if (lastSelected && projectCatalog.find(p => p.id === lastSelected)) {
      return lastSelected;
    }
    
    if (activeTimerContext && activeTimerContext.projId) {
      return activeTimerContext.projId;
    }
    
    if (entryArchive.length > 0) {
      return entryArchive[entryArchive.length - 1].projId;
    }
    
    return SYSTEM_PROJECT_MARKER;
  };

  const saveTask = () => {
    const nameInput = document.getElementById('task-name-input').value.trim();
    const projId = document.getElementById('task-project-select').value;
    
    if (!nameInput) {
      alert('Task name cannot be empty');
      return;
    }
    
    if (nameInput.length > NAME_LIMIT) {
      alert(`Task name must be ${NAME_LIMIT} characters or less`);
      return;
    }

    const newTask = {
      id: generateUniqueId(),
      label: nameInput,
      projId: projId
    };

    taskCatalog.push(newTask);
    PersistenceLayer.commitTaskRegistry(taskCatalog);
    PersistenceLayer.commitLastSelectedProj(projId);
    renderTaskTable();
    closeTaskDialog();
  };

  const renderProjectDropdowns = () => {
    const selectors = ['task-project-select'];
    selectors.forEach(selId => {
      const elem = document.getElementById(selId);
      if (elem) {
        const currentVal = elem.value;
        elem.innerHTML = '';
        projectCatalog.forEach(proj => {
          const opt = document.createElement('option');
          opt.value = proj.id;
          opt.textContent = proj.label;
          elem.appendChild(opt);
        });
        if (currentVal) elem.value = currentVal;
      }
    });
  };

  const renderProjectManagementList = () => {
    const container = document.getElementById('project-list');
    container.innerHTML = '';

    projectCatalog.forEach(proj => {
      const row = document.createElement('div');
      row.className = 'list-row';

      const nameSpan = document.createElement('span');
      nameSpan.textContent = proj.label;
      row.appendChild(nameSpan);

      if (!proj.isSystem) {
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        deleteBtn.className = 'btn-danger';
        deleteBtn.addEventListener('click', () => deleteProject(proj.id));
        row.appendChild(deleteBtn);
      }

      container.appendChild(row);
    });
  };

  const deleteProject = (projId) => {
    if (!confirm('Delete this project? Associated tasks will move to "No Project".')) return;

    projectCatalog = projectCatalog.filter(p => p.id !== projId);
    
    taskCatalog.forEach(task => {
      if (task.projId === projId) {
        task.projId = SYSTEM_PROJECT_MARKER;
      }
    });
    
    entryArchive.forEach(entry => {
      if (entry.projId === projId) {
        entry.projId = SYSTEM_PROJECT_MARKER;
      }
    });

    PersistenceLayer.commitProjectRegistry(projectCatalog);
    PersistenceLayer.commitTaskRegistry(taskCatalog);
    PersistenceLayer.commitTimeEntryLog(entryArchive);
    
    renderProjectDropdowns();
    renderProjectManagementList();
    renderTaskTable();
    refreshSummaryView();
  };

  const renderTaskTable = () => {
    const tbody = document.getElementById('task-table-body');
    tbody.innerHTML = '';

    taskCatalog.forEach(task => {
      const proj = projectCatalog.find(p => p.id === task.projId);
      const projName = proj ? proj.label : 'Unknown';

      const row = document.createElement('tr');
      
      const nameCell = document.createElement('td');
      nameCell.textContent = task.label;
      row.appendChild(nameCell);

      const projCell = document.createElement('td');
      projCell.textContent = projName;
      row.appendChild(projCell);

      const actionCell = document.createElement('td');
      
      const isRunning = activeTimerContext && activeTimerContext.taskId === task.id;
      
      if (isRunning) {
        if (activeTimerContext.isPaused) {
          const resumeBtn = document.createElement('button');
          resumeBtn.textContent = 'Resume';
          resumeBtn.className = 'btn-success';
          resumeBtn.addEventListener('click', () => resumeTimer());
          actionCell.appendChild(resumeBtn);
        } else {
          const pauseBtn = document.createElement('button');
          pauseBtn.textContent = 'Pause';
          pauseBtn.className = 'btn-warning';
          pauseBtn.addEventListener('click', () => pauseTimer());
          actionCell.appendChild(pauseBtn);
        }

        const stopBtn = document.createElement('button');
        stopBtn.textContent = 'Stop';
        stopBtn.className = 'btn-danger';
        stopBtn.addEventListener('click', () => stopTimer());
        actionCell.appendChild(stopBtn);
      } else {
        const startBtn = document.createElement('button');
        startBtn.textContent = 'Start';
        startBtn.className = 'btn-primary';
        startBtn.addEventListener('click', () => startTimer(task.id));
        actionCell.appendChild(startBtn);
      }

      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = 'Delete';
      deleteBtn.className = 'btn-danger';
      deleteBtn.addEventListener('click', () => deleteTask(task.id));
      actionCell.appendChild(deleteBtn);

      row.appendChild(actionCell);
      tbody.appendChild(row);
    });

    updateTimerDisplay();
  };

  const deleteTask = (taskId) => {
    if (activeTimerContext && activeTimerContext.taskId === taskId) {
      alert('Cannot delete a task with an active timer. Please stop the timer first.');
      return;
    }

    if (!confirm('Delete this task?')) return;

    taskCatalog = taskCatalog.filter(t => t.id !== taskId);
    PersistenceLayer.commitTaskRegistry(taskCatalog);
    renderTaskTable();
    refreshSummaryView();
  };

  const startTimer = (taskId) => {
    if (activeTimerContext) {
      stopTimer();
    }

    const task = taskCatalog.find(t => t.id === taskId);
    if (!task) return;

    activeTimerContext = {
      taskId: taskId,
      projId: task.projId,
      startTimestamp: TemporalBoundaryEngine.extractCurrentTimestamp(),
      accumulatedMinutes: 0,
      isPaused: false
    };

    PersistenceLayer.commitActiveTimerState(activeTimerContext);
    renderTaskTable();
    startClockTicker();
  };

  const pauseTimer = () => {
    if (!activeTimerContext || activeTimerContext.isPaused) return;

    const currentTime = TemporalBoundaryEngine.extractCurrentTimestamp();
    const elapsedMinutes = TemporalBoundaryEngine.calculateMinuteSpan(
      activeTimerContext.startTimestamp,
      currentTime
    );

    activeTimerContext.accumulatedMinutes += elapsedMinutes;
    activeTimerContext.isPaused = true;
    activeTimerContext.startTimestamp = null;

    PersistenceLayer.commitActiveTimerState(activeTimerContext);
    stopClockTicker();
    renderTaskTable();
  };

  const resumeTimer = () => {
    if (!activeTimerContext || !activeTimerContext.isPaused) return;

    activeTimerContext.startTimestamp = TemporalBoundaryEngine.extractCurrentTimestamp();
    activeTimerContext.isPaused = false;

    PersistenceLayer.commitActiveTimerState(activeTimerContext);
    renderTaskTable();
    startClockTicker();
  };

  const stopTimer = () => {
    if (!activeTimerContext) return;

    let totalMinutes = activeTimerContext.accumulatedMinutes;

    if (!activeTimerContext.isPaused && activeTimerContext.startTimestamp) {
      const currentTime = TemporalBoundaryEngine.extractCurrentTimestamp();
      totalMinutes += TemporalBoundaryEngine.calculateMinuteSpan(
        activeTimerContext.startTimestamp,
        currentTime
      );
    }

    if (totalMinutes >= MIN_DURATION_THRESHOLD) {
      const workdayKey = TemporalBoundaryEngine.deriveWorkdayAnchor(Date.now());
      
      const entry = {
        id: generateUniqueId(),
        taskId: activeTimerContext.taskId,
        projId: activeTimerContext.projId,
        durationMinutes: totalMinutes,
        workdayKey: workdayKey,
        timestamp: Date.now()
      };

      entryArchive.push(entry);
      PersistenceLayer.commitTimeEntryLog(entryArchive);
    }

    activeTimerContext = null;
    PersistenceLayer.clearActiveTimerState();
    stopClockTicker();
    renderTaskTable();
    refreshSummaryView();
  };

  const restoreActiveTimer = () => {
    const savedState = PersistenceLayer.fetchActiveTimerState();
    if (!savedState) return;

    const task = taskCatalog.find(t => t.id === savedState.taskId);
    if (!task) {
      PersistenceLayer.clearActiveTimerState();
      return;
    }

    activeTimerContext = savedState;

    if (!activeTimerContext.isPaused && activeTimerContext.startTimestamp) {
      startClockTicker();
    }

    renderTaskTable();
  };

  const startClockTicker = () => {
    if (clockTickerHandle) return;
    
    clockTickerHandle = setInterval(() => {
      updateTimerDisplay();
    }, TICK_INTERVAL);
    
    updateTimerDisplay();
  };

  const stopClockTicker = () => {
    if (clockTickerHandle) {
      clearInterval(clockTickerHandle);
      clockTickerHandle = null;
    }
  };

  const updateTimerDisplay = () => {
    if (!activeTimerContext) {
      document.getElementById('active-timer-display').textContent = 'No active timer';
      return;
    }

    const task = taskCatalog.find(t => t.id === activeTimerContext.taskId);
    const proj = projectCatalog.find(p => p.id === activeTimerContext.projId);

    let totalMinutes = activeTimerContext.accumulatedMinutes;

    if (!activeTimerContext.isPaused && activeTimerContext.startTimestamp) {
      const currentTime = TemporalBoundaryEngine.extractCurrentTimestamp();
      totalMinutes += TemporalBoundaryEngine.calculateMinuteSpan(
        activeTimerContext.startTimestamp,
        currentTime
      );
    }

    const displayText = `${task ? task.label : 'Unknown'} (${proj ? proj.label : 'Unknown'}) - ${TemporalBoundaryEngine.formatMinutesToDisplay(totalMinutes)}${activeTimerContext.isPaused ? ' [PAUSED]' : ''}`;
    document.getElementById('active-timer-display').textContent = displayText;
  };

  const refreshSummaryView = () => {
    const byProject = {};
    const byTask = {};
    const byTaskInProject = {};

    entryArchive.forEach(entry => {
      const proj = projectCatalog.find(p => p.id === entry.projId);
      const task = taskCatalog.find(t => t.id === entry.taskId);
      
      const projLabel = proj ? proj.label : 'Deleted Project';
      const taskLabel = task ? task.label : 'Deleted Task';

      byProject[projLabel] = (byProject[projLabel] || 0) + entry.durationMinutes;
      byTask[taskLabel] = (byTask[taskLabel] || 0) + entry.durationMinutes;

      const combinedKey = `${projLabel} > ${taskLabel}`;
      byTaskInProject[combinedKey] = (byTaskInProject[combinedKey] || 0) + entry.durationMinutes;
    });

    renderSummarySection('summary-by-project', byProject);
    renderSummarySection('summary-by-task', byTask);
    renderSummarySection('summary-by-task-in-project', byTaskInProject);
  };

  const renderSummarySection = (containerId, dataMap) => {
    const container = document.getElementById(containerId);
    container.innerHTML = '';

    const sortedEntries = Object.entries(dataMap).sort((a, b) => b[1] - a[1]);

    if (sortedEntries.length === 0) {
      container.innerHTML = '<div class="summary-row">No data available</div>';
      return;
    }

    sortedEntries.forEach(([label, minutes]) => {
      const row = document.createElement('div');
      row.className = 'summary-row';
      
      const labelSpan = document.createElement('span');
      labelSpan.textContent = label;
      
      const timeSpan = document.createElement('span');
      timeSpan.className = 'summary-time';
      timeSpan.textContent = TemporalBoundaryEngine.formatMinutesToDisplay(minutes);
      
      row.appendChild(labelSpan);
      row.appendChild(timeSpan);
      container.appendChild(row);
    });
  };

  return {
    initializeApplication
  };
})();

document.addEventListener('DOMContentLoaded', () => {
  TimeTrackOrchestrator.initializeApplication();
});
