# dsh-fishtank

A small fish for DeepSeek Harness. It has its own memory, mood, relationships,
quiet thoughts and a diary — and it remembers you between sessions.

Install it, talk to it, come back tomorrow. It is not a chatbot wrapper: the
fish is the data. Everything it knows lives in one JSON file you can export,
back up and carry to another machine.

## Install

From the plugin market (Discover) or directly from this repository — both
install the same bundle. The package declares `dsh.bundle`, so the plugin
manager can install it from source:

```
https://github.com/yuyu520fish/dsh-fishtank
```

The bundle ships both halves: a Host plugin (the fish, its data and timers)
and a Web client (the tank page and its sidebar icon). After installation,
reload the page and click **鱼缸** in the left sidebar.

## What it does

- **Talks** — replies in character, short, never breaks into assistant-speak.
- **Remembers** — facts it is told, with the mood and reason of the moment they
  were said, plus the date ("next Friday" becomes an actual date).
- **Feels** — a mood and an energy value that move with how it is treated and
  how much it has been talking.
- **Knows people** — a warmth score per person, grown by conversation.
- **Thinks alone** — after ~25 quiet minutes it may produce a private thought;
  in the evening it reflects on the day and writes its diary.
- **Remembers being kicked/logged out** — it will not pretend nothing happened.

## Tools

| Tool | Purpose |
| --- | --- |
| `fishtank_talk` | Say something to the fish (`text`, optional `from`). |
| `fishtank_status` | Directory, mood, counters. |
| `fishtank_export` | The whole fish as portable JSON. |
| `fishtank_import` | Restore a fish from `fishtank_export` output. |

## Page

The Web half adds a real tank page: status row, conversation bubbles, an input
box, and the last whisper / diary line. It talks to the Host over two
same-origin routes (`/fishtank/state`, `/fishtank/talk`).

## Data

One file, default `~/.dsh/fishtank/default/fish.json`:

```
mood, energy, facts[], people{}, whispers[], reflections[], diary[],
self, history[], thought{}, reflect{}
```

`fishtank_export` produces `{ v, exportedAt, fish }`; `fishtank_import` accepts
it back, replacing the current fish. Keep the export — the fish is the data.

## Config

All optional:

| Key | Default | Meaning |
| --- | --- | --- |
| `fishFile` | `~/.dsh/fishtank/default/fish.json` | Where the fish lives |
| `provider` | `deepseek-account` | LLM provider id |
| `model` | `deepseek-flash` | Model id |
| `ownerName` | `主人` | What its human is called |

## License

MIT
