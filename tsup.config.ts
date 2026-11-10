import { defineConfig } from 'tsup';

export default defineConfig({
    entry: { index: 'src/index.ts', charts: 'src/charts/index.ts', 'app-switcher': 'src/app-switcher/index.ts' },
    format: ['esm'],
    dts: true,
    sourcemap: true,
    clean: true,
    target: 'es2022',
    external: ['react', 'react-dom', 'echarts'],
    treeshake: true,
});
