# Sino Studio — Copilot Context

> **Purpose:** Complete reference for GitHub Copilot to build new routes, pages, and components in this project without
> needing prior conversation history. Read this file before doing any work.

---

## 1. Project Overview

Vietnamese animation studio website built with Next.js App Router. Dark-themed, Vietnamese language content, heavy use
of Montserrat headings, Framer Motion animations, and Mantine v8 for layout/UI primitives.

**Root directory:** `D:\YOUTUBE\project files\++ SINO STUDIO\WEB\sino-studio`

---

## 2. Tech Stack

| Package                      | Version | Notes                                                                                        |
|------------------------------|---------|----------------------------------------------------------------------------------------------|
| Next.js                      | 16.1.6  | App Router, `'use client'` where needed                                                      |
| React                        | 19.2.3  |                                                                                              |
| TypeScript                   | ^5      | Strict                                                                                       |
| `@mantine/core`              | ^8.3.15 | Primary UI — **always import `@mantine/core/styles.css` in layout**                          |
| `@mantine/hooks`             | ^8.3.15 | `useMediaQuery`, `useWindowScroll`, `useDisclosure`, and more depending on the page building |
| `@mantine/carousel`          | ^8.3.15 | Embla-based carousel — import `@mantine/carousel/styles.css` in component                    |
| `framer-motion`              | ^12     | `motion`, `Variants`, `useScroll`, `useTransform`                                            |
| `@tabler/icons-react`        | ^3.38   | Icon set                                                                                     |
| `embla-carousel-auto-scroll` | ^8.6    | AutoScroll plugin for carousels                                                              |
| `embla-carousel-autoplay`    | ^8.6    | Autoplay plugin                                                                              |

---

## 3. File & Folder Conventions

```
src/
  app/
    layout.tsx           ← Root layout: MantineProvider, ColorSchemeScript, MusicPlayer
    globals.css          ← CSS variables & resets
    page.tsx             ← Landing page (assembles sections)
    about/page.tsx
    projects/
      page.tsx           ← Projects listing (currently stub)
      [id]/page.tsx      ← Dynamic project detail (uses ProjectShowcasePage)
  components/
    <ComponentName>/
      <ComponentName>.tsx
      <ComponentName>.module.css
    landing/
      Hero/
      Ticker/
      WhoWeAre/
      Clients/
      Projects/
      BrandService/
    navbar/
    footer/
    music-player/
    project-details/     ← Shared section components for project pages
      hero/
      color-script/
      characters/
      background/
      credits/
      ProjectShowcasePage.tsx
  data/
    project-data.ts      ← PROJECTS Record + TypeScript interfaces
    playlist.ts          ← PLAYLIST Record for music player
public/
  images/
    projects/<id>/       ← hero.webp, characters-1.webp…N, color-script-1.webp…N, background-1.webp…N
    music-thumbnails/    ← <id>.webp
    clients/
  music/                 ← <id>.webm
  videos/
    projects/<id>/       ← hero.webm
    hero-video-desktop.webm  hero-video-tablet.webm  hero-video-mobile.webm
```

### Key rules

- `'use client';` at the top of **every** interactive or animated component
- `Image` from `next/image` for **all** images — never `<img>`
- `Link` from `next/link` for **all** navigable links — never `<a>` for internal routes
- CSS Modules only — no Tailwind, no inline `style` objects for layout (inline `style` is OK for CSS variable injection)
- One component per file; file name = component name
- If images don't exist, use `images/placeholder.png` (a generic placeholder image) to avoid build errors

---

## 4. Global Styles & CSS Variables

**File:** `src/app/globals.css`

```css
:root {
    --color-red: #e8192c;
    --color-black: #0a0a0a;
    --color-dark: #111111;
    --color-white: #ffffff;
    /* --font-heading injected by next/font (Montserrat) via layout.tsx */
}
```

- Body font: `Inter, sans-serif`
- Heading font: `var(--font-heading)` (Montserrat, weights 400/500/600/700/800/900)
- `background-color: var(--color-black)` on `html, body`
- `scroll-behavior: smooth` on `html`
- `box-sizing: border-box` everywhere

