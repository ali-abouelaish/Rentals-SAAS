import type { HelpArticle } from "../domain/types";

export const roomEnhancerArticle: HelpArticle = {
  slug: "room-enhancer",
  title: "Room Enhancer",
  route: "/room-enhancer",
  match: "prefix",
  summary: "Improve or generate room photos with AI for your listings.",
  content: `## What this page is for

Room Enhancer uses AI to improve listing photography — refresh an existing room image or generate new room concepts — without changing the room's layout.

## Key tasks

1. **Pick a mode.** **Edit** improves an uploaded photo; **Generate** creates new room images from a prompt.
2. **Upload your photo (Edit).** Add one or more source images (PNG/JPEG/WebP, under 10 MB each).
3. **Use a quick prompt.** Tap a preset — *Improve Bedding*, *Enhance Photo Quality*, *Upgrade Furniture*, or *Refresh Decor & Styling* — or write your own. These are tuned to preserve the room's layout and proportions.
4. **Mask specific areas (optional).** With a single image, open the **Brush Mask Editor**, paint the area to change, and **Save Mask** so the AI only edits there.
5. **Run and reuse.** Click **Run Room Enhancer**; from the results you can **Download**, **Set as room reference** (to guide future edits), or reload from your **Edit history**.

## Tips

- Choose how many images to generate (1–4) per run.
- Edit history is stored per user in your browser, so it's specific to this device.
- The presets intentionally avoid altering walls, floors, and furniture placement — good for honest listing photos.`,
};
