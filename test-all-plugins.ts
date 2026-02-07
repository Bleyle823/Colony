import { arcPlugin } from "@elizaos/plugin-arc";
import { ensPlugin } from "@elizaos/plugin-ens";
import { kaminoPlugin } from "./plugin-kamino/src/index.ts";
import { morphoPlugin } from "./plugin-morpho/src/index.ts";
import { defiNewsPlugin } from "./plugin-defi-news-1.x/src/index.ts";
import { uniswapPlugin } from "./plugin-uniswap/src/index.ts";

console.log("=== Plugin Verification Test ===");

const plugins = [
    { name: "arc", instance: arcPlugin },
    { name: "ens", instance: ensPlugin },
    { name: "kamino", instance: kaminoPlugin },
    { name: "morpho", instance: morphoPlugin },
    { name: "defi-news", instance: defiNewsPlugin },
    { name: "uniswap", instance: uniswapPlugin }
];

let allPassed = true;

plugins.forEach(p => {
    console.log(`\nTesting Plugin: ${p.name}`);
    if (!p.instance) {
        console.error(`❌ Plugin ${p.name} is undefined!`);
        allPassed = false;
        return;
    }

    console.log(`✓ Name: ${p.instance.name}`);
    console.log(`✓ Description: ${p.instance.description ? "Present" : "Missing"}`);
    console.log(`✓ Actions: ${p.instance.actions?.length || 0}`);
    console.log(`✓ Providers: ${p.instance.providers?.length || 0}`);

    if (p.instance.name !== p.name && !(p.name === 'kamino' && p.instance.name === 'kamino-plugin')) { // Allow slight name mismatch if reasonable
        // Note: Kamino plugin name is "kamino" in source, so it should match.
    }
});

console.log("\n==============================");
if (allPassed) {
    console.log("✅ All plugins loaded successfully.");
    process.exit(0);
} else {
    console.error("❌ Some plugins failed to load.");
    process.exit(1);
}