---

## 5. Mantine Theme (`src/app/layout.tsx`)

```ts
createTheme({
    primaryColor: 'red',
    colors: {
        red: ['#ffe8ea', '#ffb3b8', '#ff8088', '#ff4d57',
            '#e8192c', '#c91526', '#a81120', '#870d1a', '#660913', '#45050d'],
    },
    fontFamily: 'Inter, sans-serif',
    headings: {fontFamily: '"Montserrat", sans-serif'},
    defaultRadius: 0,
})
```

`defaultColorScheme="dark"` — the entire app is dark-themed.

---

## 6. Typography Scale

| Use                                 | CSS                                                                                                                                          |
|-------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------|
| Page / section heading              | `font-family: var(--font-heading); font-weight: 800; font-size: clamp(32px, 8vw, 72px); text-transform: uppercase; letter-spacing: 0.04em`   |
| Project title (hero)                | `clamp(40px, 10vw, 80px); font-weight: 900`                                                                                                  |
| Banner title (section header strip) | `clamp(28px, 5vw, 48px); font-weight: 800`                                                                                                   |
| Body copy                           | `font-size: clamp(14px, 3.5vw, 17px); line-height: 1.7; color: rgba(255,255,255,0.75)`                                                       |
| Tag / label (uppercase)             | `font-size: 10–11px; letter-spacing: 0.3em; text-transform: uppercase; color: var(--color-red)`                                              |
| Stat label                          | `font-size: 10–12px; font-weight: 600; letter-spacing: 0.25em; text-transform: uppercase`                                                    |
| Stat value                          | `font-family: var(--font-heading); font-size: clamp(14px, 5vw, 18–20px); font-weight: 700`                                                   |
| Credit role                         | `font-size: 10–11px; font-weight: 700; letter-spacing: 0.22em; text-transform: uppercase; color: rgba(255,255,255,0.4)`                      |
| Credit name                         | `font-family: var(--font-heading); font-size: clamp(13px, 1.6vw, 15px); font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase` |

---

## 7. Button Styles

```css
/* Outline */
border: 1px solid rgba(255, 255, 255, 0.5);
background: transparent;
color: #fff;
padding: 12px 24px;
font-size: 12px;
font-weight: 600;
letter-spacing: 0.2em;
text-transform: uppercase;

/* Filled red */
background: var(--color-red);
border: none;
color: #fff;
padding: 14px 28px;
font-size: 13px;
font-weight: 700;
letter-spacing: 0.12em;
text-transform: uppercase;
```

---

## 8. Framer Motion Patterns

### Standard fade-up (used everywhere)

```tsx
const fadeUp: Variants = {
    hidden: {opacity: 0, y: 40},
    visible: (i = 0) => ({
        opacity: 1, y: 0,
        transition: {duration: 0.7, delay: i * 0.12, ease: 'easeOut'},
    }),
};

// Usage — stagger children by passing custom={index}:
<motion.div initial="hidden" whileInView="visible" viewport={{once: true, amount: 0.3}}>
    <motion.h2 variants={fadeUp} custom={0}/>
    <motion.p variants={fadeUp} custom={1}/>
</motion.div>
```

### Parallax scroll (used in landing Hero)

```tsx
const {scrollYProgress} = useScroll({target: ref, offset: ['start start', 'end start']});
const y = useTransform(scrollYProgress, [0, 1], ['0%', '30%']);
// <motion.div style={{ y }}>
```

### Entrance for individual items

```tsx
initial={{ opacity: 0, x: -40 }}
animate={{ opacity: 1, x: 0 }}
transition={{ duration: 0.8, ease: 'easeOut' }}
```

---

## 9. CSS — Mobile-First Breakpoints

```css
/* Base = mobile (no media query) */

@media (min-width: 768px) {
    /* tablet */
}

@media (min-width: 1024px) {
    /* desktop */
}
```

### Mantine responsive props

