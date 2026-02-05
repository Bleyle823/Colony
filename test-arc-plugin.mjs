// Quick test to verify the plugin loads correctly
import { arcPlugin } from '@elizaos/plugin-arc';

console.log('=== Arc Plugin Test ===');
console.log('Plugin Name:', arcPlugin.name);
console.log('Plugin Description:', arcPlugin.description);
console.log('Actions:', arcPlugin.actions?.map(a => a.name));
console.log('Providers:', arcPlugin.providers?.length);
console.log('======================');
