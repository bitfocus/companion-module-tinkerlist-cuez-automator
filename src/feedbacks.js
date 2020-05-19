const { combineRgb } = require('@companion-module/base')

module.exports = {
	initFeedbacks: function () {
		let self = this
		let feedbacks = {}

		const foregroundColor = combineRgb(255, 255, 255) // White
		const backgroundColorRed = combineRgb(255, 0, 0) // Red

		feedbacks.powerStatus = {
			type: 'boolean',
			name: 'TV Power is in X State',
			description: 'Show feedback for Power State',
			options: [
				{
					type: 'dropdown',
					label: 'State',
					id: 'state',
					default: true,
					choices: [
						{ id: true, label: 'On' },
						{ id: false, label: 'Off' },
					],
				},
			],
			defaultStyle: {
				color: combineRgb(0, 0, 0),
				bgcolor: combineRgb(255, 0, 0),
			},
			callback: (event) => {
				let opt = event.options

				if (self.DATA.powerState == opt.state) {
					return true
				}

				return false
			},
		}

		feedbacks.muteStatus = {
			type: 'boolean',
			name: 'TV Mute is in X State',
			description: 'Show feedback for Mute State',
			options: [
				{
					type: 'dropdown',
					label: 'State',
					id: 'state',
					default: true,
					choices: [
						{ id: true, label: 'On' },
						{ id: false, label: 'Off' },
					],
				},
			],
			defaultStyle: {
				color: combineRgb(0, 0, 0),
				bgcolor: combineRgb(255, 0, 0),
			},
			callback: (event) => {
				let opt = event.options

				if (self.DATA.muteState == opt.state) {
					return true
				}

				return false
			},
		}

		feedbacks.currentInput = {
			type: 'boolean',
			name: 'TV Input Matches Selected Input',
			description: 'Show feedback for TV Input',
			options: [
				{
					type: 'dropdown',
					label: 'Input',
					id: 'input',
					default: self.CHOICES_INPUTS[0].id,
					choices: self.CHOICES_INPUTS,
				},
			],
			defaultStyle: {
				color: combineRgb(0, 0, 0),
				bgcolor: combineRgb(255, 0, 0),
			},
			callback: (event) => {
				let opt = event.options

				if (self.DATA.input == opt.input) {
					return true
				}

				return false
			},
		}

		self.setFeedbackDefinitions(feedbacks)
	},
}
