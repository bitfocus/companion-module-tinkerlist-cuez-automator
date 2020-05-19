module.exports = {
	initActions: function () {
		let self = this
		let actions = {}

		actions.power_on = {
			name: 'Power On',
			options: [],
			callback: async function (action) {
				let params = { status: true }
				self.sendCommand('system', 'setPowerStatus', params)
			},
		}

		actions.power_off = {
			name: 'Power Off',
			options: [],
			callback: async function (action) {
				let params = { status: false }
				self.sendCommand('system', 'setPowerStatus', params)
			},
		}

		actions.volume_up = {
			name: 'Volume Up',
			options: [],
			callback: async function (action) {
				let params = { target: 'speaker', volume: '+1' }
				self.sendCommand('audio', 'setAudioVolume', params)
			},
		}

		actions.volume_down = {
			name: 'Volume Down',
			options: [],
			callback: async function (action) {
				let params = { target: 'speaker', volume: '-1' }
				self.sendCommand('audio', 'setAudioVolume', params)
			},
		}

		actions.volume_mute = {
			name: 'Volume Mute',
			options: [],
			callback: async function (action) {
				let params = { status: true }
				self.sendCommand('audio', 'setAudioMute', params)
			},
		}

		actions.volume_unmute = {
			name: 'Volume Unmute',
			options: [],
			callback: async function (action) {
				let params = { status: false }
				self.sendCommand('audio', 'setAudioMute', params)
			},
		}

		actions.change_external_input = {
			name: 'Change External Input',
			options: [
				{
					type: 'dropdown',
					label: 'Kind',
					id: 'kind',
					choices: [
						{ id: 'hdmi', label: 'HDMI' },
						// TODO(Someone): Add CEC, but the URI has a type and port is optional
						{ id: 'component', label: 'Component' },
						{ id: 'composite', label: 'Composite' },
						{ id: 'scart', label: 'SCART' },
						{ id: 'widi', label: 'Wi-Fi Display' },
					],
				},
				{
					type: 'dropdown',
					label: 'Port',
					id: 'port',
					choices: [
						{ id: '1', label: '1' },
						{ id: '2', label: '2' },
						{ id: '3', label: '3' },
						{ id: '4', label: '4' },
					],
				},
			],
			callback: async function (action) {
				let opt = action.options
				let uri = 'extInput:' + opt.kind + '?port=' + opt.port
				let params = { uri: uri }
				self.sendCommand('avContent', 'setPlayContent', params)
			},
		}

		self.setActionDefinitions(actions)
	},
}
