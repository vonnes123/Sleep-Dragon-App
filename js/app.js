window.PageControllers = {
  report: {
    init() {
      const tabs = document.querySelectorAll(".report-tab");
      const view = document.getElementById("report-view");

      async function loadTab(tab) {
        tabs.forEach((t) =>
          t.classList.toggle("active", t.dataset.tab === tab),
        );
        const res = await fetch(`pages/report-${tab}.html`);
        view.innerHTML = await res.text();
      }

      tabs.forEach((t) =>
        t.addEventListener("click", () => loadTab(t.dataset.tab)),
      );
      loadTab("today");
    },
  },
};

document.addEventListener("DOMContentLoaded", async () => {
  await DataLoader.init();
  console.log("Total records loaded:", DataLoader.getAll().length);
  console.log("Last 3 nights:", DataLoader.getLast(3));
  Router.init();
});
