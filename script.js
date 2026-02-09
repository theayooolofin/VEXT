const leadForm = document.querySelector(".inquiry-form");
const leadFormStatus = leadForm ? leadForm.querySelector("[data-form-status]") : null;
const leadFormButton = leadForm ? leadForm.querySelector('button[type="submit"]') : null;
const mobileNavToggle = document.querySelector(".mobile-nav-toggle");
const mobileNav = document.querySelector(".mobile-nav");

const setLeadFormStatus = (message, state) => {
    if (!leadFormStatus) return;
    leadFormStatus.textContent = message;
    leadFormStatus.dataset.state = state;
};

const buildMailtoHref = (form, formData) => {
    const recipient = form.dataset.recipient || "partners@vextglobal.com";
    const subjectName = formData.get("name") || "New Prospect";
    const subject = `Strategy Call Request - ${subjectName}`;
    const lines = [
        `Name: ${formData.get("name") || ""}`,
        `Work Email: ${formData.get("email") || ""}`,
        `Business URL: ${formData.get("enterprise_url") || ""}`,
        `Primary Market: ${formData.get("market_focus") || ""}`,
        `Revenue Target: ${formData.get("revenue_target") || ""}`,
        `Source Page: ${window.location.href}`
    ];

    return `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join("\n"))}`;
};

const submitLeadForm = async (form, formData) => {
    const endpoint = (form.dataset.endpoint || "").trim();

    if (!endpoint) {
        window.location.href = buildMailtoHref(form, formData);
        return { mode: "mailto" };
    }

    const response = await fetch(endpoint, {
        method: "POST",
        body: formData,
        headers: {
            Accept: "application/json"
        }
    });

    if (!response.ok) {
        throw new Error("Lead submission request failed.");
    }

    return { mode: "api" };
};

const initLeadForm = () => {
    if (!leadForm) return;

    leadForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        if (!leadForm.checkValidity()) {
            setLeadFormStatus("Complete all required fields before submitting.", "error");
            leadForm.reportValidity();
            return;
        }

        const defaultButtonText = leadFormButton ? leadFormButton.textContent : "";
        if (leadFormButton) {
            leadFormButton.disabled = true;
            leadFormButton.textContent = "SENDING...";
        }

        setLeadFormStatus("Submitting your growth brief...", "loading");

        const formData = new FormData(leadForm);
        formData.set("submitted_at", new Date().toISOString());

        try {
            const result = await submitLeadForm(leadForm, formData);

            if (result.mode === "api") {
                setLeadFormStatus("Request sent. Our team will contact you shortly.", "success");
                leadForm.reset();
            } else {
                setLeadFormStatus("Opening your email client to complete submission.", "success");
            }
        } catch (error) {
            setLeadFormStatus("Submission failed. Try again or email partners@vextglobal.com.", "error");
        } finally {
            if (leadFormButton) {
                leadFormButton.disabled = false;
                leadFormButton.textContent = defaultButtonText;
            }
        }
    });
};

initLeadForm();

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

initMobileNav();

const hasGsap = typeof window.gsap !== "undefined" && typeof window.ScrollTrigger !== "undefined";
const prefersReducedMotionGlobal = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const initFallbackRevealSystem = () => {
    const revealElements = Array.from(document.querySelectorAll("[data-reveal]"));
    if (!revealElements.length) return;

    document.body.classList.add("motion-fallback");

    if (prefersReducedMotionGlobal) {
        revealElements.forEach((element) => element.classList.add("is-visible"));
        return;
    }

    if (typeof window.IntersectionObserver === "undefined") {
        revealElements.forEach((element) => element.classList.add("is-visible"));
        return;
    }

    const observer = new IntersectionObserver(
        (entries, activeObserver) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                entry.target.classList.add("is-visible");
                activeObserver.unobserve(entry.target);
            });
        },
        {
            threshold: 0.16,
            rootMargin: "0px 0px -10% 0px"
        }
    );

    revealElements.forEach((element) => observer.observe(element));
};

