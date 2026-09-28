/**
 * What Companion shows for the Automator: actions for every command of the control API
 * (https://download.cuez.app/automator/docs) that does something when pressed, a live block
 * feedback, variables and presets.
 *
 * Action and option ids are the 1.x module's wherever it had the action, so buttons built with 1.x
 * keep working without an upgrade script.
 *
 * Read-only endpoints (get rundown, list macros, button states, ...) are not actions: the module
 * calls them itself to fill the dropdowns. Endpoints needing a JSON body (PUT /api/projects/<id>,
 * POST /api/episode/block/<id>/column, the POST macro variants) are out too; macro variables go on
 * the query string instead.
 */

import {
	combineRgb,
	type CompanionActionDefinitions,
	type CompanionActionEvent,
	type CompanionFeedbackDefinitions,
	type CompanionPresetDefinitions,
	type CompanionPresetSection,
	type CompanionSimplePresetDefinition,
	type CompanionVariableDefinitions,
	type SomeCompanionActionInputField,
} from '@companion-module/base'

import { TITLE_FIELD, withVariables } from './cuez.js'
import type CuezAutomator from './main.js'
import type { Choice, Schema } from './main.js'

const WHITE = combineRgb(255, 255, 255)
const BLACK = combineRgb(0, 0, 0)
const GREY = combineRgb(156, 163, 175)
const BG = combineRgb(26, 26, 26)
const MAGENTA = combineRgb(255, 0, 255)
const CYAN = combineRgb(34, 211, 238)
/** Cuez magenta / cyan at 28% over the dark background: lit, but the text stays readable. */
const MAGENTA_WASH = combineRgb(90, 19, 90)
const CYAN_WASH = combineRgb(28, 78, 85)

/** Cuez's deck button colours. Anything unrecognised falls back to grey rather than vanishing. */
const CUEZ_COLORS: Record<string, [number, number, number]> = {
	lime: [163, 230, 53],
	cyan: [34, 211, 238],
	orange: [251, 146, 60],
	yellow: [250, 204, 21],
	red: [239, 68, 68],
	green: [34, 197, 94],
	blue: [59, 130, 246],
	purple: [168, 85, 247],
	magenta: [255, 0, 255],
	pink: [236, 72, 153],
	white: [255, 255, 255],
	grey: [156, 163, 175],
	gray: [156, 163, 175],
}

/** A deck button's own colour, with black or white text, whichever reads on it. */
function cuezStyle(color?: string): { bgcolor: number; color: number } {
	const [r, g, b] = CUEZ_COLORS[color ?? ''] ?? CUEZ_COLORS.grey
	return { bgcolor: combineRgb(r, g, b), color: 0.299 * r + 0.587 * g + 0.114 * b > 150 ? BLACK : WHITE }
}

const text = (id: string, label: string, tooltip?: string): SomeCompanionActionInputField => ({
	type: 'textinput',
	id,
	label,
	tooltip,
	useVariables: true,
})

/** A dropdown filled from the Automator; custom values stay allowed for an ID pasted by hand. */
const list = (id: string, label: string, choices: Choice[]): SomeCompanionActionInputField => ({
	type: 'dropdown',
	id,
	label,
	choices: choices.map(({ id, label }) => ({ id, label })),
	default: choices[0]?.id ?? '',
	allowCustom: true,
	minChoicesForSearch: 8,
	tooltip: 'Read from the Automator. Run "Refresh lists" if something is missing, or paste an ID.',
})

const onOff = (id: string, label: string): SomeCompanionActionInputField => ({
	type: 'dropdown',
	id,
	label,
	default: 'on',
	choices: [
		{ id: 'on', label: 'ON' },
		{ id: 'off', label: 'OFF' },
	],
})

const value = (event: CompanionActionEvent, id: string): string => {
	const option = event.options[id]
	return typeof option === 'string' || typeof option === 'number' ? String(option).trim() : ''
}

