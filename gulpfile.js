const { series, src, dest, task, watch } = require("gulp");
const rollupTypescript = require("rollup-plugin-typescript");
const rollup = require("rollup");
const concat = require("gulp-concat");
const replace = require("gulp-replace");
const fs = require('fs');

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
		.pipe(replace(/#include.GULP-CSS/, function(s) {
			return fs.readFileSync("./src/style.css", "utf8");
		}))
		.pipe(concat("./scoresaber.user.js"))
		.pipe(dest("./"));
});

exports.default = series("build", "userscript");
exports.watch = function () {
	watch([
		"src/**/*.ts",
		"src/**/*.css",
		"src/**/*.user.js"
	], series("build", "userscript"));
};
