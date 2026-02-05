import dotenv from 'dotenv';
import path from 'path';

// Try loading from default and explicit path
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

console.log("--- ENV CHECK ---");
console.log("CWD:", process.cwd());
console.log("SOLANA_PRIVATE_KEY Present:", !!process.env.SOLANA_PRIVATE_KEY);
console.log("SOLANA_PRIVATE_KEY Length:", process.env.SOLANA_PRIVATE_KEY ? process.env.SOLANA_PRIVATE_KEY.length : 0);
console.log("-----------------");
