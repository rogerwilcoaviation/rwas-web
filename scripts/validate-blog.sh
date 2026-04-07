#!/bin/bash
# RWAS Blog Deployment Validator
# Run after ANY change to blog files. Exits non-zero on failure.
cd ~/projects/rwas-web
FAIL=0

echo "=== RWAS Blog Deployment Validator ==="

# 1. File existence
for f in public/blog/index.html public/blog/article.html public/blog-articles.json public/js/blog-nav.js public/jerry-widget.js; do
  if [ ! -f "$f" ]; then
    echo "FAIL: Missing $f"
    FAIL=1
  else
    echo "OK: $f exists ($(wc -l < "$f") lines)"
  fi
done

# 2. Minimum file sizes (prevent truncated deploys)
INDEX_LINES=$(wc -l < public/blog/index.html)
ARTICLE_LINES=$(wc -l < public/blog/article.html)
if [ "$INDEX_LINES" -lt 350 ]; then
  echo "FAIL: blog/index.html too short ($INDEX_LINES lines, expect 350+)"
  FAIL=1
fi
if [ "$ARTICLE_LINES" -lt 280 ]; then
  echo "FAIL: blog/article.html too short ($ARTICLE_LINES lines, expect 280+)"
  FAIL=1
fi

# 3. Jerry widget included
for f in public/blog/index.html public/blog/article.html; do
  if ! grep -q "jerry-widget.js" "$f"; then
    echo "FAIL: $f missing jerry-widget.js script tag"
    FAIL=1
  else
    echo "OK: $f has jerry-widget.js"
  fi
done

# 4. Blog nav.js included
for f in public/blog/index.html public/blog/article.html; do
  if ! grep -q "blog-nav.js" "$f"; then
    echo "FAIL: $f missing blog-nav.js script tag"
    FAIL=1
  else
    echo "OK: $f has blog-nav.js"
  fi
done

# 5. No stale Shopify-style nav links (these should never appear)
for f in public/blog/index.html public/blog/article.html; do
  if grep -q "/pages/shop-capabilities\|/pages/financing\|/pages/contact\|/collections/aircraft-management" "$f"; then
    echo "FAIL: $f has stale Shopify nav links"
    FAIL=1
  else
    echo "OK: $f has no stale nav links"
  fi
done

# 6. Lightbox present
for f in public/blog/index.html public/blog/article.html; do
  if ! grep -q "lightbox" "$f"; then
    echo "FAIL: $f missing lightbox"
    FAIL=1
  else
    echo "OK: $f has lightbox"
  fi
done

# 7. Valid blog-articles.json
ARTICLE_COUNT=$(python3 -c "import json; d=json.load(open('public/blog-articles.json')); print(len(d.get('articles',[])))" 2>/dev/null)
if [ -z "$ARTICLE_COUNT" ] || [ "$ARTICLE_COUNT" -lt 1 ]; then
  echo "FAIL: blog-articles.json invalid or empty"
  FAIL=1
else
  echo "OK: blog-articles.json has $ARTICLE_COUNT articles"
fi

# 8. Nav config correct in blog-nav.js
for route in "/collections/on-sale" "/collections/garmin-avionics" "/collections/rigging-tools" "/financing" "/shop-capabilities" "/about"; do
  if ! grep -q "$route" public/js/blog-nav.js; then
    echo "FAIL: blog-nav.js missing route $route"
    FAIL=1
  fi
done
echo "OK: blog-nav.js routes validated"

# 9. Watermark background present
for f in public/blog/index.html public/blog/article.html; do
  if ! grep -q "enr_h05" "$f"; then
    echo "FAIL: $f missing watermark background"
    FAIL=1
  else
    echo "OK: $f has watermark"
  fi
done

echo ""
if [ "$FAIL" -eq 0 ]; then
  echo "=== ALL CHECKS PASSED ==="
else
  echo "=== VALIDATION FAILED ==="
  exit 1
fi
