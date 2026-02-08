(() => {
    const forms = document.querySelectorAll("[data-mailto-form]");

    const setFormStatus = (node, message, state) => {
        if (!node) return;
        node.textContent = message;
        node.dataset.state = state;
    };

    const buildMailtoHref = (form) => {
        const recipient = form.dataset.recipient || "partners@vextglobal.com";
        const subject = form.dataset.subject || "Website Inquiry";
        const fields = Array.from(form.querySelectorAll("input[name], select[name], textarea[name]"));

        const lines = fields.map((field) => {
            const label = field.dataset.label || field.name;
            if (field.type === "checkbox") {
                return `${label}: ${field.checked ? "Yes" : "No"}`;
            }
            return `${label}: ${field.value || ""}`;
        });

        lines.push(`Source Page: ${window.location.href}`);

        return `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join("\n"))}`;
    };

    forms.forEach((form) => {
        const status = form.querySelector("[data-form-status]");
        const submitButton = form.querySelector('button[type="submit"]');

        form.addEventListener("submit", (event) => {
            event.preventDefault();

            if (!form.checkValidity()) {
                setFormStatus(status, "Complete all required fields before submitting.", "error");
                form.reportValidity();
                return;
            }

            const defaultButtonText = submitButton ? submitButton.textContent : "";
            if (submitButton) {
                submitButton.disabled = true;
                submitButton.textContent = "OPENING EMAIL...";
            }

            setFormStatus(status, "Opening your email client...", "success");
            window.location.href = buildMailtoHref(form);

            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = defaultButtonText;
            }
        });
    });
})();