```tsx
<SimpleGrid cols={{base: 1, sm: 2, lg: 3}} spacing={{base: 16, sm: 24, lg: 32}}/>
<Box px={{base: 24, sm: 40, lg: 60}}/>
```

---

## 10. Existing Shared Components

### `<Navbar />`

- Fixed top, `z-index: 100`
- Transparent → `rgba(10,10,10,0.92) + backdrop-filter: blur(8px)` on scroll (uses `useWindowScroll`)
- **Mobile (< 768px):** hamburger `<button>` → Mantine `<Menu>` dropdown (positioned `bottom-end`)
- **Desktop (≥ 768px):** horizontal `<ul>` of links, active link underline in `var(--color-red)`
- Logo: `<Image src="/sino-studio-full.webp" width={125} height={66} />`
- `navItems` array drives both hamburger menu and desktop links

### `<Footer />`

- `background: #111111`
- 4-col `<SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>`: logo | nav links | contact | socials
- Hollow outlined watermark "SINO" (`position: absolute`, `z-index: 0`, large outlined text)
- Bottom bar: copyright strip

### `<MusicPlayer />`

- Fixed `bottom: 24px; left: 24px; z-index: 1000`
- Liquid-glass style: `background: rgba(15,15,15,0.55); backdrop-filter: blur(6px) saturate(160%)`
- Collapsed state: `44×44px` icon button; expanded: `300px` wide card
- Tracks from `PLAYLIST` in `src/data/playlist.ts`, shuffled after first track on mount
- Sources: `/music/<id>.webm`, thumbnails: `/images/music-thumbnails/<id>.webp`
- Controls: prev/next, play/pause, Mantine `<Slider>` for seek + volume, mute toggle
- Tabler icons: `IconPlayerPlay`, `IconPlayerPause`, `IconPlayerSkipBack/Forward`, `IconVolume`, `IconVolumeOff`,
  `IconMusic`, `IconChevronDown`

---

## 11. Project Detail Page Architecture

### Route

`/projects/[id]` → `src/app/projects/[id]/page.tsx`

```tsx
// page.tsx (Server Component)
import {notFound} from 'next/navigation';
import {PROJECTS} from '@/data/project-data';
import ProjectShowcasePage from '@/components/project-details/ProjectShowcasePage';

export const dynamicParams = false;

export async function generateStaticParams() {
    return Object.keys(PROJECTS).map((id) => ({id}));
}

export async function generateMetadata({params}) {
    const {id} = await params;
    return {title: PROJECTS[id]?.title ?? 'Project'};
}

export default async function ProjectPage({params}) {
    const {id} = await params;
    const project = PROJECTS[id];
    if (!project) notFound();
    return <ProjectShowcasePage project={project}/>;
}
```

### `ProjectShowcasePage`

Switches on `project.type`:

- `'animation'` → `<Navbar> + <Hero> + <ColorScript> + <Characters> + <Background> + <Credits> + <Footer>`
- Other types planned but not yet implemented → returns `null`

### `ProjectMetaData` interface (`src/data/project-data.ts`)

```ts
interface CreditEntry {
    role: string;
    names: string;
}

interface ProjectMetaData {
    id: string;
    type: 'animation' | 'mv' | 'others';
    title: string;
    description_1: string;
    description_2: string;
    firstAired: string;
    status: string;
    characters: string[];        // Display names — array length = number of character rows
    colorScriptCount?: number;   // Defaults to 12
    backgroundCount?: number;    // Defaults to 4
    credits: CreditEntry[];
}
```

### Image naming conventions (under `public/images/projects/<id>/`)

| File                                        | Purpose                                                       |
|---------------------------------------------|---------------------------------------------------------------|
| `hero.webp`                                  | Hero section portrait card and fallback bg                    |
| `characters-1.webp` … `characters-N.webp`     | Character turnaround sheets (N = `characters.length`)         |
| `color-script-1.webp` … `color-script-N.webp` | Color script cells (N = `colorScriptCount`, default 12)       |
| `background-1.webp` … `background-N.webp`     | Background environment art (N = `backgroundCount`, default 4) |

