# Fantasy Campaign Manager Style Guide

This app uses Tailwind CSS with a retro fantasy interface: compact panels, hard borders, pixel-style shadows, readable forms, and responsive dashboard grids. Keep new screens dense enough for play at the table, but leave enough space for long names, source text, and mobile wrapping.

## Design Vocabulary

- Use Tailwind utilities for layout, spacing, color, and typography.
- Use `pixel-panel` for major framed surfaces.
- Use `pixel-button` for primary actions and icon buttons.
- Use `font-pixel` sparingly for headings, not body copy.
- Use `font-bold` or `font-black` for labels and status text.
- Prefer lucide icons for recognizable actions and section headers.
- Keep cards/panels flat. Avoid nested decorative panels unless the inner item is a repeated list row.
- Keep text readable on themed backgrounds by using the current `theme.panel`, `theme.button`, and `theme.primary` values from `App.tsx`.

## Page Shell

Use a full-screen themed background, a constrained content grid, and small responsive padding. This matches the DM and player pages.

```tsx
<main className={`min-h-screen ${theme.bg} p-2 text-neutral-950 sm:p-3 lg:p-4`}>
  <section className="mx-auto grid max-w-[1920px] gap-3">
    <PageHeader campaign={campaign} theme={theme} />
    <DashboardGrid theme={theme} />
  </section>
</main>
```

For two-column operational pages, use a fixed sidebar at large sizes and stack on mobile.

```tsx
<main className={`min-h-screen ${theme.bg} p-2 text-neutral-950 sm:p-3 lg:p-4`}>
  <section className="mx-auto grid max-w-[1920px] gap-3 lg:grid-cols-[260px_1fr]">
    <aside className={`pixel-panel ${theme.panel} p-4`}>
      <h2 className="mb-4 font-pixel text-sm leading-6">Campaign Tools</h2>
    </aside>

    <div className="grid min-w-0 gap-3">
      <DmCommandBar campaign={campaign} theme={theme} />
      <EncounterWorkspace theme={theme} />
    </div>
  </section>
</main>
```

## Command Bar

Use a single `header` panel for top-level state and common actions. Let it become multiple columns on wide screens.

```tsx
<header
  className={`pixel-panel ${theme.panel} grid gap-3 p-3 text-sm lg:grid-cols-[minmax(220px,1fr)_minmax(320px,1.3fr)_minmax(320px,1.1fr)] lg:items-center`}
>
  <div className="flex min-w-0 items-center gap-3">
    <Shield className="h-7 w-7 shrink-0" />
    <div className="min-w-0">
      <h1 className="truncate font-pixel text-sm leading-6">
        {campaign.name}
      </h1>
      <p className="text-[11px] font-black uppercase tracking-wide">
        Dungeon Master View
      </p>
    </div>
  </div>

  <button
    type="button"
    className={`pixel-button flex items-center justify-center gap-2 px-3 py-2 text-xs font-black ${theme.button}`}
  >
    <Volume2 className="h-4 w-4" />
    Sync BGM
  </button>

  <p className="border-2 border-black bg-white/80 p-2 text-xs font-bold text-black">
    Reference files imported and indexed.
  </p>
</header>
```

## Panel Layouts

Panels should have one clear purpose. Use `grid gap-3` or `grid gap-4` for page sections and `p-3` or `p-4` inside panels.

```tsx
<div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_420px]">
  <section className={`pixel-panel ${theme.panel} p-3`}>
    <h2 className="mb-3 flex items-center gap-2 font-pixel text-xs leading-5">
      <Swords className="h-5 w-5" />
      Encounters
    </h2>
  </section>

  <section className={`pixel-panel ${theme.panel} p-3`}>
    <h2 className="mb-3 flex items-center gap-2 font-pixel text-xs leading-5">
      <BookOpen className="h-5 w-5" />
      DM Reference
    </h2>
  </section>
</div>
```

Use `min-w-0` on grid/flex children that contain user-generated text so truncation and wrapping work correctly.

```tsx
<div className="flex min-w-0 items-center gap-3">
  <img className="h-12 w-12 shrink-0 border-2 border-black object-cover" src={imageUrl} />
  <div className="min-w-0">
    <p className="truncate font-bold">{creature.name}</p>
    <p className="truncate text-xs uppercase">{creature.preferredEnvironment}</p>
  </div>
</div>
```

## Forms

Labels are compact and bold. Inputs are plain white boxes with black borders. Prefer responsive grids over long horizontal forms.

