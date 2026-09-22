// Lint configuration for this repository.
//
// It layers the official Obsidian rules on top of the same ESLint and
// typescript-eslint presets the community directory review uses, so running
// `npx eslint .` locally reproduces what the review will report.
//
// `main.js` is a hand-written CommonJS file: Obsidian's plugin loader calls
// require() on it directly, so there is no bundler and no import syntax. The
// file carries its own scoped `eslint-disable` directive for that, and the one
// override below silences a warning about modules the host provides at runtime.
import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";

export default defineConfig([
	...obsidianmd.configs.recommended,
	{
		ignores: ["dist/**", "docs/**", "test/**"],
	},
	{
		files: ["main.js"],
		rules: {
			"import/no-extraneous-dependencies": "off",
		},
	},
]);