### Video naming conventions (under `public/videos/projects/<id>/`)

| File        | Purpose                                                            |
|-------------|--------------------------------------------------------------------|
| `hero.webm` | Hero section autoplay background video (image fallback if missing) |

---

## 12. Project Detail Sections — Full Reference

### Hero (`src/components/project-details/hero/`)

**Layout (desktop):** 2-col — portrait card (36–40% width) | text info (flex: 1)  
**Background:** full-bleed `<video src="/videos/projects/<id>/hero.webm">` with `onError` fallback to
`<Image src="/images/projects/<id>/hero.webp">`, covered by gradient overlay
`linear-gradient(to right, rgba(0,0,0,0.80), rgba(0,0,0,0.65) 50%, rgba(0,0,0,0.40))`

**Portrait card:**

- `aspect-ratio: 1/1; border-radius: 20px; border: 1px solid rgba(255,255,255,0.15); overflow: hidden`
- Image `objectFit: cover; objectPosition: center top`

**Info column:**

- `<h1>` title: `clamp(40px, 10vw, 80px)` centered mobile, left-aligned tablet+
- 2 body paragraphs: `rgba(255,255,255,0.80)`, `clamp(16px, 1.5vw, 18px)`, `line-height: 1.75`
- Stats `<SimpleGrid cols={{ base: 2 }}>` — 2 stat boxes

**Stat box styling:**

```css
/* Outer — gradient border */
.statBox {
    position: relative;
    border-radius: 10px;
    padding: 1px; /* border thickness */
    background: linear-gradient(135deg, #000000, #ffffff);
    opacity: .75;
}

/* Inner background via ::before pseudo */
.statBox::before {
    content: '';
    position: absolute;
    inset: 1px;
    border-radius: 9px;
    background: linear-gradient(90deg, #373737, #6c6c6c);
    opacity: 0.75;
    z-index: 0;
}

.statBox > * {
    position: relative;
    z-index: 1;
}

.statBoxInner {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 16px 20px;
}
```

**Section nav strip** (below hero, `background: var(--color-black)`):

- Mobile: `grid-template-columns: 1fr 1fr` (2×2 grid)
- Tablet+: `grid-template-columns: repeat(4, 1fr)` (single row)
- Links: bold white uppercase, `clamp(13px, 2vw, 20px)`, `font-weight: 800`, hover → `var(--color-red)`
- Thin `rgba(255,255,255,0.12)` dividers between cells (right + bottom borders on grid cells)
- Links: `#color-script`, `#characters`, `#background`, `#credits`

---

### ColorScript (`src/components/project-details/color-script/`)

**Banner:** full-width `background: var(--color-red)`, white bold uppercase "COLOR SCRIPT", `clamp(28px, 5vw, 48px)`,
centred, `padding: 18–24px`

**Desktop (≥ 1024px):** CSS grid, `grid-template-columns: repeat(var(--grid-cols, 4), 1fr)`, `gap: 10px; padding: 10px`

- `gridCols(count)` helper: prefer 4 cols, fall back to 3 or 2
- Each cell: `aspect-ratio: 16/9; border-radius: 10px; overflow: hidden; position: relative`
- Hover: `transform: scale(1.05)` on the `<Image>`

**Mobile/Tablet (< 1024px):** `@mantine/carousel` with `embla-carousel-auto-scroll`

```tsx
const autoScroll = AutoScroll({ speed: 2, stopOnInteraction: false, stopOnMouseEnter: true });
// Carousel props:
slideSize={{ base: '83%', sm: '46%' }}
slideGap="md"
emblaOptions={{ loop: true, dragFree: true, align: 'center' }}
withControls={false}
withIndicators={false}
// Each slide: aspect-ratio: 16/9, border-radius: 10px
```

**Images:** `/images/projects/<id>/color-script-1.webp` … `color-script-N.webp`

---

### Characters (`src/components/project-details/characters/`)

**Banner:** full-width `background: var(--color-red)`, white bold uppercase "CHARACTERS"  
**Section background:** `var(--color-white)` (white)

