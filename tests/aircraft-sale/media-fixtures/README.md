These fixtures contain no real aircraft or customer data.

- `synthetic.png`: decodable 1 × 1 PNG.
- `synthetic.mp4`: two-second, 320 × 180 navy H.264 video, generated locally with `ffmpeg -f lavfi -i color=c=navy:s=320x180:d=2 -c:v libx264 -pix_fmt yuv420p -movflags +faststart -an synthetic.mp4`.
- `synthetic.pdf`: valid one-page PDF with Helvetica text reading “RWAS SYNTHETIC TEST RECORD - NOT AIRCRAFT DATA”; includes an object table, cross-reference table and trailer.

The full-shell browser test uploads these through the real built seller interface, checks photo decoding and video metadata/playback/seeking, and downloads the private PDF through the reviewer interface. `pdf-verify.py` uses the locally installed PyMuPDF (`fitz`) to parse and render that download; `PDF_VERIFY_PYTHON` can select another Python environment with PyMuPDF. Missing parser support is a test prerequisite failure, not a media pass.

Signature-only fixtures in `fixture.mjs` remain useful for backend route/security tests and do not establish decoding or playback.
