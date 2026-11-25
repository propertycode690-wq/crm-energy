const fs = require('fs');
const path = require('path');

const content = fs.readFileSync(path.resolve(__dirname, '../prisma/schema.prisma'), 'utf8');

function getModel(name) {
  const idx = content.indexOf(`model ${name} {`);
  if (idx === -1) return null;
  const endIdx = content.indexOf('\n}', idx);
  return content.slice(idx, endIdx + 2);
}

['GisRegion', 'GisTerritory', 'RdIpAsset', 'RdComplianceSop'].forEach(m => {
  console.log(`=== ${m} ===`);
  console.log(getModel(m));
});

