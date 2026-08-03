const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
    getAccounts: () => ipcRenderer.invoke("get-accounts"),
    getMessages: (account) => ipcRenderer.invoke("get-messages", account),

    // New IPC bridges:
    updateAccountNote: (email, newNote) =>
        ipcRenderer.invoke("update-account-note", { email, newNote }),
    addNewAccount: (rawString) => ipcRenderer.invoke("add-new-account", rawString),
});
