let allAccounts = [];
let selectedAccount = null;
let currentMessages = [];
let autoRefreshTimer = null;

async function loadAccounts() {
    allAccounts = await window.api.getAccounts();
    renderAccounts(allAccounts);
}

function renderAccounts(accountsToDisplay) {
    const accountList = document.getElementById("accountList");
    accountList.innerHTML = "";

    if (accountsToDisplay.length === 0) {
        accountList.innerHTML = `<div style="padding: 14px; color: #888; font-size: 13px;">No accounts found</div>`;
        return;
    }

    accountsToDisplay.forEach((account) => {
        // let email = account.email;
        // const atIndex = email.indexOf("@");
        // let emailHidden = (email.slice(0, 2) +"......" +email.slice(7, atIndex - 3) +"...." +email.slice(atIndex)).toLocaleLowerCase();

        const div = document.createElement("div");
        div.className = "account";

        if (account.name) {
            div.innerHTML = `
            <p class="accountName">${account.name}</p>
            <p>📫 ${account.email.toLowerCase()}</p>
        `;
        } else {
            div.innerHTML = `
            <p>${account.email.toLowerCase()}</p>
        `;
        }

        if (selectedAccount && selectedAccount.email === account.email) {
            div.style.background = "#202734";
            div.style.borderLeft = "4px solid #2979ff";
        }

        div.onclick = () => selectAccount(account, div);
        accountList.appendChild(div);
    });
}

function resetEmailViewer() {
    const emailContent = document.getElementById("emailContent");
    emailContent.innerHTML = `
        <div class="placeholder">Select an email message to view.</div>
    `;
}

function selectAccount(account, element) {
    document.querySelectorAll(".account").forEach((x) => {
        x.style.background = "";
        x.style.borderLeft = "";
    });

    element.style.background = "#202734";
    element.style.borderLeft = "4px solid #2979ff";

    selectedAccount = account;

    // Clear the Email Viewer when switching accounts
    resetEmailViewer();

    // Load messages for the selected account
    loadMessages();
}

async function loadMessages() {
    if (!selectedAccount) return;

    const messageList = document.getElementById("messageList");
    messageList.innerHTML = `<div class="placeholder">Fetching all folder messages...</div>`;

    const res = await window.api.getMessages(selectedAccount);

    if (!res.success || !res.data.length) {
        messageList.innerHTML = `<div class="placeholder">No messages found.</div>`;
        return;
    }

    currentMessages = res.data;
    messageList.innerHTML = "";

    currentMessages.forEach((msg) => {
        const div = document.createElement("div");
        div.className = "message-item";
        div.style.padding = "12px 16px";
        div.style.borderBottom = "1px solid #2b313d";
        div.style.cursor = "pointer";

        const senderName =
            msg.from?.emailAddress?.name || msg.from?.emailAddress?.address || "Unknown";
        const date = new Date(msg.receivedDateTime).toLocaleDateString();
        const folderTag = (msg.folderName || "inbox").toUpperCase();
        const badgeColor = folderTag.includes("JUNK") ? "#e53935" : "#2979ff";

        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                <strong style="font-size:14px; color:#fff;">${senderName}</strong>
                <span style="font-size:10px; background:${badgeColor}; color:#fff; padding:2px 6px; border-radius:4px; text-transform:uppercase;">${folderTag}</span>
            </div>
            <div style="font-size:13px; font-weight:600; color:#448aff; margin-bottom:4px; text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${msg.subject || "(No Subject)"}</div>
            <div style="font-size:12px; color:#aaa; text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${msg.bodyPreview || ""}</div>
            <small style="color:#666; font-size:11px;">${date}</small>
        `;

        div.onclick = () => viewEmail(msg, div);
        messageList.appendChild(div);
    });
}

function viewEmail(msg, element) {
    document.querySelectorAll("#messageList > div").forEach((x) => {
        x.style.background = "";
    });
    element.style.background = "#1c212b";

    const emailContent = document.getElementById("emailContent");
    const sender = msg.from?.emailAddress?.address || "Unknown";
    const date = new Date(msg.receivedDateTime).toLocaleString();

    emailContent.innerHTML = `
        <div style="padding: 20px; border-bottom: 1px solid #2b313d;">
            <h2>${msg.subject || "(No Subject)"}</h2>
            <p style="color:#888; font-size:14px; margin-top:6px;">From: <strong>${sender}</strong> | Folder: <strong>${(msg.folderName || "inbox").toUpperCase()}</strong> | ${date}</p>
        </div>
        <div style="padding: 20px; color: #ddd; line-height: 1.6;">
            ${msg.body?.content || msg.bodyPreview || "No content."}
        </div>
    `;
}

// --- Instant Search Handlers ---
const searchInput = document.getElementById("accountSearch");
const clearBtn = document.getElementById("clearSearchBtn");

searchInput.addEventListener("input", (e) => {
    const query = e.target.value.toLowerCase().trim();
    clearBtn.style.display = query.length > 0 ? "block" : "none";

    const filtered = allAccounts.filter(
        (acc) => acc.email.toLowerCase().includes(query) || acc.name.toLowerCase().includes(query),
    );
    renderAccounts(filtered);
});

clearBtn.addEventListener("click", () => {
    searchInput.value = "";
    clearBtn.style.display = "none";
    renderAccounts(allAccounts);
});

// UI Event Listeners
document.getElementById("refreshBtn").onclick = async () => {
    if (!selectedAccount) {
        alert("Select an account first.");
        return;
    }
    await loadMessages();
};

function setupAutoRefresh() {
    if (autoRefreshTimer) clearInterval(autoRefreshTimer);

    const isAuto = document.getElementById("autoRefresh").checked;
    const interval = parseInt(document.getElementById("refreshTime").value, 10);

    if (isAuto) {
        autoRefreshTimer = setInterval(() => {
            if (selectedAccount) loadMessages();
        }, interval);
    }
}

document.getElementById("autoRefresh").onchange = setupAutoRefresh;
document.getElementById("refreshTime").onchange = setupAutoRefresh;

loadAccounts();
