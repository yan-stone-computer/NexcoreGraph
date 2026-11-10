const path = require("path");
const sharp = require("sharp");

if (process.argv.length < 4) {
  console.error("Usage: node render_svg_file.cjs input.svg output.png");
  process.exit(1);
}

const input = path.resolve(process.argv[2]);
const output = path.resolve(process.argv[3]);

sharp(input, { density: 192 })
  .png()
  .toFile(output)
  .then((info) => console.log(`${info.width}x${info.height}`))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
