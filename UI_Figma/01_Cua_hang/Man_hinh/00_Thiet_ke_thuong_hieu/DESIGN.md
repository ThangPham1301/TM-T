---
name: Hue Heritage Craft
colors:
  surface: '#fff8f5'
  surface-dim: '#ebd6c7'
  surface-bright: '#fff8f5'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#fff1e8'
  surface-container: '#ffeadb'
  surface-container-high: '#fae4d5'
  surface-container-highest: '#f4dfcf'
  on-surface: '#241910'
  on-surface-variant: '#50443e'
  inverse-surface: '#3a2e24'
  inverse-on-surface: '#ffeee2'
  outline: '#82746d'
  outline-variant: '#d4c3ba'
  surface-tint: '#7b563f'
  primary: '#3e220e'
  on-primary: '#ffffff'
  primary-container: '#573722'
  on-primary-container: '#cea085'
  inverse-primary: '#edbda0'
  secondary: '#805601'
  on-secondary: '#ffffff'
  secondary-container: '#fec56d'
  on-secondary-container: '#775000'
  tertiary: '#40210c'
  on-tertiary: '#ffffff'
  tertiary-container: '#593620'
  on-tertiary-container: '#d19f82'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdbc7'
  primary-fixed-dim: '#edbda0'
  on-primary-fixed: '#2e1504'
  on-primary-fixed-variant: '#603f29'
  secondary-fixed: '#ffddaf'
  secondary-fixed-dim: '#f5bd66'
  on-secondary-fixed: '#281800'
  on-secondary-fixed-variant: '#614000'
  tertiary-fixed: '#ffdbc9'
  tertiary-fixed-dim: '#f0bb9d'
  on-tertiary-fixed: '#301403'
  on-tertiary-fixed-variant: '#633e27'
  background: '#fff8f5'
  on-background: '#241910'
  surface-variant: '#f4dfcf'
typography:
  display-lg:
    fontFamily: Noto Serif
    fontSize: 48px
    fontWeight: '600'
    lineHeight: 58px
    letterSpacing: -0.01em
  display-lg-mobile:
    fontFamily: Noto Serif
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: 0em
  headline-lg:
    fontFamily: Noto Serif
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 42px
    letterSpacing: -0.005em
  headline-md:
    fontFamily: Noto Serif
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-sm:
    fontFamily: Noto Serif
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  title-md:
    fontFamily: Be Vietnam Pro
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
  body-lg:
    fontFamily: Be Vietnam Pro
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 26px
  body-md:
    fontFamily: Be Vietnam Pro
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
  body-sm:
    fontFamily: Be Vietnam Pro
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
  label-lg:
    fontFamily: Be Vietnam Pro
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.02em
  label-md:
    fontFamily: Be Vietnam Pro
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.04em
  price-lg:
    fontFamily: Be Vietnam Pro
    fontSize: 22px
    fontWeight: '700'
    lineHeight: 28px
spacing:
  gutter: 1.5rem
  margin: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

### Brand Personality & Philosophy
This design system captures the quiet grandeur, refined court etiquette, and artisanal authenticity of Huế heritage crafts. Designed for high-end gifting, traditional confectionery, imperial teas, and culinary memorabilia, it bridges centuries-old royal aesthetics with minimalist editorial e-commerce.

The experience evokes:
- **Trầm lắng & Quý phái (Poised & Aristocratic):** Deep roasted hues, warm mulberry paper textures, and disciplined proportions.
- **Thủ công mộc mạc (Artisanal Craft):** Natural paper grain, architectural line art inspired by imperial citadel pavilions, and unhurried layouts.
- **Trang trọng & Đương đại (Contemporary Dignity):** Modern typographical clarity married to classical Vietnamese diacritics.

### Design Style: Editorial Heritage Craft
Combining the tactile elegance of handmade Dó/parchment paper with editorial discipline. Layouts reject generic SaaS cards in favor of beveled framing, gold corner accents derived from folded gift envelopes (*gói bánh, phong bao tiến cung*), and delicate 1px line separations.

## Colors

The color palette reflects natural royal dyes, aged paper parchment, roasted sesame, woodblock ink, and courtly gilded leaf. Every tone maintains strict contrast ratios exceeding WCAG AA standards against parchment backdrops.

### Palette Architecture
- **Primary (`#573722` - Nâu ca cao trầm):** Used for primary buttons, prominent editorial headlines, primary navigation marks, and active states.
- **Secondary (`#C99643` - Vàng hoàng kim):** Accent leafing, active status indicators, corner bevel accents, ratings, and refined badges.
- **Tertiary (`#795139` - Nâu óc chó):** Secondary buttons, subheadings, supporting interactive hover layers.
- **Neutral Ink (`#35291F` - Mực mộc):** Ultra-dark warm umber for long-form body copy, pricing typography, and architectural iconography. Replaces pure black to avoid digital harshness.
- **Canvas Base (`#FBF7F0` - Warm Ivory):** The main background replicating unbleached archival paper.
- **Canvas Layer (`#F4EBDD` - Bìa giấy / Parchment):** Card containers, form inputs, table headers, and product specification tiers.
- **Hairline Border (`#D8C5AE` - Chỉ viền mộc):** Delicate 1px structural outlines and frame contours.

## Typography