```tsx
<form onSubmit={onSearch} className="grid gap-2 lg:grid-cols-[1fr_150px_auto]">
  <label className="block text-xs font-black uppercase">
    Question
    <input
      name="question"
      className="mt-1 w-full border-2 border-black bg-white p-2 text-sm text-black"
      placeholder="Can a prone creature make opportunity attacks?"
    />
  </label>

  <label className="block text-xs font-black uppercase">
    Mode
    <select
      name="mode"
      className="mt-1 w-full border-2 border-black bg-white p-2 text-sm text-black"
      defaultValue="RulesOnly"
    >
      <option>RulesOnly</option>
      <option>RulesAndHomebrew</option>
    </select>
  </label>

  <button
    type="submit"
    className={`pixel-button mt-0 flex items-center justify-center gap-2 px-4 py-2 text-sm font-black lg:mt-6 ${theme.button}`}
  >
    <Search className="h-4 w-4" />
    Search
  </button>
</form>
```

## Lists And Rows

Use simple bordered rows inside panels. Keep repeated items visually consistent and avoid turning every field into its own panel.

```tsx
<div className="grid max-h-64 gap-2 overflow-auto pr-1">
  {documents.map((document) => (
    <article key={document.id} className="border-2 border-black bg-white p-2 text-sm text-black">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-black">{document.sourceName}</p>
          <p className="text-xs uppercase">
            {document.sourceType} · {document.chunkCount} chunks
          </p>
        </div>

        <button
          type="button"
          className="grid h-8 w-8 shrink-0 place-items-center border-2 border-black bg-[#bff3df]"
          aria-label="Reindex source"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>
    </article>
  ))}
</div>
```

## Empty And Status States

Use short, actionable copy in a bordered box. Keep it inside the panel where the missing content would normally appear.

```tsx
<p className="border-2 border-black bg-white p-3 text-sm font-bold text-black">
  No reference sources yet. Import the SRD PDF or upload a campaign note to start searching.
</p>
```

For transient page status, use one shared status line near the command area or relevant form.

```tsx
{status ? (
  <p className="border-2 border-black bg-white/80 p-2 text-xs font-bold text-black">
    {status}
  </p>
) : null}
```

## Buttons

Primary actions use `pixel-button` plus `theme.button`. Small icon actions can use fixed square dimensions.

```tsx
<button
  type="submit"
  className={`pixel-button flex items-center justify-center gap-2 px-3 py-2 text-sm font-black ${theme.button}`}
>
  <Upload className="h-4 w-4" />
  Upload
</button>

<button
  type="button"
  className={`pixel-button grid h-9 w-9 place-items-center ${theme.button}`}
  aria-label="Refresh"
>
  <RefreshCw className="h-4 w-4" />
</button>
```

## Responsive Rules

- Start with one column and add `sm:`, `lg:`, `xl:`, or `2xl:` columns only when the content benefits from it.
- Use explicit grid tracks for dashboards: `xl:grid-cols-[minmax(0,1fr)_360px]`.
- Use `min-w-0` on columns that contain long names, URLs, source text, or generated answers.
- Use `overflow-auto` plus a max height for long reference lists and chat/source panes.
- Keep map/game areas stable with fixed viewport-based heights and min/max constraints.

```tsx
<div className="relative h-[38vh] min-h-[260px] max-h-[520px] w-full overflow-hidden border-4 border-black">
  {/* map pins */}
</div>
```

## Color And Theme Notes

The app currently defines theme class groups in `App.tsx`. Prefer those classes when styling pages:

```tsx
const theme = themeClasses[campaign.theme];

<section className={`pixel-panel ${theme.panel} p-3`}>
  <button className={`pixel-button px-3 py-2 font-bold ${theme.button}`}>
    Save
  </button>
</section>
```

Use hard-coded colors only for content states or neutral surfaces already established in the app:

- `bg-white`, `bg-white/80`, or `bg-[#f8f4e8]` for readable content.
- `border-2 border-black` for field and row boundaries.
- `text-black` inside white content boxes.
- `bg-[#bff3df]` for positive utility actions.
- `bg-[#ffd1dc]` for destructive utility actions.

## Page Checklist

- The first screen shows the actual campaign tool or content, not a marketing block.
- Every major section has a short heading with an icon when useful.
- Forms have labels, readable input borders, and responsive stacking.
- Long user-generated text can wrap or truncate without breaking the layout.
- Loading, empty, and error states live where the content would appear.
- Buttons have clear labels, or icon-only buttons have `aria-label`.
- Mobile layout works before adding desktop columns.