**Character rows:** one row per `project.characters[i]`

- Separated by `border-bottom: 2px solid var(--color-red)` (last row no border)
- Each row: full-width `.imageWrap`, `position: relative`
    - `.charName` — `position: absolute; top: 0; left: 20–60px (responsive)` — red uppercase heading
    - `.imageInner` — `width: 80%; margin: 0 auto; aspect-ratio: 16/7 (mobile) → 16/6 (desktop); position: relative`
    - `<Image fill objectFit: contain>`
- Fade-up animation per row via `whileInView`

**Images:** `/images/projects/<id>/characters-1.webp` … `characters-N.webp`

---

### Background (`src/components/project-details/background/`)

**Banner:** full-width `background: var(--color-black)`, `border-bottom: 1px solid rgba(255,255,255,0.08)`, white bold
uppercase "BACKGROUND"  
**Section background:** `var(--color-black)`

**Image grid:**

```tsx
<SimpleGrid cols={{base: 1, sm: smCols}} spacing="xs">
```

- `smCols = count === 1 ? 1 : 2` (2-col for 2+ images)
- Each cell: `position: relative; aspect-ratio: 16/9; overflow: hidden`
- Staggered fade-up via `whileInView`

**Images:** `/images/projects/<id>/background-1.webp` … `background-N.webp`

---

### Credits (`src/components/project-details/credits/`)

**Section background:** `var(--color-black)`  
**Layout (desktop ≥ 1024px):** side-by-side row — title column (fixed 220px) | credits wrap (flex: 1)  
**Layout (mobile):** stacked column

**Title:** `clamp(28px, 5vw, 48px)`, white, bold, `var(--font-heading)`, uppercase

**Credits:** split `project.credits` array in half, render in two columns via `<SimpleGrid cols={{ base: 1, sm: 2 }>`:

```tsx
function CreditBlock({role, names, idx}) {
    return (
        <motion.div className={styles.creditBlock} variants={fadeUp} custom={idx}>
            <span className={styles.role}>{role}</span> // small muted label
            <span className={styles.names}>{names}</span> // white bold names
        </motion.div>
    );
}
```

- Gap between blocks: `28px`
- Role: `font-size: 10–11px; letter-spacing: 0.22em; color: rgba(255,255,255,0.4); text-transform: uppercase`
- Names: `clamp(13px, 1.6vw, 15px); font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase`

---

## 13. Landing Page Sections (Reference)

### Hero

- Full-bleed `<video>` background, breakpoint-switched source (`mobile` / `tablet` / `desktop`)
- Uses `useScroll + useTransform` for parallax `y` on the background div
- `useMediaQuery` from `@mantine/hooks` to pick video source

### Projects (card grid)

```tsx
<SimpleGrid cols={{base: 1, sm: 2, lg: 3}} spacing={20} maw={1200} mx="auto">
    <Link href={project.href}>
        <motion.div whileHover={{scale: 1.02}}>
            <AspectRatio ratio={16 / 10}>
                <div className={styles.cardInner}>
                    <div className={styles.cardImg}><Image fill … /></div>
                    <div className={styles.cardOverlay}/>
                    {/* gradient bottom-to-top */}
                    <div className={styles.cardInfo}>
                        <p className={styles.cardTag}>{tag}</p>
                        <h3 className={styles.cardTitle}>{title}</h3>
                    </div>
                </div>
            </AspectRatio>
        </motion.div>
    </Link>
</SimpleGrid>
```

- Card: `position: relative; overflow: hidden; border-radius: 6px; background: #1a1a1a`
- Overlay gradient: `linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 50%, transparent 100%)`
- Card info: `position: absolute; bottom 0; left 0; right 0; padding: 20px`
- Tag: `var(--color-red)`, 11px, uppercase; Title: white, `var(--font-heading)`, 700

---

## 14. Data Files

### `src/data/project-data.ts`

- `PROJECTS: Record<string, ProjectMetaData>`
- Current entries: `"ngoc-bao-khi"`, `"linh-truy-hon-am-gioi"`
- Add new projects here; static params generated automatically

