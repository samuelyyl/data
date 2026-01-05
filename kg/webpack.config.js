const JavaScriptObfuscator = require('webpack-obfuscator');
const path = require('path');
const { execSync } = require('child_process');

class PrintLineHtmlPlugin {
    apply(compiler) {
        compiler.hooks.done.tap('PrintLineHtmlPlugin', () => {
            const htmlPath = path.resolve(__dirname, 'line.html');
            console.log('\n✅ Build 完成！打开 HTML:');
            console.log(`file://${htmlPath}\n`);
        });
    }
}

class EncryptBackupPlugin {
    apply(compiler) {
        compiler.hooks.done.tap('EncryptBackupPlugin', () => {
            try {
                if (process.env.ENCRYPT_PASSWORD) {
                    console.log('\n🔒 Encrypting source files to backup...');
                    execSync('node scripts/encrypt.js', {
                        cwd: __dirname,
                        stdio: 'inherit'
                    });
                    console.log('✅ Encryption complete!\n');
                } else {
                    console.log('\n⚠️  ENCRYPT_PASSWORD not set, skipping encryption\n');
                }
            } catch (error) {
                console.error('❌ Encryption failed:', error.message);
            }
        });
    }
}
module.exports = {
    entry: './src/index.js', // 入口文件
    mode: 'development', // 设置开发模式
    // mode: 'production', // 设置开发模式
    output: {
        path: path.resolve(__dirname, 'js'), // 输出目录
        // path: __dirname+'/js', // 输出目录
        filename: 'index.min.js' // 输出文件名
    },
    devtool: false, // 不输出 source map
    plugins: [
        new JavaScriptObfuscator({
            compact: true,
            controlFlowFlattening: true,
            stringArray: true,
            stringArrayEncoding: ['base64'] // JSON/CSV里的字符串会被编码
            // 在这里可以添加更多的混淆选项
        }, ['excluded_bundle_name.js']),
        new PrintLineHtmlPlugin(),
        new EncryptBackupPlugin()
    ],
    module: {
        rules: [
            {
                test: /\.csv$/i,
                use: ['csv-loader']
            }
        ]
    }
};
