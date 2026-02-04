
import { generateEntitySecret, registerEntitySecretCiphertext } from "@circle-fin/developer-controlled-wallets";
import * as fs from "fs";
import * as path from "path";

// Function to read .env manually if needed, or rely on Bun's auto-loading
const getEnvVar = (key: string): string | undefined => {
    return process.env[key];
};

async function main() {
    console.log("Starting Circle Entity Secret registration...");
    
    const apiKey = getEnvVar("CIRCLE_API_KEY");
    if (!apiKey || apiKey.includes("your_circle_api_key")) {
        console.error("Error: CIRCLE_API_KEY is missing or invalid in .env file.");
        process.exit(1);
    }
    
    const entitySecret = "265f86d985804ef50879a4c0aae7e23ec9317836c03a3d791251a290cb73309a"; // generateEntitySecret();
    console.log("Using generated Entity Secret:", entitySecret);
    
    console.log("Registering Entity Secret Ciphertext...");
    try {
        const res = await registerEntitySecretCiphertext({
            apiKey: apiKey,
            entitySecret: entitySecret,
            recoveryFileDownloadPath: process.cwd() // Provide directory, not file path
        });
        
        console.log("Registration Successful!");
        console.log("Recovery file saved to:", path.resolve(process.cwd(), "circle_recovery_file.dat"));
        console.log("\nIMPORTANT: Update your .env file with this secret:");
        console.log(`CIRCLE_ENTITY_SECRET=${entitySecret}`);
        
    } catch (error) {
        console.error("Error registering entity secret:", error);
        process.exit(1);
    }
}

main();
