const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const { fetchAccountEmails } = require("./fetcher");

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1100,
        height: 750,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
}

app.whenReady().then(() => {
    createWindow();

    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});

// Path to raw data file
const dataPath = path.join(__dirname, "data.js");

// Clean a raw line from quotes, trailing commas, and brackets
function cleanLine(line) {
    let trimmed = line.trim();
    if (
        !trimmed ||
        trimmed.startsWith("module.exports") ||
        trimmed.startsWith("[") ||
        trimmed.startsWith("]") ||
        trimmed.startsWith(";")
    ) {
        return null;
    }
    // Remove leading/trailing quotes and trailing commas
    trimmed = trimmed.replace(/^["']|["'],?$/g, "").trim();
    return trimmed;
}

// --- IPC HANDLERS ---

ipcMain.handle("get-accounts", async () => {
    try {
        if (!fs.existsSync(dataPath)) return [];
        const content = fs.readFileSync(dataPath, "utf8");
        return content
            .split(/\r?\n/)
            .map(cleanLine)
            .filter((line) => line !== null && line.length > 0);
    } catch (err) {
        console.error("Error reading data.js:", err.message);
        return [];
    }
});

ipcMain.handle("get-messages", async (event, rawAccountLine) => {
    try {
        const messages = await fetchAccountEmails(rawAccountLine);
        return { success: true, data: messages };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

ipcMain.handle("update-account-note", async (event, { email, newNote }) => {
    try {
        if (!fs.existsSync(dataPath)) {
            return { success: false, error: "data.js file not found." };
        }

        let content = fs.readFileSync(dataPath, "utf8");
        const lines = content.split(/\r?\n/);

        const updatedLines = lines.map((line) => {
            const cleaned = cleanLine(line);
            if (cleaned && cleaned.toLowerCase().includes(email.toLowerCase())) {
                let parts = cleaned.split("|");

                // If line originally didn't have a note at parts[0]
                if (parts.length === 4 && !parts[1].includes(":")) {
                    parts = ["", ...parts]; // Ensure parts[0] is note position
                }

                parts[0] = newNote; // Replace/add note at position 0
                const newLine = parts.join("|");

                if (line.includes('"')) {
                    return `  "${newLine}",`;
                }
                return newLine;
            }
            return line;
        });

        fs.writeFileSync(dataPath, updatedLines.join("\n"), "utf8");
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

// 2. Add new raw account line to data.js
ipcMain.handle("add-new-account", async (event, rawAccountString) => {
    try {
        if (!rawAccountString || !rawAccountString.trim()) {
            return { success: false, error: "Account string cannot be empty." };
        }

        let cleanedNew = cleanLine(rawAccountString);
        if (!cleanedNew) {
            return { success: false, error: "Invalid account line string." };
        }

        let content = fs.existsSync(dataPath) ? fs.readFileSync(dataPath, "utf8") : "";
        const lines = content.split(/\r?\n/);

        // Find where closing array bracket '];' is and insert right before it
        let closeIndex = lines.findIndex(
            (l) => l.trim().startsWith("]") || l.trim().startsWith("];"),
        );

        if (closeIndex !== -1) {
            lines.splice(closeIndex, 0, `  "${cleanedNew}",`);
            fs.writeFileSync(dataPath, lines.join("\n"), "utf8");
        } else {
            // Fallback if data.js is simple plain text
            if (content && !content.endsWith("\n")) content += "\n";
            content += cleanedNew + "\n";
            fs.writeFileSync(dataPath, content, "utf8");
        }

        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
});
