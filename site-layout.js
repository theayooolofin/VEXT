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
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

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

    const optimizeUnsplashUrl = (rawUrl, width, quality) => {
        try {
            const url = new URL(rawUrl, window.location.href);
            if (!/images\.unsplash\.com$/i.test(url.hostname)) return rawUrl;

            if (Number.isFinite(width) && width > 0) {
                url.searchParams.set("w", String(Math.round(width)));
            }

            if (Number.isFinite(quality) && quality > 0) {
                url.searchParams.set("q", String(Math.round(quality)));
            }

            if (!url.searchParams.has("auto")) {
                url.searchParams.set("auto", "format");
            }

            if (!url.searchParams.has("fit")) {
                url.searchParams.set("fit", "crop");
            }

            return url.toString();
        } catch {
            return rawUrl;
        }
    };

    const optimizeUnsplashSrcset = (srcset, maxWidth, quality) => {
        const entries = srcset
            .split(",")
            .map((entry) => entry.trim())
            .filter(Boolean);

        if (!entries.length) return srcset;

        const optimized = entries
            .map((entry) => {
                const widthMatch = entry.match(/\s+(\d+)w$/i);
                if (!widthMatch) return null;
                const width = Number.parseInt(widthMatch[1], 10);
                if (!Number.isFinite(width) || width <= 0 || width > maxWidth) return null;

                const source = entry.slice(0, widthMatch.index).trim();
                return `${optimizeUnsplashUrl(source, width, quality)} ${width}w`;
            })
            .filter(Boolean);

        if (optimized.length) return optimized.join(", ");

        const fallback = entries
            .map((entry) => {
                const widthMatch = entry.match(/\s+(\d+)w$/i);
                if (!widthMatch) return null;
                return {
                    source: entry.slice(0, widthMatch.index).trim(),
                    width: Number.parseInt(widthMatch[1], 10)
                };
            })
            .filter((entry) => entry && Number.isFinite(entry.width))
            .sort((a, b) => a.width - b.width)[0];

        if (!fallback) return srcset;
        const fallbackWidth = Math.min(fallback.width, maxWidth);
        return `${optimizeUnsplashUrl(fallback.source, fallbackWidth, quality)} ${fallbackWidth}w`;
    };

    const initAdaptiveImageDelivery = () => {
        const images = document.querySelectorAll('main img[src*="images.unsplash.com"], main img[srcset*="images.unsplash.com"]');
        if (!images.length) return;

        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        const constrainedNetwork = Boolean(
            connection && (connection.saveData || /(^|[^a-z])(2g|3g)([^a-z]|$)/i.test(connection.effectiveType || ""))
        );
        const compactViewport = window.matchMedia("(max-width: 980px)").matches;
        const maxWidth = constrainedNetwork ? 900 : (compactViewport ? 1200 : 1600);
        const quality = constrainedNetwork ? 52 : (compactViewport ? 62 : 70);

        images.forEach((image) => {
            if (!(image instanceof HTMLImageElement)) return;
            if (image.dataset.optimizedImage === "true") return;

            const srcset = image.getAttribute("srcset");
            if (srcset) {
                image.setAttribute("srcset", optimizeUnsplashSrcset(srcset, maxWidth, quality));
            }

            const source = image.getAttribute("src");
            if (source) {
                const intrinsicWidth = Number.parseInt(image.getAttribute("width") || "", 10);
                const targetWidth = Number.isFinite(intrinsicWidth) && intrinsicWidth > 0
                    ? Math.min(intrinsicWidth, maxWidth)
                    : maxWidth;
                image.setAttribute("src", optimizeUnsplashUrl(source, targetWidth, quality));
            }

            if (!image.hasAttribute("decoding")) {
                image.setAttribute("decoding", "async");
            }

            if (!image.hasAttribute("sizes")) {
                const isDenseCardMedia = Boolean(image.closest(".service-media, .package-media, .luxury-card, .process-visual, .feature-image, .article-image"));
                image.setAttribute("sizes", compactViewport ? "100vw" : (isDenseCardMedia ? "52vw" : "72vw"));
            }

            const highPriority = image.getAttribute("fetchpriority") === "high";
            if (!highPriority && !image.hasAttribute("loading")) {
                image.setAttribute("loading", "lazy");
            }

            if (constrainedNetwork && highPriority) {
                image.setAttribute("fetchpriority", "auto");
            }

            image.dataset.optimizedImage = "true";
        });
    };

    const initContentReveal = () => {
        if (isHome) return;

        const selector = [
            "main h1",
            "main h2",
            "main h3",
            "main h4",
            "main p",
            "main li",
            "main label",
            "main a",
            "main button",
            "main summary"
        ].join(", ");

        const nodes = Array.from(document.querySelectorAll(selector)).filter((node) => {
            if (!(node instanceof HTMLElement)) return false;
            if (node.matches("[data-reveal], .content-reveal")) return false;
            if (node.closest("[data-reveal]")) return false;
            if (node.closest(".mobile-nav")) return false;
            if (node.getAttribute("aria-hidden") === "true") return false;
            return true;
        });

        if (!nodes.length) return;

        const groupStep = new Map();
        nodes.forEach((node) => {
            const group = node.closest("section, article, .panel, .tier-card, .note-card, .info-panel, .form-panel, .service-card, .package-card, .faq-item, .process-item") || node.parentElement;
            const order = groupStep.get(group) || 0;
            node.classList.add("content-reveal");
            node.style.setProperty("--content-reveal-delay", `${Math.min(order * 55, 330)}ms`);
            groupStep.set(group, order + 1);
        });

        if (prefersReducedMotion.matches || typeof IntersectionObserver === "undefined") {
            nodes.forEach((node) => node.classList.add("is-visible"));
            return;
        }

        const observer = new IntersectionObserver((entries, obs) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                entry.target.classList.add("is-visible");
                obs.unobserve(entry.target);
            });
        }, {
            rootMargin: "0px 0px -8% 0px",
            threshold: 0.12
        });

        nodes.forEach((node) => observer.observe(node));
    };

    initMobileNav();
    initAdaptiveImageDelivery();
    initContentReveal();

    let imageResizeTimer;
    window.addEventListener("resize", () => {
        window.clearTimeout(imageResizeTimer);
        imageResizeTimer = window.setTimeout(() => {
            document.querySelectorAll('main img[data-optimized-image="true"]').forEach((image) => {
                image.removeAttribute("data-optimized-image");
            });
            initAdaptiveImageDelivery();
        }, 180);
    }, { passive: true });
})();
