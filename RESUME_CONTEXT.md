# Resume Context — Ngọc Bảo Khí Project Page

## Goal
Build `src/app/projects/ngoc-bao-khi/page.tsx` (currently empty) as a **full project-detail page** for the animation project "Ngọc Bảo Khí".  
The page layout must **exactly follow page 4** of the Canva design named **`trang chính`** (design ID: `DAG7AP1Ppo4`).

The user will send page 4 **in sections** (cropped screenshots) so we can read the layout precisely.

---

## Canva — Page 4 Thumbnail Info
- **Design:** `trang chính` (DAG7AP1Ppo4)
- **Page index:** 4 (1-based)
- **Canvas dimensions:** 1366 × 768 px (design canvas)
- **Rendered thumbnail size:** 1366 × 4873 px — very tall, meaning the page is ~6.35× the viewport height
- **Thumbnail URL (temporary, expires ~Mar 5 2026 ~08:00 UTC):**
  ```
  https://document-export.canva.com/1Ppo4/DAG7AP1Ppo4/320/thumbnail/0004.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAQYCGKMUHWEOTUD6Q%2F20260305%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20260305T001235Z&X-Amz-Expires=27658&X-Amz-Signature=cc0368598721ac3e2a2107c6dd3266739b78acace6ce5d2423bd82463ad011cc&X-Amz-SignedHeaders=host&response-expires=Thu%2C%2005%20Mar%202026%2007%3A53%3A33%20GMT
  ```

---

## Project — Tech Stack & Conventions

### Framework / Libraries
- **Next.js 16.1.6** (App Router)
- **React 19**
- **TypeScript**
- **Mantine v8.3.15** (`@mantine/core`, `@mantine/hooks`, `@mantine/carousel`)
- **Framer Motion v12** (`motion`, `Variants`, `useScroll`, `useTransform`)
- **@tabler/icons-react v3.38**
- **CSS Modules** for all component styles

### File conventions
- Each component lives in `src/components/<ComponentName>/<ComponentName>.tsx` + `<ComponentName>.module.css`
- `'use client';` directive at top of every interactive/animated component
- `Image` from `next/image` for all images
- `Link` from `next/link` for all navigable links
- Mobile-first CSS (base = mobile, then `@media (min-width: 768px)` tablet, `@media (min-width: 1024px)` desktop)

### CSS Variables (defined in `src/app/globals.css`)
```css
--color-red:   #e8192c
--color-black: #0a0a0a
--color-dark:  #111111
--color-white: #ffffff
--font-heading: (injected by next/font Montserrat)
```

### Framer Motion pattern (used across all components)
```tsx
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 40 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.7, delay: i * 0.12, ease: 'easeOut' },
  }),
};
// Usage:
<motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.3 }}>
  <motion.h2 variants={fadeUp} custom={0}>...</motion.h2>
  <motion.p  variants={fadeUp} custom={1}>...</motion.p>
</motion.div>
```

### Mantine responsive pattern
```tsx
<SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing={20} />
// useMediaQuery from @mantine/hooks for conditional rendering
const isMobile = useMediaQuery('(max-width: 767px)');
```

---

## Existing Components (for reference/reuse on the new page)

### `<Navbar />`
- Fixed top nav, transparent → `rgba(10,10,10,0.92)` on scroll
- Logo: `<Image src="/sino-studio-full.png" …/>`
- Mobile hamburger → Mantine `<Drawer>`
- Desktop: flex row of links

### `<Footer />`
- Dark bg `#111111`
- 4-col `<SimpleGrid>`: logo | nav links | contact | socials
- Hollow "SINO" watermark text behind content
- Bottom bar: copyright

### `<Projects />` (card grid — useful reference for related-projects section)
```tsx
<SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing={20} maw={1200} mx="auto">
  <Link href={project.href}>
    <motion.div className={styles.card} whileHover={{ scale: 1.02 }}>
      <AspectRatio ratio={16/10}>
        <div className={styles.cardInner}>
          <div className={styles.cardImg}><Image fill … /></div>
          <div className={styles.cardOverlay} />
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
Card CSS: `position:relative; overflow:hidden; border-radius:6px; background:#1a1a1a`  
Overlay: `linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 50%, transparent 100%)`

