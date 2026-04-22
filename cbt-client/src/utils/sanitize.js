import DOMPurify from 'dompurify';

export function sanitizeContent(htmlContent) {
    if (typeof htmlContent !== 'string') return htmlContent;
    
    return DOMPurify.sanitize(htmlContent, {
        ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'li', 'ol', 'span', 'div', 'sup', 'sub'],
        ALLOWED_ATTR: ['href', 'target', 'class', 'style', 'data-math']
    });
}
