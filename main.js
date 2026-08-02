const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const accountService = require("./lib/accountService");
const outlookService = require("./lib/outlookService");

function createWindow() {
    const win = new BrowserWindow({
        width: 1600,
        height: 900,
        minWidth: 1200,
        minHeight: 700,
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    win.loadFile("renderer/index.html");
}

ipcMain.handle("accounts:get", () => accountService.getAccounts());
ipcMain.handle("account:refresh", (event, account) => outlookService.refresh(account));
ipcMain.handle("messages:get", (event, account) => outlookService.getMessages(account));

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});
