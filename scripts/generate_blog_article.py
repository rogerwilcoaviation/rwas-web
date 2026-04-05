#!/usr/bin/env python3
"""
generate_blog_article.py
========================
Generates a blog article entry from a Garmin release (press release, memo,
bulletin, product update) and appends it to blog-articles.json.

Usage:
  python3 generate_blog_article.py \
    --category press-release \
    --title "Garmin Announces New GTN Xi Feature Pack" \
    --subtitle "Update adds synthetic vision overlay and vertical nav" \
    --source "Garmin Press Release" \
    --source-url "https://www.garmin.com/en-US/newsroom/..." \
    --lead "Garmin International today announced..." \
    --body "The new feature pack includes..." \
    --body "Operators with existing GTN Xi installations..." \
    --body "Contact RWAS at (605) 299-8178 for scheduling." \
    --tags garmin,gtn-xi,software-update \
    --status draft

Categories: press-release, service-bulletin, product-update, memo, regulatory

Status values:
  draft     - Article generated, awaiting John's approval
  approved  - John approved, ready to publish
  published - Live on the website

After generation, run:
  cd ~/projects/rwas-web && git add blog-articles.json && git commit -m "blog: add <title>" && git push
"""

import json
import os
import sys
import argparse
import re
from datetime import datetime, timezone

REPO_ROOT = os.path.expanduser("~/projects/rwas-web")
JSON_PATH = os.path.join(REPO_ROOT, "public", "blog-articles.json")
PHONE = "(605) 299-8178"

def slugify(text):
    text = text.lower()
    text = re.sub(r'[^a-z0-9\s-]', '', text)
    text = re.sub(r'[\s]+', '-', text)
    text = text.strip('-')
    return text[:60]

def generate_social_posts(title, lead, category, tags):
    """Generate Facebook and Instagram post text."""
    tag_str = ' '.join(['#' + t.replace('-', '').title() for t in tags[:6]])
    base_tags = "#GarminAvionics #RogerWilcoAviation #KYKN #FlyGA"

    cat_labels = {
        'press-release': 'NEWS',
        'service-bulletin': 'SERVICE BULLETIN',
        'product-update': 'UPDATE',
        'memo': 'DEALER UPDATE',
        'regulatory': 'REGULATORY'
    }
    cat_label = cat_labels.get(category, 'NEWS')

    # Facebook — longer, conversational
    fb_text = f"{lead}\n\n"
    fb_text += f"Contact us at {PHONE} to learn more or schedule service.\n\n"
    fb_text += f"{tag_str} {base_tags}"

    # Instagram — shorter, punchy, more hashtags
    # Truncate lead to ~120 chars for IG
    ig_lead = lead[:140].rsplit(' ', 1)[0] + '...' if len(lead) > 140 else lead
    ig_text = f"{ig_lead}\n\n"
    ig_text += f"Authorized Garmin dealer.\n{PHONE} | rogerwilcoaviation.com\n\n"
    ig_text += f"{tag_str} {base_tags} #Avionics #PilotLife #GeneralAviation"

    return {
        "facebook": {"text": fb_text.strip(), "status": "pending"},
        "instagram": {"text": ig_text.strip(), "status": "pending"}
    }