### `src/data/playlist.ts`

- `PLAYLIST: Record<string, MusicMetadata>` — `{ id, title, artist[], album? }`
- Current tracks: `ngoc-bao-khi`, `chang-trai-bat-tinh`, `hinh-hai-trong-mat-anh`, `khien-anh-mo-long`, `khong-the-co`,
  `ngay-em-den`, `tam-su-voi-em-sau-nay`, `yeu-em-trong-mo`, `yeu-trong-co-doc`
- First track always plays first on load; rest are shuffled

---

## 15. How to Add a New Project Page

1. **Add to `PROJECTS`** in `src/data/project-data.ts`:
   ```ts
   "my-project": {
     id: "my-project",
     type: "animation",
     title: "MY PROJECT",
     description_1: "...",
     description_2: "...",
     firstAired: "MONTH DD, YYYY",
     status: "AIRING",
     characters: ["CHAR ONE", "CHAR TWO"],
     colorScriptCount: 12,
     backgroundCount: 4,
     credits: [
       { role: "DIRECTOR", names: "NAME" },
       // ...
     ],
   }
   ```

2. **Add assets** to `public/images/projects/my-project/`:
    - `hero.webp`
    - `characters-1.webp` … `characters-N.webp`
    - `color-script-1.webp` … `color-script-12.webp`
    - `background-1.webp` … `background-4.webp`

3. **(Optional) Add hero video:** `public/videos/projects/my-project/hero.webm`

4. **Route is auto-generated** via `generateStaticParams` — no new page file needed.

5. **If `type !== 'animation'`**, add a new branch in `ProjectShowcasePage.tsx` and create the relevant section
   components.

---

## 16. How to Add a New Top-Level Route

1. Create `src/app/<route>/page.tsx` (Server Component unless you need client state at root)
2. Assemble: `<Navbar />` + content sections + `<Footer />`
3. `MusicPlayer` is already in the root layout — no need to re-add it
4. Add the route to `navItems` in `src/components/navbar/Navbar.tsx` if it should be in the nav

---

## 17. Common Mantine v8 API Gotchas

- `cols` prop on `<SimpleGrid>` is `{ base, sm, md, lg, xl }` object — **not** a plain number
- `spacing` can be a number (px) or responsive object `{ base: 16, sm: 24 }`
- `maw` / `miw` / `px` / `py` are shorthand props available on most Mantine components
- `useMediaQuery` returns `boolean | undefined` — handle `undefined` for SSR safety
- Mantine `<Menu>` used for navbar mobile dropdown: `position="bottom-end"`, `offset={12}`
- `<Slider>` `label={null}` disables the floating tooltip
- Always import `@mantine/carousel/styles.css` in the file that uses `<Carousel>`

---

## 18. Glass / Overlay Styling Patterns

### Liquid-glass panel (used in MusicPlayer)

```css
background: rgba(15, 15, 15, 0.55);
backdrop-filter: blur(6px) saturate(160%);
border: 1px solid rgba(255, 255, 255, 0.10);
box-shadow: 0 8px 32px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.07);
border-radius: 16px;
```

### Gradient border + gradient background (used in stat boxes)

```css
/* Outer wrapper = the border */
.box {
    position: relative;
    padding: 1px; /* border thickness */
    border-radius: 10px;
    background: linear-gradient(135deg, #000000, #ffffff); /* border gradient */
    opacity: 0.75;
}

/* Inner fill via ::before */
.box::before {
    content: '';
    position: absolute;
    inset: 1px;
    border-radius: 9px;
    background: linear-gradient(90deg, #373737, #6c6c6c);
    opacity: 0.75;
    z-index: 0;
}

.box > * {
    position: relative;
    z-index: 1;
}
```

### Dark hero overlay

```css
background: linear-gradient(
    to right,
    rgba(0, 0, 0, 0.80) 0%,
    rgba(0, 0, 0, 0.65) 50%,
    rgba(0, 0, 0, 0.40) 100%
);
```

### Card bottom-to-top overlay

