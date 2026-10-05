# MicLink

**Use your iPhone as a microphone for your Windows PC**, over a USB cable or Wi-Fi.

- **Website:** https://mattnq1.github.io/miclink/
- **Download for Windows:** [MicLinkSetup.exe](https://github.com/MattNQ1/miclink/releases/latest/download/MicLinkSetup.exe) (Windows 10 and 11, 64-bit)
- **iPhone app:** coming soon to the App Store (iOS 17 or later)

## What the installer does

`MicLinkSetup.exe` installs the MicLink app and sets up what it needs:

- the virtual microphone, **VB-CABLE** (a product of VB-Audio Software, downloaded from VB-Audio during setup; VB-CABLE is a donationware, all participations are welcome: https://www.vb-cable.com), and
- Apple's USB support for cable mode (installed through Windows Package Manager).

Afterwards, choose **CABLE Output (VB-Audio Virtual Cable)** as the microphone in Discord, Zoom, OBS or Windows Sound settings.

The installer is not code-signed yet, so Windows SmartScreen may show a warning: click **More info**, then **Run anyway**. You can check the file against the SHA-256 published with each release.

## Help

Setup guide and FAQ: https://mattnq1.github.io/miclink/setup.html
Problems or questions: open an issue in this repository.

---

MicLink is not affiliated with Apple, Microsoft or VB-Audio. Their names are trademarks of their respective owners.
