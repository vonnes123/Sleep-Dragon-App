const Router = (() => {

    console.log("[Router] script loaded");
    console.log("[Router] current hash:", location.hash);

  const routes = {
    home: "pages/home.html",
    report: "pages/report.html",
    "pet-vitals": "pages/pet-vitals.html",
    profile: "pages/profile.html",
    "remote-control": "pages/remote-control.html",
  };

  let current = null;

async function navigate(page) {
  if (!routes[page]) page = "home";
  if (page === current) return;
  current = page;

  history.replaceState(null, "", `#${page}`);

  const canvas = document.getElementById("petCanvas");
  if (canvas) {
    canvas.style.opacity = "0";
    canvas.style.display = "none";
    document.body.appendChild(canvas);
  }

  const res = await fetch(routes[page]);
  const html = await res.text();
  document.getElementById("view-container").innerHTML = html;

  if (window.PageControllers?.[page]) {
    window.PageControllers[page].init();
  }

  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.page === page);
  });
}

  function init() {
    document.querySelectorAll(".nav-item[data-page]").forEach((btn) => {
      btn.addEventListener("click", () => navigate(btn.dataset.page));
    });

    window.addEventListener("hashchange", () => {
      navigate(location.hash.replace("#", "") || "home");
    });

    navigate(location.hash.replace("#", "") || "home");
  }

  return { init, navigate };
})();
