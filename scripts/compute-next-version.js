#!/usr/bin/env node
'use strict';

/**
 * Calcula la versión que se debe publicar para una extensión de Azure DevOps,
 * evitando el error "Version number must increase each time an extension is
 * published" cuando el manifiesto del repo se desincroniza de lo ya publicado
 * en el marketplace.
 *
 * Consulta la versión actualmente publicada (tfx extension show) y calcula
 * next = bump_patch(published). Si el manifiesto local ya declara una versión
 * igual o superior (por ejemplo, porque se ha subido MINOR/MAJOR a mano para
 * una nueva funcionalidad), se respeta la del manifiesto en su lugar.
 *
 * Uso: node scripts/compute-next-version.js <manifest.json> <token>
 * Salida: imprime por stdout la versión a publicar (sin salto de línea).
 */

const { execFileSync } = require('node:child_process');
const path = require('node:path');

function bumpPatch(version) {
    const [major, minor, patch] = version.split('.').map(Number);
    return `${major}.${minor}.${patch + 1}`;
}

function compareVersions(a, b) {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
        if (pa[i] !== pb[i]) return pa[i] - pb[i];
    }
    return 0;
}

function getPublishedVersion(publisher, extensionId, token) {
    try {
        const output = execFileSync(
            'npx',
            [
                'tfx', 'extension', 'show',
                '--publisher', publisher,
                '--extension-id', extensionId,
                '--token', token,
                '--json',
            ],
            { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
        );
        const info = JSON.parse(output);
        return info && info.versions && info.versions[0] ? info.versions[0].version : null;
    } catch {
        // La extensión no existe todavía (primera publicación) o no se pudo consultar.
        return null;
    }
}

function computeNextVersion(manifest, published) {
    if (!published) {
        return manifest.version;
    }
    const candidate = bumpPatch(published);
    return compareVersions(manifest.version, candidate) < 0 ? candidate : manifest.version;
}

function main() {
    const [, , manifestPath, token] = process.argv;
    if (!manifestPath || !token) {
        console.error('Uso: node compute-next-version.js <manifest.json> <token>');
        process.exit(1);
    }

    const manifest = require(path.resolve(manifestPath));
    const published = getPublishedVersion(manifest.publisher, manifest.id, token);
    const next = computeNextVersion(manifest, published);

    process.stdout.write(next);
}

if (require.main === module) {
    main();
} else {
    module.exports = { bumpPatch, compareVersions, computeNextVersion };
}
