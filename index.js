// TinkerList-Cuez-Automator

const { InstanceBase, InstanceStatus, runEntrypoint } = require('@companion-module/base')
const UpgradeScripts = require('./src/upgrades')

const config = require('./src/config')
const actions = require('./src/actions')
const feedbacks = require('./src/feedbacks')
const variables = require('./src/variables')
const presets = require('./src/presets')

const api = require('./src/api')

class cuezAutomatorInstance extends InstanceBase {
	constructor(internal) {
		super(internal)

		// Assign the methods from the listed files to this class
		Object.assign(this, {
			...config,
			...actions,
			...feedbacks,
			...variables,
			...presets,
			...api,
		})

		this.DATA = {
			appInfo: [],
			appState: [],
			project: [],
			rundowns: [],
			episode: [],
			items: [],
			buttons: [],
			keys: [],
			macros: [],
			timers: [],
		}

		this.CHOICES_PROJECTS = []
		this.CHOICES_RUNDOWNS = []
		this.CHOICES_ITEMS = []
		this.CHOICES_DECK_BUTTONS = []
		this.CHOICES_DECK_SWITCHES = []
		this.CHOICES_SHORTCUTS = []
		this.CHOICES_MACROS = []
		this.CHOICES_TIMERS = []
	}

	async destroy() {
		let self = this
	}

	async init(config) {
		this.configUpdated(config)
	}

	async configUpdated(config) {
		this.config = config

		if (this.config.verbose) {
			this.log('info', 'Verbose mode enabled. Log entries will contain detailed information.')
		}

		this.initConnection()
		this.initWebSocket()

		this.initActions()
		this.initFeedbacks()
		this.initVariables()
		this.initPresets()

		this.checkFeedbacks()
	}

	maybeReconnect() {
		if (this.isInitialized) {
			if (this.reconnect_timer) {
				clearTimeout(this.reconnect_timer)
			}
			this.reconnect_timer = setTimeout(() => {
				this.initWebSocket()
			}, 5000)
		}
	}
}

runEntrypoint(cuezAutomatorInstance, UpgradeScripts)
