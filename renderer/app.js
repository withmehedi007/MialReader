// --- State ---
let accounts = [];
let selectedAccount = null;
let currentMessages = [];

// --- DOM Elements ---
const accountList = document.getElementById("accountList");
const accountCount = document.getElementById("accountCount");
const accountSearch = document.getElementById("accountSearch");

const selectedAccountEmail = document.getElementById("selectedAccountEmail");
const selectedAccountType = document.getElementById("selectedAccountType");
const refreshBtn = document.getElementById("refreshBtn");
const selectedAccountNote = document.getElementById("selectedAccountNote"); // <--- ADD THIS

const emailList = document.getElementById("emailList");
const messageCount = document.getElementById("messageCount");
const emailDetail = document.getElementById("emailDetail");

// --- Modal Elements ---
const editNoteBtn = document.getElementById("editNoteBtn");
const noteModal = document.getElementById("noteModal");
const noteInput = document.getElementById("noteInput");
const selectedEmailLabel = document.getElementById("selectedEmailLabel");
const cancelNoteBtn = document.getElementById("cancelNoteBtn");
const saveNoteBtn = document.getElementById("saveNoteBtn");

const addAccountBtn = document.getElementById("addAccountBtn");
const addAccountModal = document.getElementById("addAccountModal");
const newAccountInput = document.getElementById("newAccountInput");
const cancelAddBtn = document.getElementById("cancelAddBtn");
const saveAccountBtn = document.getElementById("saveAccountBtn");

