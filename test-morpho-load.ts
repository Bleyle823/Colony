import { morphoPlugin } from "./plugin-morpho/src/index.ts";

console.log("Loading Morpho Plugin...");
if (morphoPlugin && morphoPlugin.name === "morpho") {
    console.log("✅ Morpho Plugin loaded successfully!");
    console.log(`Actions: ${morphoPlugin.actions?.length}`);
    console.log(`Providers: ${morphoPlugin.providers?.length}`);
    process.exit(0);
} else {
    console.error("❌ Morpho Plugin failed to load.");
    process.exit(1);
}
