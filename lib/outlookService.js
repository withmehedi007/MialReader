const axios = require("axios");

// Folders to fetch and combine together
const FOLDERS_TO_FETCH = ["inbox", "junkemail", "sentitems", "drafts", "deleteditems"];

async function getAccessToken(account) {
    const params = new URLSearchParams({
        client_id: account.clientId,
        grant_type: "refresh_token",
        refresh_token: account.refreshToken,
    });

    // Try IMAP / Legacy scope first (what web checkers use)
    try {
        const imapParams = new URLSearchParams(params);
        imapParams.append(
            "scope",
            "https://outlook.office365.com/IMAP.AccessAsUser.All offline_access",
        );

        const response = await axios.post(
            "https://login.microsoftonline.com/common/oauth2/v2.0/token",
            imapParams.toString(),
            { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
        );
        return { token: response.data.access_token, type: "imap" };
    } catch (err) {
        // Fallback to Graph API scope
        const graphParams = new URLSearchParams(params);
        graphParams.append("scope", "https://graph.microsoft.com/Mail.Read offline_access");

        const response = await axios.post(
            "https://login.microsoftonline.com/common/oauth2/v2.0/token",
            graphParams.toString(),
            { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
        );
        return { token: response.data.access_token, type: "graph" };
    }
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

async function refresh(account) {
    try {
        const { token } = await getAccessToken(account);
        return { success: true, token };
    } catch (err) {
        console.error(`[${account.email}] Refresh error:`, err.response?.data || err.message);
        return { success: false, error: err.message };
    }
}

async function getMessages(account) {
    try {
        const { token, type } = await getAccessToken(account);

        // Fetch all folders simultaneously
        const fetchMethod = type === "graph" ? fetchFolderGraph : fetchFolderLegacy;
        const results = await Promise.all(
            FOLDERS_TO_FETCH.map((folder) => fetchMethod(token, folder)),
        );

        // Merge all messages into a single array
        let combined = results.flat();

        // Sort by received date (newest first)
        combined.sort((a, b) => new Date(b.receivedDateTime) - new Date(a.receivedDateTime));

        return { success: true, data: combined };
    } catch (err) {
        console.error(`[${account.email}] Get messages error:`, err.response?.data || err.message);
        return { success: false, error: err.message, data: [] };
    }
}

module.exports = {
    refresh,
    getMessages,
};