### `<WhoWeAre />` (two-col text + image — useful reference for overview section)
- Left: heading + body text + CTA button
- Right: absolutely positioned character image (hidden mobile, shown desktop)
- BG: dark with `background-image` overlay

### `<BrandService />` (two-panel — useful reference for stats/info blocks)
- `<SimpleGrid cols={{ base: 1, lg: 2 }} spacing={0}>`
- Each panel: `position:relative; overflow:hidden; min-height:380px`
- Text content `z-index:2`, character image absolutely positioned

---

## Images Available for This Page

| Purpose | Path |
|---|---|
| Hero image | `/images/projects/ngoc-bao-khi/ngoc-bao-khi-hero.png` |
| Scene/gallery placeholder | `/images/placeholder.png` |
| Related project cards | `/images/projects/linh.webp`, `/images/projects/long-x-boss.webp`, `/images/projects/chang-trai-bat-tinh.jpg`, etc. |

---

## Target File Structure to Create

```
src/
  app/projects/ngoc-bao-khi/
    page.tsx                          ← MAIN TARGET (currently empty)
  components/
    NgocBaoKhi/                       ← NEW components for this page
      Hero/
        Hero.tsx
        Hero.module.css
      NbkOverview/
        NbkOverview.tsx
        NbkOverview.module.css
      NbkGallery/
        NbkGallery.tsx
        NbkGallery.module.css
      NbkRelated/
        NbkRelated.tsx
        NbkRelated.module.css
```

`page.tsx` assembles: `<Navbar>` + new section components + `<Footer>`

---

## Section-by-Section Layout (to be filled in as user sends images)

> The user will send cropped sections of the page 4 thumbnail one at a time.
> Fill in each section below as images are received.

### Section 0 — Navbar
Re-use existing `<Navbar />` component

### Section 1 — Hero + Section Nav Bar
**Full-bleed background:** Project artwork image, dark overlay on top.

**Two-column layout (desktop):**
- Left (~40% width): Square character portrait card (`ngoc-bao-khi-hero.png`), subtle dark border, slight border-radius ~6px
- Right (~60% width):
  - `<h1>` **"NGỌC BẢO KHÍ"** — white, font-weight 900, uppercase, `clamp(40px, 7vw, 80px)`
  - Two body paragraphs (Vietnamese), `rgba(255,255,255,0.80)`, `font-size: clamp(14px, 1.5vw, 16px)`:
    - "Ngọc Bảo Khí là dự án hoạt hình ngắn được đội ngũ SiNo Studio thực hiện ngay sau teaser LINH: Truy Hồn Âm Giới. Đây là một bước tiến quan trọng của team, đánh dấu sự trưởng thành rõ rệt về mặt kỹ thuật và tư duy sản xuất."
    - "Không phải một dự án series, Ngọc Bảo Khí đơn thuần là lời khẳng định cho sự nghiêm túc, bền bỉ và định hướng lâu dài của SiNo Studio trên con đường sáng tạo phía trước."
  - Two stat boxes (`<SimpleGrid cols={{ base: 2 }}`), dark semi-transparent bg `rgba(255,255,255,0.08)`, border `1px solid rgba(255,255,255,0.15)`, padding ~16px 20px:
    - Box 1 — label: "FIRST AIRED" (small, muted/red), value: "JANUARY 19, 2026" (white bold)
    - Box 2 — label: "STATUS", value: "AIRING"

**Mobile:** stack vertically — image top, text below, stat boxes stay 2-col grid.

**Bottom section-nav strip** (black bg, top border `rgba(255,255,255,0.12)`):
- Flex row of 4 `<Link>` anchors, full width, each equal width, centred text, `padding: 20px 0`
- Bold white underlined text, uppercase, `font-size: clamp(14px, 2vw, 20px)`, `font-weight: 800`, `var(--font-heading)`
- Thin vertical dividers `rgba(255,255,255,0.12)` between links on desktop
- Links → section IDs:
  1. COLOR SCRIPT → `#color-script`
  2. CHARACTERS → `#characters`
  3. BACKGROUND → `#background`
  4. CREDITS → `#credits`
- Mobile: 2×2 grid

