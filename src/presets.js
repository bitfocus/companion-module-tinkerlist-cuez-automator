const { combineRgb } = require('@companion-module/base')

module.exports = {
	initPresets: function () {
		let self = this

		let presets = []

		const foregroundColor = combineRgb(255, 255, 255) // White
		const foregroundColorBlack = combineRgb(0, 0, 0) // Black
		const backgroundColorRed = combineRgb(255, 0, 0) // Red
		const backgroundColorGreen = combineRgb(0, 255, 0) // Green
		const backgroundColorYellow = combineRgb(255, 255, 0) // Yellow

		presets['power_on'] = {
			category: 'Power',
			name: `Power On`,
			type: 'button',
			style: {
				text: 'Power On',
				size: '18',
				color: foregroundColor,
				bgcolor: foregroundColorBlack,
			},
			feedbacks: [
				{
					feedbackId: 'powerStatus',
					style: {
						bgcolor: backgroundColorYellow,
						color: foregroundColorBlack,
					},
					options: {
						state: true,
					},
				},
			],
			steps: [
				{
					down: [
						{
							actionId: 'power_on',
							options: {},
						},
					],
					up: [],
				},
			],
		}

		presets['power_off'] = {
			category: 'Power',
			name: `Power Off`,
			type: 'button',
			style: {
				text: 'Power Off',
				size: '18',
				color: foregroundColor,
				bgcolor: foregroundColorBlack,
			},
			feedbacks: [
				{
					feedbackId: 'powerStatus',
					style: {
						bgcolor: backgroundColorYellow,
						color: foregroundColorBlack,
					},
					options: {
						state: false,
					},
				},
			],
			steps: [
				{
					down: [
						{
							actionId: 'power_off',
							options: {},
						},
					],
					up: [],
				},
			],
		}

		presets['volume_mute'] = {
			category: 'Volume',
			name: `Mute`,
			type: 'button',
			style: {
				text: 'Mute',
				size: '18',
				color: foregroundColor,
				bgcolor: foregroundColorBlack,
			},
			feedbacks: [
				{
					feedbackId: 'muteStatus',
					style: {
						bgcolor: backgroundColorYellow,
						color: foregroundColorBlack,
					},
					options: {
						state: true,
					},
				},
			],
			steps: [
				{
					down: [
						{
							actionId: 'volume_mute',
							options: {},
						},
					],
					up: [],
				},
			],
		}

		presets['volume_unmute'] = {
			category: 'Volume',
			name: `Unmute`,
			type: 'button',
			style: {
				text: 'Unmute',
				size: '18',
				color: foregroundColor,
				bgcolor: foregroundColorBlack,
			},
			feedbacks: [
				{
					feedbackId: 'muteStatus',
					style: {
						bgcolor: backgroundColorYellow,
						color: foregroundColorBlack,
					},
					options: {
						state: false,
					},
				},
			],
			steps: [
				{
					down: [
						{
							actionId: 'volume_unmute',
							options: {},
						},
					],
					up: [],
				},
			],
		}

		presets['volume_up'] = {
			category: 'Volume',
			name: `Volume Up`,
			type: 'button',
			style: {
				text: 'Volume Up',
				size: '18',
				color: foregroundColor,
				bgcolor: foregroundColorBlack,
			},
			feedbacks: [],
			steps: [
				{
					down: [
						{
							actionId: 'volume_up',
							options: {},
						},
					],
					up: [],
				},
			],
		}

		presets['volume_down'] = {
			category: 'Volume',
			name: `Volume Down`,
			type: 'button',
			style: {
				text: 'Volume Down',
				size: '18',
				color: foregroundColor,
				bgcolor: foregroundColorBlack,
			},
			feedbacks: [],
			steps: [
				{
					down: [
						{
							actionId: 'volume_down',
							options: {},
						},
					],
					up: [],
				},
			],
		}

		for (const input of this.CHOICES_INPUTS) {
			presets[`select_source_${input.label}`] = {
				category: 'Source',
				name: `Select source ${input.label}`,
				type: 'button',
				style: {
					text: input.label,
					size: '18',
					color: foregroundColor,
					bgcolor: foregroundColorBlack,
				},
				feedbacks: [
					{
						feedbackId: 'currentInput',
						style: {
							bgcolor: backgroundColorYellow,
							color: foregroundColorBlack,
						},
						options: {
							input: input.id,
						},
					},
				],
				steps: [
					{
						down: [
							{
								actionId: 'change_external_input',
								options: self.parseDeviceResourceURI(input.id),
							},
						],
						up: [],
					},
				],
			}
		}

		self.setPresetDefinitions(presets)
	},
}
