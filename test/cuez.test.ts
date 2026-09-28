import assert from 'node:assert/strict'

import {
	buildUrl,
	describeError,
	hint,
	origin,
	parseCommand,
	toOptions,
	toVariables,
	withVariables,
} from '../src/cuez.ts'

// Bare paths default to GET.
assert.deepEqual(parseCommand('/api/trigger/next'), { method: 'GET', path: '/api/trigger/next' })
assert.deepEqual(parseCommand('  api/trigger/next  '), { method: 'GET', path: '/api/trigger/next' })

// An explicit method is honoured, case-insensitively.
assert.deepEqual(parseCommand('DELETE /api/episode'), { method: 'DELETE', path: '/api/episode' })
assert.deepEqual(parseCommand('patch /api/episode/abc/select'), { method: 'PATCH', path: '/api/episode/abc/select' })

// Bad input is rejected rather than silently sent somewhere unexpected.
assert.throws(() => parseCommand(''), /No command configured/)
assert.throws(() => parseCommand('POST'), /no path/)

// URLs are assembled from the global host/port.
assert.equal(buildUrl('192.168.1.50', '7070', '/api/trigger/next'), 'http://192.168.1.50:7070/api/trigger/next')
assert.equal(buildUrl(' localhost ', 7070, 'api/timer/stop'), 'http://localhost:7070/api/timer/stop')
// Query strings survive (macros take variables that way).
assert.equal(buildUrl('localhost', '7070', '/api/macro/hi?a=b'), 'http://localhost:7070/api/macro/hi?a=b')
// A pasted origin is tolerated instead of being nested into a broken URL.
assert.equal(buildUrl('http://10.0.0.2:8080', '7070', '/api/trigger/next'), 'http://10.0.0.2:8080/api/trigger/next')
// A missing host fails loudly instead of hitting the wrong machine.
assert.throws(() => buildUrl('', '7070', '/api/trigger/next'), /No Automator host/)

// The list endpoints are not schema'd in the API docs, so toOptions accepts the shapes they can
// plausibly answer with rather than one hard-coded layout.
assert.deepEqual(toOptions([{ id: 'm1', name: 'Roll VT' }]), [{ label: 'Roll VT', value: 'm1' }])
// Wrapped lists.
assert.deepEqual(toOptions({ macros: [{ uuid: 'm2', title: 'Lower third' }] }), [{ label: 'Lower third', value: 'm2' }])
// An id-keyed object of objects.
assert.deepEqual(toOptions({ b1: { label: 'CAM 1' } }), [{ label: 'CAM 1', value: 'b1' }])
// An id -> name map.
assert.deepEqual(toOptions({ t1: 'Show clock' }), [{ label: 'Show clock', value: 't1' }])
// A plain array of names (macros can be fired by name).
assert.deepEqual(toOptions(['my-macro']), [{ label: 'my-macro', value: 'my-macro' }])
// No name anywhere: the ID is still selectable rather than showing a blank row.
assert.deepEqual(toOptions([{ id: 'x' }]), [{ label: 'x', value: 'x' }])
// A one-entry id-keyed object is a list, not a wrapper.
assert.deepEqual(toOptions({ b1: { name: 'CAM 1' } }), [{ label: 'CAM 1', value: 'b1' }])
// Keyboard shortcuts carry no name; they read as the key combination.
assert.deepEqual(toOptions([{ id: 's1', key: 'Space', alt: false, control: true, shift: true }]), [
	{ label: 'Control+Shift+Space', value: 's1' },
])
// Entries with nothing to address are dropped, and a non-list never throws.
assert.deepEqual(toOptions([{ colour: 'red' }, null]), [])
assert.deepEqual(toOptions('nope'), [])

