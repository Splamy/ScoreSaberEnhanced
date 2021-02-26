module.exports = {
	"root": true,
	"env": {
		"browser": true,
		"es2021": true
	},
	"extends": [
		"eslint:recommended",
		"plugin:@typescript-eslint/recommended"
	],
	"parser": "@typescript-eslint/parser",
	"parserOptions": {
		"ecmaVersion": 12
	},
	"plugins": [
		"@typescript-eslint"
	],
	"rules": {
		"@typescript-eslint/no-inferrable-types": 0,
		"@typescript-eslint/no-non-null-assertion": 0,
		"@typescript-eslint/no-explicit-any": 0,
	}
};