if (!hasGsap) {
    document.body.classList.remove("gsap-ready");
    const fallbackHeader = document.querySelector(".site-header");
    if (fallbackHeader) {
        fallbackHeader.style.transform = "translateY(0)";
        fallbackHeader.style.opacity = "1";
    }

    initFallbackRevealSystem();
} else {
    document.body.classList.add("gsap-ready");
    gsap.registerPlugin(ScrollTrigger);

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const hasFinePointer = window.matchMedia("(any-hover: hover) and (any-pointer: fine)").matches
        || window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const isCompactViewport = () => window.matchMedia("(max-width: 980px)").matches;

    const header = document.querySelector(".site-header");
    const hero = document.querySelector(".hero");
    const heroImage = document.querySelector(".hero-bg-image");
    const heroLabel = document.querySelector("[data-hero-label]");
    const heroSub = document.querySelector("[data-hero-sub]");
    const methodSection = document.querySelector(".methodology");
    const spotlight = document.querySelector(".spotlight");
    const intelCurtain = document.querySelector(".intel-curtain");
    const inquiryForm = document.querySelector(".inquiry-form");
    const magneticButton = document.querySelector("[data-magnetic]");
    const footerLine = document.querySelector(".footer-line");
    const cursor = document.querySelector(".liquid-cursor");
    const isHomePage = !!(document.body && document.body.dataset && document.body.dataset.page === "home");

    const splitTextToChars = () => {
        const parts = gsap.utils.toArray("[data-split-line]");
        const chars = [];

        parts.forEach((part) => {
            const text = part.textContent || "";
            const fragment = document.createDocumentFragment();

            [...text].forEach((char) => {
                if (char === " ") {
                    fragment.appendChild(document.createTextNode(" "));
                    return;
                }

                const span = document.createElement("span");
                span.className = "split-char";
                span.textContent = char;
                fragment.appendChild(span);
                chars.push(span);
            });

            part.textContent = "";
            part.appendChild(fragment);
        });

        return chars;
    };

    const initLenis = () => {
        document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
            anchor.addEventListener("click", (event) => {
                const href = anchor.getAttribute("href");
                if (!href || href === "#") return;

                const target = document.querySelector(href);
                if (!target) return;

                event.preventDefault();
                const headerOffset = header ? (header.offsetHeight || 80) : 80;
                const targetTop = window.scrollY + target.getBoundingClientRect().top - headerOffset;

                window.scrollTo({
                    top: Math.max(0, targetTop),
                    behavior: prefersReducedMotion ? "auto" : "smooth"
                });
            });
        });
    };

    const initHeader = () => {
        if (!header) return;

        const setHeaderState = () => {
            header.classList.toggle("is-scrolled", window.scrollY > 16);
        };

        if (prefersReducedMotion) {
            gsap.set(header, { yPercent: 0, opacity: 1 });
        } else {
            gsap.to(header, {
                yPercent: 0,
                opacity: 1,
                duration: 1.85,
                ease: "expo.out"
            });
        }

        window.addEventListener("scroll", setHeaderState, { passive: true });
        setHeaderState();
    };

    const initHero = () => {
        const compactViewport = isCompactViewport();
        const chars = compactViewport ? [] : splitTextToChars();
        const heroLines = gsap.utils.toArray(".hero-title .hero-line");
        const heroCtas = gsap.utils.toArray(".hero-actions .strategic-cta");

        if (prefersReducedMotion) {
            if (chars.length) gsap.set(chars, { opacity: 1, y: 0 });
            gsap.set([heroLabel, heroSub, ...heroLines, ...heroCtas], { opacity: 1, y: 0, filter: "blur(0px)" });
        } else if (compactViewport) {
            gsap.timeline({ defaults: { ease: "power2.out" } })
                .fromTo(
                    heroLabel,
                    { opacity: 0, y: 12 },
                    { opacity: 1, y: 0, duration: 0.85, delay: 0.2 }
                )
                .fromTo(
                    heroLines,
                    { opacity: 0, y: 14, filter: "blur(6px)" },
                    { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.9, stagger: 0.12 },
                    "-=0.45"
                )
                .fromTo(
                    heroSub,
                    { opacity: 0, y: 12 },
                    { opacity: 0.86, y: 0, duration: 0.8 },
                    "-=0.52"
                )
                .fromTo(
                    heroCtas,
                    { opacity: 0, y: 10 },
                    { opacity: 1, y: 0, duration: 0.72, stagger: 0.08 },
                    "-=0.45"
                );
        } else {
            gsap.timeline({ defaults: { ease: "expo.out" } })
                .fromTo(
                    heroLabel,
                    { opacity: 0, y: 20 },
                    { opacity: 1, y: 0, duration: 2.8, delay: 1.4 }
                )
                .to(
                    chars,
                    {
                        opacity: 1,
                        y: 0,
                        duration: 2.4,
                        stagger: 0.075
                    },
                    "-=1.7"
                )
                .fromTo(
                    heroSub,
                    { opacity: 0, y: 18, filter: "blur(10px)" },
                    { opacity: 0.82, y: 0, filter: "blur(0px)", duration: 2.3 },
                    "-=1.65"
                );
        }

        if (hero && heroImage && !prefersReducedMotion && !compactViewport) {
            gsap.to(heroImage, {
                yPercent: 24,
                ease: "none",
                scrollTrigger: {
                    trigger: hero,
                    start: "top top",
                    end: "bottom top",
                    scrub: 5
                }
            });

            gsap.to(".hero-content", {
                y: -12,
                x: 4,
                duration: 22,
                repeat: -1,
                yoyo: true,
                ease: "sine.inOut"
            });

            if (heroCtas.length) {
                gsap.to(heroCtas, {
                    y: -3,
                    duration: 4.8,
                    ease: "sine.inOut",
                    repeat: -1,
                    yoyo: true,
                    stagger: 0.45
                });
            }
        }
    };

    const initHorizontalScale = () => {
        const track = document.querySelector(".horizontal-track");
        const section = document.querySelector(".horizontal-section");
        if (!track || !section) return;

        let horizontalTween = null;

        const mountHorizontalAnimation = () => {
            if (horizontalTween) {
                if (horizontalTween.scrollTrigger) horizontalTween.scrollTrigger.kill();
                horizontalTween.kill();
                horizontalTween = null;
            }

            gsap.set(track, { clearProps: "transform" });

            if (prefersReducedMotion || window.matchMedia("(max-width: 980px)").matches) return;

            const getDistance = () => Math.max(0, track.scrollWidth - window.innerWidth);

            horizontalTween = gsap.to(track, {
                x: () => -getDistance(),
                ease: "none",
                scrollTrigger: {
                    trigger: section,
                    pin: true,
                    scrub: 3.2,
                    start: "top top",
                    end: () => `+=${getDistance()}`,
                    invalidateOnRefresh: true
                }
            });
        };

        mountHorizontalAnimation();
        window.addEventListener("resize", mountHorizontalAnimation, { passive: true });
    };

    const initImageFallbacks = () => {
        const mediaImages = document.querySelectorAll(".hero-bg-image, .slide-image, .intel-image");

        mediaImages.forEach((img) => {
            img.addEventListener("error", () => {
                const parent = img.parentElement;
                img.style.display = "none";
                if (parent) parent.classList.add("image-fallback");
            }, { once: true });
        });
    };

    const initMethodSpotlight = () => {
        if (!methodSection) return;

        const setSpot = (clientX, clientY) => {
            const rect = methodSection.getBoundingClientRect();
            const x = ((clientX - rect.left) / rect.width) * 100;
            const y = ((clientY - rect.top) / rect.height) * 100;

            methodSection.style.setProperty("--spot-x", `${x}%`);
            methodSection.style.setProperty("--spot-y", `${y}%`);
        };

        if (prefersReducedMotion || !hasFinePointer || isCompactViewport()) {
            methodSection.classList.add("method-static");
            methodSection.style.setProperty("--spot-x", "50%");
            methodSection.style.setProperty("--spot-y", "50%");
            if (spotlight) spotlight.style.opacity = "0";
            return;
        }

        methodSection.addEventListener("pointerenter", (event) => {
            if (spotlight) {
                gsap.to(spotlight, {
                    opacity: 1,
                    duration: 1.6,
                    ease: "sine.out",
                    overwrite: true
                });
            }
            setSpot(event.clientX, event.clientY);
        });

        methodSection.addEventListener("pointermove", (event) => {
            setSpot(event.clientX, event.clientY);
        });

        methodSection.addEventListener("pointerleave", () => {
            if (spotlight) {
                gsap.to(spotlight, {
                    opacity: 0,
                    duration: 1.9,
                    ease: "sine.out",
                    overwrite: true
                });
            }
        });
    };

    const initIntelReveal = () => {
        if (!intelCurtain || prefersReducedMotion) return;

        gsap.to(intelCurtain, {
            xPercent: 101,
            duration: 2.8,
            ease: "expo.out",
            scrollTrigger: {
                trigger: ".sector-intel",
                start: "top 80%"
            }
        });
    };

    const initMagneticButton = () => {
        if (!inquiryForm || !magneticButton || prefersReducedMotion || !hasFinePointer) return;

        const reset = () => {
            gsap.to(magneticButton, {
                x: 0,
                y: 0,
                duration: 0.95,
                ease: "power3.out",
                overwrite: true
            });
        };

        inquiryForm.addEventListener("pointermove", (event) => {
            const rect = magneticButton.getBoundingClientRect();
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;
            const dx = event.clientX - cx;
            const dy = event.clientY - cy;
            const distance = Math.hypot(dx, dy);

            if (distance <= 100) {
                gsap.to(magneticButton, {
                    x: dx * 0.32,
                    y: dy * 0.32,
                    duration: 1.35,
                    ease: "elastic.out(1, 0.45)",
                    overwrite: true
                });
                return;
            }

            reset();
        });

        inquiryForm.addEventListener("pointerleave", reset);
    };

    const initLiquidCursor = () => {
        document.body.classList.remove("custom-cursor-active");
        if (!cursor || !hasFinePointer) return;

        // Keep native pointer for reliable desktop interactions.
        gsap.set(cursor, { opacity: 0 });
    };

    const initFooterPulse = () => {
        if (!footerLine || prefersReducedMotion) return;

        gsap.set(footerLine, { opacity: 0.3 });

        gsap.timeline({ repeat: -1, repeatDelay: 8.8 })
            .to(footerLine, {
                opacity: 1,
                duration: 1.7,
                ease: "sine.inOut"
            })
            .to(footerLine, {
                opacity: 0.3,
                duration: 1.7,
                ease: "sine.inOut"
            });
    };

    const initHomeLuxuryColumns = () => {
        if (!isHomePage) return;

        const compactViewport = isCompactViewport();
        const motionScale = compactViewport ? 0.62 : 1;
        const columnSelector = [
            ".proof-item",
            ".logo-grid span",
            ".slide-content",
            ".case-card",
            ".testimonial-card",
            ".intel-media",
            ".intel-copy",
            ".engagement-card",
            ".faq-item",
            ".inquiry-copy",
            ".inquiry-form"
        ].join(", ");

        const columns = gsap.utils.toArray(columnSelector);
        if (!columns.length) return;

        const getColumnProfile = (column, index) => {
            if (column.matches(".proof-item")) {
                return {
                    from: { x: (index % 2 ? -18 : 18) * motionScale, y: 36 * motionScale, scale: 0.95, rotationX: -9, rotationZ: index % 2 ? -1.2 : 1.2 },
                    mediaFrom: { scale: 1.06, filter: "grayscale(0.64) brightness(0.74)" },
                    textFrom: { y: 14 * motionScale },
                    bumpScale: compactViewport ? 1.005 : 1.012,
                    start: compactViewport ? "top 95%" : "top 87%"
                };
            }

            if (column.matches(".logo-grid span")) {
                return {
                    from: { x: (index % 2 ? -52 : 52) * motionScale, y: 10 * motionScale, scale: 0.93, rotationY: index % 2 ? -10 : 10, rotationZ: index % 2 ? -1.5 : 1.5 },
                    mediaFrom: { scale: 1.04, filter: "grayscale(0.58) brightness(0.78)" },
                    textFrom: { y: 10 * motionScale },
                    bumpScale: compactViewport ? 1.004 : 1.009,
                    start: compactViewport ? "top 95%" : "top 88%"
                };
            }

            if (column.matches(".slide-content")) {
                return {
                    from: { x: (index % 2 ? -126 : 126) * motionScale, y: 22 * motionScale, scale: 0.972, rotationY: index % 2 ? -8 : 8, skewX: index % 2 ? -2.5 : 2.5 },
                    mediaFrom: { scale: 1.12, filter: "grayscale(0.72) brightness(0.7)" },
                    textFrom: { y: 16 * motionScale },
                    bumpScale: compactViewport ? 1.004 : 1.008,
                    start: compactViewport ? "top 96%" : "top 82%"
                };
            }

            if (column.matches(".case-card")) {
                return {
                    from: { x: (index % 2 ? -92 : 92) * motionScale, y: 26 * motionScale, scale: 0.968, rotationZ: index % 2 ? -1.8 : 1.8 },
                    mediaFrom: { scale: 1.08, filter: "grayscale(0.68) brightness(0.75)" },
                    textFrom: { y: 14 * motionScale },
                    bumpScale: compactViewport ? 1.005 : 1.01,
                    start: compactViewport ? "top 95%" : "top 84%"
                };
            }

            if (column.matches(".testimonial-card")) {
                return {
                    from: { x: (index % 2 ? -34 : 34) * motionScale, y: 56 * motionScale, scale: 0.972, rotationX: -8 },
                    mediaFrom: { scale: 1.05, filter: "grayscale(0.58) brightness(0.8)" },
                    textFrom: { y: 13 * motionScale },
                    bumpScale: compactViewport ? 1.004 : 1.008,
                    start: compactViewport ? "top 95%" : "top 86%"
                };
            }

            if (column.matches(".intel-media")) {
                return {
                    from: { x: -118 * motionScale, y: 24 * motionScale, scale: 0.975, rotationY: -9 },
                    mediaFrom: { scale: 1.14, filter: "grayscale(0.76) brightness(0.68)" },
                    textFrom: { y: 12 * motionScale },
                    bumpScale: compactViewport ? 1.004 : 1.009,
                    start: compactViewport ? "top 95%" : "top 83%"
                };
            }

            if (column.matches(".intel-copy")) {
                return {
                    from: { x: 108 * motionScale, y: 18 * motionScale, scale: 0.98, rotationY: 7 },
                    mediaFrom: { scale: 1.06, filter: "grayscale(0.62) brightness(0.76)" },
                    textFrom: { y: 13 * motionScale },
                    bumpScale: compactViewport ? 1.004 : 1.008,
                    start: compactViewport ? "top 95%" : "top 84%"
                };
            }

            if (column.matches(".engagement-card")) {
                return {
                    from: { x: (index % 2 ? -40 : 40) * motionScale, y: 50 * motionScale, scale: 0.972, rotationZ: index % 2 ? -1.4 : 1.4 },
                    mediaFrom: { scale: 1.06, filter: "grayscale(0.6) brightness(0.78)" },
                    textFrom: { y: 12 * motionScale },
                    bumpScale: compactViewport ? 1.004 : 1.009,
                    start: compactViewport ? "top 95%" : "top 85%"
                };
            }

            if (column.matches(".faq-item")) {
                return {
                    from: { x: (index % 2 ? -54 : 54) * motionScale, y: 16 * motionScale, scale: 0.976, rotationY: index % 2 ? -6 : 6 },
                    mediaFrom: { scale: 1.04, filter: "grayscale(0.58) brightness(0.82)" },
                    textFrom: { y: 9 * motionScale },
                    bumpScale: compactViewport ? 1.003 : 1.007,
                    start: compactViewport ? "top 96%" : "top 86%"
                };
            }

            if (column.matches(".inquiry-copy")) {
                return {
                    from: { x: -72 * motionScale, y: 30 * motionScale, scale: 0.976, rotationY: -6 },
                    mediaFrom: { scale: 1.06, filter: "grayscale(0.6) brightness(0.78)" },
                    textFrom: { y: 12 * motionScale },
                    bumpScale: compactViewport ? 1.003 : 1.008,
                    start: compactViewport ? "top 95%" : "top 84%"
                };
            }

            if (column.matches(".inquiry-form")) {
                return {
                    from: { x: 72 * motionScale, y: 34 * motionScale, scale: 0.972, rotationY: 6 },
                    mediaFrom: { scale: 1.08, filter: "grayscale(0.62) brightness(0.76)" },
                    textFrom: { y: 11 * motionScale },
                    bumpScale: compactViewport ? 1.004 : 1.009,
                    start: compactViewport ? "top 95%" : "top 84%"
                };
            }

            return {
                from: { y: 30 * motionScale, scale: 0.98 },
                mediaFrom: { scale: 1.06, filter: "grayscale(0.62) brightness(0.78)" },
                textFrom: { y: 10 * motionScale },
                bumpScale: compactViewport ? 1.004 : 1.008,
                start: compactViewport ? "top 95%" : "top 85%"
            };
        };

        columns.forEach((column, index) => {
            column.classList.add("luxury-column");

            const textNodes = Array.from(
                column.querySelectorAll("h2, h3, h4, p, li, summary, label, a, code, strong, span")
            );
            const mediaNodes = Array.from(column.querySelectorAll("img, figure"));
            const profile = getColumnProfile(column, index);

            textNodes.forEach((node) => node.classList.add("luxury-column-text"));
            mediaNodes.forEach((node) => node.classList.add("luxury-column-media"));

            if (prefersReducedMotion) {
                column.classList.add("is-column-visible");
                return;
            }

            gsap.set(column, {
                opacity: 0,
                x: profile.from.x || 0,
                y: profile.from.y || 0,
                scale: profile.from.scale || 0.98,
                rotationX: profile.from.rotationX || 0,
                rotationY: profile.from.rotationY || 0,
                rotationZ: profile.from.rotationZ || 0,
                skewX: profile.from.skewX || 0,
                filter: compactViewport ? "blur(5px)" : "blur(8px)"
            });

            if (textNodes.length) {
                gsap.set(textNodes, {
                    opacity: 0,
                    y: profile.textFrom.y || (compactViewport ? 7 : 11),
                    filter: compactViewport ? "blur(2px)" : "blur(4px)"
                });
            }

            if (mediaNodes.length) {
                gsap.set(mediaNodes, {
                    opacity: 0,
                    scale: profile.mediaFrom.scale || (compactViewport ? 1.02 : 1.05),
                    filter: profile.mediaFrom.filter || "grayscale(0.7) brightness(0.72)"
                });
            }

            const tl = gsap.timeline({
                paused: true,
                defaults: { ease: "expo.inOut" },
                onStart: () => column.classList.add("is-column-visible")
            });

            tl.to(column, {
                opacity: 1,
                x: 0,
                y: 0,
                scale: 1,
                rotationX: 0,
                rotationY: 0,
                rotationZ: 0,
                skewX: 0,
                filter: "blur(0px)",
                duration: compactViewport ? 1.45 : 2.2
            });

            if (mediaNodes.length) {
                tl.to(
                    mediaNodes,
                    {
                        opacity: 1,
                        scale: 1,
                        filter: "grayscale(0.28) brightness(0.88)",
                        duration: compactViewport ? 1.35 : 2.1,
                        stagger: compactViewport ? 0.08 : 0.12
                    },
                    "<0.22"
                );
            }

            if (textNodes.length) {
                tl.to(
                    textNodes,
                    {
                        opacity: 1,
                        y: 0,
                        filter: "blur(0px)",
                        duration: compactViewport ? 1.05 : 1.55,
                        stagger: compactViewport ? 0.026 : 0.034
                    },
                    "<0.18"
                );
            }

            tl.fromTo(
                column,
                { scale: 1 },
                {
                    scale: profile.bumpScale,
                    duration: compactViewport ? 0.95 : 1.35,
                    yoyo: true,
                    repeat: 1,
                    ease: "sine.inOut"
                },
                "-=0.64"
            );

            ScrollTrigger.create({
                trigger: column,
                start: profile.start,
                end: compactViewport ? "bottom 36%" : "bottom 22%",
                toggleActions: "play none none reverse",
                onEnter: () => tl.play(),
                onEnterBack: () => tl.play(),
                onLeaveBack: () => tl.reverse()
            });

            const primaryImage = column.querySelector("img");
            if (primaryImage && !compactViewport) {
                gsap.to(primaryImage, {
                    yPercent: 12,
                    ease: "none",
                    scrollTrigger: {
                        trigger: column,
                        start: "top bottom",
                        end: "bottom top",
                        scrub: 2.4
                    }
                });
            }
        });
    };

    const initLuxurySurfaceMotion = () => {
        if (prefersReducedMotion || isCompactViewport()) return;

        const floatTargets = gsap.utils.toArray(".proof-item, .case-card, .testimonial-card, .engagement-card, .logo-grid span");
        const glowTargets = gsap.utils.toArray(".slide-content, .inquiry-form, .intel-media");

        floatTargets.forEach((element, index) => {
            ScrollTrigger.create({
                trigger: element,
                start: "top 86%",
                once: true,
                onEnter: () => {
                    element.classList.add("luxury-float-soft");
                    element.style.animationDelay = `${(index % 9) * 0.9}s`;
                    element.style.animationDuration = `${18 + (index % 5) * 2.6}s`;
                }
            });
        });

        glowTargets.forEach((element, index) => {
            ScrollTrigger.create({
                trigger: element,
                start: "top 86%",
                once: true,
                onEnter: () => {
                    element.classList.add("luxury-glow-soft");
                    element.style.animationDelay = `${(index % 6) * 1.2}s`;
                    element.style.animationDuration = `${20 + (index % 4) * 3.1}s`;
                }
            });
        });
    };

    const inferDecimalPlaces = (value) => {
        const parts = `${value}`.split(".");
        return parts.length === 2 ? parts[1].length : 0;
    };

    const initProofCounters = () => {
        const counters = gsap.utils.toArray(".proof-value[data-count-to]");
        if (!counters.length) return;

        counters.forEach((element) => {
            const targetValue = Number.parseFloat(element.dataset.countTo || "");
            if (!Number.isFinite(targetValue)) return;

            const parsedDecimals = Number.parseInt(element.dataset.countDecimals || "", 10);
            const decimals = Number.isFinite(parsedDecimals) ? parsedDecimals : inferDecimalPlaces(targetValue);
            const prefix = element.dataset.countPrefix || "";
            const suffix = element.dataset.countSuffix || "";
            const parsedDuration = Number.parseFloat(element.dataset.countDuration || "1.8");
            const duration = Number.isFinite(parsedDuration) ? parsedDuration : 1.8;
            const counterState = { value: 0 };

            const renderValue = (rawValue) => {
                const safeValue = Number.isFinite(rawValue) ? rawValue : 0;
                element.textContent = `${prefix}${safeValue.toFixed(decimals)}${suffix}`;
            };

            if (prefersReducedMotion) {
                renderValue(targetValue);
                return;
            }

            renderValue(0);

            ScrollTrigger.create({
                trigger: element.closest(".proof-item") || element,
                start: "top 85%",
                once: true,
                onEnter: () => {
                    element.classList.add("is-counting");

                    gsap.fromTo(
                        counterState,
                        { value: 0 },
                        {
                            value: targetValue,
                            duration,
                            ease: "power2.out",
                            onUpdate: () => renderValue(counterState.value),
                            onComplete: () => {
                                renderValue(targetValue);
                                element.classList.remove("is-counting");
                            }
                        }
                    );

                    gsap.fromTo(
                        element,
                        { scale: 0.94 },
                        { scale: 1, duration: 0.9, ease: "back.out(2.4)" }
                    );
                }
            });
        });
    };

    const initSectionReveals = () => {
        if (prefersReducedMotion) return;

        const compactViewport = isCompactViewport();
        const start = compactViewport ? "top 94%" : "top 88%";
        const duration = compactViewport ? 1.05 : 1.7;
        const offsetY = compactViewport ? 18 : 28;
        const blur = compactViewport ? "blur(5px)" : "blur(8px)";

        gsap.utils.toArray("[data-reveal]").forEach((element) => {
            if (element.classList.contains("luxury-column") || element.closest(".luxury-column")) return;

            gsap.fromTo(
                element,
                { opacity: 0, y: offsetY, filter: blur },
                {
                    opacity: 1,
                    y: 0,
                    filter: "blur(0px)",
                    duration,
                    ease: "expo.out",
                    scrollTrigger: {
                        trigger: element,
                        start
                    }
                }
            );
        });
    };
    initLenis();
    initHeader();
    initHero();
    initHorizontalScale();
    initImageFallbacks();
    initMethodSpotlight();
    initIntelReveal();
    initMagneticButton();
    initLiquidCursor();
    initFooterPulse();
    initHomeLuxuryColumns();
    initLuxurySurfaceMotion();
    initProofCounters();
    initSectionReveals();

    window.addEventListener("load", () => {
        ScrollTrigger.refresh();
    });
}
