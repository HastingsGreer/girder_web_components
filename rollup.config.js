
import vue from 'rollup-plugin-vue';
import replace from 'rollup-plugin-replace';
import resolve from 'rollup-plugin-node-resolve';
import babel from 'rollup-plugin-babel';
import scss from 'rollup-plugin-scss';
import stylus from 'rollup-plugin-stylus-compiler';
import commonjs from 'rollup-plugin-commonjs';
// import postcss from 'rollup-plugin-postcss';

const plugins = [
  stylus(),
  scss(),
  commonjs(),
  vue({ css: false }),
  replace({
    'process.env.NODE_ENV': JSON.stringify('production')
  }),
  resolve(),
  babel({
    exclude: 'node_modules/**',
  }),
];

const config = {
  input: 'src/index.js',
  output: {
    file: 'dist/gwc.js',
    format: 'esm',
    sourcemap: false,
  },
  plugins,
};

export default config;
