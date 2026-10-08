"""Parse and render a downloaded synthetic PDF with the local PyMuPDF installation."""
import sys
import fitz

with fitz.open(sys.argv[1]) as document:
    assert document.page_count == 1
    page = document[0]
    assert "RWAS SYNTHETIC TEST RECORD - NOT AIRCRAFT DATA" in page.get_text()
    image = page.get_pixmap()
    assert image.width == 612 and image.height == 792
    assert min(image.samples) < 100, "Rendered page must contain visible text"
    image.save(sys.argv[2])
print("PASS downloaded synthetic PDF parses and renders one page with the expected text")
