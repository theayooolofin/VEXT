const mobileNavToggle = document.querySelector(".mobile-nav-toggle");
const mobileNav = document.querySelector(".mobile-nav");
const filterButtons = document.querySelectorAll(".filter-button");
const serviceCards = document.querySelectorAll(".service-card[data-audience]");
const packageCards = document.querySelectorAll(".package-card[data-audience]");
const packageGroups = document.querySelectorAll(".package-group");
const faqItems = document.querySelectorAll(".faq-item");
const revealElements = document.querySelectorAll("[data-reveal]");
const scrollProgress = document.querySelector(".scroll-progress");
const parallaxNodes = document.querySelectorAll("[data-parallax-speed]");
const counterNodes = document.querySelectorAll("[data-counter]");
const tiltNodes = document.querySelectorAll("[data-tilt]");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const hasFinePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

const setMobileNavState = (isOpen) => {
    if (!mobileNav || !mobileNavToggle) return;
    mobileNav.classList.toggle("is-open", isOpen);
    mobileNavToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    document.body.classList.toggle("mobile-nav-open", isOpen);
};

const initMobileNav = () => {
    if (!mobileNav || !mobileNavToggle || window.__vextMobileNavBound) return;
    window.__vextMobileNavBound = true;

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

    window.addEventListener("resize", () => {
        if (window.innerWidth > 980) setMobileNavState(false);
    }, { passive: true });
};

const applyServiceFilter = (filter) => {
    const applyToCards = (cards) => {
        cards.forEach((card) => {
            const audience = (card.dataset.audience || "").split(" ");
            const isVisible = filter === "all" || audience.includes(filter);
            card.classList.toggle("is-hidden", !isVisible);
            card.setAttribute("aria-hidden", isVisible ? "false" : "true");
        });
    };

    applyToCards(serviceCards);
    applyToCards(packageCards);

    packageGroups.forEach((group) => {
        const visibleCards = group.querySelectorAll(".package-card:not(.is-hidden)").length;
        const groupVisible = visibleCards > 0 || filter === "all";
        group.classList.toggle("is-hidden", !groupVisible);
        group.setAttribute("aria-hidden", groupVisible ? "false" : "true");
    });
};

const initServiceFilter = () => {
    if (!filterButtons.length || (!serviceCards.length && !packageCards.length)) return;

    filterButtons.forEach((button) => {
        button.addEventListener("click", () => {
            const filter = button.dataset.filter || "all";
            filterButtons.forEach((entry) => {
                const active = entry === button;
                entry.classList.toggle("is-active", active);
                entry.setAttribute("aria-pressed", active ? "true" : "false");
            });
            applyServiceFilter(filter);
        });
    });

    applyServiceFilter("all");
};

const toggleFaqItem = (item, shouldOpen) => {
    const button = item.querySelector(".faq-question");
    const answer = item.querySelector(".faq-answer");
    if (!button || !answer) return;

    item.classList.toggle("is-open", shouldOpen);
    button.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
    answer.style.maxHeight = shouldOpen ? `${answer.scrollHeight}px` : "0px";
};

const initFaqAccordion = () => {
    if (!faqItems.length) return;

    faqItems.forEach((item) => {
        const button = item.querySelector(".faq-question");
        if (!button) return;

        toggleFaqItem(item, false);

        button.addEventListener("click", () => {
            const isOpen = item.classList.contains("is-open");
            toggleFaqItem(item, !isOpen);
        });
    });

    window.addEventListener("resize", () => {
        faqItems.forEach((item) => {
            if (!item.classList.contains("is-open")) return;
            const answer = item.querySelector(".faq-answer");
            if (answer) answer.style.maxHeight = `${answer.scrollHeight}px`;
        });
    }, { passive: true });
};

const initRevealObserver = () => {
    if (!revealElements.length) return;

    if (typeof IntersectionObserver === "undefined" || prefersReducedMotion) {
        revealElements.forEach((element) => element.classList.add("is-visible"));
        return;
    }

    const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add("is-visible");
            obs.unobserve(entry.target);
        });
    }, {
        rootMargin: "0px 0px -4% 0px",
        threshold: 0.08
    });

    revealElements.forEach((element) => observer.observe(element));
};

const initScrollProgress = () => {
    if (!scrollProgress) return;

    const update = () => {
        const scrollTop = window.scrollY || window.pageYOffset;
        const height = document.documentElement.scrollHeight - window.innerHeight;
        const progress = height > 0 ? Math.min(scrollTop / height, 1) : 0;
        scrollProgress.style.transform = `scaleX(${progress})`;
    };

    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update, { passive: true });
    update();
};

