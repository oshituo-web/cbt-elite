export function sanitizeContent(htmlContent) {
    if (typeof htmlContent !== 'string') return htmlContent;
    if (window.DOMPurify) {
        return window.DOMPurify.sanitize(htmlContent, {
            ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'li', 'ol', 'span', 'div', 'sup', 'sub'],
            ALLOWED_ATTR: ['href', 'target', 'class', 'style', 'data-math']
        });
    }
    // Fallback if DOMPurify fails to load: Strip all HTML tags entirely
    return htmlContent.replace(/<[^>]*>?/gm, '');
}
