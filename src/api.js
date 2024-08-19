const { InstanceStatus } = require('@companion-module/base')
const { WebSocket } = require('ws')

const Client = require('node-rest-client').Client

module.exports = {
	initConnection: function () {
		let self = this
	},

	initWebSocket: function () {
		this.log('debug', 'Starting ws')

		if (this.reconnect_timer) {
			clearTimeout(this.reconnect_timer)
			this.reconnect_timer = null
		}

		this.log('debug', 'Checking config...')
		const url = 'ws://' + this.config.host + ':' + this.config.port + '/ws'
		if (!url || !this.config.host) {
			this.updateStatus(InstanceStatus.BadConfig, `IP address is missing`)
			return
		} else if (!url || !this.config.port) {
			this.updateStatus(InstanceStatus.BadConfig, `Port is missing`)
			return
		}

		this.updateStatus(InstanceStatus.Connecting)
		this.log('debug', 'Connecting...')

		if (this.ws) {
			this.ws.close(1000)
			delete this.ws
		}
		this.ws = new WebSocket(url)

		this.ws.on('open', () => {
			this.updateStatus(InstanceStatus.Ok)
		})
		this.ws.on('close', (code) => {
			this.updateStatus(InstanceStatus.Disconnected, `Connection closed with code ${code}`)
			this.maybeReconnect()
		})

		this.ws.on('message', this.messageReceivedFromWebSocket.bind(this))

		this.ws.on('error', (data) => {
			this.log('error', `WebSocket error: ${data}`)
		})
	},

	handleWSWelcome: function (msg) {
		this.log('debug', 'clientid: ' + msg.data.clientid)

		// Call HTTP
		this.sendCommand('POST', 'app', 'init', '', '', { hello: 'from client', clientid: msg.data.clientid })

		//'http://10.0.0.9:7070/api/app/init' 'Content-Type: application/json'  '{"hello":"from client","clientid":"32bcef15-3ddb-4e9b-a00d-7d404aa76b0b"}'
	},

	handleWSAppInfo: function (msg) {
		this.DATA.appInfo = msg.data
		this.updateAppInfoVariables()
		this.initFeedbacks()
	},

	handleWSAppStateChanged: function (msg) {
		switch (msg.data.state) {
			case 'SELECT_RUNDOWN':
				this.DATA.episode = null
				this.DATA.items = null
				this.DATA.buttons = null
				this.DATA.keys = null
				this.DATA.macros = null
				this.DATA.timers = null
				this.buildItemList()
				this.buildDeckButtonList()
				this.buildDeckSwitchList()
				this.buildShortcutList()
				this.buildMacroList()
				this.buildTimerList()
				this.updateEpisodeVariables()
				break
			case 'OK':
				break
			default:
				this.log('info', `Unknown App State: ` + msg.data.state)
				this.log('debug', `WebSocket data: ` + JSON.stringify(msg.data))
		}
		this.DATA.appState = msg.data
		this.updateAppStateVariables()
		this.initActions()
		this.initFeedbacks()
		this.initPresets()
	},

	handleWSProjects: function (msg) {
		this.log('debug', 'Projects list: ' + msg.data.length)
		this.DATA.projects = msg.data
		this.buildProjectList()
		this.initActions()
		this.initFeedbacks()
		this.initPresets()
	},

	handleWSProjectSelected: function (msg) {
		this.log('debug', 'Selected Project: ' + msg.data.title)
		this.DATA.project = msg.data
		this.updateProjectVariables()
		this.initFeedbacks()
	},

	handleWSProjectRundownsOnair: function (msg) {
		this.log('debug', 'Rundown list: ' + msg.data.length)
		this.DATA.rundowns = msg.data
		this.buildRundownList()
		this.initActions()
		this.initFeedbacks()
		this.initPresets()
	},

	handleWSEpisode: function (msg) {
		if (msg.data != null) {
			this.log('debug', 'Episode item list: ' + msg.data.length)
		} else {
			this.log('debug', 'Episode item list - None')
		}
		this.DATA.episode = msg.data
		this.buildItemList()
		this.updateEpisodeVariables()
		this.initActions()
		this.initFeedbacks()
		this.initPresets()
	},

	handleWSConfigCuezDeckButtons: function (msg) {
		this.log('debug', 'Button list: ' + msg.data.value.length)
		this.DATA.buttons = msg.data.value
		this.buildDeckButtonList()
		this.buildDeckSwitchList()
		this.initActions()
		this.initFeedbacks()
		this.initPresets()
	},

	handleWSConfigKeys: function (msg) {
		if (msg.data.value.keys != null) {
			this.log('debug', 'Key list: ' + msg.data.value.keys.length)
			this.DATA.keys = msg.data.value.keys
		} else {
			this.log('debug', `Didn't get any keys`)
			this.DATA.keys = []
		}
		this.buildShortcutList()
		this.initActions()
		this.initFeedbacks()
		this.initPresets()
	},

	handleWSConfigMacros: function (msg) {
		if (msg.data.value.macros != null) {
			this.log('debug', 'Macro list: ' + msg.data.value.macros.length)
			this.DATA.macros = msg.data.value.macros
		} else {
			this.log('debug', `Didn't get any macros`)
			this.DATA.macros = []
		}
		this.buildMacroList()
		this.initActions()
		this.initFeedbacks()
		this.initPresets()
	},

	handleWSConfigTimers: function (msg) {
		this.log('debug', 'Timer list: ' + msg.data.value.timers.length)
		this.DATA.timers = msg.data.value.timers
		this.buildTimerList()
		this.initActions()
		this.initFeedbacks()
		this.initPresets()
	},

	messageReceivedFromWebSocket: function (data) {
		let msgValue = null
		try {
			msgValue = JSON.parse(data)
		} catch (e) {
			msgValue = data
		}
		if (msgValue.method != null) {
			this.log('debug', `WebSocket message method: ` + msgValue.method)
			switch (msgValue.method) {
				case 'welcome':
					this.log('debug', `Welcome`)
					this.handleWSWelcome(msgValue)
					break
				case 'app-info':
					this.handleWSAppInfo(msgValue)
					break
				case 'app-state-changed':
					this.handleWSAppStateChanged(msgValue)
					break
				case 'projects':
					this.handleWSProjects(msgValue)
					break
				case 'project-selected':
					this.handleWSProjectSelected(msgValue)
					break
				case 'project-rundowns-onair':
					this.handleWSProjectRundownsOnair(msgValue)
					break
				case 'episode':
					this.handleWSEpisode(msgValue)
					break
				case 'config--cuezDeckButtons--':
					this.handleWSConfigCuezDeckButtons(msgValue)
					break
				case 'config--keys--':
					this.handleWSConfigKeys(msgValue)
					break
				case 'config--macros--':
					this.handleWSConfigMacros(msgValue)
					break
				case 'config--timers--':
					this.handleWSConfigTimers(msgValue)
					break
				default:
					this.log('info', `Unknown WebSocket message method: ` + msgValue.method)
					this.log('debug', `WebSocket data: ` + data)
			}
		}
	},

	handleResponse: function (data, response, url, request) {
		let self = this

		//do something with response
		try {
			self.log('debug', 'Response: ' + JSON.stringify(response.statusCode) + ' Data: ' + JSON.stringify(data))
			if (response.statusCode == 200) {
				self.updateStatus(InstanceStatus.Ok)
				if (request) {
					switch (request) {
						case 'buttons':
							// TODO(Peter): Reject if not an array
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
						case 'items':
							self.DATA.items = data
							self.buildItemList()
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
			} else {
				self.log('debug', 'Called: ' + url)
				if (response.statusCode == 400 || response.statusCode == 500) {
					self.updateStatus(InstanceStatus.ConnectionFailure, 'Error ' + response.statusCode + '.')
					self.log('error', 'Error ' + response.statusCode)
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
	},

	sendCommand: function (verb, service, method, value = '', action = '', params = {}, request = undefined) {
		let self = this

		let cmdObj = {}
		if (JSON.stringify(params) == '{}') {
			cmdObj.params = []
		} else {
			cmdObj.params = [params]
		}

		let args = {
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

		client.on('error', function (error) {
			self.updateStatus(InstanceStatus.UnknownError, 'Failed to sending command ' + error.toString())
			self.log('error', 'Error Sending Command ' + error.toString())
		})

		switch (verb) {
			case 'GET':
				client.get(url, args, function (data, response) {
					self.handleResponse(data, response, url, request)
				})

				break
			case 'POST':
				client.post(url, args, function (data, response) {
					self.handleResponse(data, response, url, request)
				})

				break
			case 'PUT':
				client.put(url, args, function (data, response) {
					self.handleResponse(data, response, url, request)
				})

				break
			case 'DELETE':
				client.delete(url, args, function (data, response) {
					self.handleResponse(data, response, url, request)
				})

				break
			case 'PATCH':
				client.patch(url, args, function (data, response) {
					self.handleResponse(data, response, url, request)
				})

				break
			default:
				self.updateStatus(InstanceStatus.UnknownError, 'Unknown verb ' + verb + ' when sending command')
				self.log('error', 'Unknown verb ' + verb + ' when sending command')
		}
	},

	updateAppInfoVariables: function () {
		try {
			this.setVariableValues({
				automator_id: this.DATA.appInfo.automator_id,
				automator_name: this.DATA.appInfo.automator_name,
				automator_version: this.DATA.appInfo.automator_version,
			})
		} catch (error) {
			this.log('error', 'Error setting variables: ' + error)
		}
	},
	updateAppStateVariables: function () {
		try {
			this.setVariableValues({
				automator_id: this.DATA.appState.id,
				automator_name: this.DATA.appState.name,
				automator_state: this.DATA.appState.state,
			})
		} catch (error) {
			this.log('error', 'Error setting variables: ' + error)
		}
	},
	buildProjectList: function () {
		let self = this

		self.CHOICES_PROJECTS = []

		for (const project of self.DATA.projects) {
			self.CHOICES_PROJECTS.push({ id: project.id, label: project.title })
		}
	},
	updateProjectVariables: function () {
		try {
			this.setVariableValues({
				project_id: this.DATA.project.id,
				project_title: this.DATA.project.title,
				project_pairing_expired: this.DATA.project.expired,
			})
		} catch (error) {
			this.log('error', 'Error setting variables: ' + error)
		}
	},
	buildRundownList: function () {
		let self = this

		self.CHOICES_RUNDOWNS = []

		for (const rundown of self.DATA.rundowns) {
			self.CHOICES_RUNDOWNS.push({ id: rundown.id, label: rundown.title })
		}
	},
	updateEpisodeVariables: function () {
		try {
			if (this.DATA.episode != null) {
				this.setVariableValues({
					episode_id: this.DATA.episode.episode.id,
					episode_title: this.DATA.episode.episode.title,
				})
			} else {
				this.setVariableValues({
					episode_id: undefined,
					episode_title: undefined,
				})
			}
		} catch (error) {
			this.log('error', 'Error setting variables: ' + error)
		}
	},
	buildItemList: function () {
		let self = this

		self.CHOICES_ITEMS = []

		if (self.DATA.episode != null) {
			for (const partId of self.DATA.episode.episode.parts) {
				const part = self.DATA.episode.parts[partId]
				if (part.float !== undefined && part.float === false) {
					for (const itemId of part.items) {
						const item = self.DATA.episode.items[itemId]
						if (item.float !== undefined && item.float === false) {
							self.CHOICES_ITEMS.push({ id: item.id, label: part.title + ' - ' + item.title.title })
						} else {
							self.log('debug', 'Skipping item ' + item.title.title + ' of part ' + part.title + ' as its floated')
						}
					}
				} else {
					self.log('debug', 'Skipping part ' + part.title + ' as its floated')
				}
			}
		} else {
			self.log('debug', 'Episode has no items')
		}
	},
	buildDeckButtonList: function () {
		let self = this

		self.CHOICES_DECK_BUTTONS = []

		if (self.DATA.buttons != null) {
			for (const button of self.DATA.buttons) {
				if (button.type !== undefined && button.type === 'button') {
					self.CHOICES_DECK_BUTTONS.push({ id: button.id, label: button.title })
				}
			}
		} else {
			self.log('debug', 'Buttons have no items')
		}
	},
	buildDeckSwitchList: function () {
		let self = this

		self.CHOICES_DECK_SWITCHES = []

		if (self.DATA.buttons != null) {
			for (const button of self.DATA.buttons) {
				if (button.type !== undefined && button.type === 'switch') {
					self.CHOICES_DECK_SWITCHES.push({ id: button.id, label: button.title })
				}
			}
		} else {
			self.log('debug', 'Buttons have no items')
		}
	},
	buildShortcutList: function () {
		let self = this

		self.CHOICES_SHORTCUTS = []

		if (self.DATA.keys != null) {
			for (const key of self.DATA.keys) {
				// TODO(Peter): Add modifiers to label
				self.CHOICES_SHORTCUTS.push({ id: key.id, label: key.key })
			}
		} else {
			self.log('debug', 'Keys have no items')
		}
	},
	buildMacroList: function () {
		let self = this

		self.CHOICES_MACROS = []

		if (self.DATA.macros != null) {
			for (const macro of self.DATA.macros) {
				self.CHOICES_MACROS.push({ id: macro.id, label: macro.title })
			}
		} else {
			self.log('debug', 'Macros have no items')
		}
	},
	buildTimerList: function () {
		let self = this

		self.CHOICES_TIMERS = []

		if (self.DATA.timers != null) {
			for (const timer of self.DATA.timers) {
				self.CHOICES_TIMERS.push({ id: timer.id, label: timer.title })
			}
		} else {
			self.log('debug', 'Timers have no items')
		}
	},
}
