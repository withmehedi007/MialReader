function normalizeAccount(account) {
    let name, email, password, refreshToken, clientId;

    // Handle string format: mail|pass|refresh_token|client_id
    if (typeof account === "string") {
        const parts = account.trim().split("|");
        if (parts.length < 4) {
            throw new Error(`Invalid format string: ${account}`);
        } else if (parts.length == 4) {
            [email, password, refreshToken, clientId] = parts;
        } else if (parts.length == 5) {
            [name, email, password, refreshToken, clientId] = parts;
        }
    }
    // Handle object format with fullData string
    // else if (account.fullData && account.fullData.trim() !== "") {
    //     const parts = account.fullData.trim().split("|");
    //     if (parts.length < 4) {
    //         throw new Error(`Invalid fullData format (id: ${account.id})`);
    //     }
    //     [email, password, refreshToken, clientId] = parts;
    // }
    // Handle structured object format
    // else {
    //     if (!account.email) throw new Error(`Email missing (id: ${account.id})`);
    //     if (!account.refreshToken) throw new Error(`Refresh Token missing (id: ${account.id})`);
    //     if (!account.clientId) throw new Error(`Client ID missing (id: ${account.id})`);

    //     email = account.email;
    //     password = account.password || "";
    //     refreshToken = account.refreshToken;
    //     clientId = account.clientId;
    // }

    return {
        id: email,
        name: name || "",
        email: email,
        password: password,
        refreshToken: refreshToken,
        clientId: clientId,
        scope: "offline_access https://graph.microsoft.com/Mail.Read",
    };
}

module.exports = normalizeAccount;
