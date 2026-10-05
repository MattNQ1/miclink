/*
 * MicLink website settings. This is the only file to edit when a link or a version changes.
 *
 * Every value is a string. Leave a value as "" when there is nothing to show yet: the pages
 * are written to look right either way (see website/_tools/README.md for what each state shows).
 */
window.MICLINK_CONFIG = {
  // Direct link to the Windows installer. "" shows "Windows download coming soon" instead.
  WINDOWS_DOWNLOAD_URL: "https://github.com/MattNQ1/miclink/releases/latest/download/MicLinkSetup.exe",

  // The app's App Store page, for example "https://apps.apple.com/app/id0000000000".
  // "" shows "Coming soon to the App Store". When set, the pages show an App Store button
  // and a QR code that opens this link.
  APP_STORE_URL: "",

  // Support address, for example "support@example.com". "" hides the email line.
  SUPPORT_EMAIL: "",

  // Short price line for the iPhone app, shown next to it on the home page and in the setup guide.
  // "" shows no price line. The plans themselves (Free, MicLink Pro Yearly, MicLink Pro Monthly)
  // are written out in the pricing section of index.html: if a price changes, change it there,
  // in the FAQ, in terms.html and here (see website/_tools/README.md, "If the prices change").
  PRICE_TEXT: "Free with ads, or Pro from $2.99/month",

  // Version of the Windows installer, for example "1.0.0". "" shows no version.
  VERSION: "1.0.0",

  // Where people can report a problem. "" hides the link.
  ISSUES_URL: "https://github.com/MattNQ1/miclink/issues"
};
