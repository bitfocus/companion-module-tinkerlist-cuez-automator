module.exports = {
	initVariables: function () {
		let self = this

		let variables = []

		variables.push({ variableId: 'powerState', name: 'Power State' })
		variables.push({ variableId: 'muteState', name: 'Mute State' })
		variables.push({ variableId: 'volumeLevel', name: 'Current Volume Level' })
		variables.push({ variableId: 'input', name: 'Current Input' })

		self.setVariableDefinitions(variables)
	},

	checkVariables: function () {
		let self = this

		try {
			self.setVariableValues({
				powerState: self.DATA.powerState ? 'On' : 'Off',
				muteState: self.DATA.muteState ? 'Muted' : 'Unmuted',
				volumeLevel: self.DATA.volumeLevel,
				input: self.DATA.input,
			})
		} catch (error) {
			self.log('error', 'Error setting variables: ' + error)
		}
	},
}
