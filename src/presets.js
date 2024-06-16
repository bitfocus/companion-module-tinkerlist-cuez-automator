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

		presets['next'] = {
			category: 'Navigation',
			name: `Next`,
			type: 'button',
			style: {
				text: 'Next',
				size: '14',
				color: foregroundColor,
				bgcolor: foregroundColorBlack,
			},
			feedbacks: [],
			steps: [
				{
					down: [
						{
							actionId: 'next',
							options: {},
						},
					],
					up: [],
				},
			],
		}

		presets['previous'] = {
			category: 'Navigation',
			name: `Previous`,
			type: 'button',
			style: {
				text: 'Previous',
				size: '14',
				color: foregroundColor,
				bgcolor: foregroundColorBlack,
			},
			feedbacks: [],
			steps: [
				{
					down: [
						{
							actionId: 'previous',
							options: {},
						},
					],
					up: [],
				},
			],
		}

		presets['next_trigger'] = {
			category: 'Navigation',
			name: `Next Trigger`,
			type: 'button',
			style: {
				text: 'Next Trigger',
				size: '14',
				color: foregroundColor,
				bgcolor: foregroundColorBlack,
			},
			feedbacks: [],
			steps: [
				{
					down: [
						{
							actionId: 'next_trigger',
							options: {},
						},
					],
					up: [],
				},
			],
		}

		presets['previous_trigger'] = {
			category: 'Navigation',
			name: `Previous Trigger`,
			type: 'button',
			style: {
				text: 'Previous Trigger',
				size: '14',
				color: foregroundColor,
				bgcolor: foregroundColorBlack,
			},
			feedbacks: [],
			steps: [
				{
					down: [
						{
							actionId: 'previous_trigger',
							options: {},
						},
					],
					up: [],
				},
			],
		}

		// TODO(Peter): Retest on later automator
		/*for (const macro of this.CHOICES_MACROS) {
			presets[`fire_macro_${macro.label}`] = {
				category: 'Macros',
				name: `Fire Macro ${macro.label}`,
				type: 'button',
				style: {
					text: `Fire Macro ${macro.label}`,
					size: '14',
					color: foregroundColor,
					bgcolor: foregroundColorBlack,
				},
				feedbacks: [
				],
				steps: [
					{
						down: [
							{
								actionId: 'fire_macro',
								options: {macro: macro.id},
							},
						],
						up: [],
					},
				],
			}
		}*/

		presets['stop_all_timers'] = {
			category: 'Timers',
			name: `Stop All Timers`,
			type: 'button',
			style: {
				text: 'Stop All Timers',
				size: '14',
				color: foregroundColor,
				bgcolor: foregroundColorBlack,
			},
			feedbacks: [],
			steps: [
				{
					down: [
						{
							actionId: 'stop_all_timers',
							options: {},
						},
					],
					up: [],
				},
			],
		}

		for (const timer of this.CHOICES_TIMERS) {
			presets[`start_timer_${timer.label}`] = {
				category: 'Timers',
				name: `Start Timer ${timer.label}`,
				type: 'button',
				style: {
					text: `Start Timer ${timer.label}`,
					size: '14',
					color: foregroundColor,
					bgcolor: foregroundColorBlack,
				},
				feedbacks: [],
				steps: [
					{
						down: [
							{
								actionId: 'start_timer',
								options: { timer: timer.id },
							},
						],
						up: [],
					},
				],
			}

			presets[`stop_timer_${timer.label}`] = {
				category: 'Timers',
				name: `Stop Timer ${timer.label}`,
				type: 'button',
				style: {
					text: `Stop Timer ${timer.label}`,
					size: '14',
					color: foregroundColor,
					bgcolor: foregroundColorBlack,
				},
				feedbacks: [],
				steps: [
					{
						down: [
							{
								actionId: 'stop_timer',
								options: { timer: timer.id },
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
