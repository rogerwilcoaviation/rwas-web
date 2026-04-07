/**
 * RWAS Blog Navigation — Single Source of Truth
 * 
 * ALL blog pages load this file to render the nav bar.
 * To update navigation across all blog pages, edit ONLY this file.
 * Then commit and push — all pages pick it up automatically.
 */
(function() {
  var navLinks = [
    { text: "Home", href: "/" },
    { text: "Ask Jerry", href: "/#ask-jerry" },
    { text: "On Sale", href: "/collections/on-sale" },
    { text: "Garmin", href: "/collections/garmin-avionics" },
    { text: "Papa-Alpha Tools", href: "/collections/rigging-tools" },
    { text: "Financing", href: "/financing" },
    { text: "Shop Capabilities", href: "/shop-capabilities" },
    { text: "Blog Articles", href: "/blog/" },
    { text: "About", href: "/about" }
  ];

  var currentPath = window.location.pathname;

  function renderNav(containerId) {
    var el = document.getElementById(containerId || 'rwas-nav');
    if (!el) return;
    var html = '';
    navLinks.forEach(function(link) {
      var isActive = (link.href === '/blog/' && currentPath.indexOf('/blog') === 0);
      html += '<a' + (isActive ? ' class="active"' : '') + ' href="' + link.href + '">' + link.text + '</a>';
    });
    el.innerHTML = html;
  }

  // Auto-render on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { renderNav(); });
  } else {
    renderNav();
  }

  // Expose for manual use
  window.rwasNav = { links: navLinks, render: renderNav };
})();
