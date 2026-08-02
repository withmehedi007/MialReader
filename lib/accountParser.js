function normalizeAccount(account) {
    let note = "",
        name = "",
        email = "",
        password = "",
        refreshToken = "",
        clientId = "",
        host = "",
        port = 993,
        type = "GRAPH",
        timestamp = "";

    if (typeof account === "string") {
        const parts = account.trim().split("|");

        // Check for IMAP format (e.g., "Note|email|pass:host:port|timestamp")
        const passPart = parts.find((p) => p.includes(":") && !p.startsWith("http"));

        if (passPart) {
            type = "IMAP";
            const [pass, serverHost, serverPort] = passPart.split(":");
            password = pass || "";
            host = serverHost || "";
            port = parseInt(serverPort, 10) || 993;

            if (parts.length === 3) {
                [email, , timestamp] = parts;
            } else if (parts.length >= 4) {
                [note, email, , timestamp] = parts;
            }
        }
        // Microsoft Graph API Format (e.g., "Note|email|pass|refreshToken|clientId")
        else if (parts.length >= 4) {
            type = "GRAPH";
            if (parts.length === 4) {
                [email, password, refreshToken, clientId] = parts;
            } else {
                [note, email, password, refreshToken, clientId] = parts;
            }
        }
    }

    return {
        id: email || "unknown",
        type: type,
        note: note || "", // Explicitly assigned note
        name: note || "", // Fallback alias for compatibility
        email: email || "",
        password: password || "",
        refreshToken: refreshToken || "",
        clientId: clientId || "",
        host: host || "",
        port: port || 993,
        timestamp: timestamp || "",
        scope: "offline_access https://graph.microsoft.com/Mail.Read",
    };
}

module.exports = normalizeAccount;
