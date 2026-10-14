import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const sourceDir = path.join(repoRoot, 'src', 'userscript');
const outputFile = path.join(repoRoot, 'tornracingtelemetry.js');

const partFiles = readdirSync(sourceDir, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.js'))
    .map(entry => entry.name)
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));

if (partFiles.length === 0) {
    throw new Error(`No source parts found in ${sourceDir}`);
}

const bundle = partFiles
    .map(fileName => readFileSync(path.join(sourceDir, fileName), 'utf8').replace(/\r\n/g, '\n'))
    .join('\n');

if (!bundle.startsWith('// ==UserScript==')) {
    throw new Error('The generated bundle is missing the userscript header.');
}

writeFileSync(path.join(repoRoot, 'tornracingtelemetry.user.js'), bundle, 'utf8');

const previousBundle = existsSync(outputFile)
    ? readFileSync(outputFile, 'utf8')
    : null;

if (previousBundle === bundle) {
    console.log(`No changes. ${path.basename(outputFile)} is already up to date.`);
    process.exit(0);
}

writeFileSync(outputFile, bundle, 'utf8');
console.log(`Built ${path.basename(outputFile)} from ${partFiles.length} source parts.`);
