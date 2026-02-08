(() => {
    if (!document.querySelector(".luxury-veil")) {
        const veil = document.createElement("div");
        veil.className = "luxury-veil";
        veil.setAttribute("aria-hidden", "true");
        document.body.prepend(veil);
    }

    const headerHost = document.querySelector("[data-site-header]");
    const footerHost = document.querySelector("[data-site-footer]");
    const page = document.body && document.body.dataset ? (document.body.dataset.page || "") : "";
    const isHome = page === "home";

    const navLinks = [
        { label: "HOME", href: "index.html", key: "home" },
        { label: "SERVICES", href: "services.html", key: "services" },
        { label: "PROCESS", href: "process.html", key: "process" },
        { label: "INDUSTRIES", href: "industries.html", key: "industries" },
        { label: "RESULTS", href: isHome ? "#case-studies" : "index.html#case-studies", key: "results" },
        { label: "CONTACT", href: "contact.html", key: "contact" },
        { label: "BLOG", href: "blog.html", key: "blog" },
        { label: "INVESTMENT", href: "investment.html", key: "investment" }
    ];

    const renderNavLinks = () =>
        navLinks
            .map((item) => {
                const current = item.key === page ? ' aria-current="page"' : "";
                return `<a href="${item.href}"${current}>${item.label}</a>`;
            })
            .join("");

    if (headerHost) {
        headerHost.innerHTML = `
            <header class="site-header" id="top">
                <a href="${isHome ? "#top" : "index.html"}" class="logo-link" aria-label="VEXT Global home">
                    <img src="vext-logo.svg" alt="VEXT logo" class="logo-svg">
                </a>
                <nav class="header-nav" aria-label="Primary">
                    ${renderNavLinks()}
                </nav>
                <a class="header-cta" href="book-consultation.html">BOOK CONSULTATION</a>
                <button class="mobile-nav-toggle" type="button" aria-expanded="false" aria-controls="mobile-nav" aria-label="Toggle menu">
                    <span class="mobile-nav-toggle-icon" aria-hidden="true">
                        <span class="mobile-nav-toggle-line"></span>
                        <span class="mobile-nav-toggle-line"></span>
                        <span class="mobile-nav-toggle-line"></span>
                    </span>
                </button>
            </header>
            <nav class="mobile-nav" id="mobile-nav" aria-label="Mobile">
                ${renderNavLinks()}
                <a href="book-consultation.html">BOOK CONSULTATION</a>
            </nav>
        `;
    }

    if (footerHost) {
        footerHost.innerHTML = `
            <footer class="site-footer">
                <div class="footer-grid">
                    <div class="footer-col">
                        <p class="footer-label">OPERATIONS</p>
                        <p class="footer-text">USA / CANADA / GLOBAL</p>
                    </div>
                    <div class="footer-col">
                        <p class="footer-label">DIRECT LINE</p>
                        <p class="footer-text">partners@vextglobal.com</p>
                        <p class="footer-text"><a href="services.html">SERVICES</a> / <a href="process.html">PROCESS</a> / <a href="industries.html">INDUSTRIES</a> / <a href="blog.html">BLOG</a> / <a href="investment.html">INVESTMENT</a> / <a href="book-consultation.html">CONSULTATION</a> / <a href="contact.html">CONTACT</a> / <a href="privacy.html">PRIVACY POLICY</a> / <a href="terms.html">TERMS</a></p>
                    </div>
                    <div class="footer-col">
                        <p class="footer-text">&copy; ${new Date().getFullYear()} VEXT GLOBAL.</p>
                        <p class="footer-text">ALL RIGHTS RESERVED.</p>
                    </div>
                </div>
                <div class="footer-line" aria-hidden="true"></div>
            </footer>
        `;
    }

    const mobileNavToggle = document.querySelector(".mobile-nav-toggle");
    const mobileNav = document.querySelector(".mobile-nav");

    let lockedScrollY = 0;

    const lockBodyScroll = () => {
        if (document.body.style.position === "fixed") return;
        lockedScrollY = window.scrollY || window.pageYOffset || 0;
        document.body.style.position = "fixed";
        document.body.style.top = `-${lockedScrollY}px`;
        document.body.style.left = "0";
        document.body.style.right = "0";
        document.body.style.width = "100%";
    };

    const unlockBodyScroll = () => {
        if (document.body.style.position !== "fixed") return;
        document.body.style.position = "";
        document.body.style.top = "";
        document.body.style.left = "";
        document.body.style.right = "";
        document.body.style.width = "";
        window.scrollTo(0, lockedScrollY);
    };

    const setMobileNavState = (isOpen) => {
        if (!mobileNav || !mobileNavToggle) return;
        mobileNav.classList.toggle("is-open", isOpen);
        mobileNavToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
        mobileNav.setAttribute("aria-hidden", isOpen ? "false" : "true");
        document.body.classList.toggle("mobile-nav-open", isOpen);
        if (isOpen) {
            lockBodyScroll();
        } else {
            unlockBodyScroll();
        }
    };

    const initMobileNav = () => {
        if (!mobileNav || !mobileNavToggle || window.__vextMobileNavBound) return;
        window.__vextMobileNavBound = true;

        setMobileNavState(false);

        mobileNavToggle.addEventListener("click", () => {
            const next = !mobileNav.classList.contains("is-open");
            setMobileNavState(next);
        });

        mobileNav.querySelectorAll("a").forEach((link) => {
            link.addEventListener("click", () => setMobileNavState(false));
        });

        window.addEventListener("keydown", (event) => {
            if (event.key === "Escape") setMobileNavState(false);
        });

        document.addEventListener("click", (event) => {
            if (!mobileNav.classList.contains("is-open")) return;
            const target = event.target;
            if (!(target instanceof Element)) return;
            if (target.closest(".site-header") || target.closest(".mobile-nav")) return;
            setMobileNavState(false);
        });

        window.addEventListener("resize", () => {
            if (window.innerWidth > 980) setMobileNavState(false);
        }, { passive: true });

        window.addEventListener("orientationchange", () => {
            setMobileNavState(false);
        });
    };

    initMobileNav();
})();
