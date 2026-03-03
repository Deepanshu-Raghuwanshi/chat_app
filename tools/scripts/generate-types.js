
const { execSync } = require('child_process');

console.log('Generating OpenAPI types...');
execSync('openapi-typescript libs/openapi-specs/auth.json -o libs/shared-types/generated/auth.types.ts');
console.log('Done.');
