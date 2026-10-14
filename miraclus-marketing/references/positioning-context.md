# Positioning context — know the brand before you write

Every marketing decision reads from one document: what the product is, for whom, against what,
and how its customers talk. Without it, posts become feature lists and the voice drifts.

## Where it lives

- **A versioned file in the brand's own project**, e.g. `marketing/positioning.md`, with a short
  changelog at the top (newest first; bump the version for meaning changes, not typos).
- No project repo for this brand (an agency client, a quick engagement)? Keep the file in the
  working directory you were given, or in the owner's docs, and say where. If nothing persistent
  is available, the Brand Kit is the minimum — never keep positioning only in the conversation.
- **The Miraclus Brand Kit is the part the generators read.** Keep it in sync from the file:

| Positioning section | Kit field |
|---|---|
| One-line description | `about` |
| Verifiable product facts | `facts` (short, one per line) |
| Taglines and claims to use verbatim | `approved_lines` (both languages) |
| Brand/product names in each script | `names` ("English = العربية") |
| Words never to use | `banned` |
| Voice per language, Arabic dialect | `voice_en`, `voice_ar.dialect` |

Never let the kit and the file disagree. When you change one, change the other in the same session.

## The sections

1. **Product** — what it is in one sentence; the category it competes in.
2. **Audience** — who buys, who uses, who signs off (for B2B: user, champion, decision maker,
   budget holder, technical gatekeeper) and what each cares about.
3. **Pains** — the job they are trying to get done and what hurts today, in their words.
4. **Alternatives** — direct competitors, adjacent tools, and "do nothing / spreadsheets".
5. **Difference** — why this, not those. Only differences you can prove.
6. **Objections** — what makes people hesitate, and the honest answer.
7. **Switching forces** — push (pain), pull (new outcome), habit (status quo), anxiety (risk).
8. **Customer language** — words they use, words to avoid, glossary, terms in each language.
9. **Proof** — screens, numbers, customers, certifications. Mark what may be published.
10. **Voice** — how the brand sounds, per language; what it never sounds like.
11. **Markets** — the markets and languages the brand *chose*. Do not invent one.
12. **Goals** — what marketing must achieve this quarter.

## Building it

- Draft from what exists — website, product, existing posts (`brands_learn_voice`), the kit draft
  from `brands_add_company_from_url` — then ask the owner **one section at a time** to confirm or
  correct. Never invent proof, customers, numbers or markets.
- Mark every capability as *verified in product* or *to check*. Only verified ones become `facts`.
- **Verifying without product access**: use what the owner can show you (screenshots, the public
  site, release notes, docs) and ask them to confirm the rest in one direct question. A claim
  nobody can confirm stays out of the post.
- **No Arabic name in `names`?** Ask the owner how the brand is written in Arabic (official
  spelling, or keep Latin). Never invent a transliteration and publish it.