```css
background: linear-gradient(
    to top,
    rgba(0, 0, 0, 0.85) 0%,
    rgba(0, 0, 0, 0.2) 50%,
    transparent 100%
);
```

---

## 19. Section Banner Pattern

Used in ColorScript, Characters, Background, Credits sections:

```tsx
<motion.div
    className={styles.banner}
    initial={{opacity: 0}}
    whileInView={{opacity: 1}}
    viewport={{once: true}}
    transition={{duration: 0.5}}
>
    <h2 className={styles.bannerTitle}>SECTION NAME</h2>
</motion.div>
```

```css
.banner {
    background-color: var(--color-red); /* OR var(--color-black) for dark sections */
    padding: 18px 24px; /* 22px 40px tablet, 24px 60px desktop */
    display: flex;
    align-items: center;
    justify-content: center;
}

.bannerTitle {
    font-family: var(--font-heading);
    font-weight: 800;
    font-size: clamp(28px, 5vw, 48px);
    color: var(--color-white);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin: 0;
    line-height: 1;
}
```

**Banner color by section:**

- COLOR SCRIPT → `var(--color-red)` background
- CHARACTERS → `var(--color-red)` background
- BACKGROUND → `var(--color-black)` background + `border-bottom: 1px solid rgba(255,255,255,0.08)`
- CREDITS → no banner (title is inline in the content layout)

---

## 20. Carousel Pattern (embla + auto-scroll)

```tsx
import {Carousel} from '@mantine/carousel';
import AutoScroll from 'embla-carousel-auto-scroll';
import '@mantine/carousel/styles.css';

// Initialise plugin OUTSIDE component or with useMemo to avoid re-creation:
const autoScroll = AutoScroll({
    speed: 2,
    startDelay: 0,             // resume immediately after hover/swipe — default is 1000 ms
    stopOnInteraction: false,  // don't permanently stop on drag
    stopOnMouseEnter: true,    // pause on hover
});

<Carousel
    plugins={[autoScroll]}
    slideSize={{base: '83%', sm: '46%'}}
    slideGap="md"
    emblaOptions={{loop: true, dragFree: true, align: 'center'}}
    withControls={false}
    withIndicators={false}
>
    {items.map((item) => (
        <Carousel.Slide key={item.id}>
            {/* content */}
        </Carousel.Slide>
    ))}
</Carousel>
```

---

## 21. `not-found.tsx` for Dynamic Routes

Place at `src/app/projects/[id]/not-found.tsx`:

```tsx
import Link from 'next/link';

export default function NotFound() {
    return (
        <div style={{ /* centred dark page */}}>
            <h1>404</h1>
            <p>Project not found.</p>
            <Link href="/projects">Back to Projects</Link>
        </div>
    );
}
```

The dynamic `[id]/page.tsx` calls `notFound()` when `PROJECTS[id]` is undefined, which triggers this component.

---

## 22. Quick Decision Guide

| Situation                          | Solution                                                         |
|------------------------------------|------------------------------------------------------------------|
| New project showcase               | Add to `PROJECTS`, add assets — **no new route file needed**     |
| New type of project page           | New branch in `ProjectShowcasePage.tsx` + new section components |
| New landing page section           | New folder in `src/components/landing/<Name>/`                   |
| New top-level page                 | `src/app/<route>/page.tsx` + `Navbar` + sections + `Footer`      |
| Responsive image                   | `<Image fill sizes="…">` inside `position: relative` container   |
| Responsive grid                    | Mantine `<SimpleGrid cols={{ base:1, sm:2, lg:3 }}>`             |
| Animated section entry             | `motion.div` + `whileInView` + `fadeUp` variants                 |
| Auto-scrolling image strip         | `@mantine/carousel` + `embla-carousel-auto-scroll`               |
| Mobile nav                         | Mantine `<Menu>` from hamburger button (see `Navbar.tsx`)        |
| Glass-effect panel                 | See §18 liquid-glass pattern                                     |
| Gradient border with gradient fill | See §18 stat-box pattern                                         |

