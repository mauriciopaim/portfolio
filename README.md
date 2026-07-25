# mauriciopaim.com

A single page, hand built, no framework and no build step. Push `master` and
GitHub Pages serves it.

```
index.html          the whole page
css/style.css       the whole design
js/main.js          reveals, nav state, and the canvas press in the hero
fonts/              subset woff2, see below
og.png              link preview card, generated from build/og.html
build/og.html       source for og.png, not linked from anywhere
```

## The idea

"Registration": the thing a print shop does when it lines up the cyan, magenta
and yellow plates so the image comes out clean. The page starts as ink, becomes
paper, and goes back to ink. Type arrives slightly out of register and settles.
In the hero, three ink threads run across the plate and come into register
wherever the cursor is.

## Rules of the house

- **No dependencies.** The hero effect is plain canvas 2D, about 100 lines.
  If it ever needs a library, it is the wrong effect.
- **The page works with JavaScript off.** The reveal animations are gated behind
  a `.js` class that an inline script sets in `<head>`. Never write
  `.reveal { opacity: 0 }` without that gate, or a script error hides the site.
- **The page prints.** There is a real print stylesheet: it drops to black on
  white and lays the content out as a two page CV. Check it after any layout
  change (Ctrl+P, or the "Print this page" link in the footer).
- **Bump the cache version** in `index.html` after editing CSS or JS:
  `style.css?v=N`, `main.js?v=N`.

## The grid

Everything sits on one 76rem sheet with three columns: an 11rem rail for
section labels and dates, a 40rem column for content, and whatever is left as
margin. The rail is why the eyebrows, the years and the body text all line up
down the whole page. `--rail`, `--measure`, `--sheet` and `--gutter` at the top
of the CSS control it.

## Regenerating the fonts

The fonts are subset and the optical size axis is pinned, which takes them from
396 KB to 190 KB. Needs `python-fonttools` and `brotli`.

```sh
python3 - <<'PY'
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools import subset
UNI = ('U+0020-007E,U+00A0-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,'
       'U+02DC,U+2000-206F,U+20AC,U+2122,U+2190-2193,U+2212,U+FEFF,U+FFFD')
def build(src, out, pins=None):
    f = TTFont(src)
    if pins:
        f = instancer.instantiateVariableFont(f, pins, optimize=True)
    o = subset.Options(); o.flavor = 'woff2'
    o.layout_features = ['*']; o.name_IDs = ['*']
    s = subset.Subsetter(options=o)
    s.populate(unicodes=subset.parse_unicodes(UNI)); s.subset(f)
    f.flavor = 'woff2'; f.save(out)
# Newsreader italic is only ever used at weight 500, so it is pinned flat.
build('Newsreader-italic.woff2', 'fonts/Newsreader-italic-500.woff2', {'opsz': 18, 'wght': 500})
build('Newsreader-normal.woff2', 'fonts/Newsreader-normal-200-800.woff2', {'opsz': 16})
build('Archivo.woff2', 'fonts/Archivo-normal-100-900.woff2')
PY
```

The unicode range covers Latin plus the characters the copy actually uses:
`ã ç ó á`, the arrows in the facts strip, the middle dot, the non-breaking
hyphen and curly quotes. If new copy adds a character outside it, that
character will render in the fallback font.

## Regenerating og.png

Screenshot `build/og.html` at 600 x 315 with a device pixel ratio of 2, which
gives the 1200 x 630 the Open Graph spec wants.
