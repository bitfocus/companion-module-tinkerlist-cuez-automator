import { generateEslintConfig } from '@companion-module/tools/eslint/config.mjs'

export default [
	...(await generateEslintConfig({ enableTypescript: true })),
	// Run with node's type stripping, outside the tsconfig project.
	{ ignores: ['test/**'] },
]
