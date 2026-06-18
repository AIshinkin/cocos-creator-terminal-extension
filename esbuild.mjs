import { build, context } from 'esbuild';
const watch = process.argv.includes('--watch');

const common = {
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node18',
  sourcemap: true,
  loader: { '.css': 'text' },
  // Editor is an editor global; electron, node builtins, and the native pty
  // module stay external (the .node binary must load from node_modules at runtime).
  external: ['electron', '@lydell/node-pty'],
};

const builds = [
  { ...common, entryPoints: ['src/main.ts'], outfile: 'dist/main.js' },
  {
    ...common,
    entryPoints: ['src/panel/index.ts'],
    outfile: 'dist/panel.js',
    // Cocos requires the panel module.exports to BE the panel definition,
    // not { default: ... }. Re-point module.exports to the default export.
    footer: { js: 'if (module.exports && module.exports.default) module.exports = module.exports.default;' },
  },
];

if (watch) {
  for (const cfg of builds) { const ctx = await context(cfg); await ctx.watch(); }
  console.log('esbuild watching...');
} else {
  await Promise.all(builds.map((cfg) => build(cfg)));
  console.log('build done');
}
