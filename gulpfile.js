const { series, src, dest, task, watch } = require("gulp");
const rollupTypescript = require("rollup-plugin-typescript");
const rollup = require("rollup");
const concat = require("gulp-concat");

task("build", async () => {
	const bundle = await rollup.rollup({
		input: "./src/main.ts",
		plugins: [
			rollupTypescript()
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
	return src(["./src/header.user.js", "./out/rollup.js"])
		.pipe(concat("./scoresaber.user.js"))
		.pipe(dest("./"));
});

exports.default = series("build", "userscript");
exports.watch = function () {
	watch([
		"src/**/*.ts",
		"src/**/*.user.js"
	], series("build", "userscript"));
};
