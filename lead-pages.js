(() => {
    const forms = document.querySelectorAll("[data-mailto-form]");

    const setFormStatus = (node, message, state) => {
        if (!node) return;
        node.textContent = message;
        node.dataset.state = state;
    };

    const buildMailtoHref = (form, formData) => {
        const recipient = form.dataset.recipient || "partners@vextglobal.com";
        const subject = form.dataset.subject || "Website Inquiry";
        const fields = Array.from(form.querySelectorAll("input[name], select[name], textarea[name]:not([name='source_page'])"));

        const lines = fields.map((field) => {
            const name = field.name;
            if (!name) return null;
            const label = field.dataset.label || name;

            if (field.type === "checkbox") {
                return `${label}: ${field.checked ? "Yes" : "No"}`;
            }

            return `${label}: ${formData.get(name) || ""}`;
        });

        lines.push(`Source Page: ${window.location.href}`);
        return `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.filter(Boolean).join("\n"))}`;
    };

    const extractSubmissionError = async (response) => {
        const fallback = `Request failed (${response.status}).`;

        try {
            const contentType = response.headers.get("content-type") || "";

            if (contentType.includes("application/json")) {
                const payload = await response.json();
                if (payload && typeof payload.detail === "string" && payload.detail.trim()) return payload.detail.trim();
                if (payload && typeof payload.message === "string" && payload.message.trim()) return payload.message.trim();
                if (payload && typeof payload.error === "string" && payload.error.trim()) return payload.error.trim();
                return fallback;
            }

            const text = (await response.text() || "").trim();
            if (!text) return fallback;
            return text.slice(0, 180);
        } catch {
            return fallback;
        }
    };

    const buildSerializablePayload = (formData) => {
        const payload = {};

        formData.forEach((value, key) => {
            if (typeof value !== "string") return;

            if (Object.prototype.hasOwnProperty.call(payload, key)) {
                const current = payload[key];
                if (Array.isArray(current)) {
                    current.push(value);
                } else {
                    payload[key] = [current, value];
                }
                return;
            }

            payload[key] = value;
        });

        return payload;
    };

    const payloadToUrlEncoded = (payload) => {
        const params = new URLSearchParams();

        Object.entries(payload).forEach(([key, value]) => {
            if (Array.isArray(value)) {
                value.forEach((entry) => params.append(key, entry));
                return;
            }

            params.append(key, value);
        });

        return params.toString();
    };

    const submitForm = async (form, formData) => {
        const endpoint = (form.dataset.endpoint || "").trim();

        if (!endpoint) {
            window.location.href = buildMailtoHref(form, formData);
            return { mode: "mailto" };
        }

        const payload = buildSerializablePayload(formData);
        const urlEncodedPayload = payloadToUrlEncoded(payload);
        const attempts = [
            {
                name: "form-data",
                init: {
                    method: "POST",
                    body: formData,
                    headers: { Accept: "application/json" }
                }
            },
            {
                name: "json",
                init: {
                    method: "POST",
                    body: JSON.stringify(payload),
                    headers: {
                        Accept: "application/json",
                        "Content-Type": "application/json"
                    }
                }
            },
            {
                name: "url-encoded",
                init: {
                    method: "POST",
                    body: urlEncodedPayload,
                    headers: {
                        Accept: "application/json",
                        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
                    }
                }
            }
        ];

        let lastError = "";

        for (const attempt of attempts) {
            try {
                const response = await fetch(endpoint, attempt.init);
                if (response.ok) {
                    return { mode: "api", transport: attempt.name };
                }

                lastError = await extractSubmissionError(response);
            } catch (error) {
                lastError = error instanceof Error && error.message
                    ? error.message
                    : `Request failed during ${attempt.name} submission.`;
            }
        }

        throw new Error(lastError || "Lead submission failed.");
    };

    forms.forEach((form) => {
        const status = form.querySelector("[data-form-status]");
        const submitButton = form.querySelector('button[type="submit"]');

        form.addEventListener("submit", async (event) => {
            event.preventDefault();

            if (!form.checkValidity()) {
                setFormStatus(status, "Complete all required fields before submitting.", "error");
                form.reportValidity();
                return;
            }

            const defaultButtonText = submitButton ? submitButton.textContent : "";

            if (submitButton) {
                submitButton.disabled = true;
                submitButton.textContent = "SENDING...";
            }

            const formData = new FormData(form);
            formData.set("submitted_at", new Date().toISOString());
            formData.set("source_page", window.location.href);

            try {
                const result = await submitForm(form, formData);

                if (result.mode === "api") {
                    setFormStatus(status, "Request sent. We will contact you soon.", "success");
                    form.reset();
                } else {
                    setFormStatus(status, "Opening your email client to finish submission.", "success");
                }
            } catch (error) {
                setFormStatus(status, "Direct submission failed. Opening your email client...", "loading");

                try {
                    window.location.href = buildMailtoHref(form, formData);
                    setFormStatus(status, "Opening your email client to finish submission.", "success");
                } catch {
                    const message = error instanceof Error && error.message
                        ? `Submission failed: ${error.message}`
                        : "Submission failed. Please retry or email partners@vextglobal.com.";
                    setFormStatus(status, message, "error");
                }
            } finally {
                if (submitButton) {
                    submitButton.disabled = false;
                    submitButton.textContent = defaultButtonText;
                }
            }
        });
    });
})();
