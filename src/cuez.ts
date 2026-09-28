// The list endpoints are not schema'd, so values of unknown shape are stringified on purpose.
/* eslint-disable @typescript-eslint/no-base-to-string */
/**
 * The whole Cuez Automator control API is "<METHOD> /api/...", so the module needs exactly one
 * request builder. Commands are written as an optional method followed by a path, e.g.
 * "/api/trigger/next", "PATCH /api/episode/<id>/select", "DELETE /api/episode".
 */

const METHODS = ['GET', 'POST', 'PATCH', 'PUT', 'DELETE']

export type Command = { method: string; path: string }

/** Splits a command string into its method (default GET) and path. Throws if there is no path. */
export function parseCommand(command: string): Command {
	const [first = '', ...rest] = command.trim().split(/\s+/)
	const method = first.toUpperCase()

	if (METHODS.includes(method)) {
		const path = rest.join(' ')
		if (!path) {
			throw new Error(`Command "${command}" has a method but no path`)
		}
		return { method, path: withLeadingSlash(path) }
	}

	if (!first) {
		throw new Error('No command configured')
	}
	return { method: 'GET', path: withLeadingSlash([first, ...rest].join(' ')) }
}

function withLeadingSlash(path: string): string {
	return path.startsWith('/') ? path : `/${path}`
}

/**
 * The Automator's origin, from what was typed in the IP and Port fields. Customers type all of
 * "192.168.1.50", "192.168.1.50:7070", "http://192.168.1.50" and "http://192.168.1.50:7070/", so
 * all of them work; a port typed into the IP field wins over the Port field.
 */
