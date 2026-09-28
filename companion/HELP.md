## Cuez Automator

Controls a [Cuez Automator](https://download.cuez.app/automator/docs) and follows its rundown live.

### Setup

1. Add the **Cuez Automator** connection.
2. **Automator IP**: the Automator computer, or `localhost` when Companion runs on it. A host name or a pasted `http://10.0.0.2:7070` also works.
3. **Port**: `7070` unless it was changed in the Automator.

The connection turns green once the Automator answers. If it stays red, the status says why: wrong IP, nothing on that port, a firewall, or (on macOS) Companion not allowed under _System Settings > Privacy & Security > Local Network_.

### Presets

Open the **Presets** tab and drag buttons onto your surface. The module reads your Automator and makes a preset for each of its:

- **Deck buttons**, in their Cuez colours
- **Macros**
- **Timers** (start and stop)
- **Episodes** and **Projects**

Fixed presets cover **Next / Previous** and the triggers, the **Prompter**, **Current / Next block**, and an **Automator status** button (press it to re-read the lists).

When the Automator is unreachable, preset buttons turn grey, so a dead button never looks armed.

### Actions

| Group            | Actions                                                                                            |
| ---------------- | -------------------------------------------------------------------------------------------------- |
| Rundown          | Next, Previous, Next / Previous / First trigger, Trigger block, Trigger first block, Step by index |
| Deck             | Deck button: Press · Deck switch: Toggle / ON / OFF                                                |
| Keyboard         | Keyboard shortcut                                                                                  |
| Macro            | Macro: Fire, with optional variables                                                               |
| Timer            | Start, Stop, Stop all                                                                              |
| Prompter         | To start, Go to trigger, Black ON / OFF                                                            |
| Episode, project | Load episode, Unload episode, Select project                                                       |
| App              | Custom request, Check web connection, Refresh lists                                                |

- **Dropdowns** list what the Automator has, by name. They update on their own when the episode or project changes. You can also paste an ID.
- **Trigger block** lists the blocks of the loaded rundown. Press **Learn** to take the block that is cued now.
- **Macro variables** go in as a query string, by variable name or ID: `Title=hello&delay in ms=500`. The macro dropdown shows each macro's variables in brackets. Leave a variable out to use its default.
- **Custom request** sends any path from the API docs. Prefix `PATCH`, `POST`, `PUT` or `DELETE` for non-GET, e.g. `PATCH /api/episode/<id>/select`.
- Text fields accept Companion variables, e.g. `$(cuez:next_id)`.

### Feedbacks

- **Current / Next block**: the cued block or the one after it. It shows the title, or any field by its label (Title, Media, …). A dash means nothing is cued. **NO LINK** means the Automator is unreachable.
- **Automator connected**: invert it to grey a button out when the link drops.

### Variables

| Variable                                                                 | Holds                              |
| ------------------------------------------------------------------------ | ---------------------------------- |
| `connected`                                                              | `true` while the Automator answers |
| `current_title`, `current_id`, `current_part`, `current_item`            | The cued block                     |
| `next_title`, `next_id`                                                  | The block after it                 |
| `episode_id`, `episode_title`                                            | The loaded episode                 |
| `project_id`, `project_title`, `project_pairing_expired`                 | The selected project               |
| `automator_id`, `automator_name`, `automator_version`, `automator_state` | The Automator itself               |

### Upgrading from 1.x

Buttons made with version 1.x keep working. The **Select Project** action and every 1.x variable are still there.
