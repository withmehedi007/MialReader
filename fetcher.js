const { ImapFlow } = require("imapflow");
const axios = require("axios");

/**
 * Line parser for mixed string formats
 */
function parseAccountLine(line) {
    const parts = line.split("|");

    // Format A: IMAP ("Note|email|pass:host:port|timestamp")
    if (parts.length >= 3 && parts[2].includes(":")) {
        const [password, host, port] = parts[2].split(":");
        return {
            type: "IMAP",
            note: parts[0] || "",
            email: parts[1],
            password: password,
            host: host,
            port: parseInt(port, 10) || 993,
            timestamp: parts[3] || null,
        };
    }

    // Format B: Graph API ("Note|email|pass|refreshToken|clientId")
    if (parts.length >= 5) {
        return {
            type: "GRAPH",
            note: parts[0] || "",
            email: parts[1],
            password: parts[2],
            refreshToken: parts[3],
            clientId: parts[4],
        };
    }

    throw new Error(`Invalid account format line: ${line}`);
}

/**
 * IMAP Message Fetcher
 */
async function fetchImap(account, limit = 15) {
    const client = new ImapFlow({
        host: account.host,
        port: account.port,
        secure: true,
        tls: { rejectUnauthorized: false }, // Bypass self-signed SSL cert checks
        auth: { user: account.email, pass: account.password },
        logger: false,
    });

    const emails = [];

    try {
        await client.connect();
        const lock = await client.getMailboxLock("INBOX");

        try {
            const total = client.mailbox.exists;
            if (total > 0) {
                const start = Math.max(1, total - limit + 1);
                for await (let msg of client.fetch(`${start}:${total}`, {
                    envelope: true,
                    source: true,
                })) {
                    emails.push({
                        id: msg.uid.toString(),
                        type: "IMAP",
                        account: account.email,
                        from: msg.envelope.from?.[0]?.address || "Unknown",
                        subject: msg.envelope.subject || "(No Subject)",
                        date: msg.envelope.date,
                        body: msg.source.toString("utf-8"),
                    });
                }
            }
        } finally {
            lock.release();
        }
        await client.logout();
    } catch (err) {
        console.error(`[IMAP Error] ${account.email}:`, err.message);
    }

    return emails;
}

/**
 * Microsoft Graph API Message Fetcher
 */
async function fetchGraph(account, limit = 15) {
    try {
        const tokenParams = new URLSearchParams({
            client_id: account.clientId,
            grant_type: "refresh_token",
            refresh_token: account.refreshToken,
            scope: "https://graph.microsoft.com/mail.read",
        });

        const tokenRes = await axios.post(
            "https://login.microsoftonline.com/common/oauth2/v2.0/token",
            tokenParams.toString(),
            { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
        );

        const accessToken = tokenRes.data.access_token;

        const messagesRes = await axios.get(
            `https://graph.microsoft.com/v1.0/me/messages?$top=${limit}&$select=id,from,subject,receivedDateTime,body`,
            { headers: { Authorization: `Bearer ${accessToken}` } },
        );

        return messagesRes.data.value.map((msg) => ({
            id: msg.id,
            type: "GRAPH",
            account: account.email,
            from: msg.from?.emailAddress?.address || "Unknown",
            subject: msg.subject || "(No Subject)",
            date: new Date(msg.receivedDateTime),
            body: msg.body?.content || "",
        }));
    } catch (err) {
        console.error(
            `[Graph Error] ${account.email}:`,
            err.response?.data?.error_description || err.message,
        );
        return [];
    }
}

/**
 * Universal Dispatcher
 */
async function fetchAccountEmails(rawLine, limit = 15) {
    const account = parseAccountLine(rawLine);
    if (account.type === "IMAP") return await fetchImap(account, limit);
    if (account.type === "GRAPH") return await fetchGraph(account, limit);
    return [];
}

module.exports = { parseAccountLine, fetchAccountEmails };
