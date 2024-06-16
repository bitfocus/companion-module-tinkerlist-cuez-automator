const { InstanceStatus } = require('@companion-module/base')

const Client = require('node-rest-client').Client

module.exports = {
	initConnection: function () {
		let self = this

		self.updateStatus(InstanceStatus.Connecting)

		self.sendCommand('app', 'webconnection', '', '', {}, 'webconnection')

		self.getInformation()
		self.setupInterval()
	},

	setupInterval: function () {
		let self = this

		self.stopInterval()

		if (self.config.polling !== undefined && self.config.polling && self.config.interval > 0) {
			self.INTERVAL = setInterval(self.getInformation.bind(self), self.config.interval)
			self.log('info', 'Starting Update Interval: Every ' + self.config.interval + 'ms')
		}
	},

	stopInterval: function () {
		let self = this

		if (self.INTERVAL !== null) {
			self.log('info', 'Stopping Update Interval.')
			clearInterval(self.INTERVAL)
			self.INTERVAL = null
		}
	},

	getInformation: async function () {
		let self = this

		self.sendCommand('trigger', 'button', '', '', {}, 'buttons')
		self.sendCommand('trigger', 'shortcut', '', '', {}, 'shortcuts')
		self.sendCommand('macro', '', '', '', {}, 'macros')
		self.sendCommand('timer', '', '', '', {}, 'timers')
	},

	sendCommand: function (service, method, value = '', action = '', params = {}, request = undefined) {
		let self = this

		let cmdObj = {}
		if (JSON.stringify(params) == '{}') {
			cmdObj.params = []
		} else {
			cmdObj.params = [params]
		}

		let args = {
			//data: cmdObj,
			headers: {
				'Content-Type': 'application/json',
			},
		}

		let client = new Client()

		let url = `http://${self.config.host}:${self.config.port}/api/${service}/${method}`
		if (value !== undefined && value !== '') {
			url += `/${value}`
			if (action !== undefined && action !== '') {
				url += `/${action}`
			}
		}

		client
			.get(url, args, function (data, response) {
				//do something with response
				try {
					self.log('debug', 'Response: ' + JSON.stringify(response.statusCode) + ' Data: ' + JSON.stringify(data))
					if (response.statusCode == 200) {
						self.updateStatus(InstanceStatus.Ok)
						if (request) {
							switch (request) {
								case 'buttons':
									self.DATA.buttons = data
									self.buildDeckButtonList()
									self.buildDeckSwitchList()
									self.initActions()
									self.initFeedbacks()
									self.initPresets()
									break
								case 'shortcuts':
									self.DATA.shortcuts = data
									self.buildShortcutList()
									self.initActions()
									self.initFeedbacks()
									self.initPresets()
									break
								case 'macros':
									self.DATA.macros = data
									self.buildMacroList()
									self.initActions()
									self.initFeedbacks()
									self.initPresets()
									break
								case 'timers':
									self.DATA.timers = data
									self.buildTimerList()
									self.initActions()
									self.initFeedbacks()
									self.initPresets()
									break
								default:
									self.log('warn', 'Unknown request: ' + request)
									break
							}
						}

						self.checkFeedbacks()
						self.checkVariables()
					} else {
						self.log('debug', 'Called: ' + url)
						if (response.statusCode == 400 || response.statusCode == 500) {
							self.updateStatus(InstanceStatus.ConnectionFailure, 'Error ' + response.statusCode + '.')
							self.log('error', 'Error ' + response.statusCode)
							self.stopInterval()
						} else {
							self.log('warn', 'Unknown status code: ' + response.statusCode)
						}
					}
				} catch (error) {
					self.updateStatus(InstanceStatus.UnknownError, 'Failed to process response: ' + error)
					self.log('error', 'Error processing response: ' + error)
					console.log(error)
					console.log(data)
				}
			})
			.on('error', function (error) {
				self.updateStatus(InstanceStatus.UnknownError, 'Failed to sending command ' + error.toString())
				self.log('error', 'Error Sending Command ' + error.toString())
			})
	},

	buildDeckButtonList: function () {
		let self = this

		self.CHOICES_DECK_BUTTONS = []

		for (const button of self.DATA.buttons) {
			if (button.type !== undefined && button.type === 'button') {
				self.CHOICES_DECK_BUTTONS.push({ id: button.id, label: button.title })
			}
		}
	},
	buildDeckSwitchList: function () {
		let self = this

		self.CHOICES_DECK_SWITCHES = []

		for (const button of self.DATA.buttons) {
			if (button.type !== undefined && button.type === 'switch') {
				self.CHOICES_DECK_SWITCHES.push({ id: button.id, label: button.title })
			}
		}
	},
	buildShortcutList: function () {
		let self = this

		self.CHOICES_SHORTCUTS = []

		for (const shortcut of self.DATA.shortcuts) {
			self.CHOICES_SHORTCUTS.push({ id: shortcut.id, label: shortcut.key })
		}
	},
	buildMacroList: function () {
		let self = this

		self.CHOICES_MACROS = []

		for (const macro of self.DATA.macros) {
			self.CHOICES_MACROS.push({ id: macro.id, label: macro.title })
		}
	},
	buildTimerList: function () {
		let self = this

		self.CHOICES_TIMERS = []

		for (const timer of self.DATA.timers) {
			self.CHOICES_TIMERS.push({ id: timer.id, label: timer.title })
		}
	},
}
