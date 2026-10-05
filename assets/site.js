/*
 * MicLink website behaviour: applies assets/config.js to the page and runs the mobile menu.
 * Every page is complete and readable without this file; it only upgrades what is there.
 */
(function () {
  "use strict";

  var config = window.MICLINK_CONFIG || {};

  function setting(key) {
    var value = config[key];
    return typeof value === "string" ? value.trim() : "";
  }

  function httpsUrl(key) {
    var value = setting(key);
    return /^https:\/\/[^\s"'<>]+$/i.test(value) ? value : "";
  }

  function each(selector, callback) {
    Array.prototype.forEach.call(document.querySelectorAll(selector), callback);
  }

  function element(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  // ---- Windows download ----

  var windowsUrl = httpsUrl("WINDOWS_DOWNLOAD_URL");
  each("a[data-win-download]", function (link) {
    if (windowsUrl) {
      link.href = windowsUrl;
      return;
    }
    var label = element("span", link.className.replace("btn--primary", "btn--disabled"),
      "Windows download coming soon");
    link.parentNode.replaceChild(label, link);
  });
  each("[data-win-inline]", function (link) {
    if (windowsUrl) link.href = windowsUrl;
    else link.replaceWith(document.createTextNode(link.textContent));
  });
  each("[data-win-missing]", function (node) {
    node.hidden = Boolean(windowsUrl);
  });

  var version = setting("VERSION");
  each("[data-version]", function (node) {
    if (!version) return;
    node.textContent = "Version " + version.replace(/^v(?=\d)/i, "");
    node.hidden = false;
  });
  each("[data-version-sep]", function (node) {
    node.hidden = !version;
  });

  // ---- App Store ----

  var storeUrl = httpsUrl("APP_STORE_URL");
  var storeLabel = "Download on the App Store";

  function qrMarkup() {
    if (!window.MicLinkQR) return null;
    return window.MicLinkQR.svg(storeUrl, {
      margin: 3,
      title: "QR code that opens MicLink on the App Store"
    });
  }

  if (storeUrl) {
    // Buttons: the "Coming soon to the App Store" label becomes a real link, styled as an
    // ordinary site button. It is deliberately not a drawn "Download on the App Store" badge:
    // Apple allows only its own badge artwork for that.
    each("[data-appstore-button]", function (placeholder) {
      var link = element("a", "btn btn--ghost", "Get MicLink on the App Store");
      link.href = storeUrl;
      link.rel = "noopener";
      placeholder.parentNode.replaceChild(link, placeholder);
    });

    // Short text mentions inside sentences.
    each("[data-appstore-text]", function (node) {
      var link = element("a", "", node.getAttribute("data-appstore-text") || storeLabel);
      link.href = storeUrl;
      link.rel = "noopener";
      node.textContent = "";
      node.appendChild(link);
    });

    // The box next to the hero button: QR code, hint and link.
    each("[data-appstore-box]", function (box) {
      var media = box.querySelector(".app-box__media");
      var note = box.querySelector(".app-box__note");
      var body = box.querySelector(".app-box__body");
      var qr = qrMarkup();
      if (qr && media) {
        media.insertAdjacentHTML("beforeend", qr);
        box.classList.add("has-qr");
        if (note) note.textContent = "Point your iPhone camera at the code";
      } else if (note) {
        note.hidden = true;
      }
      if (body) {
        var link = element("a", "app-box__link", storeLabel);
        link.href = storeUrl;
        link.rel = "noopener";
        body.insertBefore(link, box.querySelector(".app-box__meta"));
      }
    });

    // Stand-alone QR slots.
    each("[data-appstore-qr]", function (slot) {
      var qr = qrMarkup();
      if (!qr) return;
      slot.innerHTML = qr;
      slot.hidden = false;
    });

    each("[data-appstore-soon]", function (node) {
      node.hidden = true;
    });
    each("[data-appstore-live]", function (node) {
      node.hidden = false;
    });
  }

  // ---- Price, support email, issue tracker ----

  // The pages carry the price line themselves, so it is there without JavaScript too.
  // PRICE_TEXT replaces it; an empty PRICE_TEXT hides it.
  var price = setting("PRICE_TEXT");
  each("[data-price]", function (node) {
    if (!price) {
      node.hidden = true;
      return;
    }
    var prefix = node.getAttribute("data-price") || "";
    var end = node.getAttribute("data-price-end") || "";
    node.textContent = prefix + price + end;
    node.hidden = false;
  });

  var email = setting("SUPPORT_EMAIL");
  var emailIsValid = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(email);
  each("[data-support-email]", function (node) {
    if (!emailIsValid) return;
    var slot = node.querySelector("[data-email-link]") || node;
    var link = element("a", "", email);
    link.href = "mailto:" + email;
    slot.textContent = "";
    slot.appendChild(link);
    node.hidden = false;
  });

  var issuesUrl = httpsUrl("ISSUES_URL");
  each("a[data-issues-link]", function (link) {
    if (issuesUrl) link.href = issuesUrl;
  });
  each("[data-issues-block]", function (node) {
    node.hidden = !issuesUrl;
  });
  var hasContact = Boolean(issuesUrl) || emailIsValid;
  each("[data-contact]", function (node) {
    node.hidden = !hasContact;
  });
  each("[data-no-contact]", function (node) {
    node.hidden = hasContact;
  });

  // ---- Mobile menu ----

  var toggle = document.querySelector(".nav-toggle");
  var nav = document.getElementById("site-nav");
  if (toggle && nav) {
    var setOpen = function (open) {
      nav.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    };
    toggle.addEventListener("click", function () {
      setOpen(toggle.getAttribute("aria-expanded") !== "true");
    });
    nav.addEventListener("click", function (event) {
      if (event.target.closest("a")) setOpen(false);
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
        setOpen(false);
        toggle.focus();
      }
    });
  }

  // ---- Side-scrolling strips: reachable by keyboard only while they actually scroll ----

  function refreshScrollers() {
    each("[data-scroller]", function (strip) {
      if (strip.scrollWidth > strip.clientWidth + 1) strip.setAttribute("tabindex", "0");
      else strip.removeAttribute("tabindex");
    });
  }
  refreshScrollers();
  window.addEventListener("resize", refreshScrollers);

  // ---- Open the answer a link points at (for example faq links from other pages) ----

  function openTarget() {
    if (!location.hash) return;
    var target;
    try {
      target = document.querySelector(location.hash);
    } catch (error) {
      return;
    }
    if (target && target.tagName === "DETAILS") target.open = true;
  }
  openTarget();
  window.addEventListener("hashchange", openTarget);
})();
