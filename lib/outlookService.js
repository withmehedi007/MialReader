const axios = require("axios");
const { ImapFlow } = require("imapflow");
const { simpleParser } = require("mailparser");

// Folders to fetch and combine for Graph API accounts
const FOLDERS_TO_FETCH = ["inbox", "junkemail", "sentitems", "drafts", "deleteditems"];

async function getAccessToken(account) {
    const clientId =
        account.clientId ||
        process.env.MICROSOFT_CLIENT_ID ||
        "27922004-70b5-4084-8b77-24774844627d"; // Outlook App Client ID fallback
    const refreshToken = account.refreshToken;

    if (!refreshToken) {
        throw new Error("No refresh token available for this account.");
    }

    const params = new URLSearchParams({
        client_id: clientId,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        scope: account.scope || "offline_access https://graph.microsoft.com/Mail.Read",
    });

    const response = await fetch("https://login.microsoftonline.com/consumers/oauth2/v2.0/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
    });

    const data = await response.json();

    if (!response.ok) {
        // Return clear error message for invalid/expired grants
        const rawErr = data.error_description || data.error || "Failed to refresh token";
        throw new Error(rawErr);
    }

    return data.access_token;
}

async function fetchFolderGraph(token, folder) {
    try {
        const res = await axios.get(
            `https://graph.microsoft.com/v1.0/me/mailFolders/${folder}/messages?$top=15&$select=id,subject,from,receivedDateTime,bodyPreview,body`,
            { headers: { Authorization: `Bearer ${token}` } },
        );
        return res.data.value.map((msg) => ({ ...msg, folderName: folder }));
    } catch (err) {
        return [];
    }
}

async function fetchFolderLegacy(token, folder) {
    try {
        const res = await axios.get(
            `https://outlook.office.com/api/v2.0/me/mailfolders/${folder}/messages?$top=15`,
            { headers: { Authorization: `Bearer ${token}` } },
        );
        return (res.data.value || []).map((msg) => ({
            id: msg.Id,
            subject: msg.Subject,
            from: {
                emailAddress: {
                    name: msg.From?.EmailAddress?.Name,
                    address: msg.From?.EmailAddress?.Address,
                },
            },
            receivedDateTime: msg.DateTimeReceived,
            bodyPreview: msg.BodyPreview,
            body: { content: msg.Body?.Content },
            folderName: folder,
        }));
    } catch (err) {
        return [];
    }
}

/**
 * Real-time IMAP Fetcher for transactional emails (e.g. Instagram alerts)
 */
async function getMessagesImap(account, limit = 30) {
    const client = new ImapFlow({
        host: account.host,
        port: account.port,
        secure: true,
        tls: { rejectUnauthorized: false },
        auth: {
            user: account.email,
            pass: account.password,
        },
        logger: false,
    });

    const messages = [];

    try {
        await client.connect();

        const lock = await client.getMailboxLock("INBOX");

        try {
            const total = client.mailbox.exists;

            if (total > 0) {
                // Fetch the newest `limit` messages (e.g. 1 to 30 or total - limit to total)
                const start = Math.max(1, total - limit + 1);

                for await (let msg of client.fetch(`${start}:${total}`, {
                    source: true,
                    envelope: true,
                })) {
                    let parsedText = "";
                    let parsedHtml = "";
                    let senderName = msg.envelope.from?.[0]?.name || "";
                    let senderAddress = msg.envelope.from?.[0]?.address || "Unknown";
                    let msgDate = msg.envelope.date;
                    let subject = msg.envelope.subject || "(No Subject)";

                    if (msg.source) {
                        try {
                            const parsed = await simpleParser(msg.source);
                            parsedText = parsed.text || "";
                            parsedHtml = parsed.html || "";
                            if (parsed.subject) subject = parsed.subject;
                            if (parsed.from?.value?.[0]?.address) {
                                senderAddress = parsed.from.value[0].address;
                                senderName = parsed.from.value[0].name || senderName;
                            }
                            if (parsed.date) msgDate = parsed.date;
                        } catch (pErr) {
                            console.warn("Mailparser fallback:", pErr.message);
                        }
                    }

                    messages.push({
                        id: `imap-${msg.uid}`,
                        subject: subject,
                        from: {
                            emailAddress: {
                                name: senderName,
                                address: senderAddress,
                            },
                        },
                        receivedDateTime: msgDate,
                        bodyPreview: parsedText.slice(0, 150).replace(/[\r\n]+/g, " "),
                        body: {
                            content:
                                parsedHtml ||
                                `<pre style="white-space: pre-wrap; font-family: inherit;">${parsedText}</pre>`,
                        },
                        folderName: "inbox",
                    });
                }
            }
        } finally {
            lock.release();
        }

        await client.logout();

        // Sort newest first
        messages.sort((a, b) => new Date(b.receivedDateTime) - new Date(a.receivedDateTime));

        return { success: true, data: messages };
    } catch (err) {
        console.error(`[${account.email}] IMAP fetch error:`, err.message);
        return { success: false, error: err.message, data: [] };
    }
}

async function refresh(account) {
    if (account.type === "IMAP") {
        return { success: true, token: null };
    }

    try {
        const token = await getAccessToken(account);
        return { success: true, token };
    } catch (err) {
        let userFriendlyError = err.message || "Refresh error";
        if (
            userFriendlyError.includes("AADSTS70000") ||
            userFriendlyError.includes("invalid_grant")
        ) {
            userFriendlyError = "Refresh token expired or unauthorized.";
        }
        console.error(`[${account.email}] Refresh error:`, userFriendlyError);
        return { success: false, error: userFriendlyError };
    }
}

async function getMessages(account) {
    if (account.type === "IMAP") {
        return await getMessagesImap(account);
    }

    try {
        const token = await getAccessToken(account);

        const fetchMethod = account.type === "legacy" ? fetchFolderLegacy : fetchFolderGraph;
        const results = await Promise.all(
            FOLDERS_TO_FETCH.map((folder) => fetchMethod(token, folder)),
        );

        let combined = results.flat();
        combined.sort((a, b) => new Date(b.receivedDateTime) - new Date(a.receivedDateTime));

        return { success: true, data: combined };
    } catch (err) {
        console.error(`[${account.email}] Get messages error:`, err.message || err);

        let errorMessage = err.message || "Failed to fetch messages";

        // Convert raw AADSTS70000 into a clean dashboard warning
        if (errorMessage.includes("AADSTS70000") || errorMessage.includes("invalid_grant")) {
            errorMessage =
                "Unauthorized / Token Expired: Please re-authenticate this Hotmail account.";
        }

        return {
            success: false,
            error: errorMessage,
            data: [],
        };
    }
}

module.exports = {
    refresh,
    getMessages,
};