export function actions(self: CuezAutomator): CompanionActionDefinitions {
	const simple = (name: string, description: string, path: string) => ({
		name,
		description,
		options: [],
		callback: async () => self.run(path),
	})

	/** Actions addressing one thing by id or index: an empty value fails before anything is sent. */
	const withParam =
		(id: string, build: (param: string, event: CompanionActionEvent) => string) =>
		async (event: CompanionActionEvent) => {
			const param = value(event, id)
			if (!param) {
				self.log('warn', `${event.actionId} needs a value for ${id}`)
				return
			}
			return self.run(build(param, event))
		}

	const deckSwitch = (name: string, suffix: string) => ({
		name,
		options: [list('switch', 'Switch', self.lists.buttons)],
		callback: withParam('switch', (id) => `/api/trigger/button/${id}/${suffix}`),
	})

	const timer = (name: string, verb: string) => ({
		name,
		options: [list('timer', 'Timer', self.lists.timers)],
		callback: withParam('timer', (id) => `/api/timer/${verb}/${id}`),
	})

	return {
		next: simple('Rundown: Next', 'Take the next step or block, as the Next key in Cuez.', '/api/trigger/next'),
		previous: simple('Rundown: Previous', 'Go back one step or block.', '/api/trigger/previous'),
		next_trigger: simple('Rundown: Next trigger', 'Skip to the next trigger.', '/api/trigger/nextTrigger'),
		previous_trigger: simple(
			'Rundown: Previous trigger',
			'Back to the previous trigger.',
			'/api/trigger/previousTrigger',
		),
		first_trigger: simple('Rundown: First trigger', 'Back to the top of the rundown.', '/api/trigger/firstTrigger'),
		trigger_block: {
			name: 'Rundown: Trigger block',
			description: 'Pick from the loaded rundown, or use Learn to take the block cued now.',
			options: [list('block', 'Block', self.lists.blocks)],
			callback: withParam('block', (id) => `/api/trigger/block/${id}`),
			learn: () => (self.snapshot.current ? { block: self.snapshot.current.id } : undefined),
		},
		trigger_first_block: {
			name: 'Rundown: Trigger first block',
			options: [],
			callback: async () => {
				const first = self.lists.blocks[0]
				if (first) return self.run(`/api/trigger/block/${first.id}`)
				self.log('warn', 'No rundown loaded, so there is no first block')
			},
		},
		step: {
			name: 'Rundown: Step by index',
			options: [text('stepIndex', 'Step index', 'Starts at 0')],
			callback: withParam('stepIndex', (index) => `/api/trigger/step/${index}`),
		},
		trigger_shortcut: {
			name: 'Keyboard shortcut',
			description: 'Fires an Automator keyboard shortcut, as if the keys were pressed.',
			options: [list('shortcut', 'Shortcut', self.lists.shortcuts)],
			callback: withParam('shortcut', (id) => `/api/trigger/shortcut/${id}`),
		},
		trigger_deck_button: {
			name: 'Deck button: Press',
			options: [list('button', 'Button', self.lists.buttons)],
			callback: withParam('button', (id) => `/api/trigger/button/${id}`),
		},
		trigger_deck_switch_click: deckSwitch('Deck switch: Toggle', 'click'),
		trigger_deck_switch_on: deckSwitch('Deck switch: ON', 'on'),
		trigger_deck_switch_off: deckSwitch('Deck switch: OFF', 'off'),
		fire_macro: {
			name: 'Macro: Fire',
			description: "The dropdown names each macro's variables in brackets.",
			options: [
				list('macro', 'Macro', self.lists.macros),
				text(
					'variables',
					'Variables',
					'Optional. Variable names or IDs as a query string, e.g. Title=hello&delay in ms=500. Left out = the macro default.',
				),
			],
			callback: withParam('macro', (macro, event) =>
				withVariables(`/api/macro/${macro}`, Object.fromEntries(new URLSearchParams(value(event, 'variables')))),
			),
		},
		start_timer: timer('Timer: Start', 'start'),
		stop_timer: timer('Timer: Stop', 'stop'),
		stop_all_timers: simple('Timer: Stop all', 'Stops every running timer.', '/api/timer/stop'),
		prompter_start: simple('Prompter: To start', 'Scrolls the prompter back to the top.', '/api/prompter/start'),
		prompter_goto: {
			name: 'Prompter: Go to trigger',
			options: [text('triggerId', 'Trigger ID', 'From /api/trigger/blockcontent, or $(cuez:current_id)')],
			callback: withParam('triggerId', (id) => `/api/prompter/goto/${id}`),
		},
		prompter_black: {
			name: 'Prompter: Black',
			options: [onOff('state', 'Black')],
			callback: withParam('state', (state) => `/api/prompter/black/${state}`),
		},
		select_episode: {
			name: 'Episode: Load',
			options: [list('episode', 'Episode', self.lists.episodes)],
			callback: withParam('episode', (id) => `PATCH /api/episode/${id}/select`),
		},
		unload_episode: simple('Episode: Unload', 'Closes the loaded episode.', 'DELETE /api/episode'),
		select_project: {
			name: 'Project: Select',
			options: [list('project', 'Project', self.lists.projects)],
			callback: withParam('project', (id) => `PATCH /api/project/${id}/select`),
		},
		custom: {
			name: 'Custom request',
			description: 'Any path from the Automator API docs. Prefix PATCH, POST, PUT or DELETE for non-GET.',
			options: [text('path', 'Path', 'e.g. /api/trigger/button/<id>/click or PATCH /api/episode/<id>/select')],
			callback: withParam('path', (path) => path),
		},
		web_connection: simple(
			'App: Check web connection',
			'Asks the Automator to check its link to Cuez.',
			'/api/app/webconnection',
		),
		refresh_lists: {
			name: 'App: Refresh lists',
			description:
				'Re-reads macros, deck buttons, shortcuts, timers, episodes and projects. Also happens on its own when the episode or project changes.',
			options: [],
			callback: async () => self.loadLists(),
		},
	}
}

