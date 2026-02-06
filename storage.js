// Persistence layer for browser storage abstraction
const PersistenceLayer = (() => {
  const VAULT_KEYS = {
    projectRegistry: 'ttrack_proj_registry',
    taskRegistry: 'ttrack_task_registry',
    timeEntryLog: 'ttrack_entries_log',
    activeTimerState: 'ttrack_active_state',
    lastSelectedProj: 'ttrack_last_proj'
  };

  const retrieveFromVault = (vaultKey) => {
    try {
      const serialized = localStorage.getItem(vaultKey);
      return serialized ? JSON.parse(serialized) : null;
    } catch (err) {
      console.error('Vault retrieval error:', err);
      return null;
    }
  };

  const storeInVault = (vaultKey, payload) => {
    try {
      localStorage.setItem(vaultKey, JSON.stringify(payload));
      return true;
    } catch (err) {
      console.error('Vault storage error:', err);
      return false;
    }
  };

  const purgeVaultKey = (vaultKey) => {
    try {
      localStorage.removeItem(vaultKey);
      return true;
    } catch (err) {
      console.error('Vault purge error:', err);
      return false;
    }
  };

  const fetchProjectRegistry = () => {
    return retrieveFromVault(VAULT_KEYS.projectRegistry) || [];
  };

  const commitProjectRegistry = (projectList) => {
    return storeInVault(VAULT_KEYS.projectRegistry, projectList);
  };

  const fetchTaskRegistry = () => {
    return retrieveFromVault(VAULT_KEYS.taskRegistry) || [];
  };

  const commitTaskRegistry = (taskList) => {
    return storeInVault(VAULT_KEYS.taskRegistry, taskList);
  };

  const fetchTimeEntryLog = () => {
    return retrieveFromVault(VAULT_KEYS.timeEntryLog) || [];
  };

  const commitTimeEntryLog = (entryList) => {
    return storeInVault(VAULT_KEYS.timeEntryLog, entryList);
  };

  const fetchActiveTimerState = () => {
    return retrieveFromVault(VAULT_KEYS.activeTimerState);
  };

  const commitActiveTimerState = (stateObj) => {
    return storeInVault(VAULT_KEYS.activeTimerState, stateObj);
  };

  const clearActiveTimerState = () => {
    return purgeVaultKey(VAULT_KEYS.activeTimerState);
  };

  const fetchLastSelectedProj = () => {
    return retrieveFromVault(VAULT_KEYS.lastSelectedProj);
  };

  const commitLastSelectedProj = (projId) => {
    return storeInVault(VAULT_KEYS.lastSelectedProj, projId);
  };

  return {
    fetchProjectRegistry,
    commitProjectRegistry,
    fetchTaskRegistry,
    commitTaskRegistry,
    fetchTimeEntryLog,
    commitTimeEntryLog,
    fetchActiveTimerState,
    commitActiveTimerState,
    clearActiveTimerState,
    fetchLastSelectedProj,
    commitLastSelectedProj
  };
})();
