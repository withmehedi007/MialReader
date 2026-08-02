const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
    getAccounts: () => ipcRenderer.invoke("accounts:get"),
    refreshAccount: (account) => ipcRenderer.invoke("account:refresh", account),
    getMessages: (account) => ipcRenderer.invoke("messages:get", account),
});
