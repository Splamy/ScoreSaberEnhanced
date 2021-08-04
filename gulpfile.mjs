import { readFileSync } from "fs";
import pkg from "gulp";
import concat from "gulp-concat";
import replace from "gulp-replace";
import { rollup } from "rollup";
import typescript from "@rollup/plugin-typescript";
import resolve from "@rollup/plugin-node-resolve";
import eslint from "@rbnlffl/rollup-plugin-eslint";
import svelte from "rollup-plugin-svelte";
import sveltePreprocess from "svelte-preprocess";
import commonjs from "@rollup/plugin-commonjs";
const { series, src, dest, task, watch } = pkg;

task("build", async () => {
	const bundle = await rollup({
		input: "./src/main.ts",
		plugins: [
			svelte({
				include: '**/*.svelte',
				preprocess: sveltePreprocess(),
				emitCss: false,
				onwarn: (warning, handler) => {
					// e.g. don't warn on <marquee> elements, cos they're cool
					if (warning.code === 'a11y-label-has-associated-control') return;
					handler(warning);
				},
			}),
			eslint({ filterExclude: ["**/*.svelte", "node_modules/**"] }),
			resolve({ browser: true }),
			typescript({ tsconfig: './tsconfig.json' }),
			commonjs({ extensions: ['.js', '.ts'] }),
		]
	});
	return bundle.write({
		file: "./out/rollup.js",
		format: "iife",
		name: "library",
		sourcemap: true
	});
});

task("userscript", async () => {
	let meta = JSON.parse(readFileSync("./package.json"));
	return src(["./src/header.user.js", "./out/rollup.js"])
		.pipe(replace(/include\$GULP_CSS/, readFileSync("./src/style.css", "utf8")))
		.pipe(replace(/include\$GULP_METADATA/, [
			`// @version      ${meta.version}`,
			`// @description  ${meta.description}`,
			`// @author       ${meta.author}`,
		].join('\n')))
		.pipe(concat("./scoresaber.user.js"))
		.pipe(dest("./"));
});

const _default = series("build", "userscript");
export { _default as default };
const _watch = function () {
	watch([
		"src/**/*.ts",
		"src/**/*.css",
		"src/**/*.svelte",
		"src/**/*.user.js",
		"./package.json",
	], series("build", "userscript"));
};
export { _watch as watch };
