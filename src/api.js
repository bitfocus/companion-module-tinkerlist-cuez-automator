const { InstanceStatus } = require('@companion-module/base')

const Client = require('node-rest-client').Client

module.exports = {
	initConnection: function () {
		let self = this

		self.updateStatus(InstanceStatus.Connecting)

		self.sendCommand('avContent', 'getCurrentExternalInputsStatus', {}, 'allinputs')

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

		self.sendCommand('system', 'getPowerStatus', {}, 'power')
		self.sendCommand('audio', 'getVolumeInformation', {}, 'volume')
		self.sendCommand('avContent', 'getPlayingContentInfo', {}, 'input')
	},

	sendCommand: function (service, method, params, request = undefined) {
		let self = this

		let cmdObj = {}
		cmdObj.method = method
		cmdObj.version = '1.0'
		cmdObj.id = 1
		if (JSON.stringify(params) == '{}') {
			cmdObj.params = []
		} else {
			cmdObj.params = [params]
		}

		if (self.config.psk !== undefined && self.config.psk !== '') {
			let args = {
				data: cmdObj,
				headers: {
					'Content-Type': 'application/json',
					'X-Auth-PSK': self.config.psk,
				},
			}

			let client = new Client()

			client
				.post(`http://${self.config.host}/sony/${service}`, args, function (data, response) {
					//do something with response
					try {
						if (response.statusCode == 200) {
							self.updateStatus(InstanceStatus.Ok)
							if (request) {
								if (data.result) {
									switch (request) {
										case 'allinputs':
											self.DATA.inputs = data.result[0]
											self.buildInputList()
											self.initFeedbacks()
											self.initPresets()
											break
										case 'power':
											self.DATA.powerState = data.result[0].status === 'active' ? true : false
											break
										case 'volume':
											self.DATA.volumeLevel = data.result[0][0].volume
											self.DATA.muteState = data.result[0][0].mute
											break
										case 'input':
											self.DATA.input = data.result[0].uri
											break
										default:
											break
									}
								} else {
									if (data.error) {
										//some error like display is probably off
									}
								}
							}

							self.checkFeedbacks()
							self.checkVariables()
						} else {
							if (response.statusCode == 403) {
								self.updateStatus(InstanceStatus.ConnectionFailure, 'Error 403, PSK may be incorrect.')
								self.log('error', 'PSK may be incorrect. Please check your PSK and try again.')
								self.stopInterval()
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
		} else {
			self.updateStatus(InstanceStatus.BadConfig, 'No PSK set, not sending.')
			if (self.config.verbose) {
				self.log('debug', 'No PSK set. Not sending command.')
			}
		}
	},

	parseDeviceResourceURI: function (uri) {
		try {
			resourceURI = new URL(uri)
			if (resourceURI.protocol == 'extinput:') {
				let params = resourceURI.searchParams
				return {
					// Seemingly not URL.host!
					kind: resourceURI.pathname,
					port: parseInt(params.get('port')),
				}
			} else {
				return undefined
			}
		} catch (e) {
			// instanceof doesn't seem to work directly
			if (e.name == 'TypeError') {
				return undefined
			} else {
				throw e
			}
		}
	},

	buildInputList: function () {
		let self = this

		self.CHOICES_INPUTS = []

		for (let i = 0; i < self.DATA.inputs.length; i++) {
			let input = self.DATA.inputs[i]
			self.CHOICES_INPUTS.push({ id: input.uri, label: input.title })
		}
	},
}
