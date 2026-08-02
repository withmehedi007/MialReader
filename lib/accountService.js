const rawAccounts = require("../data");
const normalizeAccount = require("./accountParser");

function getAccounts() {
    const accounts = [];

    for (const account of rawAccounts) {
        try {
            accounts.push(normalizeAccount(account));
        } catch (err) {
            console.error(err.message);
        }
    }

    return accounts;
}

module.exports = {
    getAccounts,
};
