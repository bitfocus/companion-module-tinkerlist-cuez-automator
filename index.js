// Sony-Bravia

const { InstanceBase, InstanceStatus, runEntrypoint } = require('@companion-module/base')
const UpgradeScripts = require('./src/upgrades')

const config = require('./src/config')
const actions = require('./src/actions')
const feedbacks = require('./src/feedbacks')
const variables = require('./src/variables')
const presets = require('./src/presets')

const api = require('./src/api')

class braviaInstance extends InstanceBase {
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

		this.INTERVAL = null //used to poll for updates

		this.DATA = {
			powerState: false,
			volumeLevel: 0,
			muteState: false,
			input: '',
			inputs: [],
		}

		this.CHOICES_INPUTS = [
			{ id: 'extInput:component?port=1', label: 'Component 1' },
			{ id: 'extInput:component?port=2', label: 'Component 2' },
			{ id: 'extInput:hdmi?port=1', label: 'HDMI 1' },
			{ id: 'extInput:hdmi?port=2', label: 'HDMI 2' },
		]
	}

	async destroy() {
		let self = this

		if (self.INTERVAL) {
			clearInterval(self.INTERVAL)
			self.INTERVAL = null
		}
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

		this.initActions()
		this.initFeedbacks()
		this.initVariables()
		this.initPresets()

		this.checkFeedbacks()
		this.checkVariables()
	}
}

runEntrypoint(braviaInstance, UpgradeScripts)