### Section 2 — Color Script (#color-script)
- **Header banner:** Full-width solid red `var(--color-red)` bar, bold white uppercase "COLOR SCRIPT", `font-weight:800`, `var(--font-heading)`, `font-size: clamp(28px, 5vw, 48px)`, centred, `padding: 20px 24px`
- **Image grid (desktop ≥1024px):** 4 columns × 3 rows, 12 images, no gap, each cell `aspect-ratio: 16/9`, uses `placeholder.png`
- **Mobile/tablet (<1024px):** `@mantine/carousel` with `autoPlay`, draggable, `slidesToScroll=1`, showing 1.2 slides on mobile, 2.2 on tablet — so user knows more slides exist

### Section 3 — Characters (#characters)
- **Header banner:** Full-width solid red `var(--color-red)` bar, bold white uppercase "CHARACTER", same style as Color Script banner
- **Two character rows** separated by a `2px solid var(--color-red)` divider:
  - Each row: red uppercase character name label on the left + wide `16/6` aspect-ratio turnaround sheet image on the right
  - Characters: **BOSS** (row 1), **LONG** (row 2)
  - Desktop: label in a fixed `140px` left column, image fills remaining width
  - Mobile: label above image, stacked vertically
- **Section background:** `var(--color-white)` (light)
- **Component:** `src/components/NgocBaoKhi/Characters/Characters.tsx` ✅ DONE

### Section 4 — Background & Environment (#background)
- **Header banner:** Full-width **black** (`var(--color-black)`) bar with subtle bottom border `rgba(255,255,255,0.08)`, bold white uppercase "BACKGROUND", same font/size style as other banners
- **2×2 image grid:** 4 landscape images, `aspect-ratio: 16/9` each, using `placeholder.png`
  - Desktop (≥640px): 2 columns × 2 rows via Mantine `<SimpleGrid cols={{ base: 1, sm: 2 }}>`
  - Mobile: stacked single column
  - Subtle hover zoom (`scale(1.04)`) on each cell
  - Staggered fade-up animation via Framer Motion `whileInView`
- **Section background:** `var(--color-black)`
- **Component:** `src/components/NgocBaoKhi/Background/Background.tsx` ✅ DONE

### Section 5 — Credits (#credits)

### Section 6 — Footer
Re-use existing `<Footer />` component

---

## Implementation Notes & Constraints

1. **Mobile-first** — all CSS starts with mobile base, adds tablet/desktop via `@media`
2. **No complex CSS tricks** — use Mantine layout components (`SimpleGrid`, `Group`, `Stack`, `AspectRatio`, `Box`) wherever possible
3. **Mantine v8 API** — `cols` prop is `{ base, sm, lg }` object. `spacing` can be number or object.
4. **All images** → `<Image>` from `next/image` with proper `fill` + `sizes` or explicit `width`/`height`
5. **All links** → `<Link>` from `next/link`
6. **Animations** — `motion.*` + `whileInView` with `viewport={{ once: true }}`, staggered via `custom` index
7. **Typography scale:**
   - Section heading: `clamp(32px, 8vw, 72px)`, `font-weight: 800`, `font-family: var(--font-heading)`
   - Body: `font-size: clamp(14px, 3.5vw, 17px)`, `line-height: 1.7`, `color: rgba(255,255,255,0.75)`
   - Tag/label: `font-size: 10–11px`, `letter-spacing: 0.3em`, `text-transform: uppercase`, `color: var(--color-red)`
8. **Red accent colour:** `#e8192c` / `var(--color-red)`
9. **Button style (outline):** `border: 1px solid rgba(255,255,255,0.5); background: transparent; color:#fff; padding:12px 24px; font-size:12px; font-weight:600; letter-spacing:0.2em; text-transform:uppercase`
10. **Button style (filled red):** `background: var(--color-red); border:none; color:#fff; padding:14px 28px; font-size:13px; font-weight:700; letter-spacing:0.12em`

---

## How to Resume

1. Open a **new chat** in GitHub Copilot (JetBrains)
2. Paste or attach this file (`RESUME_CONTEXT.md`) as context
3. Tell the AI: _"Continue building the Ngọc Bảo Khí project page. I will send the Canva page 4 thumbnail sections one by one."_
4. Send cropped sections of the thumbnail image one at a time
5. After all sections are described, the AI should build all components and `page.tsx`

---

## Project directory root
`D:\YOUTUBE\project files\++ SINO STUDIO\WEB\sino-studio`