// A macro's variables are read off the same list response, by ID or by name.
const macros = [
	{
		id: 'm1',
		name: 'Roll VT',
		variables: [
			{ id: 'v1', name: 'Clip', required: true },
			{ id: 'v2', name: 'Loop', type: 'boolean', default: false },
			{ id: 'v3', name: 'Speed', type: 'enum', options: [{ key: 'slow', value: 'Slow motion' }] },
		],
	},
]
assert.deepEqual(toVariables(macros, 'm1'), [
	{ key: 'v1', label: 'Clip', type: 'string', required: true, default: undefined },
	{ key: 'v2', label: 'Loop', type: 'boolean', required: false, default: 'false' },
	{
		key: 'v3',
		label: 'Speed',
		type: 'enum',
		required: false,
		default: undefined,
		options: [{ label: 'Slow motion', value: 'slow' }],
	},
])
assert.deepEqual(toVariables(macros, 'Roll VT').length, 3)
// A macro without variables, and an unknown macro, simply have no fields.
assert.deepEqual(toVariables([{ id: 'm2', name: 'Sting' }], 'm2'), [])
assert.deepEqual(toVariables(macros, 'nope'), [])
// Variables keyed by ID instead of listed.
assert.deepEqual(toVariables([{ id: 'm3', variables: { v9: { name: 'Text' } } }], 'm3'), [
	{ key: 'v9', label: 'Text', type: 'string', required: false, default: undefined },
])

// Values ride on the query string; empty ones are dropped so the variable's default applies.
assert.equal(withVariables('/api/macro/m1', { v1: 'clip 4', v2: false }), '/api/macro/m1?v1=clip+4&v2=false')
assert.equal(withVariables('/api/macro/m1', { v1: '', v2: undefined }), '/api/macro/m1')
assert.equal(withVariables('/api/macro/m1', undefined), '/api/macro/m1')
// An existing query string is extended, not replaced.
assert.equal(withVariables('/api/macro/m1?a=b', { v1: 'c' }), '/api/macro/m1?a=b&v1=c')

console.log('ok')

// --- Live display data -------------------------------------------------------------------------
// Shapes below are real responses captured from a running Automator (7070).

import { blockTitle, currentAndNext, toBlocks, toFieldLabels, toFields } from '../src/cuez.ts'

// A block names itself with `title` - a plain string on older Automators, a { title, subtitle }
// object on newer ones - or with the field it flags `asTitle`.
assert.equal(blockTitle({ title: 'asdf', type: 'CLIP' }), 'asdf')
assert.equal(blockTitle({ title: { title: 'asdf', subtitle: '' }, type: 'default_clip' }), 'asdf')
assert.equal(blockTitle({ title: '', type: 'CLIP', fields: [{ asTitle: true, value: 'Opening' }] }), 'Opening')
// An /api/trigger/current payload names it `blockTitle`.
assert.equal(blockTitle({ blockTitle: '1', blockType: 'default_clip' }), '1')
// Untitled reads as Cuez shows it, never as the internal type slug.
assert.equal(blockTitle({ title: { title: '', subtitle: '' }, type: 'default_graphic' }), 'Untitled')
assert.equal(blockTitle({ title: '', type: 'GRAPHIC', fields: [{ asTitle: true, value: null }] }), 'Untitled')
assert.equal(blockTitle({}), 'Untitled')

// blockcontent is an object keyed by block ID, in rundown order.
const CONTENT = {
	a: { id: 'a', type: 'CLIP', title: '', fields: [{ label: 'Title', asTitle: true, value: 'Opening' }] },
	b: { id: 'b', type: 'default_clip', title: { title: 'asdf', subtitle: '' } },
	c: { id: 'c', type: 'default_graphic', title: { title: '', subtitle: '' } },
}
assert.deepEqual(
	toBlocks(CONTENT).map(({ id, title }) => ({ id, title })),
	[
		{ id: 'a', title: 'Opening' },
		{ id: 'b', title: 'asdf' },
		{ id: 'c', title: 'Untitled' },
	],
)

