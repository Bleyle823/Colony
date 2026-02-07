
// Reproduction of parsing logic from src/actions/quote.ts

const content = "Get quote for 1 MF-ONE to USDC";
const words = content.split(" ");

// Logic from src/actions/quote.ts
const symbols = words.filter(w => w === w.toUpperCase() && w.length > 1 && w.length < 6);

console.log("Input:", content);
console.log("Extracted symbols:", symbols);

if (symbols.includes("MF-ONE")) {
    console.log("SUCCESS: MF-ONE found");
} else {
    console.log("FAILURE: MF-ONE not found (likely length restriction)");
}
