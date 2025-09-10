const JavaScriptObfuscator = require('webpack-obfuscator');
const path = require('path');

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
        }, ['excluded_bundle_name.js'])
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
