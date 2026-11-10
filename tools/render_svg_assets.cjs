const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const root = path.resolve(__dirname, "..");
const inputDir = path.join(root, "deliverables", "作品介绍增强", "assets", "diagrams");

for (const file of fs.readdirSync(inputDir).filter((name) => name.endsWith(".svg"))) {
  const input = path.join(inputDir, file);
  const output = path.join(inputDir, file.replace(/\.svg$/, ".png"));
  sharp(input, { density: 192 })
    .png()
    .toFile(output)
    .then((info) => console.log(`${file} -> ${info.width}x${info.height}`))
    .catch((error) => {
      console.error(`${file}: ${error.message}`);
      process.exitCode = 1;
    });
}
