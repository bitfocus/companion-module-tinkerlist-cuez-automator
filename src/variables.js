module.exports = {
	initVariables: function () {
		let variables = []

		variables.push({
			name: 'Automator ID',
			variableId: 'automator_id',
		})

		variables.push({
			name: 'Automator Name',
			variableId: 'automator_name',
		})

		variables.push({
			name: 'Automator Version',
			variableId: 'automator_version',
		})

		variables.push({
			name: 'Automator State',
			variableId: 'automator_state',
		})

		variables.push({
			name: 'Project ID',
			variableId: 'project_id',
		})

		variables.push({
			name: 'Project Title',
			variableId: 'project_title',
		})

		variables.push({
			name: 'Project Pairing Expired',
			variableId: 'project_pairing_expired',
		})

		variables.push({
			name: 'Episode ID',
			variableId: 'episode_id',
		})

		variables.push({
			name: 'Episode Title',
			variableId: 'episode_title',
		})

		this.setVariableDefinitions(variables)
	},
}
