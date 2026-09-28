/**
 * One live connection to the Automator per Companion connection.
 *
 * The Automator pushes `{method, data}` frames on `ws://<host>:<port>/ws`. Those method names are
 * not in the API docs, so the block feedback and the dropdowns never depend on them: any frame is
 * "something changed" and the documented REST endpoints are re-read. The socket is a doorbell, not
 * the data, and a 2s poll takes over when it is down.
 *
 * The one exception is the Automator/project/episode info variables, which the REST API does not
 * expose at all. Those come from the frames the old (1.x) module read, and simply stay empty if
 * the frames ever change.
 */

import {
	InstanceBase,
	InstanceStatus,
	type CompanionFeedbackSchema,
	type CompanionOptionValues,
	type CompanionStaticUpgradeProps,
	type CompanionStaticUpgradeResult,
	type CompanionStaticUpgradeScript,
	type CompanionUpgradeContext,
	type CompanionVariableValues,
	type DropdownChoice,
	type SomeCompanionConfigField,
} from '@companion-module/base'

import {
	type Block,
	currentAndNext,
	describeError,
	hint,
	origin,
	send,
	toBlocks,
	toFieldLabels,
	toOptions,
	toVariables,
} from './cuez.js'
import { actions, feedbacks, presets, variables } from './definitions.js'

export type Config = { host: string; port: number }

export type Schema = {
	config: Config
	secrets: undefined
	actions: Record<string, { options: CompanionOptionValues }>
	feedbacks: Record<string, CompanionFeedbackSchema<CompanionOptionValues>>
	variables: CompanionVariableValues
}

/** How the Automator looks right now, as far as the buttons are concerned. */
export type Snapshot = {
	current?: Block
	next?: Block
	/** False while the Automator cannot be reached, so buttons can say so rather than show stale data. */
	online: boolean
}

/**
 * List endpoints turned into action dropdowns and presets. Prompter triggers are deliberately
 * absent: they have no list endpoint and change with every episode — those stay free text.
 */
const LISTS = {
	macros: '/api/macro/',
	buttons: '/api/trigger/button/',
	shortcuts: '/api/trigger/shortcut/',
	timers: '/api/timer',
	episodes: '/api/project/episodes',
	projects: '/api/projects',
}
export type Choice = DropdownChoice<string> & { color?: string }
export type Lists = Record<keyof typeof LISTS | 'blocks', Choice[]>

/** Re-read at this interval while the socket is down; the socket makes polling unnecessary. */
const POLL_MS = 2000
/** Frames arrive in bursts (one action can move several things), so coalesce them into one read. */
const COALESCE_MS = 150

type Upgrade = CompanionStaticUpgradeResult<Config, undefined>
const NO_CHANGE: Upgrade = { updatedConfig: null, updatedActions: [], updatedFeedbacks: [] }

export const UpgradeScripts: CompanionStaticUpgradeScript<Config>[] = [
	// The 1.x module's placeholder. It must stay: Companion counts upgrade scripts by position, so
	// removing it would skip the next script for everyone upgrading from 1.x.
	(): Upgrade => NO_CHANGE,
	// 1.x stored the port as text and had a "verbose" checkbox; 2.x keeps a number and logs anyway.
	(_context: CompanionUpgradeContext<Config>, props: CompanionStaticUpgradeProps<Config, undefined>): Upgrade => {
		const old = props.config as { host?: string; port?: unknown } | null
		if (!old || typeof old.port === 'number') return NO_CHANGE
		return { ...NO_CHANGE, updatedConfig: { host: old.host ?? 'localhost', port: Number(old.port) || 7070 } }
	},
]

export default class CuezAutomator extends InstanceBase<Schema> {
	config: Config = { host: 'localhost', port: 7070 }
	snapshot: Snapshot = { online: false }
	lists: Lists = { macros: [], buttons: [], shortcuts: [], timers: [], episodes: [], projects: [], blocks: [] }
	fieldLabels: string[] = []

	#socket: WebSocket | undefined
	#polling: ReturnType<typeof setInterval> | undefined
	#coalescing: ReturnType<typeof setTimeout> | undefined
	#listsTimer: ReturnType<typeof setTimeout> | undefined
	#reading: Promise<void> | undefined
	#lastState = ''

	async init(config: Config): Promise<void> {
		this.config = config
		this.setVariableDefinitions(variables)
		this.#define()
		this.#start()
	}

	async configUpdated(config: Config): Promise<void> {
		this.config = config
		this.#stop()
		this.#lastState = ''
		this.#start()
	}

