import commonjs from '@rollup/plugin-commonjs';
import typescript from 'rollup-plugin-typescript2';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import externals from 'rollup-plugin-node-externals';
import json from '@rollup/plugin-json';
import { terser } from 'rollup-plugin-terser';

const LOCAL_EXTERNALS = ['./config.json'];
const NPM_EXTERNALS = [
  './src/api-lambda/index.ts',
  './src/default-lambda/index.ts',
  './src/image-lambda/index.ts',
];

const generateConfig = (input) => ({
  input: `./src/${input.filename}.ts`,
  output: {
    file: `./lib/${input.filename}${input.minify ? '.min' : ''}.js`,
    format: 'cjs',
  },
  plugins: [
    json(),
    commonjs(),
    externals({
      exclude: '@sls-next/next-aws-cloudfront',
    }),
    nodeResolve(),
    typescript({
      tsconfig: 'tsconfig.bundle.json',
    }),
    input.minify
      ? terser({
        compress: true,
        mangle: true,
        output: { comments: false }, // Remove all comments, which is fine as the handler code is not distributed.
      })
      : undefined,
  ],
  external: [...NPM_EXTERNALS, ...LOCAL_EXTERNALS],
  inlineDynamicImports: true,
});

export default [
  { filename: 'index', minify: false },
  { filename: 'index', minify: true },
].map(generateConfig);
