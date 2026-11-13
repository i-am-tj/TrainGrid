# Branding

The TrainGrid mark is a week grid with a rising diagonal. Its top-right cell is amber: planned
sessions building towards a goal. The header draws it inline (`components/BrandLogo.tsx`), so the
page makes no extra request. The files below are the same drawing.

| File | Use |
| --- | --- |
| `public/brand/traingrid-logo.svg` | Rounded-corner mark, for documents and pages |
| `public/brand/traingrid-logo-square.svg` | Full-bleed square, the source of the PNGs |
| `public/brand/traingrid-logo-google-120.png` | **Google Auth Platform → Branding → App logo** (120 × 120 px PNG, about 1 KB) |
| `public/brand/traingrid-logo-512.png` | Larger square, e.g. a GitHub or Supabase avatar |

The PNGs are full-bleed squares, so they survive whatever rounding or circular crop the consent
screen applies. Colours: `#1c1917` (stone-900), `#fffcf7` (card), `#f59e0b` (amber-500).

## Google consent screen (owner only)

Uploading the logo is console work for the owner. An agent does not change Google Cloud settings.

1. Google Cloud console → **Google Auth Platform** → **Branding**.
2. **App logo**: upload `public/brand/traingrid-logo-google-120.png`. Google asks for a square
   image of 120 × 120 px, 1 MB at most, in PNG, JPEG or BMP.
3. Save.

Google treats a logo as a branding change. For an app published to external users, a logo
generally means the brand must be **verified** before the logo appears on the consent screen.
Until then, users see the app name without a logo. Verification asks for the authorised domain,
the home page and the privacy policy links that the Branding page lists. TrainGrid asks only for
the basic scopes (`openid`, `email`, `profile`), so no sensitive-scope review is involved. Check the
Branding page's current wording before you submit, because Google changes these rules from time
to time.