def main():
    parser = argparse.ArgumentParser(description="Generate RWAS blog article from Garmin release")
    parser.add_argument("--category", required=True,
                        choices=["press-release", "service-bulletin", "product-update", "memo", "regulatory"])
    parser.add_argument("--title", required=True)
    parser.add_argument("--subtitle", default="")
    parser.add_argument("--source", default="Garmin")
    parser.add_argument("--source-url", default="")
    parser.add_argument("--lead", required=True, help="Opening paragraph / summary")
    parser.add_argument("--body", action="append", default=[], help="Body paragraphs (repeat for multiple)")
    parser.add_argument("--tags", default="garmin", help="Comma-separated tags")
    parser.add_argument("--status", default="draft", choices=["draft", "approved", "published"])
    parser.add_argument("--byline", default="RWAS Avionics Desk")
    args = parser.parse_args()

    # Load existing JSON
    if os.path.exists(JSON_PATH):
        with open(JSON_PATH, 'r') as f:
            data = json.load(f)
    else:
        data = {"meta": {"last_updated": "", "total_articles": 0,
                         "categories": ["press-release", "service-bulletin", "product-update", "memo", "regulatory"]},
                "articles": []}

    # Generate article ID
    date_str = datetime.now().strftime("%Y-%m-%d")
    article_id = slugify(args.title) + "-" + datetime.now().strftime("%Y%m%d")

    # Check for duplicates
    existing_ids = [a["id"] for a in data["articles"]]
    if article_id in existing_ids:
        print(f"WARNING: Article ID '{article_id}' already exists. Appending counter.")
        counter = 2
        while f"{article_id}-{counter}" in existing_ids:
            counter += 1
        article_id = f"{article_id}-{counter}"

    tags = [t.strip() for t in args.tags.split(",") if t.strip()]
    social = generate_social_posts(args.title, args.lead, args.category, tags)

    now_iso = datetime.now(timezone.utc).isoformat()

    article = {
        "id": article_id,
        "status": args.status,
        "category": args.category,
        "title": args.title,
        "subtitle": args.subtitle,
        "author": "Roger Wilco Aviation Services",
        "byline": args.byline,
        "date": date_str,
        "source": args.source,
        "source_url": args.source_url,
        "lead": args.lead,
        "body": args.body,
        "tags": tags,
        "social": social,
    }

    if args.status == "approved":
        article["approved_at"] = now_iso
    if args.status == "published":
        article["approved_at"] = now_iso
        article["published_at"] = now_iso

    # Prepend to articles list (newest first)
    data["articles"].insert(0, article)
    data["meta"]["total_articles"] = len(data["articles"])
    data["meta"]["last_updated"] = now_iso

    # Write back
    with open(JSON_PATH, 'w') as f:
        json.dump(data, f, indent=2)

    print(f"OK: Article '{article_id}' added as '{args.status}'")
    print(f"    Title: {args.title}")
    print(f"    Category: {args.category}")
    print(f"    Tags: {', '.join(tags)}")
    print(f"    Social posts: Facebook (pending), Instagram (pending)")
    print(f"\nNext steps:")
    if args.status == "draft":
        print(f"  1. Review article at /blog/article.html?id={article_id}")
        print(f"  2. Approve: python3 {__file__} --approve {article_id}")
        print(f"  3. Publish: python3 {__file__} --publish {article_id}")
    elif args.status == "approved":
        print(f"  1. Publish: python3 {__file__} --publish {article_id}")
    else:
        print(f"  1. git add && git commit && git push to deploy")

if __name__ == "__main__":
    # Handle --approve and --publish shortcut commands
    if len(sys.argv) >= 3 and sys.argv[1] in ("--approve", "--publish"):
        target_id = sys.argv[2]
        new_status = "approved" if sys.argv[1] == "--approve" else "published"

        if os.path.exists(JSON_PATH):
            with open(JSON_PATH, 'r') as f:
                data = json.load(f)
        else:
            print("ERROR: blog-articles.json not found")
            sys.exit(1)

        found = False
        now_iso = datetime.now(timezone.utc).isoformat()
        for article in data["articles"]:
            if article["id"] == target_id:
                article["status"] = new_status
                if new_status == "approved":
                    article["approved_at"] = now_iso
                elif new_status == "published":
                    if "approved_at" not in article:
                        article["approved_at"] = now_iso
                    article["published_at"] = now_iso
                found = True
                break

        if not found:
            print(f"ERROR: Article '{target_id}' not found")
            sys.exit(1)

        data["meta"]["last_updated"] = now_iso
        with open(JSON_PATH, 'w') as f:
            json.dump(data, f, indent=2)

        print(f"OK: Article '{target_id}' status changed to '{new_status}'")
        if new_status == "published":
            print("  Don't forget: git add && git commit && git push")
        sys.exit(0)

    main()