export function feedbacks(self: CuezAutomator): CompanionFeedbackDefinitions {
	return {
		block: {
			type: 'advanced',
			name: 'Current / Next block',
			description:
				'Shows the block cued now, or the one after it. A dash means nothing is cued; NO LINK means the Automator is unreachable.',
			options: [
				{
					type: 'dropdown',
					id: 'which',
					label: 'Show',
					default: 'current',
					choices: [
						{ id: 'current', label: 'Current block' },
						{ id: 'next', label: 'Next block' },
					],
				},
				{
					// Labels, not field ids: ids are per block type, labels are shared across types.
					type: 'dropdown',
					id: 'field',
					label: 'Field',
					default: TITLE_FIELD,
					allowCustom: true,
					tooltip: 'Fields of the loaded rundown. Type a label if the one you need is not listed.',
					choices: [
						{ id: TITLE_FIELD, label: 'Block title' },
						...self.fieldLabels.map((label) => ({ id: label, label })),
					],
				},
				{ type: 'checkbox', id: 'label', label: 'Show CURRENT / NEXT above it', default: true },
			],
			callback: (feedback) => {
				// A dark button must never be mistaken for a calm one.
				if (!self.snapshot.online) return { text: 'NO LINK', color: GREY, bgcolor: BG }

				const next = feedback.options.which === 'next'
				const block = next ? self.snapshot.next : self.snapshot.current
				const field = typeof feedback.options.field === 'string' ? feedback.options.field : TITLE_FIELD
				// An em dash for "nothing cued"; a blank for "this block has that field, but it is empty",
				// which is a different thing and must not read as the rundown having stopped.
				const shown = block === undefined ? '—' : field !== TITLE_FIELD ? (block.fields[field] ?? '') : block.title
				const heading = feedback.options.label === false ? '' : `${next ? 'NEXT' : 'CURRENT'}\n`

				return {
					text: `${heading}${shown}`,
					color: block ? WHITE : next ? CYAN : MAGENTA,
					bgcolor: block ? (next ? CYAN_WASH : MAGENTA_WASH) : BG,
				}
			},
		},
		connected: {
			type: 'boolean',
			name: 'Automator connected',
			description: 'True while the Automator answers. Invert it to grey a button out when the link drops.',
			defaultStyle: { bgcolor: combineRgb(0, 120, 0), color: WHITE },
			showInvert: true,
			options: [],
			callback: () => self.snapshot.online,
		},
	}
}

export const variables: CompanionVariableDefinitions = {
	connected: { name: 'Automator reachable (true/false)' },
	automator_id: { name: 'Automator ID' },
	automator_name: { name: 'Automator name' },
	automator_version: { name: 'Automator version' },
	automator_state: { name: 'Automator state' },
	project_id: { name: 'Project ID' },
	project_title: { name: 'Project title' },
	project_pairing_expired: { name: 'Project pairing expired (true/false)' },
	episode_id: { name: 'Episode ID' },
	episode_title: { name: 'Episode title' },
	current_title: { name: 'Cued block: title' },
	current_id: { name: 'Cued block: ID' },
	current_part: { name: 'Cued block: part title' },
	current_item: { name: 'Cued block: item title' },
	next_title: { name: 'Next block: title' },
	next_id: { name: 'Next block: ID' },
}

type Preset = CompanionSimplePresetDefinition<Schema>

/** Greys a preset out while the Automator is unreachable, so a dead button does not look armed. */
const OFFLINE = { feedbackId: 'connected', options: {}, isInverted: true, style: { color: GREY, bgcolor: BG } }

function press(
	name: string,
	label: string,
	actionId: string,
	options: Record<string, string> = {},
	style: { bgcolor: number; color: number } = { bgcolor: BG, color: WHITE },
): Preset {
	return {
		type: 'simple',
		name,
		style: { text: label, size: 'auto', ...style, show_topbar: false },
		steps: [{ down: [{ actionId, options }], up: [] }],
		feedbacks: [OFFLINE],
	}
}

function live(which: 'current' | 'next'): Preset {
	return {
		type: 'simple',
		name: which === 'next' ? 'Next block' : 'Current block',
		style: { text: '', size: 'auto', color: WHITE, bgcolor: BG, show_topbar: false },
		steps: [],
		feedbacks: [{ feedbackId: 'block', options: { which, field: TITLE_FIELD, label: true } }],
	}
}

/**
 * Presets, rebuilt whenever the lists load: fixed ones for the rundown, prompter and status, and
 * one per macro, deck button, timer, episode and project the Automator has.
 */
