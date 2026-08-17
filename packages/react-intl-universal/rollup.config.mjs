import typescript from '@rollup/plugin-typescript';

const copyright = (`/*
 * Copyright ${new Date().getFullYear()}, Alibaba Group.
 * Copyrights licensed under the BSD License.
 * See the accompanying LICENSE file for terms.
 */
`);

const externals = [
    'invariant',
    'intl-messageformat',
    'escape-html',
    'react',
    'lodash.merge',
];

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
    external: externals,
    plugins: [
        typescript({
            tsconfig: './tsconfig.json',
            noEmit: false,
            sourceMap: false
        })
    ]
};