const initParallax = () => {
    if (!parallaxNodes.length || prefersReducedMotion) return;

    let targetY = window.scrollY || window.pageYOffset;
    let currentY = targetY;
    let rafId = null;

    const render = () => {
        const disableForSmallScreens = window.matchMedia("(max-width: 980px)").matches;
        if (disableForSmallScreens) {
            parallaxNodes.forEach((node) => {
                node.style.transform = "";
            });
            currentY = targetY;
            rafId = null;
            return;
        }

        currentY += (targetY - currentY) * 0.08;
        parallaxNodes.forEach((node) => {
            const speed = Number.parseFloat(node.dataset.parallaxSpeed || "0");
            node.style.transform = `translate3d(0, ${(currentY * speed * 0.78).toFixed(2)}px, 0)`;
        });

        if (Math.abs(targetY - currentY) > 0.15) {
            rafId = window.requestAnimationFrame(render);
        } else {
            rafId = null;
        }
    };

    const queueRender = () => {
        targetY = window.scrollY || window.pageYOffset;
        if (!rafId) {
            rafId = window.requestAnimationFrame(render);
        }
    };

    window.addEventListener("scroll", queueRender, { passive: true });
    window.addEventListener("resize", queueRender, { passive: true });
    queueRender();
};

const formatCounterValue = (value, decimals) => {
    const rounded = Number.parseFloat(value.toFixed(decimals));
    return decimals > 0 ? rounded.toFixed(decimals) : String(Math.round(rounded));
};

const animateCounter = (node) => {
    const target = Number.parseFloat(node.dataset.counter || "0");
    const decimals = Number.parseInt(node.dataset.decimals || "0", 10);
    const prefix = node.dataset.prefix || "";
    const suffix = node.dataset.suffix || "";
    const duration = 2600;
    const start = performance.now();

    const tick = (now) => {
        const elapsed = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - elapsed, 3);
        const current = target * eased;
        node.textContent = `${prefix}${formatCounterValue(current, decimals)}${suffix}`;
        if (elapsed < 1) requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
};

const initCounters = () => {
    if (!counterNodes.length) return;

    if (typeof IntersectionObserver === "undefined" || prefersReducedMotion) {
        counterNodes.forEach((node) => {
            const target = Number.parseFloat(node.dataset.counter || "0");
            const decimals = Number.parseInt(node.dataset.decimals || "0", 10);
            const prefix = node.dataset.prefix || "";
            const suffix = node.dataset.suffix || "";
            node.textContent = `${prefix}${formatCounterValue(target, decimals)}${suffix}`;
        });
        return;
    }

    const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            animateCounter(entry.target);
            obs.unobserve(entry.target);
        });
    }, {
        threshold: 0.35
    });

    counterNodes.forEach((node) => observer.observe(node));
};

const initTilt = () => {
    if (!tiltNodes.length || prefersReducedMotion || !hasFinePointer) return;

    tiltNodes.forEach((node) => {
        node.style.transition = "transform 0.85s cubic-bezier(0.22, 0.61, 0.36, 1)";

        node.addEventListener("pointermove", (event) => {
            const rect = node.getBoundingClientRect();
            const px = (event.clientX - rect.left) / rect.width;
            const py = (event.clientY - rect.top) / rect.height;
            const rotateY = (px - 0.5) * 4.2;
            const rotateX = (0.5 - py) * 4.2;

            node.style.transform = `perspective(900px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateY(-2px)`;
        });

        node.addEventListener("pointerleave", () => {
            node.style.transform = "perspective(900px) rotateX(0deg) rotateY(0deg) translateY(0)";
        });
    });
};

const initLuxurySurfaceMotion = () => {
    if (prefersReducedMotion) return;

    const floatTargets = document.querySelectorAll(".metric, .luxury-card, .process-item, .faq-item, .matrix-wrap");
    const glowTargets = document.querySelectorAll(".hero-frame, .service-card, .package-card, .cta-shell");

    floatTargets.forEach((element, index) => {
        element.classList.add("luxury-float-soft");
        element.style.animationDelay = `${(index % 8) * 0.9}s`;
    });

    glowTargets.forEach((element, index) => {
        element.classList.add("luxury-glow-soft");
        element.style.animationDelay = `${(index % 7) * 1.1}s`;
    });
};

initMobileNav();
initServiceFilter();
initFaqAccordion();
initRevealObserver();
initScrollProgress();
initParallax();
initCounters();
initTilt();
initLuxurySurfaceMotion();