The typographic hierarchy pairs the literary grace of **Noto Serif** with the engineered clarity and pristine Vietnamese tone mark handling of **Be Vietnam Pro**.

### Typographic Hierarchy Rules
- **Noto Serif** is strictly reserved for editorial displays, product names, section hero titles, and ceremonial headers. Its serifs echo traditional wooden print types of Huế.
- **Be Vietnam Pro** governs UI ergonomics: price tags, configuration chips, specifications, form fields, and long descriptions. It ensures dense information remains legible at small scales.
- Diacritical marks (*dấu thanh*) in Vietnamese must have adequate line height. Never compress body text line-height below `1.5` to prevent diacritic clipping.

## Layout & Spacing

The layout model uses a fluid 12-column grid on desktop and tablet, converting to a 4-column flow on mobile screens. 

### Breakpoints & Canvas Logic
- **Desktop (>= 1200px):** 12 columns, `1.5rem` gutters, `2rem` to `3.5rem` external margins. Max content container is capped at `1280px` centered to evoke high-end editorial magazines.
- **Tablet (768px - 1199px):** 8 columns, `1rem` gutters, `1.5rem` margins.
- **Mobile (< 768px):** 4 columns, `0.75rem` gutters, `1rem` outer margin.

### Editorial White Space Rhythm
Ample empty canvas is essential to reflect cultural composure (*nhịp thong thả*). Hero viewports balance generous text spacing on the left with high-resolution, unhurried product stills on the right. Framing devices utilize asymmetrical margins to highlight artisanal goods like mè xửng, sen sấy, and hoàng trà.

## Elevation & Depth

This design system avoids blurry SaaS drop shadows. Instead, it creates depth through tactile material layering, tonal stacking, and hairline structural borders.

### Depth Principles
1. **Paper-on-Paper Stacking:** Depth is achieved by placing `#F4EBDD` (bìa giấy container) atop `#FBF7F0` (warm ivory canvas), bounded by a clean `1px solid #D8C5AE` stroke.
2. **Warm Ghost Outlines:** Interactive elements use subtle inner borders or 1px outer hairlines tinted with `#D8C5AE`.
3. **Restrained Ambient Shadow for Floating Modals:** Where absolute elevation is required (e.g. quick cart drawer, modal dialogs), use an extra-diffused, warm-tinted shadow:
   `box-shadow: 0 16px 36px -8px rgba(53, 41, 31, 0.12);`
4. **Beveled Gilded Corners:** Layer transitions on banners and specialty frames feature cut corners with a solid 45-degree triangular tag in `#C99643`.

## Shapes

The shape system uses a customized sharp-and-beveled geometry (`roundedness: 0`), inspired by court architecture and folded paper wrappers.

### Corner Treatments & Geometries
- **Beveled Corner Button:** Primary and secondary action buttons feature a 45-degree chamfer/clip-path on the top-right and bottom-right edges (or diagonal opposite corners), accented with a gilded triangle (`#C99643`) nested into the cut corner.
- **Imperial Frame Cutouts:** Feature cards and hero banners utilize a decorative single or double chamfer on opposing diagonal corners with hairline `#D8C5AE` contour strokes.
- **Rectangular Restraint:** Standard data cells, product gallery thumbnails, and selection chips retain sharp 90-degree corners to honor traditional craft packaging blocks.

## Components

### Buttons
- **Primary Action (Nút Khám Phá / Mua Ngay):** Solid `#573722` background, text `#FBF7F0` in `Be Vietnam Pro 500`. The right edge is angled/beveled with a gilded triangle pin `#C99643` flush in the corner. Padding: `12px 24px`. Hover state lightens to `#795139`.
- **Secondary Action:** Transparent background with `1px solid #573722`, text `#573722`, bearing the same beveled cut with an outlined or solid gold corner indicator.
- **Text Button:** Clean underline spaced 4px below text in `#573722`, ending with an en-dash or angled craft glyph.

### Cards & Packaging Blocks
- **Heritage Product Card:** Outer container has a `#F4EBDD` surface, framed by a `1px solid #D8C5AE` border. Imagery is framed with generous internal padding (`16px`) showing packaging textures. Chamfered corner accents appear on active or featured variants.
- **Specification Block:** Surface `#F4EBDD` with `#D8C5AE` hairline dividers separating weight (*Khối lượng*), price (*Giá*), and quantity (*Số lượng*).

### Selection Chips & Radio Selectors
- **Variant Selector (Hộp quà / Túi zip):** Card-style radio box. Unselected: `#FBF7F0` background with `1px solid #D8C5AE`. Selected: `#F4EBDD` background with `1px solid #573722`, accented by a solid `#573722` circular radio indicator containing an inner `#C99643` gold core.

### Form Inputs
- Single-line and textarea fields use `#FBF7F0` background with a bottom border or full box border in `1px solid #D8C5AE`.
- On focus: Border shifts to `#573722` with zero fuzzy glow; an optional 1px offset line honors the precision of court drafting.

### Dividers & Ornaments
- **Imperial Hairline Divider:** `1px solid #D8C5AE` spanning the grid, interrupted at the center or right quadrant by an asymmetrical diamond or gilded chevron accent `#C99643`.
- **Botanical / Architectural Line Art:** Single-color vector sketches of royal roofs, lotus motifs, and apricot blossoms rendered strictly in `#D8C5AE` or `#795139` at 20-40% opacity.