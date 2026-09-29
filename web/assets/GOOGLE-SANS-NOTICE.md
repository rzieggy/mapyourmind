# Google Sans

Bundled font copyright, read from the supplied font metadata:

Copyright 2025 The Google Sans Project Authors (github.com/googlefonts/googlesans)

The fonts were downloaded from the Google Fonts CSS endpoint supplied by the user. `google-sans-sources.json` lists the exact source URLs and the hashes of those original TTF files.

The bundled `.woff2` files are a modified version under the SIL Open Font License 1.1: each original was subset to Latin, Latin Extended, Vietnamese, Greek, Cyrillic, punctuation, arrows, mathematical and technical symbols, with every OpenType layout feature and name record kept, and converted to WOFF2. Glyph outlines and metrics are unchanged. Text in other scripts falls back to the system font. The command, with fontTools 4.66:

```sh
pyftsubset GoogleSans-<style>-<weight>.ttf \
  --unicodes="U+0000-036F,U+0370-03FF,U+0400-052F,U+1E00-1FFF,U+2000-23FF,U+25A0-27BF,U+2C60-2C7F,U+A720-A7FF,U+AB30-AB6F,U+E000-F8FF,U+FB00-FB06,U+FEFF,U+FFFD" \
  --layout-features='*' --name-IDs='*' --name-languages='*' --notdef-outline --flavor=woff2
```

The font metadata links to https://openfontlicense.org. The accompanying `GOOGLE-SANS-LICENSE.txt` is the complete license file retrieved from the official https://github.com/googlefonts/googlesans repository.
