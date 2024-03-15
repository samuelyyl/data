const JavaScriptObfuscator = require('webpack-obfuscator');
const path = require('path');

module.exports = {
    entry: './src/index.js', // 入口文件
    mode: 'development', // 设置开发模式
    output: {
        path: path.resolve(__dirname, 'js'), // 输出目录
        // path: __dirname+'/js', // 输出目录
        filename: 'index.min.js' // 输出文件名
    },
    plugins: [
        new JavaScriptObfuscator({
            compact: true,
            controlFlowFlattening: true
            // 在这里可以添加更多的混淆选项
        }, ['excluded_bundle_name.js'])
    ],
    module: {
        rules: [
        ]
    }
};