// Fields are keyed by label, since ids differ per block type (default_clip_title vs
// default_graphic_title) and a key must survive a different kind of block being cued.
const CLIP = {
	fields: [
		{ id: 'default_clip_title', label: 'Title', asTitle: true, value: 'THIS BLOCK IS ON AIR' },
		// A media field's value is an object; only its readable title is kept, never the signed URL.
		{ id: 'default_clip_media', label: 'Media', value: { title: 'clip.mp4', highres: 'https://…signed…' } },
		{ id: 'default_clip_sound', label: 'Sound', value: null },
	],
}
assert.deepEqual(toFields(CLIP), { Title: 'THIS BLOCK IS ON AIR', Media: 'clip.mp4', Sound: '' })
// A repeated label keeps the first, which is the one Cuez shows first.
assert.deepEqual(
	toFields({
		fields: [
			{ label: 'Box', value: 'one' },
			{ label: 'Box', value: 'two' },
		],
	}),
	{ Box: 'one' },
)
assert.deepEqual(toFields({}), {})

// The dropdown lists each label once, in the order first seen across the rundown.
assert.deepEqual(toFieldLabels({ x: CLIP, y: { fields: [{ label: 'Title' }, { label: 'Position', value: 'A' }] } }), [
	'Title',
	'Media',
	'Sound',
	'Position',
])

// Nothing cued -> neither current nor next, rather than defaulting to the top of the rundown.
assert.deepEqual(currentAndNext(undefined, CONTENT), {})
assert.deepEqual(currentAndNext('', CONTENT), {})

// Cued -> that block, and the one after it in rundown order.
{
	const { current, next } = currentAndNext('a', CONTENT)
	assert.deepEqual([current?.title, next?.title], ['Opening', 'asdf'])
}
// The last block has no next.
{
	const { current, next } = currentAndNext('c', CONTENT)
	assert.deepEqual([current?.title, next], ['Untitled', undefined])
}
// /api/trigger/current may answer with the block itself rather than its ID.
assert.equal(currentAndNext({ id: 'b', title: 'asdf' }, CONTENT).current?.title, 'asdf')
// Cued but missing from the content list: still shown, using the title it arrived with.
assert.equal(currentAndNext({ id: 'z', title: 'Late add' }, CONTENT).current?.title, 'Late add')

console.log('ok')

// Everything customers type into the IP field lands on the same origin.
assert.equal(origin('192.168.1.50', '7070'), 'http://192.168.1.50:7070')
assert.equal(origin(' 192.168.1.50:7070 ', ' 7070 '), 'http://192.168.1.50:7070')
assert.equal(origin('192.168.1.50:8080', '7070'), 'http://192.168.1.50:8080')
assert.equal(origin('http://192.168.1.50', '7070'), 'http://192.168.1.50:7070')
assert.equal(origin('http://192.168.1.50:7070/', '7070'), 'http://192.168.1.50:7070')
assert.equal(origin('http://192.168.1.50:80', '7070'), 'http://192.168.1.50')
assert.throws(() => origin('192.168.1.50', '70 70'), /not a port/)
assert.throws(() => origin('192.168.1.50', ''), /not a port/)
assert.throws(() => origin('192.168.1.50', '99999'), /not a port/)
assert.throws(() => origin('192.168.1.50 7070', '7070'), /not an IP/)

// fetch's reason is dug out of its causes, and a timeout reads as one.
const refused = new TypeError('fetch failed', {
	cause: Object.assign(new Error('connect ECONNREFUSED 1.2.3.4:7070'), { code: 'ECONNREFUSED' }),
})
assert.deepEqual(describeError(new Error('GET x failed', { cause: refused })), {
	code: 'ECONNREFUSED',
	message: 'connect ECONNREFUSED 1.2.3.4:7070',
})
assert.equal(describeError(Object.assign(new Error('aborted'), { name: 'TimeoutError' })).code, 'ETIMEDOUT')
assert.match(hint('EHOSTUNREACH', 'darwin'), /Local Network/)
assert.equal(hint('whatever'), '')
