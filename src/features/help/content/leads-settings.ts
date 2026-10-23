import type { HelpArticle } from "../domain/types";

export const leadsSettingsArticle: HelpArticle = {
  slug: "leads-settings",
  title: "Leads Settings",
  route: "/leads/settings",
  match: "exact",
  summary: "Connect Gmail for portal enquiries, manage portal platforms, and connect your website's enquiry forms.",
  content: `## What this page is for

Leads Settings controls where your leads come from. It is admin-only.

- **Gmail Connection.** Connect the inbox that receives portal enquiry emails (Zoopla, Rightmove). Harbor reads only those emails and turns each one into a lead.
- **Platform Sources.** The portals Harbor recognises in that inbox, by sender domain.
- **Website enquiries.** Connect your own website so its enquiry forms send leads straight here.

## Connecting your website

1. Click **Connect a website** and give it a name, e.g. "Main website". That name appears on every lead the site sends.
2. Harbor creates a key that **can only add leads** and shows it **once**. Copy it before closing the dialog; it is never shown again.
3. Pick the tab that matches your website:
   - **Form plugin / Zapier.** Paste the webhook URL into your form plugin (Elementor, Contact Form 7 add-ons, Webflow, Wix) or a Zapier/Make POST step. No code needed.
   - **Developer API.** Your developer sends each enquiry from the site's server with the key in an Authorization header.
   - **HTML form.** For simple sites, replace the form's opening tag with the one shown. It includes a hidden spam trap and a thank-you redirect.
4. Send a test enquiry. Add a field \`test\` set to \`true\` to check the connection without saving a lead, or submit for real and it appears on the Leads page.

## Managing connected websites

- Each website shows its **Leads received**, **Last lead** and **Last request**. If enquiries stop arriving, check **Last request**: an old date means the website has stopped sending.
- **Disconnect** stops a website's enquiries straight away; leads it already sent are kept. Use it if the key was exposed or the site is retired, then connect the site again for a fresh key.
- Connect each website separately if you have several, so you can tell their enquiries apart and disconnect one without affecting the others.

## Tips

- Name your form fields \`name\`, \`email\`, \`phone\` and \`message\`. Common names like \`your-name\` or \`Email\` are recognised too, and any other field is added to the lead's message.
- An enquiry needs at least a valid email address or phone number; anything else missing is tolerated.
- The same enquiry sent twice (a plugin retrying, or a double click) becomes one lead.
- If Website enquiries doesn't appear here, website lead capture isn't enabled for your agency. Contact Harbor Ops support.`,
};
