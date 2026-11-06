const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld(
  "daylight",
  Object.freeze({
    load: () => ipcRenderer.invoke("data:load"),
    save: (data) => ipcRenderer.invoke("data:save", data),
    exportData: () => ipcRenderer.invoke("data:export"),
    importData: () => ipcRenderer.invoke("data:import"),
  }),
);
