#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream/promises');

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const ITERATIONS = 100000;

// Get password from environment variable
const password = process.env.ENCRYPT_PASSWORD;

if (!password) {
    console.error('Error: ENCRYPT_PASSWORD environment variable is not set');
    process.exit(1);
}

// Derive key from password
function deriveKey(password, salt) {
    return crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, 'sha256');
}

// Encrypt a single file
function encryptFile(inputPath, outputPath) {
    const salt = crypto.randomBytes(SALT_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);
    const key = deriveKey(password, salt);

    const plaintext = fs.readFileSync(inputPath);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    const encrypted = Buffer.concat([
        cipher.update(plaintext),
        cipher.final(),
        cipher.getAuthTag()
    ]);

    // Write file with format: salt + iv + encrypted
    fs.writeFileSync(outputPath, Buffer.concat([salt, iv, encrypted]));

    console.log(`Encrypted: ${path.basename(inputPath)} -> ${path.basename(outputPath)}`);
}

// Encrypt all files in a directory
function encryptDirectory(srcDir, backupDir) {
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }

    const files = fs.readdirSync(srcDir);

    for (const file of files) {
        const srcPath = path.join(srcDir, file);
        const stat = fs.statSync(srcPath);

        if (stat.isFile()) {
            const backupPath = path.join(backupDir, file + '.enc');
            encryptFile(srcPath, backupPath);
        } else if (stat.isDirectory()) {
            const subBackupDir = path.join(backupDir, file);
            encryptDirectory(srcPath, subBackupDir);
        }
    }
}

// Main execution
const srcDir = path.join(__dirname,'..',  'src');
const backupDir = path.join(__dirname, '..', 'backup');

if (!fs.existsSync(srcDir)) {
    console.error(`Error: Source directory "${srcDir}" does not exist`);
    process.exit(1);
}

console.log('Encrypting files...');
encryptDirectory(srcDir, backupDir);
console.log('Encryption complete!');