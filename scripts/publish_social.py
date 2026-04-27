#!/usr/bin/env python3
"""
publish_social.py
=================
Manages social media publishing for RWAS blog articles.

Commands:
  python3 publish_social.py --list-pending         List articles with pending social posts
  python3 publish_social.py --preview <article-id>  Show social post previews for approval
  python3 publish_social.py --approve <article-id> <platform>  Mark a social post as approved
  python3 publish_social.py --publish <article-id> <platform>  Publish to platform (requires API keys)

Platforms: facebook, instagram

Facebook Publishing (Graph API):
  Requires FB_PAGE_ID and FB_PAGE_TOKEN environment variables.
  Posts to a Facebook Page as a status update.

Instagram Publishing (Graph API):
  Requires IG_BUSINESS_ACCOUNT_ID and IG_ACCESS_TOKEN environment variables.
  Note: Instagram API requires an image URL for posts. Text-only posts
  can be created as captions on an image. For text-only, you'll need
  to provide a default brand image URL.

Environment variables (set in Jerry's env or .env file):
  FB_PAGE_ID          - Facebook Page ID
  FB_PAGE_TOKEN       - Facebook Page access token (long-lived)
  IG_BUSINESS_ACCOUNT_ID - Instagram Business Account ID
  IG_ACCESS_TOKEN     - Instagram/Facebook access token
  IG_DEFAULT_IMAGE    - URL to default RWAS brand image for IG posts

Setup guide:
  1. Create a Meta Developer App at developers.facebook.com
  2. Add Facebook Login and Instagram Graph API products
  3. Connect your RWAS Facebook Page
  4. Generate a long-lived Page access token
  5. Set env vars in ~/.rwas_social_env and source in Jerry's shell profile
"""

import json
import os
import sys
import urllib.request
import urllib.parse
from datetime import datetime, timezone

REPO_ROOT = os.path.expanduser("~/projects/rwas-web")
JSON_PATH = os.path.join(REPO_ROOT, "public", "blog-articles.json")

def load_data():
    with open(JSON_PATH, 'r') as f:
        return json.load(f)

def save_data(data):
    data["meta"]["last_updated"] = datetime.now(timezone.utc).isoformat()
    with open(JSON_PATH, 'w') as f:
        json.dump(data, f, indent=2)

def list_pending():
    data = load_data()
    pending = []
    for art in data["articles"]:
        social = art.get("social", {})
        for platform, post in social.items():
            if post.get("status") == "pending":
                pending.append((art["id"], art["title"][:50], platform, post["status"]))
    if not pending:
        print("No pending social posts.")
        return
    print(f"{'Article ID':<45} {'Platform':<12} {'Status'}")
    print("-" * 70)
    for aid, title, plat, status in pending:
        print(f"{title:<45} {plat:<12} {status}")

def preview(article_id):
    data = load_data()
    art = next((a for a in data["articles"] if a["id"] == article_id), None)
    if not art:
        print(f"ERROR: Article '{article_id}' not found"); return
    social = art.get("social", {})
    print(f"Article: {art['title']}")
    print(f"Status:  {art['status']}")
    print("=" * 60)
    for platform, post in social.items():
        print(f"\n--- {platform.upper()} [{post['status']}] ---")
        print(post["text"])
        print()

def approve_post(article_id, platform):
    data = load_data()
    art = next((a for a in data["articles"] if a["id"] == article_id), None)
    if not art:
        print(f"ERROR: Article '{article_id}' not found"); return
    if platform not in art.get("social", {}):
        print(f"ERROR: No {platform} post found for this article"); return
    art["social"][platform]["status"] = "approved"
    art["social"][platform]["approved_at"] = datetime.now(timezone.utc).isoformat()
    save_data(data)
    print(f"OK: {platform} post for '{article_id}' approved. Ready to publish.")

