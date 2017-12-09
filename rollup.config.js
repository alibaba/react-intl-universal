import * as p from 'path';
import babel from 'rollup-plugin-babel';
import nodeResolve from 'rollup-plugin-node-resolve';
import 'babel-preset-es2015-rollup';
import builtins from 'rollup-plugin-node-builtins';
import commonjs from 'rollup-plugin-commonjs';
import replace from 'rollup-plugin-replace';
import uglify from 'rollup-plugin-uglify';

// const isProduction = process.env.NODE_ENV === 'production';
const isProduction = true;

const copyright = (`/*
 * Copyright ${new Date().getFullYear()}, Alibaba Group.
 * Copyrights licensed under the BSD License.
 * See the accompanying LICENSE file for terms.
 */
`);

export default {
    entry: p.resolve('src/index.js'),
    targets: [
        // {
        //     dest: 'lib/index.js',
        //     format: 'cjs'
        // },
        {
            dest: 'dist/intl-universal.min.js',
            format: 'umd',
            moduleName: 'ReactIntlUniversal',
        },
    ],
    
    banner: copyright,
    external: [
        // 'invariant',
        // 'intl-messageformat',
        // 'load-script',
        // 'intl',
        // 'escape-html',
        // 'cookie',
        'react',
        // 'console-polyfill',
    ],
    globals: {
        react: 'React',
    },
    sourceMap: true,
    plugins: [
        builtins(),
        babel({
            exclude: 'node_modules/**',
            presets: ['es2015-rollup']
        }),
        nodeResolve({
            jsnext: true,
        }),
        commonjs(),
        replace({
            'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
        }),
        isProduction &&
        uglify({
            warnings: false,
        }),
    ]
};
