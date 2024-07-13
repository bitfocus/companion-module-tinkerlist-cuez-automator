module.exports = {
	initActions: function () {
		let self = this
		let actions = {}

		actions.next = {
			name: 'Next',
			options: [],
			callback: async function (action) {
				self.sendCommand('trigger', 'next')
			},
		}

		actions.previous = {
			name: 'Previous',
			options: [],
			callback: async function (action) {
				self.sendCommand('trigger', 'previous')
			},
		}

		actions.next_trigger = {
			name: 'Next Trigger',
			options: [],
			callback: async function (action) {
				self.sendCommand('trigger', 'nextTrigger')
			},
		}

		actions.previous_trigger = {
			name: 'Previous Trigger',
			options: [],
			callback: async function (action) {
				self.sendCommand('trigger', 'previousTrigger')
			},
		}

		actions.trigger_deck_button = {
			name: 'Trigger Deck Button',
			options: [
				{
					type: 'dropdown',
					label: 'Button',
					id: 'button',
					choices: self.CHOICES_DECK_BUTTONS,
					default: self.CHOICES_DECK_BUTTONS.length > 0 ? self.CHOICES_DECK_BUTTONS[0].id : '',
				},
			],
			callback: async function (action) {
				let opt = action.options
				self.sendCommand('trigger', 'button', opt.button)
			},
		}

		actions.trigger_deck_switch_on = {
			name: 'Trigger Deck Switch On',
			options: [
				{
					type: 'dropdown',
					label: 'Switch',
					id: 'switch',
					choices: self.CHOICES_DECK_SWITCHES,
					default: self.CHOICES_DECK_SWITCHES.length > 0 ? self.CHOICES_DECK_SWITCHES[0].id : '',
				},
			],
			callback: async function (action) {
				let opt = action.options
				self.sendCommand('trigger', 'button', opt.switch, 'on')
			},
		}

		actions.trigger_deck_switch_off = {
			name: 'Trigger Deck Switch Off',
			options: [
				{
					type: 'dropdown',
					label: 'Switch',
					id: 'switch',
					choices: self.CHOICES_DECK_SWITCHES,
					default: self.CHOICES_DECK_SWITCHES.length > 0 ? self.CHOICES_DECK_SWITCHES[0].id : '',
				},
			],
			callback: async function (action) {
				let opt = action.options
				self.sendCommand('trigger', 'button', opt.switch, 'off')
			},
		}

		actions.trigger_deck_switch_click = {
			name: 'Trigger Deck Switch Click',
			options: [
				{
					type: 'dropdown',
					label: 'Switch',
					id: 'switch',
					choices: self.CHOICES_DECK_SWITCHES,
					default: self.CHOICES_DECK_SWITCHES.length > 0 ? self.CHOICES_DECK_SWITCHES[0].id : '',
				},
			],
			callback: async function (action) {
				let opt = action.options
				self.sendCommand('trigger', 'button', opt.switch, 'click')
			},
		}

		actions.trigger_shortcut = {
			name: 'Trigger Shortcut',
			options: [
				{
					type: 'dropdown',
					label: 'Shortcut',
					id: 'shortcut',
					choices: self.CHOICES_SHORTCUTS,
					default: self.CHOICES_SHORTCUTS.length > 0 ? self.CHOICES_SHORTCUTS[0].id : '',
				},
			],
			callback: async function (action) {
				let opt = action.options
				self.sendCommand('trigger', 'shortcut', opt.shortcut)
			},
		}

		// TODO(Peter): Retest on later automator
		/*actions.fire_macro = {
			name: 'Fire Macro',
			options: [
				{
					type: 'dropdown',
					label: 'Macro',
					id: 'macro',
					choices: self.CHOICES_MACROS,
					default: self.CHOICES_MACROS.length > 0 ? self.CHOICES_MACROS[0].id : '',
				},
			],
			callback: async function (action) {
				let opt = action.options
				self.sendCommand('macro', '', opt.macro)
			},
		}*/

		actions.start_timer = {
			name: 'Start Timer',
			options: [
				{
					type: 'dropdown',
					label: 'Timer',
					id: 'timer',
					choices: self.CHOICES_TIMERS,
					default: self.CHOICES_TIMERS.length > 0 ? self.CHOICES_TIMERS[0].id : '',
				},
			],
			callback: async function (action) {
				let opt = action.options
				self.sendCommand('timer', 'start', opt.timer)
			},
		}

		actions.stop_timer = {
			name: 'Stop Timer',
			options: [
				{
					type: 'dropdown',
					label: 'Timer',
					id: 'timer',
					choices: self.CHOICES_TIMERS,
					default: self.CHOICES_TIMERS.length > 0 ? self.CHOICES_TIMERS[0].id : '',
				},
			],
			callback: async function (action) {
				let opt = action.options
				self.sendCommand('timer', 'stop', opt.timer)
			},
		}

		actions.stop_all_timers = {
			name: 'Stop All Timers',
			options: [],
			callback: async function (action) {
				self.sendCommand('timer', 'stop')
			},
		}

		self.setActionDefinitions(actions)
	},
}
