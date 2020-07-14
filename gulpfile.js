const { series, src, dest, task, watch } = require("gulp");
const rollupTypescript = require("rollup-plugin-typescript");
const rollup = require("rollup");
const concat = require("gulp-concat");
const replace = require("gulp-replace");
const fs = require('fs');
const tslint = require("rollup-plugin-tslint");

task("build", async () => {
	const bundle = await rollup.rollup({
		input: "./src/main.ts",
		plugins: [
			tslint(),
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
	let meta = JSON.parse(fs.readFileSync("./package.json"));
	return src(["./src/header.user.js", "./out/rollup.js"])
		.pipe(replace(/include\$GULP_CSS/, fs.readFileSync("./src/style.css", "utf8")))
		.pipe(replace(/include\$GULP_METADATA/, [
			`// @version      ${meta.version}`,
			`// @description  ${meta.description}`,
			`// @author       ${meta.author}`,
		].join('\n')))
		.pipe(concat("./scoresaber.user.js"))
		.pipe(dest("./"));
});

exports.default = series("build", "userscript");
exports.watch = function () {
	watch([
		"src/**/*.ts",
		"src/**/*.css",
		"src/**/*.user.js",
		"./package.json",
	], series("build", "userscript"));
};