export function presets(self: CuezAutomator): {
	structure: CompanionPresetSection<Schema>[]
	definitions: CompanionPresetDefinitions<Schema>
} {
	const definitions: Record<string, Preset> = {
		next: press('Next', 'NEXT ▶', 'next', {}, { bgcolor: MAGENTA_WASH, color: WHITE }),
		previous: press('Previous', '◀ PREV', 'previous'),
		next_trigger: press('Next trigger', 'NEXT\nTRIGGER', 'next_trigger'),
		previous_trigger: press('Previous trigger', 'PREV\nTRIGGER', 'previous_trigger'),
		first_trigger: press('First trigger', 'FIRST\nTRIGGER', 'first_trigger'),
		current_block: live('current'),
		next_block: live('next'),
		prompter_start: press('Prompter to start', 'PROMPTER\nTO START', 'prompter_start'),
		prompter_black_on: press('Prompter black ON', 'PROMPTER\nBLACK', 'prompter_black', { state: 'on' }),
		prompter_black_off: press('Prompter black OFF', 'PROMPTER\nUNBLACK', 'prompter_black', { state: 'off' }),
		stop_all_timers: press('Stop all timers', 'STOP ALL\nTIMERS', 'stop_all_timers'),
		unload_episode: press('Unload episode', 'UNLOAD\nEPISODE', 'unload_episode'),
		status: {
			type: 'simple',
			name: 'Automator status (press to refresh lists)',
			style: {
				text: `$(${self.label}:automator_name)\n$(${self.label}:episode_title)`,
				size: '7',
				color: WHITE,
				bgcolor: BG,
				show_topbar: false,
			},
			steps: [{ down: [{ actionId: 'refresh_lists', options: {} }], up: [] }],
			feedbacks: [
				{ feedbackId: 'connected', options: {}, style: { bgcolor: combineRgb(0, 90, 0) } },
				{
					feedbackId: 'connected',
					options: {},
					isInverted: true,
					style: { bgcolor: combineRgb(120, 0, 0), text: 'NO LINK' },
				},
			],
		},
	}

	/** One preset per entry of a list, keyed by its ID so a renamed entry keeps its preset. */
	const each = (prefix: string, choices: Choice[], make: (choice: Choice) => Preset): string[] =>
		choices.map((choice) => {
			const id = `${prefix}_${choice.id}`
			definitions[id] = make(choice)
			return id
		})

	const macros = each('macro', self.lists.macros, (m) =>
		// The dropdown label carries the variable names in brackets; the button needs only the name.
		press(m.label, m.label.replace(/ \(.*\)$/, ''), 'fire_macro', { macro: m.id, variables: '' }),
	)
	const buttons = each('button', self.lists.buttons, (b) =>
		press(b.label, b.label, 'trigger_deck_button', { button: b.id }, cuezStyle(b.color)),
	)
	const timersStart = each('timer_start', self.lists.timers, (t) =>
		press(`Start ${t.label}`, `▶ ${t.label}`, 'start_timer', { timer: t.id }),
	)
	const timersStop = each('timer_stop', self.lists.timers, (t) =>
		press(`Stop ${t.label}`, `■ ${t.label}`, 'stop_timer', { timer: t.id }),
	)
	const episodes = each('episode', self.lists.episodes, (e) =>
		press(`Load ${e.label}`, e.label, 'select_episode', { episode: e.id }),
	)
	const projects = each('project', self.lists.projects, (p) =>
		press(`Select ${p.label}`, p.label, 'select_project', { project: p.id }),
	)

	const section = (id: string, name: string, description: string, presetIds: string[]) => ({
		id,
		name,
		description,
		definitions: presetIds,
	})

	const structure: CompanionPresetSection<Schema>[] = [
		section('rundown', 'Rundown', 'Step through the rundown.', [
			'next',
			'previous',
			'next_trigger',
			'previous_trigger',
			'first_trigger',
		]),
		section('live', 'Live', 'What is on now, what is next, and the link itself.', [
			'current_block',
			'next_block',
			'status',
		]),
		section('deck', 'Deck buttons', 'Your Cuez deck buttons, in their Cuez colours.', buttons),
		section('macros', 'Macros', 'One button per Automator macro.', macros),
		section('timers', 'Timers', 'Start and stop each timer.', [...timersStart, ...timersStop, 'stop_all_timers']),
		section('prompter', 'Prompter', 'Prompter controls.', [
			'prompter_start',
			'prompter_black_on',
			'prompter_black_off',
		]),
		section('episodes', 'Episodes', 'Load an episode of the selected project.', [...episodes, 'unload_episode']),
		section('projects', 'Projects', 'Switch the Automator to another project.', projects),
	].filter((s) => s.definitions.length > 0)

	return { structure, definitions }
}
