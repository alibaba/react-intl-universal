import typescript from '@rollup/plugin-typescript';

const copyright = (`/*
 * Copyright ${new Date().getFullYear()}, Alibaba Group.
 * Copyrights licensed under the BSD License.
 * See the accompanying LICENSE file for terms.
 */
`);

export default {
    input: 'src/index.ts',
    output: [
        {
            file: 'lib/index.js',
            format: 'cjs',
            exports: 'named',
            banner: copyright
        },
        {
            file: 'es/index.js',
            format: 'es',
            banner: copyright
        }
    ],
    external: [
        'invariant',
        'intl-messageformat',
        'escape-html',
        'react',
        'lodash.merge',
    ],
    plugins: [
        typescript({
            tsconfig: './tsconfig.json',
            noEmit: false,
            sourceMap: false
        })
    ]
};

