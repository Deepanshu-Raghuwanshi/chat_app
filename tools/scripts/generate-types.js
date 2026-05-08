const { execSync } = require("child_process");

console.log("Generating OpenAPI types...");
const services = ["auth", "user", "chat"];

services.forEach((service) => {
  console.log(`Generating types for ${service}...`);
  execSync(
    `npx openapi-typescript libs/openapi-specs/src/v1/${service}.yaml -o libs/shared-types/src/v1/${service}.types.ts`,
  );
});

console.log("Done.");