export function origin(host: string, port: string | number): string {
	const trimmed = host.trim().replace(/\/+$/, '')
	if (!trimmed) {
		throw new Error('No Automator host configured')
	}
	const portText = String(port).trim()
	// URL's port setter silently ignores anything that is not a port, which would send the request
	// to port 80 instead of failing.
	if (!/^\d{1,5}$/.test(portText) || Number(portText) > 65535) {
		throw new Error(`Port "${portText}" is not a port number`)
	}

	let url: URL
	try {
		url = new URL(/^[a-z]+:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`)
	} catch {
		throw new Error(`"${trimmed}" is not an IP address or host name`)
	}
	const authority = trimmed.replace(/^[a-z]+:\/\//i, '').split('/')[0]
	if (!/:\d+$/.test(authority)) {
		url.port = portText
	}
	return url.origin
}

/** Builds the absolute URL for a command against the configured Automator. */
export function buildUrl(host: string, port: string | number, command: string): string {
	return new URL(parseCommand(command).path, origin(host, port)).href
}

/**
 * Node's fetch rejects with a bare "fetch failed" and hides the reason in `cause`; without this
 * every connection problem reads the same in a customer's log.
 */
export function describeError(err: unknown): { code: string; message: string } {
	type Failure = { name?: string; code?: unknown; message?: string; cause?: unknown }
	let e = err as Failure
	// Walk to the innermost cause: send() wraps fetch's error, which wraps the socket's.
	while (e?.cause && typeof e.cause === 'object') {
		e = e.cause
	}
	if (e?.name === 'TimeoutError' || e?.name === 'AbortError') {
		return { code: 'ETIMEDOUT', message: 'no answer before the timeout' }
	}
	const message = e?.message ?? String(err)
	return { code: typeof e?.code === 'string' ? e.code : message, message }
}

/** What to tell a customer to check, per failure. */
export function hint(code: string, platform = process.platform): string {
	switch (code) {
		case 'ENOTFOUND':
		case 'EAI_AGAIN':
			return "That name does not resolve on this computer. Enter the Automator machine's IP address instead."
		case 'ECONNREFUSED':
			return 'The machine is there but nothing listens on this port. Is the Automator running, and is the port the one it uses (7070 by default)?'
		case 'ETIMEDOUT':
		case 'UND_ERR_CONNECT_TIMEOUT':
			return 'No answer at all. Check the IP, that both computers are on the same network, and that the firewall on the Automator computer lets this port in.'
		case 'EHOSTUNREACH':
		case 'ENETUNREACH':
			return platform === 'darwin'
				? 'No route to that address. On macOS, allow Companion under System Settings > Privacy & Security > Local Network, then restart Companion. Otherwise check the network or VPN.'
				: 'No route to that address. Check that both computers are on the same network, and that no VPN is in the way.'
		case 'ECONNRESET':
			return 'The connection was cut. Something other than the Automator may be on this port, or a firewall or proxy is dropping it.'
		case 'bad port':
			return 'Node refuses to make web requests to this port. Run the Automator on another port, such as 7070.'
		default:
			return ''
	}
}

/**
 * Sends a command to the Automator. Resolves with the response body on success (many endpoints
 * return no body), rejects on a network error, timeout, or non-2xx status.
 */
export async function send(
	host: string,
	port: string | number,
	command: string,
	timeoutMs = 5000,
	body?: unknown,
): Promise<string> {
	const { method } = parseCommand(command)
	const url = buildUrl(host, port, command)

	let response: Response
	try {
		response = await fetch(url, {
			method,
			signal: AbortSignal.timeout(timeoutMs),
			...(body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
		})
	} catch (err) {
		throw new Error(`${method} ${url} failed: ${describeError(err).message}`, { cause: err })
	}
	if (!response.ok) {
		throw new Error(`${method} ${url} responded ${response.status} ${response.statusText}`)
	}
	return response.text()
}

/** One entry of a dropdown built from a live Automator list. */
export type Option = { label: string; value: string; disabled?: boolean }

const ID_KEYS = ['id', 'uuid', '_id']
/** Used to address an entry when it carries no ID of its own - macros can be fired by name. */
const NAME_KEYS = ['name', 'key', 'title']
const LABEL_KEYS = ['name', 'title', 'label', 'text', 'displayName', 'caption']

/**
 * Turns a list endpoint's response into dropdown options. The list endpoints (macros, deck buttons,
 * shortcuts, timers, episodes, configurations) are not schema'd in the API docs and do not answer
 * with the same shape, so this stays deliberately tolerant: an array, an id-keyed object, a
 * single-key wrapper around either, and objects that name their id/label with any of the usual keys.
 */
export function toOptions(data: unknown): Option[] {
	return entriesOf(data)
		.map(([key, item]) => toOption(key, item))
		.filter((option): option is Option => option !== undefined)
}

/** The entries of a list response, as [id from the key if it had one, entry] pairs. */
function entriesOf(data: unknown): [string | undefined, unknown][] {
	const unwrapped = unwrap(data)
	return Array.isArray(unwrapped)
		? unwrapped.map((item) => [undefined, item])
		: isRecord(unwrapped)
			? Object.entries(unwrapped)
			: []
}

/**
 * Responses that wrap the list in a single property, e.g. `{ "macros": [...] }`. Only an array is
 * unwrapped: a lone object would just as likely be a one-entry id-keyed list.
 */
function unwrap(data: unknown): unknown {
	if (isRecord(data)) {
		const values = Object.values(data)
		if (values.length === 1 && Array.isArray(values[0])) {
			return values[0]
		}
	}
	return data
}

function toOption(key: string | undefined, item: unknown): Option | undefined {
	// An id -> name map, or a plain array of names.
	if (typeof item === 'string') {
		return key ? { label: item || key, value: key } : { label: item, value: item }
	}

	if (!isRecord(item)) {
		return undefined
	}

	const pick = (keys: string[]): string | undefined =>
		keys.map((k) => item[k]).find((value) => typeof value === 'string' && value.trim() !== '') as string | undefined

	// The key of an id-keyed object is the ID, so it outranks a name the entry happens to carry.
	const value = pick(ID_KEYS) ?? key ?? pick(NAME_KEYS)
	return value ? { label: pick(LABEL_KEYS) ?? shortcutLabel(item) ?? value, value } : undefined
}

/** Keyboard shortcuts have no name, only `{ key, control, alt, shift }`; read them as "Shift+Space". */
function shortcutLabel(item: Record<string, unknown>): string | undefined {
	if (typeof item['key'] !== 'string' || !item['key']) return undefined
	const held = (['control', 'alt', 'shift'] as const).filter((mod) => item[mod] === true)
	return [...held.map((mod) => mod[0].toUpperCase() + mod.slice(1)), item['key']].join('+')
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** A macro variable, as read off the macro list. */
export type Variable = {
	/** What the query string is keyed by: the variable's ID, or its name when it has none. */
	key: string
	label: string
	/** "string" | "number" | "boolean" | "enum"; anything else is treated as free text. */
	type: string
	required: boolean
	default?: string
	options?: Option[]
}

const VARIABLE_KEYS = ['variables', 'parameters', 'vars', 'arguments']

/**
 * Digs the variables of one macro out of the `/api/macro/` response, so the macro dropdown can
 * name them. Same tolerance
 * as {@link toOptions}: the response shape is not in the API docs.
 */
export function toVariables(data: unknown, macro: string): Variable[] {
	const found = entriesOf(data).find(([key, item]) => {
		const option = toOption(key, item)
		return option?.value === macro || option?.label === macro
	})

	const entry = found?.[1]
	if (!isRecord(entry)) {
		return []
	}

	const list = VARIABLE_KEYS.map((key) => entry[key]).find((value) => value !== undefined)
	return entriesOf(list)
		.map(([key, variable]) => toVariable(key, variable))
		.filter((variable): variable is Variable => variable !== undefined)
}

function toVariable(key: string | undefined, variable: unknown): Variable | undefined {
	if (typeof variable === 'string') {
		return { key: key ?? variable, label: variable, type: 'string', required: false }
	}

	if (!isRecord(variable)) {
		return undefined
	}

	const text = (...keys: string[]): string | undefined =>
		keys.map((k) => variable[k]).find((value) => typeof value === 'string' && value.trim() !== '') as string | undefined

	// The API keys parameters by variable id or name, so either will do.
	const id = text(...ID_KEYS) ?? key ?? text(...NAME_KEYS)
	if (!id) {
		return undefined
	}

	const type = (text('type', 'kind') ?? 'string').toLowerCase()
	const fallback = variable['default'] ?? variable['defaultValue'] ?? variable['value']
	const options = entriesOf(variable['options'] ?? variable['values'] ?? variable['choices']).map(([, option]) =>
		toEnumOption(option),
	)

	return {
		key: id,
		label: text(...LABEL_KEYS) ?? id,
		type: options.length > 0 ? 'enum' : type,
		required: variable['required'] === true,
		default: fallback === undefined || fallback === null ? undefined : String(fallback),
		...(options.length > 0 ? { options } : {}),
	}
}

/** Enum options are `{ key, value }` pairs - the key is submitted, the value is what people read. */
function toEnumOption(option: unknown): Option {
	if (!isRecord(option)) {
		return { label: String(option), value: String(option) }
	}
	const value = String(option['key'] ?? option['id'] ?? option['value'] ?? '')
	return { label: String(option['value'] ?? option['label'] ?? option['name'] ?? value), value }
}

/**
 * Appends the macro variable values to the command as a query string; the API reads macro
 * parameters from there. Empty values are left out so the variable's own default applies.
 */
export function withVariables(command: string, values?: Record<string, unknown>): string {
	const entries = Object.entries(values ?? {}).filter(
		([, value]) => value !== undefined && value !== null && value !== '',
	)
	if (entries.length === 0) {
		return command
	}

	const query = new URLSearchParams(entries.map(([key, value]): [string, string] => [key, String(value)])).toString()
	return `${command}${command.includes('?') ? '&' : '?'}${query}`
}

/** The dropdown value meaning "the block's own title", rather than one of its fields. */
export const TITLE_FIELD = '__title__'

/**
 * A block of the rundown, reduced to what a key can show.
 *
 * `fields` is keyed by the field's *label*, not its id: ids are per block type
 * (`default_clip_title` vs `default_graphic_title`), so a key set to one id would go blank the
 * moment a different kind of block was cued. Labels are shared across types.
 *
 * Only the readable text of each field is kept. A media field's raw value carries multi-kilobyte
 * signed URLs, and the whole rundown is re-read on every change, so none of that is held on.
 */
export type Block = { id: string; title: string; fields: Record<string, string> }

/**
 * The readable name of a block.
 *
 * Where that name lives has moved between Automator versions, so all of the known spellings are
 * tried: `title` as a plain string, `title` as a `{ title, subtitle }` object, the `blockTitle` of
 * an `/api/trigger/current` payload, and the field a block flags `asTitle`.
 *
 * An untitled block falls back to "Untitled", which is what Cuez itself shows - never to the block
 * type, which is an internal slug (`default_graphic`) and reads as a fault on a key.
 */
export function blockTitle(block: Record<string, unknown>): string {
	const title = text(block['title']) ?? text(block['blockTitle'])
	if (title) {
		return title
	}

	const fields = Array.isArray(block['fields']) ? block['fields'] : []
	for (const field of fields) {
		if (isRecord(field) && field['asTitle'] === true) {
			const value = text(field['value'])
			if (value) {
				return value
			}
		}
	}

	return 'Untitled'
}

/** The readable text of a field value: a plain string, or the `title` of a media/title object. */
function text(value: unknown): string | undefined {
	if (typeof value === 'string') {
		return value.trim() || undefined
	}
	if (isRecord(value) && typeof value['title'] === 'string') {
		return value['title'].trim() || undefined
	}
	return undefined
}

/** The blocks of `/api/trigger/blockcontent`, which is keyed by block ID in rundown order. */
export function toBlocks(data: unknown): Block[] {
	return entriesOf(data)
		.map(([key, item]): Block | undefined => {
			if (!isRecord(item)) {
				return undefined
			}
			const id = typeof item['id'] === 'string' ? item['id'] : key
			return id ? { id, title: blockTitle(item), fields: toFields(item) } : undefined
		})
		.filter((block): block is Block => block !== undefined)
}

/** The readable value of every labelled field on a block, keyed by label. */
export function toFields(block: Record<string, unknown>): Record<string, string> {
	const fields: Record<string, string> = {}
	for (const field of Array.isArray(block['fields']) ? block['fields'] : []) {
		if (!isRecord(field)) {
			continue
		}
		const label = typeof field['label'] === 'string' ? field['label'].trim() : ''
		// First one wins: a block can repeat a label, and the earlier field is the one Cuez shows first.
		if (label && fields[label] === undefined) {
			fields[label] = text(field['value']) ?? ''
		}
	}
	return fields
}

/** Every field label in the rundown, in the order first seen, for the block feedback's field dropdown. */
export function toFieldLabels(blockcontent: unknown): string[] {
	const labels: string[] = []
	for (const block of toBlocks(blockcontent)) {
		for (const label of Object.keys(block.fields)) {
			if (!labels.includes(label)) {
				labels.push(label)
			}
		}
	}
	return labels
}

/**
 * Works out what is cued now and what follows it, from `/api/trigger/current` (the cued block, and
 * an empty body when the rundown is not cued) and `/api/trigger/blockcontent`.
 *
 * ponytail: "next" is simply the following entry of blockcontent, trusting its key order to be
 * rundown order. If a rundown ever comes back unordered, order the blocks by walking
 * /api/episode's parts -> items -> blocks instead.
 */
export function currentAndNext(current: unknown, blockcontent: unknown): { current?: Block; next?: Block } {
	const id = typeof current === 'string' ? current.trim() : isRecord(current) ? String(current['id'] ?? '').trim() : ''
	if (!id) {
		return {}
	}

	const blocks = toBlocks(blockcontent)
	const at = blocks.findIndex((block) => block.id === id)
	if (at >= 0) {
		return { current: blocks[at], next: blocks[at + 1] }
	}

	// Cued but absent from the content list; still show it when it arrived with its own title.
	return {
		current: {
			id,
			title: isRecord(current) ? blockTitle(current) : id,
			fields: isRecord(current) ? toFields(current) : {},
		},
	}
}
