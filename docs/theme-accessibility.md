# Theme Accessibility Checklist

Purpose: keep contrast and boundary visibility consistent across the app while using design tokens.

## Automated Check

Run `npm run lint:contrast` (or `npm run lint`) to verify the required token pairings meet the minimum contrast ratios.

## Manual Verification Checklist

Minimums:
- Normal text: ~4.5:1
- UI boundaries (borders, focus rings): ~3:1

Required pairings to verify:
- Text on background: `--text` on `--bg` (>= 4.5:1)
- Text on surface: `--text` on `--surface` (>= 4.5:1)
- Muted text on surface: `--text-muted` on `--surface` (>= 4.5:1)
- Border on surface: `--border` on `--surface` (>= 3:1)
- Primary button text: `--primary-fg` on `--primary` (>= 4.5:1)
- Focus ring on background: `--focus-ring` on `--bg` (>= 3:1)

## WebAIM Contrast Checker Guidance

Use the WebAIM Contrast Checker to validate the pairings above.

Steps:
1. Open `src/styles/theme.css` and copy the token values.
2. For solid colors (hex), paste the foreground and background values directly.
3. For tokens with alpha (`--text-muted`, `--border`, `--focus-ring`), use browser DevTools to sample the rendered color on the target background and paste the computed color into WebAIM.
4. Re-check the ratios after any token changes and confirm in `/theme-preview`.
