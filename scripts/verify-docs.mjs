import fs from "node:fs";
for (const file of ["index.html", "docs/index.md", "docs/product-definition.md"]) {
  if (!fs.existsSync(file)) throw new Error(`${file} missing`);
}
console.log("documentation kb verified");
