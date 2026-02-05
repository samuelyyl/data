const http = require('http');
const fs = require('fs');
const path = require('path');

const PORTS = [12340, 12341, 12342, 12343, 12344, 12345];
const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
};

function startServer(port) {
    const server = http.createServer((req, res) => {
        let filePath = '.' + req.url;
        if (filePath === './') {
            filePath = './line.dev.html';
        }

        const extname = String(path.extname(filePath)).toLowerCase();
        const mimeType = MIME_TYPES[extname] || 'application/octet-stream';

        fs.readFile(filePath, (error, content) => {
            if (error) {
                if (error.code === 'ENOENT') {
                    res.writeHead(404, { 'Content-Type': 'text/html' });
                    res.end('<h1>404 Not Found</h1>', 'utf-8');
                } else {
                    res.writeHead(500);
                    res.end(`Server Error: ${error.code}`, 'utf-8');
                }
            } else {
                res.writeHead(200, { 'Content-Type': mimeType });
                res.end(content, 'utf-8');
            }
        });
    });

    server.listen(port, () => {
        console.log(`\nServer running at http://localhost:${port}/`);
        console.log(`Opening http://localhost:${port}/line.dev.html\n`);

        const { exec } = require('child_process');
        exec(`open http://localhost:${port}/line.dev.html`);
    });

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.log(`Port ${port} is busy, trying next port...`);
            const nextPortIndex = PORTS.indexOf(port) + 1;
            if (nextPortIndex < PORTS.length) {
                startServer(PORTS[nextPortIndex]);
            } else {
                console.error('All ports in range are busy!');
            }
        }
    });
}

// Start with first port
startServer(PORTS[0]);
