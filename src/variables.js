module.exports = {
	initVariables: function () {
		let self = this

		let variables = []

		self.setVariableDefinitions(variables)
	},

	checkVariables: function () {
		let self = this

		try {
			self.setVariableValues({
			})
		} catch (error) {
			self.log('error', 'Error setting variables: ' + error)
		}
	},
}
