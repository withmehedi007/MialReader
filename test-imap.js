const { ImapFlow } = require("imapflow");

const client = new ImapFlow({
    host: "stackmind.buzz",
    port: 993,
    secure: true,
    tls: { rejectUnauthorized: false },
    auth: {
        user: "santanasheltonmyrz@hotmail.com", // or your exact user
        pass: "lLmoM4_7ipJW_Gf0p0LiXLIxj2E97e-9t1vuc63C4QXE5im5lKfiZb9oBV339wfV_GWdjHUCEM7S8XG9FQQ9mF3m_ZhHZTr4BNTifKB9ZN0",
    },
    logger: false,
});

async function checkMessages() {
    try {
        await client.connect();
        const lock = await client.getMailboxLock("INBOX");

        console.log(`\n Total messages in INBOX: ${client.mailbox.exists}\n`);

        for await (let msg of client.fetch("1:*", { envelope: true })) {
            console.log(`[UID: ${msg.uid}] Date: ${msg.envelope.date}`);
            console.log(`   From: ${msg.envelope.from?.[0]?.address}`);
            console.log(`   Subject: ${msg.envelope.subject}\n`);
        }

        lock.release();
        await client.logout();
    } catch (err) {
        console.error("Error:", err);
    }
}

checkMessages();