function parseLine(rawLine) {
    let cleaned = rawLine.trim();
    if (
        !cleaned ||
        cleaned.startsWith("module.exports") ||
        cleaned.startsWith("[") ||
        cleaned.startsWith("]") ||
        cleaned.startsWith(";")
    ) {
        return null;
    }

    cleaned = cleaned.replace(/^["']|["'],?$/g, "").trim();
    const parts = cleaned.split("|");

    // Helper to check if a string looks like an email address
    const isEmail = (str) => str && str.includes("@");

    let note = "";
    let email = "Unknown";

    // Detect if parts[0] is the note or the email
    if (isEmail(parts[0])) {
        // Line format: email|pass... (No note)
        note = "";
        email = parts[0];
    } else {
        // Line format: note|email|pass...
        note = parts[0] || "";
        email = isEmail(parts[1]) ? parts[1] : parts[0];
    }

    const isImap = cleaned.includes(":");

    return {
        raw: cleaned,
        note,
        email,
        type: isImap ? "IMAP" : "GRAPH",
    };
}

// --- Render Functions ---
function renderAccounts(filterText = "") {
    accountList.innerHTML = "";

    const filtered = accounts.filter((acc) => {
        const query = filterText.toLowerCase();
        return acc.email.toLowerCase().includes(query) || acc.note.toLowerCase().includes(query);
    });

    accountCount.textContent = filtered.length;

    if (filtered.length === 0) {
        accountList.innerHTML = `<div class="empty-state">No accounts found</div>`;
        return;
    }

    filtered.forEach((acc) => {
        const item = document.createElement("div");
        item.className = "account-item";
        if (selectedAccount && selectedAccount.raw === acc.raw) {
            item.classList.add("active");
        }

        item.innerHTML = `
            <div class="account-email">${acc.email}</div>
            ${acc.note ? `<div class="account-note">${acc.note}</div>` : ""}
        `;

        item.onclick = () => selectAccount(acc);
        accountList.appendChild(item);
    });
}

async function selectAccount(acc) {
    selectedAccount = acc;
    renderAccounts(accountSearch.value);

    selectedAccountEmail.textContent = acc.email;
    selectedAccountType.textContent = acc.type;
    selectedAccountNote.textContent = acc.note ? acc.note : ""; // <--- ADD THIS
    refreshBtn.disabled = false;

    await loadMessages();
}

async function loadMessages() {
    if (!selectedAccount) return;

    // Show loading state
    emailList.innerHTML = `<div class="loading">Loading messages...</div>`;
    emailDetail.innerHTML = `<div class="empty-state">Select a message to read</div>`;
    messageCount.textContent = "0";

    // Request messages from backend
    const res = await window.api.getMessages(selectedAccount.raw);

    if (res.success) {
        currentMessages = res.data;
        messageCount.textContent = currentMessages.length;
        renderEmailList(currentMessages);
    } else {
        // Display backend error inside the dashboard list column
        currentMessages = [];
        messageCount.textContent = "0";
        emailList.innerHTML = `
            <div class="error-state" style="padding: 20px; color: #ff5252; font-size: 13px; word-break: break-word; line-height: 1.5;">
                <strong>Failed:</strong> ${res.error}
            </div>
        `;
    }
}

function renderEmailList(messages) {
    emailList.innerHTML = "";

    if (messages.length === 0) {
        emailList.innerHTML = `<div class="empty-state">No messages found</div>`;
        return;
    }

    messages.forEach((msg) => {
        const item = document.createElement("div");
        item.className = "email-item";

        const formattedDate = msg.date ? new Date(msg.date).toLocaleDateString() : "";

        item.innerHTML = `
            <div class="email-item-header">
                <span class="email-from">${msg.from}</span>
                <span class="email-date">${formattedDate}</span>
            </div>
            <div class="email-subject">${msg.subject}</div>
        `;

        item.onclick = () => {
            // 1. If this email item is already active/selected, DO NOTHING (prevents refresh & preserves text selection)
            if (item.classList.contains("active")) {
                return;
            }

            // 2. Otherwise, select the new item and render its content
            document.querySelectorAll(".email-item").forEach((el) => el.classList.remove("active"));
            item.classList.add("active");
            renderEmailDetail(msg);
        };

        emailList.appendChild(item);
    });
}

function renderEmailDetail(msg) {
    const formattedDate = msg.date ? new Date(msg.date).toLocaleString() : "";

    emailDetail.innerHTML = `
        <div class="email-detail-header">
            <h2>${msg.subject}</h2>
            <div class="meta-row"><strong>From:</strong> ${msg.from}</div>
            <div class="meta-row"><strong>Date:</strong> ${formattedDate}</div>
        </div>
        <div class="email-body">${msg.body}</div>
    `;
}

async function loadAccounts() {
    const rawLines = await window.api.getAccounts();
    accounts = rawLines.map(parseLine).filter((acc) => acc !== null && acc.email !== "Unknown");
    renderAccounts(accountSearch.value);
}

// --- Event Listeners ---
accountSearch.oninput = (e) => {
    renderAccounts(e.target.value);
};

refreshBtn.onclick = () => {
    loadMessages();
};

// --- Modal Handlers ---

// 1. Edit Note
if (editNoteBtn) {
    editNoteBtn.onclick = () => {
        if (!selectedAccount) {
            alert("Please select an account first.");
            return;
        }
        selectedEmailLabel.innerText = selectedAccount.email;
        noteInput.value = selectedAccount.note || "";
        noteModal.style.display = "flex";
    };
}

if (cancelNoteBtn) {
    cancelNoteBtn.onclick = () => {
        noteModal.style.display = "none";
    };
}

if (saveNoteBtn) {
    saveNoteBtn.onclick = async () => {
        const newNote = noteInput.value.trim();
        const res = await window.api.updateAccountNote(selectedAccount.email, newNote);

        if (res.success) {
            noteModal.style.display = "none";

            // Remember current email
            const targetEmail = selectedAccount.email;

            // Reload fresh accounts from data.js
            await loadAccounts();

            // Update selectedAccount reference to the newly reloaded object
            const updatedAcc = accounts.find(
                (a) => a.email.toLowerCase() === targetEmail.toLowerCase(),
            );
            if (updatedAcc) {
                selectedAccount = updatedAcc;
                selectedAccountNote.textContent = updatedAcc.note;
            }
        } else {
            alert("Failed to update note: " + res.error);
        }
    };
}

// 2. Add Account
if (addAccountBtn) {
    addAccountBtn.onclick = () => {
        newAccountInput.value = "";
        addAccountModal.style.display = "flex";
    };
}

if (cancelAddBtn) {
    cancelAddBtn.onclick = () => {
        addAccountModal.style.display = "none";
    };
}

if (saveAccountBtn) {
    saveAccountBtn.onclick = async () => {
        const rawData = newAccountInput.value.trim();
        if (!rawData) {
            alert("Please enter account data.");
            return;
        }

        const res = await window.api.addNewAccount(rawData);

        if (res.success) {
            addAccountModal.style.display = "none";
            await loadAccounts(); // Refresh sidebar account list
        } else {
            alert("Failed to add account: " + res.error);
        }
    };
}

// --- Initialization ---
loadAccounts();
