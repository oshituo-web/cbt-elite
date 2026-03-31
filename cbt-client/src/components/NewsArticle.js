export const NewsArticleComponent = {
  containerId: 'news-article-container',

  render(article, onBack) {
    let container = document.getElementById(this.containerId)
    if (!container) {
      container = document.createElement('div')
      container.id = this.containerId
      container.className = 'fade-in'
      container.style.maxWidth = '800px'
      container.style.margin = '0 auto'
      container.style.padding = '0 1rem 2rem 1rem'
      document.body.appendChild(container)
    }

    container.style.display = 'block'
    
    // Convert newlines to paragraphs
    const contentHTML = article.content
      .split('\n')
      .filter(p => p.trim() !== '')
      .map(p => `<p style="margin-bottom: 1.25rem; line-height: 1.7; color: var(--text-secondary); font-size: 1.05rem;">${p.trim()}</p>`)
      .join('')

    // Format Date safely
    let formattedDate = 'Recent'
    if (article.created_at) {
        try {
            formattedDate = new Date(article.created_at).toLocaleDateString('en-NG', {
                year: 'numeric', month: 'long', day: 'numeric'
            })
        } catch (e) {
            console.error("Date format error:", e)
        }
    }

    container.innerHTML = `
      <div style="margin-top: 2rem; margin-bottom: 2rem;">
        <button id="back-to-dashboard-btn" class="glass" style="display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; border-radius: 8px; font-size: 0.9rem; cursor: pointer; border: 1px solid var(--glass-border); transition: all 0.2s ease;">
          ← Back to Dashboard
        </button>
      </div>
      
      <article class="glass card" style="padding: 2.5rem; border-top: 6px solid var(--accent-primary);">
        <div style="display: flex; gap: 1rem; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap;">
            <span style="background: var(--accent-primary)1A; color: var(--accent-primary); padding: 0.4rem 0.8rem; border-radius: 6px; font-weight: 800; font-size: 0.75rem; letter-spacing: 0.05em; text-transform: uppercase;">
                ${article.category || 'EXAM UPDATE'}
            </span>
            <span style="color: var(--text-secondary); font-size: 0.85rem; display: flex; align-items: center; gap: 0.4rem;">
                📅 ${formattedDate}
            </span>
        </div>
        
        <h1 style="font-family: 'Outfit'; font-size: 2.25rem; line-height: 1.2; margin-bottom: 2rem; color: var(--text-primary);">
            ${article.title}
        </h1>
        
        ${article.attachment_url ? `
        <div style="margin-bottom: 2rem; padding: 1.5rem; background: rgba(59, 130, 246, 0.1); border-radius: 8px; border-left: 4px solid var(--accent-primary); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem;">
            <div>
                <p style="font-size: 0.85rem; font-weight: bold; color: var(--accent-primary); margin-bottom: 0.25rem;">📎 Attached Document</p>
                <p style="font-size: 0.95rem; color: var(--text-primary);">${article.attachment_name || 'Official Exam Document'}</p>
            </div>
            <a href="${article.attachment_url}" target="_blank" download style="background: var(--accent-primary); color: #fff; padding: 0.6rem 1.2rem; border-radius: 6px; font-weight: bold; text-decoration: none; font-size: 0.85rem; display: inline-flex; align-items: center; gap: 0.5rem; box-shadow: 0 4px 10px rgba(59, 130, 246, 0.3);">
                📥 Download PDF
            </a>
        </div>
        ` : ''}

        <div style="border-top: 1px solid var(--glass-border); margin-bottom: 2rem;"></div>
        
        <div style="font-family: inherit;">
            ${contentHTML}
        </div>
      </article>
    `

    // Setup navigation listener
    document.getElementById('back-to-dashboard-btn').onclick = () => {
      this.hide()
      if (onBack) onBack()
    }
  },

  hide() {
    const container = document.getElementById(this.containerId)
    if (container) container.style.display = 'none'
  }
}