	async destroy(): Promise<void> {
		this.#stop()
		clearTimeout(this.#listsTimer)
	}

	getConfigFields(): SomeCompanionConfigField[] {
		return [
			{
				type: 'static-text',
				id: 'info',
				label: 'Cuez Automator',
				width: 12,
				value:
					'Controls a Cuez Automator over its HTTP API and follows the rundown live. Macros, deck buttons, ' +
					'shortcuts, timers, episodes and projects are read from the Automator and offered as presets.',
			},
			{
				// Not Regex.IP: host names and a pasted "http://10.0.0.2:7070" are accepted too.
				type: 'textinput',
				id: 'host',
				label: 'Automator IP',
				description: 'localhost when Companion runs on the Automator computer.',
				width: 8,
				default: 'localhost',
			},
			{
				type: 'number',
				id: 'port',
				label: 'Port',
				description: '7070 unless changed in the Automator.',
				width: 4,
				min: 1,
				max: 65535,
				default: 7070,
			},
		]
	}

	/** Sends a command, logging rather than throwing: a failed press must not look like a crash. */
	async run(command: string): Promise<void> {
		try {
			await send(this.config.host ?? '', String(this.config.port ?? ''), command)
		} catch (err) {
			const { code, message } = describeError(err)
			this.log('error', `"${command}" failed: ${message}${hint(code) ? ` - ${hint(code)}` : ''}`)
		}
	}

	/** Fills the dropdowns and presets from the Automator's own lists, so things are picked by name. */
	async loadLists(): Promise<void> {
		await Promise.all(
			Object.entries(LISTS).map(async ([name, path]) => {
				try {
					const data: unknown = JSON.parse(await send(this.config.host, String(this.config.port), path))
					const items = Array.isArray(data) ? (data as Record<string, unknown>[]) : []
					const itemOf = (id: string) => items.find((entry) => entry?.id === id)
					this.lists[name as keyof typeof LISTS] = toOptions(data)
						// A deck button pane is a container, not something to press.
						.filter(({ value }) => itemOf(value)?.type !== 'buttonpane')
						.map(({ label, value }): Choice => {
							// Macros name their variables in the dropdown, since they go in a free-text field.
							const vars = name === 'macros' ? toVariables(data, value).map((v) => v.label) : []
							const color = itemOf(value)?.color
							return {
								id: value,
								// An unnamed deck button comes back titled "undefined", literally.
								label: label === 'undefined' ? 'Untitled' : vars.length ? `${label} (${vars.join(', ')})` : label,
								color: typeof color === 'string' ? color : undefined,
							}
						})
				} catch (err) {
					this.log('warn', `Could not load ${path}: ${describeError(err).message}`)
				}
			}),
		)
		this.#define()
	}

	#define(): void {
		this.setActionDefinitions(actions(this))
		this.setFeedbackDefinitions(feedbacks(this))
		const { structure, definitions } = presets(this)
		this.setPresetDefinitions(structure, definitions)
	}

	/** Lists change with the episode and project; a burst of frames reloads them once. */
	#reloadLists(): void {
		clearTimeout(this.#listsTimer)
		this.#listsTimer = setTimeout(() => void this.loadLists(), 500)
	}

