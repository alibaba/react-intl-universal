import * as p from 'path';
import babel from 'rollup-plugin-babel';
import 'babel-preset-es2015-rollup';

const copyright = (`/*
 * Copyright ${new Date().getFullYear()}, Alibaba Group.
 * Copyrights licensed under the BSD License.
 * See the accompanying LICENSE file for terms.
 */
`);

export default {
    entry : p.resolve('src/index.js'),
    targets : [
        {
            dest: 'lib/index.js',
            format: 'cjs'
        }
    ],
    banner : copyright,
    external : [
        'invariant',
        'intl-messageformat',
        'intl',
        'escape-html',
        'cookie',
        'querystring',
        'react',
        'console-polyfill',
        'lodash.merge',
    ],
    plugins : [babel({exclude: 'node_modules/**', presets: ['es2015-rollup']})]
};
