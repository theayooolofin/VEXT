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
const techToyCanvas = document.querySelector("[data-tech-toy-canvas]");
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

const initTechToy = () => {
    if (!techToyCanvas) return;

    const ctx = techToyCanvas.getContext("2d");
    const shell = techToyCanvas.closest(".tech-toy-shell");
    if (!ctx || !shell) return;

    let width = 0;
    let height = 0;
    let phase = 0;
    let rafId = 0;
    let running = false;
    let particles = [];

    const createParticles = () => {
        const count = width < 560 ? 20 : 32;
        particles = Array.from({ length: count }, () => ({
            x: Math.random() * width,
            y: Math.random() * height,
            vx: (Math.random() - 0.5) * 0.5,
            vy: (Math.random() - 0.5) * 0.5,
            radius: 1 + Math.random() * 1.8
        }));
    };

    const resizeCanvas = () => {
        const rect = shell.getBoundingClientRect();
        width = Math.max(1, Math.floor(rect.width));
        height = Math.max(1, Math.floor(rect.height));

        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        techToyCanvas.width = Math.floor(width * dpr);
        techToyCanvas.height = Math.floor(height * dpr);
        techToyCanvas.style.width = `${width}px`;
        techToyCanvas.style.height = `${height}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        createParticles();
    };

    const drawCore = (advanceMotion) => {
        if (!width || !height) return;

        if (advanceMotion) phase += 0.016;

        ctx.clearRect(0, 0, width, height);

        const background = ctx.createLinearGradient(0, 0, 0, height);
        background.addColorStop(0, "rgba(2, 13, 11, 0.9)");
        background.addColorStop(1, "rgba(1, 6, 6, 0.9)");
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, width, height);

        const pulse = (Math.sin(phase * 1.9) + 1) * 0.5;
        const sweepY = ((phase * 160) % (height + 80)) - 40;

        const sweep = ctx.createLinearGradient(0, sweepY - 20, 0, sweepY + 20);
        sweep.addColorStop(0, "rgba(53, 201, 150, 0)");
        sweep.addColorStop(0.5, `rgba(53, 201, 150, ${0.16 + pulse * 0.15})`);
        sweep.addColorStop(1, "rgba(53, 201, 150, 0)");
        ctx.fillStyle = sweep;
        ctx.fillRect(0, sweepY - 20, width, 40);

        const cx = width * 0.5;
        const cy = height * 0.52;
        const ringRadius = Math.min(width, height) * 0.2 + pulse * 8;

        ctx.strokeStyle = `rgba(53, 201, 150, ${0.2 + pulse * 0.3})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, ringRadius, 0, Math.PI * 2);
        ctx.stroke();

        for (let i = 0; i < particles.length; i += 1) {
            const particle = particles[i];

            if (advanceMotion) {
                particle.x += particle.vx;
                particle.y += particle.vy;

                if (particle.x < 0 || particle.x > width) particle.vx *= -1;
                if (particle.y < 0 || particle.y > height) particle.vy *= -1;
            }

            for (let j = i + 1; j < particles.length; j += 1) {
                const other = particles[j];
                const dx = particle.x - other.x;
                const dy = particle.y - other.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance > 122) continue;

                const alpha = (1 - (distance / 122)) * 0.34;
                ctx.strokeStyle = `rgba(53, 201, 150, ${alpha})`;
                ctx.beginPath();
                ctx.moveTo(particle.x, particle.y);
                ctx.lineTo(other.x, other.y);
                ctx.stroke();
            }
        }

        particles.forEach((particle) => {
            const glow = ctx.createRadialGradient(
                particle.x,
                particle.y,
                0,
                particle.x,
                particle.y,
                particle.radius * 3.5
            );
            glow.addColorStop(0, "rgba(53, 201, 150, 0.88)");
            glow.addColorStop(1, "rgba(53, 201, 150, 0)");

            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(particle.x, particle.y, particle.radius * 3.5, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = "rgba(173, 255, 231, 0.9)";
            ctx.beginPath();
            ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
            ctx.fill();
        });

        const crossSize = 26 + pulse * 5;
        ctx.strokeStyle = "rgba(53, 201, 150, 0.33)";
        ctx.beginPath();
        ctx.moveTo(cx - crossSize, cy);
        ctx.lineTo(cx + crossSize, cy);
        ctx.moveTo(cx, cy - crossSize);
        ctx.lineTo(cx, cy + crossSize);
        ctx.stroke();
    };

    const frame = () => {
        if (!running) return;
        drawCore(true);
        rafId = window.requestAnimationFrame(frame);
    };

    const start = () => {
        if (running || prefersReducedMotion) return;
        running = true;
        rafId = window.requestAnimationFrame(frame);
    };

    const stop = () => {
        running = false;
        if (rafId) {
            window.cancelAnimationFrame(rafId);
            rafId = 0;
        }
    };

    resizeCanvas();

    if (prefersReducedMotion) {
        drawCore(false);
        return;
    }

    if (typeof IntersectionObserver !== "undefined") {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    start();
                } else {
                    stop();
                }
            });
        }, {
            threshold: 0.12
        });
        observer.observe(shell);
    } else {
        start();
    }

    document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
            stop();
            return;
        }
        if (shell.getBoundingClientRect().bottom > 0) {
            start();
        }
    });

    window.addEventListener("resize", () => {
        resizeCanvas();
        if (!running) drawCore(false);
    }, { passive: true });
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
initTechToy();
initLuxurySurfaceMotion();