def publish_facebook(article_id):
    page_id = os.environ.get("FB_PAGE_ID", "")
    token = os.environ.get("FB_PAGE_TOKEN", "")
    if not page_id or not token:
        print("ERROR: FB_PAGE_ID and FB_PAGE_TOKEN environment variables required.")
        print("Set these in ~/.rwas_social_env")
        return False

    data = load_data()
    art = next((a for a in data["articles"] if a["id"] == article_id), None)
    if not art:
        print(f"ERROR: Article '{article_id}' not found"); return False

    post = art.get("social", {}).get("facebook", {})
    if post.get("status") not in ("approved", "pending"):
        print(f"ERROR: Facebook post status is '{post.get('status')}', expected 'approved'")
        return False

    article_url = f"https://rogerwilcoaviation.com/blog/article.html?id={article_id}"
    message = post["text"] + f"\n\nRead more: {article_url}"
    image_path = art.get("image", "")
    image_url = ""
    if image_path:
        image_url = image_path if image_path.startswith("http://") or image_path.startswith("https://") else f"https://rogerwilcoaviation.com{image_path}"

    try:
        if image_url:
            url = f"https://graph.facebook.com/v19.0/{page_id}/photos"
            params = urllib.parse.urlencode({"url": image_url, "caption": message, "access_token": token}).encode()
            req = urllib.request.Request(url, data=params, method="POST")
            with urllib.request.urlopen(req) as resp:
                result = json.loads(resp.read())
                post_id = result.get("post_id") or result.get("id", "unknown")
        else:
            url = f"https://graph.facebook.com/v19.0/{page_id}/feed"
            params = urllib.parse.urlencode({"message": message, "access_token": token}).encode()
            req = urllib.request.Request(url, data=params, method="POST")
            with urllib.request.urlopen(req) as resp:
                result = json.loads(resp.read())
                post_id = result.get("id", "unknown")

        art["social"]["facebook"]["status"] = "published"
        art["social"]["facebook"]["published_at"] = datetime.now(timezone.utc).isoformat()
        art["social"]["facebook"]["post_id"] = post_id
        save_data(data)
        print(f"OK: Published to Facebook. Post ID: {post_id}")
        return True
    except Exception as e:
        print(f"ERROR: Facebook publish failed: {e}")
        return False

def publish_instagram(article_id):
    account_id = os.environ.get("IG_BUSINESS_ACCOUNT_ID", "")
    token = os.environ.get("IG_ACCESS_TOKEN", "")
    fallback_image_url = os.environ.get("IG_DEFAULT_IMAGE", "")

    if not account_id or not token:
        print("ERROR: IG_BUSINESS_ACCOUNT_ID and IG_ACCESS_TOKEN required.")
        return False

    data = load_data()
    art = next((a for a in data["articles"] if a["id"] == article_id), None)
    if not art:
        print(f"ERROR: Article '{article_id}' not found"); return False

    post = art.get("social", {}).get("instagram", {})
    if post.get("status") not in ("approved", "pending"):
        print(f"ERROR: Instagram post status is '{post.get('status')}', expected 'approved'")
        return False

    article_image = art.get("image", "")
    if article_image:
        image_url = article_image if article_image.startswith(("http://", "https://")) else f"https://www.rogerwilcoaviation.com{article_image}"
    else:
        image_url = fallback_image_url
    if not image_url:
        print("ERROR: Article image or IG_DEFAULT_IMAGE required (URL to image for post).")
        return False

    caption = post["text"]

    # Step 1: Create media container
    create_url = f"https://graph.facebook.com/v19.0/{account_id}/media"
    params = urllib.parse.urlencode({
        "image_url": image_url,
        "caption": caption,
        "access_token": token
    }).encode()

    try:
        req = urllib.request.Request(create_url, data=params, method="POST")
        with urllib.request.urlopen(req) as resp:
            result = json.loads(resp.read())
            container_id = result.get("id")

        # Step 2: Publish the container
        pub_url = f"https://graph.facebook.com/v19.0/{account_id}/media_publish"
        pub_params = urllib.parse.urlencode({
            "creation_id": container_id,
            "access_token": token
        }).encode()
        req2 = urllib.request.Request(pub_url, data=pub_params, method="POST")
        with urllib.request.urlopen(req2) as resp2:
            result2 = json.loads(resp2.read())
            media_id = result2.get("id", "unknown")

        art["social"]["instagram"]["status"] = "published"
        art["social"]["instagram"]["published_at"] = datetime.now(timezone.utc).isoformat()
        art["social"]["instagram"]["media_id"] = media_id
        save_data(data)
        print(f"OK: Published to Instagram. Media ID: {media_id}")
        return True
    except Exception as e:
        print(f"ERROR: Instagram publish failed: {e}")
        return False

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: publish_social.py --list-pending | --preview <id> | --approve <id> <platform> | --publish <id> <platform>")
        sys.exit(1)

    cmd = sys.argv[1]

    if cmd == "--list-pending":
        list_pending()
    elif cmd == "--preview" and len(sys.argv) >= 3:
        preview(sys.argv[2])
    elif cmd == "--approve" and len(sys.argv) >= 4:
        approve_post(sys.argv[2], sys.argv[3])
    elif cmd == "--publish" and len(sys.argv) >= 4:
        platform = sys.argv[3]
        article_id = sys.argv[2]
        if platform == "facebook":
            publish_facebook(article_id)
        elif platform == "instagram":
            publish_instagram(article_id)
        else:
            print(f"ERROR: Unknown platform '{platform}'. Use: facebook, instagram")
    else:
        print("Invalid command. Use --list-pending, --preview, --approve, or --publish")
        sys.exit(1)
