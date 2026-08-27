const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');

const includesDir = path.join(projectRoot, 'public', 'includes');

const fileMap = {
  [path.join(projectRoot, 'index.html')]: 'header-index.html',
  [path.join(projectRoot, 'vistas', 'orden.html')]: 'header-orden.html',
  [path.join(projectRoot, 'vistas', 'reporte.html')]: 'header-reporte.html',
  [path.join(projectRoot, 'vistas', 'catalogo.html')]: 'header-index.html',
};

function processFile(htmlPath, headerName) {
  let content = fs.readFileSync(htmlPath, 'utf8');

  const headerPath = path.join(includesDir, headerName);
  const footerPath = path.join(includesDir, 'footer.html');

  const headerContent = fs.readFileSync(headerPath, 'utf8');
  const footerContent = fs.readFileSync(footerPath, 'utf8');

  content = content.replace(
    /<!--\s*@include\s+"includes\/header-[^"]+"\s*-->/,
    headerContent
  );

  content = content.replace(
    /<!--\s*@include\s+"includes\/footer\.html"\s*-->/,
    footerContent
  );

  fs.writeFileSync(htmlPath, content, 'utf8');
  console.log(`Processed: ${path.relative(projectRoot, htmlPath)}`);
}

for (const [htmlPath, headerName] of Object.entries(fileMap)) {
  processFile(htmlPath, headerName);
}

console.log('Build includes completed.');
