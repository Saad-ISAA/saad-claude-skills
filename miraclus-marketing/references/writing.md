# Writing and editing posts — English and Arabic

Let Miraclus draft (`composer_write_variants`) so the kit's voice and dialect are applied, then
edit like an editor. You are responsible for every word that ships.

## Principles

- **One idea per post.** If you need a list of five features, you need five posts.
- **Benefit before feature.** Lead with what changes for the reader; name the feature second.
- **Specific beats impressive.** A real screen, a concrete task, a number you can prove.
- **The reader's words, not the company's.** Use the customer language from the positioning file.
- **Every claim supportable.** Seen in the product, or cut.
- **Hook before "see more"** (about 200 characters on LinkedIn): the reason to keep reading.
- **One call to action**, at the end, when the post has earned it. Early posts in a series can
  end with "next: …" instead of a sales line.
- **Links go in the first comment** (`params.first_comment` / link placement) — feeds tend to show
  posts with outbound links to fewer people.

## Taglines and approved lines

`approved_lines` are allowed, not required. A tagline in every post becomes wallpaper: put it on
the cards (the template's tagline slot) and in the text of the first and last posts of a series,
or where it genuinely lands. Never open a post with a recap of the previous one or with "this is
our first/last post".

## Hook types

Pick deliberately; vary across a series: a question the reader is asking, a sharp observation of
their pain, a before/after, a surprising fact you can prove, a short story, a clear promise.

## AI tells — remove them

Readers recognise machine-written posts and scroll past. Strip:

- "It's not X, it's Y" / "not just X — Y" contrast reveals. Budget: **one per series**, used
  where it matters most. A post headline is not exempt because it sounds like a slogan.
- Self-answered questions ("The result? …"), colon reveals, "Here's the thing".
- Every sentence on its own line (broetry). Use short paragraphs.
- Emoji bullets, em dashes as decoration, arrow-bullet lists for everything.
- Engagement bait ("Agree?", "Thoughts?"), "game-changer", "revolutionise", "unlock", "seamless",
  "in today's fast-paced world".
- Promises the post can't back ("the visual below walks through all 4 steps" when it doesn't).

Arabic has its own tells: literal calques of English idioms, formal Arabic where the kit asks for
a dialect, Latin-script product names where the kit has an Arabic name, and stiff connectives.

## The edit passes (before submitting for review)

Run in order; after each, re-read with the earlier ones in mind.

1. **Clarity** — could a busy reader say what this is about after one read?
2. **Voice** — does it sound like the brand (kit voice), not like a model?
3. **So what** — every sentence earns its place for this audience; cut the rest.
4. **Prove it** — every claim verified; numbers sourced; nothing implied that isn't true.
5. **Specificity** — vague words replaced by concrete ones.
6. **Feeling** — is there a reason to care: relief, curiosity, recognition?
7. **Risk** — anything that could embarrass the brand: legal claims, competitors named, market
   assumptions, promises about the future.

## Arabic

- **Written, not translated.** Same plan, written for Arabic readers. Different examples and order
  are fine; different facts are not.
- **Dialect from the kit** (`voice_ar.dialect`). Don't default to formal Arabic if the kit says
  otherwise; don't use dialect if it says formal.
- **Brand and product names** in the Arabic spelling from `names`; Latin only where the kit does.
- **Terminology**: established Arabic professional terms are correct. Acronyms may follow in
  brackets. Tool and standard names with no common Arabic form stay in Latin. Put this rule in
  the kit's `facts` so the writer and the check follow it.
- **Arrows and bullets** point right to left (←). Hashtags in Arabic.
- **The Arabic check** (`composer_check_variant`) is advice, not law. If it flags correct Arabic,
  the kit is missing a fact, name or approved line — fix the kit, re-check; don't degrade the text.
  If it contradicts itself between runs, choose the version a native reader would and move on.

## Before handing over

Read both languages in `composer_preview_piece`. Check: hook before the fold, no AI tells, claims
true, names right, one CTA, hashtags in each language, picture attached.
