#!/usr/bin/env node
// ENCRYPT_PASSWORD= node kg/scripts/decrypt.js tmp
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

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

// Decrypt a single file
function decryptFile(inputPath, outputPath) {
    const encryptedData = fs.readFileSync(inputPath);

    if (encryptedData.length < SALT_LENGTH + IV_LENGTH + TAG_LENGTH) {
        throw new Error(`Invalid encrypted file: ${inputPath}`);
    }

    const salt = encryptedData.subarray(0, SALT_LENGTH);
    const iv = encryptedData.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const ciphertext = encryptedData.subarray(SALT_LENGTH + IV_LENGTH);

    const key = deriveKey(password, salt);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

    // Extract auth tag (last 16 bytes)
    const tag = ciphertext.subarray(ciphertext.length - TAG_LENGTH);
    const actualCiphertext = ciphertext.subarray(0, ciphertext.length - TAG_LENGTH);

    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([
        decipher.update(actualCiphertext),
        decipher.final()
    ]);

    fs.writeFileSync(outputPath, decrypted);
    console.log(`Decrypted: ${path.basename(inputPath)} -> ${path.basename(outputPath)}`);
}

// Decrypt all files in a directory
function decryptDirectory(backupDir, outputDir) {
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const files = fs.readdirSync(backupDir);

    for (const file of files) {
        const backupPath = path.join(backupDir, file);
        const stat = fs.statSync(backupPath);

        if (stat.isFile() && file.endsWith('.enc')) {
            const originalName = file.slice(0, -4); // Remove .enc extension
            const outputPath = path.join(outputDir, originalName);
            decryptFile(backupPath, outputPath);
        } else if (stat.isDirectory()) {
            const subOutputDir = path.join(outputDir, file);
            decryptDirectory(backupPath, subOutputDir);
        }
    }
}

// Main execution
const backupDir = path.join(__dirname, '..','backup');
const outputDir = process.argv[2];

if (!outputDir) {
    console.error('Error: output directory is required');
    console.error('Usage: node scripts/decrypt.js <output_dir>');
    process.exit(1);
}

if (!fs.existsSync(backupDir)) {
    console.error(`Error: Backup directory "${backupDir}" does not exist`);
    process.exit(1);
}



console.log('Decrypting files...');
decryptDirectory(backupDir, outputDir);
console.log('Decryption complete!');