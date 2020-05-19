const api = require('./api.js')

test('parse URI', () => {
	expect(api.parseDeviceResourceURI('extInput:hdmi?port=1')).toEqual({ kind: 'hdmi', port: 1 })
	expect(api.parseDeviceResourceURI('extInput:component?port=4')).toEqual({ kind: 'component', port: 4 })
	expect(api.parseDeviceResourceURI('foo:component?port=4')).toEqual(undefined)
	expect(api.parseDeviceResourceURI('')).toEqual(undefined)
	expect(api.parseDeviceResourceURI(undefined)).toEqual(undefined)
})
