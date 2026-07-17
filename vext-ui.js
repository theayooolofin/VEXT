(() => {
    const main = document.querySelector("main");
    if (!main) return;

    if (!main.id) main.id = "main-content";

    if (!document.querySelector(".skip-link")) {
        const skipLink = document.createElement("a");
        skipLink.className = "skip-link";
        skipLink.href = `#${main.id}`;
        skipLink.textContent = "Skip to main content";
        document.body.prepend(skipLink);
    }

    document.documentElement.classList.add("vext-ui-ready");
})();
