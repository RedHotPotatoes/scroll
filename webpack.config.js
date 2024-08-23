const path = require('path');

module.exports = {
    mode: 'production',
    entry: './src/app.tsx',
    output: {
        path: path.resolve(__dirname, 'out'),
        filename: 'app.js'
    },
    resolve: {
        extensions: ['.ts', '.tsx', '.js']
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/
            },
            {
                test: /\.(png|jpg|gif|svg|eot|ttf|woff|woff2)$/,
                use: 'file-loader'
            }
        ]
    }
};
