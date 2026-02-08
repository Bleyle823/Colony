
const texts = [
    "Send 10 USDC to 0x1234567890123456789012345678901234567890",
    "send 5.5 tokens to 0x1234567890123456789012345678901234567890",
    "pay 100 usdc to 0x1234567890123456789012345678901234567890",
    "send 10 to 0x1234567890123456789012345678901234567890", // loosely matched
];

const patterns = [
    /(\d+(\.\d+)?) (USDC|tokens?)/i,
    /send (\d+(\.\d+)?)/i
];

const addressPattern = /(0x[a-fA-F0-9]{40})/;

console.log("Testing Transfer Action Regex...");

for (const text of texts) {
    console.log(`\nTesting: "${text}"`);
    const amountMatch = text.match(patterns[0]) || text.match(patterns[1]);
    const addressMatch = text.match(addressPattern);

    if (amountMatch) {
        console.log(`  Amount found: ${amountMatch[1]}`);
    } else {
        console.log("  No amount matched");
    }

    if (addressMatch) {
        console.log(`  Address found: ${addressMatch[1]}`);
    } else {
        console.log("  No address matched");
    }
}
