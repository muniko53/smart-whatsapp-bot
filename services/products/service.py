"""Catalog queries + menu formatting + stock. Extracted from ai_engine.py:100-208,476-501.

Pure DB + string building — no sends, no Flask. Images returned as
[(url, caption)] for the caller (webhook) to send via whatsapp client.
"""
from core.db import fetch_all, execute as db_execute, fetch_one
from services.ai.prompts import CAT_EMOJIS, TYPE_PERSONAS, get_business_type

MAX_IMAGES = 6


def list_grouped(business_id: int) -> dict[str, list[dict]]:
    rows = fetch_all(
        "SELECT * FROM products WHERE business_id=%s ORDER BY category, id",
        (business_id,),
    )
    categories: dict[str, list[dict]] = {}
    for p in rows:
        cat = (p.get("category") or "Our Products").strip().upper() or "OUR PRODUCTS"
        categories.setdefault(cat, []).append(p)
    return categories


def category_menu(business: dict) -> tuple[str | None, list[str]]:
    categories = list_grouped(business["id"])
    if not categories:
        return None, []
    cat_list = list(categories.keys())
    if len(cat_list) == 1:
        return None, cat_list  # single category — caller skips to products
    btype = get_business_type(business)
    intro = TYPE_PERSONAS.get(btype, TYPE_PERSONAS["general"])["catalog_intro"]
    lines = [f"🛍️ *{business['name']}*\n{intro}\n", "Select a category:\n"]
    for i, cat in enumerate(cat_list, 1):
        emoji = CAT_EMOJIS.get(cat, "📦")
        available = sum(1 for p in categories[cat] if p.get("available", 1))
        lines.append(f"{i}️⃣  {emoji} {cat.title()}  _{available} item{'s' if available != 1 else ''}_")
    lines.append("\nType *0* to speak to an agent 👤")
    return "\n".join(lines), cat_list


def products_in_category(business: dict, category_name: str):
    categories = list_grouped(business["id"])
    products = categories.get(category_name, [])
    if not products:
        return None, [], []
    numbered, images, lines = [], [], [f"{CAT_EMOJIS.get(category_name, '📦')} *{category_name.title()}*\n"]
    counter = 1
    for p in products:
        in_stock = p.get("available", 1)
        stock_tag = "" if in_stock else " _(Out of Stock)_"
        photo_tag = " 📷" if (p.get("photo_url") or "").strip() else ""
        desc = f"\n     _{p['description']}_" if p.get("description") else ""
        lines.append(f"{counter}. {p['name']} — *{p['price']}*{photo_tag}{stock_tag}{desc}")
        numbered.append((counter, p))
        if in_stock and (p.get("photo_url") or "").strip():
            caption = f"{p['name']} — {p['price']}"
            if p.get("description"):
                caption += f"\n{p['description']}"
            images.append((p["photo_url"].strip(), caption))
        counter += 1
    lines += ["", "Reply with the *number(s)* to order. Example: *1* or *1, 3*",
              "Type *back* to see categories  |  *0* to speak to an agent"]
    if images:
        lines.append(f"\n📷 {len(images[:MAX_IMAGES])} photo{'s' if len(images) > 1 else ''} sent above.")
    return "\n".join(lines), numbered, images[:MAX_IMAGES]


def full_catalog(business: dict):
    categories = list_grouped(business["id"])
    if not categories:
        return None, [], []
    numbered, images = [], []
    lines = [f"🛍️ *{business['name']}* — Full Catalog\n"]
    counter = 1
    for cat, products in categories.items():
        lines.append(f"\n{CAT_EMOJIS.get(cat, '📦')} *{cat.title()}*")
        for p in products:
            in_stock = p.get("available", 1)
            stock_tag = "" if in_stock else " _(Out of Stock)_"
            photo_tag = " 📷" if (p.get("photo_url") or "").strip() else ""
            desc = f"\n     _{p['description']}_" if p.get("description") else ""
            lines.append(f"  {counter}. {p['name']} — *{p['price']}*{photo_tag}{stock_tag}{desc}")
            numbered.append((counter, p))
            if in_stock and (p.get("photo_url") or "").strip():
                caption = f"{p['name']} — {p['price']}"
                if p.get("description"):
                    caption += f"\n{p['description']}"
                images.append((p["photo_url"].strip(), caption))
            counter += 1
    lines += ["\nReply with the *number(s)* to order.", "Type *0* to speak to an agent 👤"]
    return "\n".join(lines), numbered, images[:MAX_IMAGES]


def build_upsell(business_id: int, cart_names: set[str]) -> str:
    """Suggest up to 3 other available products. From ai_engine:_build_upsell."""
    try:
        lowered = {n.lower() for n in cart_names}
        suggestions = []
        for cat_products in list_grouped(business_id).values():
            for p in cat_products:
                if p.get("available", 1) and p["name"].lower() not in lowered:
                    suggestions.append(p)
                    if len(suggestions) >= 3:
                        break
            if len(suggestions) >= 3:
                break
        if not suggestions:
            return ""
        lines = ["━━━━━━━━━━━━━━━━━━━━", "🎁 *You may also like:*\n"]
        for p in suggestions:
            lines.append(f"• *{p['name']}* — {p['price']}")
        lines.append("\nReply *1* to keep shopping! 🛍️")
        return "\n".join(lines)
    except Exception:
        return ""


LOW_STOCK_THRESHOLD = 5


def decrement_stock(business_id: int, cart: list[dict]) -> list[tuple[str, int]]:
    """Decrement stock_qty per cart item. Returns [(name, new_qty)] at/below threshold."""
    low = []
    for item in cart:
        product = fetch_one(
            "SELECT id, stock_qty FROM products WHERE business_id=%s AND name=%s LIMIT 1",
            (business_id, item["name"]),
        )
        if product and (product.get("stock_qty", -1) if product.get("stock_qty") is not None else -1) >= 0:
            qty = item.get("qty", 1)
            new_qty = max(0, product["stock_qty"] - qty)
            db_execute("UPDATE products SET stock_qty=%s WHERE id=%s",
                       (new_qty, product["id"]))
            if new_qty == 0:
                db_execute("UPDATE products SET available=0 WHERE id=%s",
                           (product["id"],))
            if new_qty <= LOW_STOCK_THRESHOLD:
                low.append((item["name"], new_qty))
    return low
