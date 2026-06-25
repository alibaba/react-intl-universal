const fs = require('fs');
const path = require('path');

const esDir = path.resolve(__dirname, '../es');
fs.mkdirSync(esDir, { recursive: true });
fs.writeFileSync(
  path.join(esDir, 'package.json'),
  `${JSON.stringify({ type: 'module' }, null, 2)}\n`
);