	#start(): void {
		this.updateStatus(InstanceStatus.Connecting)
		this.#polling = setInterval(() => {
			// The socket keeps itself current; this is the fallback for when it is down or absent.
			if (this.#socket?.readyState !== WebSocket.OPEN) this.#open()
		}, POLL_MS)
		this.#open()
	}

	#stop(): void {
		clearInterval(this.#polling)
		clearTimeout(this.#coalescing)
		this.#socket?.close()
		this.#socket = undefined
	}

	#open(): void {
		let url: string
		try {
			url = `${origin(this.config.host ?? '', String(this.config.port ?? '')).replace(/^http/, 'ws')}/ws`
		} catch (err) {
			this.updateStatus(InstanceStatus.BadConfig, describeError(err).message)
			return
		}

		if (!this.#socket || this.#socket.readyState > WebSocket.OPEN) {
			try {
				// Node's native WebSocket, not the `ws` package: `ws` throws an uncatchable RangeError
				// on a close frame with a reserved code such as 1006, which the Automator sends.
				const socket = new WebSocket(url)
				this.#socket = socket
				socket.onmessage = (ev) => this.#onFrame(ev.data)
				socket.onopen = () => this.#refresh()
				// No reconnect timer: the poll interval already retries, and doubles as the fallback.
				socket.onerror = () => undefined
				socket.onclose = (ev) =>
					this.log('debug', `Automator socket closed (code ${ev.code}); polling until it is back`)
			} catch (err) {
				this.log('debug', `Could not open the Automator socket on ${url}: ${describeError(err).message}`)
				this.#socket = undefined
			}
		}
		this.#refresh()
	}

	#onFrame(raw: unknown): void {
		this.#refresh()

		let frame: { method?: unknown; data?: unknown }
		try {
			frame = JSON.parse(typeof raw === 'string' ? raw : '') as typeof frame
		} catch {
			return
		}
		const data = (frame.data ?? {}) as Record<string, unknown>
		const text = (value: unknown) => (typeof value === 'string' || typeof value === 'number' ? String(value) : '')

		switch (frame.method) {
			case 'welcome':
				// The Automator only sends its app info to a client that introduces itself.
				send(this.config.host, String(this.config.port), 'POST /api/app/init', 5000, {
					hello: 'from Companion',
					clientid: data.clientid,
				}).catch((err: unknown) => this.log('debug', `app/init failed: ${describeError(err).message}`))
				break
			case 'app-info':
				this.setVariableValues({
					automator_id: text(data.automator_id),
					automator_name: text(data.automator_name),
					automator_version: text(data.automator_version),
				})
				break
			case 'app-state-changed':
				this.setVariableValues({ automator_name: text(data.name), automator_state: text(data.state) })
				this.#reloadLists()
				break
			case 'project-selected':
				this.setVariableValues({
					project_id: text(data.id),
					project_title: text(data.title),
					project_pairing_expired: data.expired === true,
				})
				this.#reloadLists()
				break
			case 'episode': {
				const episode = (data.episode ?? {}) as Record<string, unknown>
				this.setVariableValues({ episode_id: text(episode.id), episode_title: text(episode.title) })
				this.#reloadLists()
				break
			}
		}
	}

	#refresh(): void {
		clearTimeout(this.#coalescing)
		this.#coalescing = setTimeout(() => void this.#read(), COALESCE_MS)
	}

	async #read(): Promise<void> {
		// A read against an unreachable Automator takes the full timeout, which is longer than the poll
		// interval; without this the retries would stack up on each other.
		this.#reading ??= this.#readNow()
			.catch((err: unknown) => this.log('error', `Reading the Automator failed: ${describeError(err).message}`))
			.finally(() => (this.#reading = undefined))
		return this.#reading
	}

	async #readNow(): Promise<void> {
		const { host, port } = this.config
		/** Separates "the Automator answered" from "it had nothing to say", which read the same otherwise. */
		const get = async (path: string): Promise<{ ok: boolean; data?: unknown; err?: unknown }> => {
			try {
				const body = await send(host, String(port), path)
				try {
					return { ok: true, data: JSON.parse(body) }
				} catch {
					// A 200 with an empty body: /api/trigger/current answers that way when nothing is cued.
					return { ok: true }
				}
			} catch (err) {
				return { ok: false, err }
			}
		}

		const [current, blockcontent] = await Promise.all([get('/api/trigger/current'), get('/api/trigger/blockcontent')])
		const wasOnline = this.snapshot.online
		// Whether the request itself completed, not whether it carried anything: nothing cued is a
		// normal state and must not read as a dead Automator.
		this.snapshot = { ...currentAndNext(current.data, blockcontent.data), online: current.ok || blockcontent.ok }
		const { online, current: now, next } = this.snapshot

		if (online && !wasOnline) void this.loadLists()

		// The rundown's blocks and field labels feed dropdowns; redefine only when they changed.
		const blocks = toBlocks(blockcontent.data).map((block) => ({ id: block.id, label: block.title }))
		const labels = toFieldLabels(blockcontent.data)
		if (JSON.stringify([blocks, labels]) !== JSON.stringify([this.lists.blocks, this.fieldLabels])) {
			this.lists.blocks = blocks
			this.fieldLabels = labels
			this.setActionDefinitions(actions(this))
			this.setFeedbackDefinitions(feedbacks(this))
		}

		// Only on change: an Automator that is off polls every 2s and would bury the errors that matter.
		const state = `Automator ${online ? 'online' : 'unreachable'}: current "${now?.title ?? '-'}", next "${next?.title ?? '-'}"`
		if (state !== this.#lastState) {
			this.log('info', state)
			this.#lastState = state
			if (online) {
				this.updateStatus(InstanceStatus.Ok)
			} else {
				const { code, message } = describeError(current.err)
				// A web server that is not the Automator (or one too old for this API) answers 404 here.
				const text = /responded 404/.test(message)
					? 'Something answers on this port, but it is not the Automator API. Check the port.'
					: hint(code) || message
				this.updateStatus(InstanceStatus.ConnectionFailure, text)
			}
		}

		const cued = (current.data ?? {}) as Record<string, unknown>
		this.setVariableValues({
			connected: online,
			current_title: now?.title ?? '',
			current_id: now?.id ?? '',
			current_part: now && typeof cued.partTitle === 'string' ? cued.partTitle : '',
			current_item: now && typeof cued.itemTitle === 'string' ? cued.itemTitle : '',
			next_title: next?.title ?? '',
			next_id: next?.id ?? '',
		})
		this.checkFeedbacks('block', 'connected')
	}
}
