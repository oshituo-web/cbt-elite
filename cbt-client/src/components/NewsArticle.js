import { DataService } from '../services/data'
import { sanitizeContent } from '../utils/sanitize'

export const NewsArticleComponent = {
  async render(articleId, onBack) {
    const container = document.getElementById('news-article-container')
    if (!container) return
    
    container.style.display = 'block'
    // Ensure we start at the top of the article
    container.scrollTo(0, 0)
    
    container.innerHTML = `
      <div style="text-align: center; padding: 4rem 2rem;">
        <div class="loader-spinner" style="margin: 0 auto; width: 40px; height: 40px;"></div>
        <p style="margin-top: 1rem; color: var(--text-secondary);">Opening article...</p>
      </div>
    `

    try {
      const { data: article, error } = await DataService.getNewsArticle(articleId)
      if (error || !article) throw new Error("Article not found")

      // Fetch attachments if any
      const { data: attachments } = await DataService.getNewsAttachments(articleId)

      container.innerHTML = `
        <div class="news-article-wrapper" style="width: 100%; max-width: 800px; margin: 0 auto; box-sizing: border-box;">
          <div class="news-article-card glass animate-fadeIn" style="border: none; background: var(--surface-color); border-radius: 16px; margin-bottom: 3rem; overflow: hidden;">
            
            <!-- Mobile Sticky Header -->
            <div style="position: sticky; top: 0; left: 0; right: 0; background: var(--surface-color); padding: 1rem; border-bottom: 1px solid var(--glass-border); z-index: 10; display: flex; align-items: center; gap: 1rem;">
               <button id="close-news-btn" class="btn-secondary" style="width: 40px; height: 40px; padding: 0; border-radius: 50%; display: flex; align-items: center; justify-content: center; min-width: auto;">
                 <i data-lucide="arrow-left"></i>
               </button>
               <span style="font-weight: 800; font-family: 'Outfit'; font-size: 0.9rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em;">News Update</span>
            </div>

            <!-- Content Area -->
            <div style="padding: 2rem 1.5rem;">
              <div style="margin-bottom: 2rem;">
                <span class="badge" style="background: var(--primary); color: white; margin-bottom: 1rem; font-weight: 900; font-size: 0.7rem;">${article.category || 'GENERAL'}</span>
                <h1 class="news-article-title" style="margin: 0.5rem 0 1rem 0; font-family: 'Outfit'; font-weight: 900; line-height: 1.2;">${article.title}</h1>
                <div style="display: flex; align-items: center; gap: 0.75rem; color: var(--text-secondary); font-size: 0.85rem; font-weight: 600;">
                  <i data-lucide="calendar" style="width: 14px; height: 14px;"></i>
                  ${new Date(article.created_at).toLocaleDateString(undefined, { dateStyle: 'long' })}
                </div>
              </div>

              <div class="news-content-body" style="font-size: 1.1rem; line-height: 1.8; color: var(--text-primary); font-family: 'Outfit', sans-serif;">
                ${sanitizeContent(article.content.replace(/\n/g, '<br>'))}
              </div>

              ${attachments && attachments.length > 0 ? `
                <div style="margin-top: 4rem; padding-top: 2rem; border-top: 1px solid var(--glass-border);">
                  <h4 style="font-family: 'Outfit'; font-weight: 800; margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.6rem;">
                    <i data-lucide="paperclip" style="color: var(--accent-primary);"></i> Official Documents
                  </h4>
                  <div style="display: flex; flex-direction: column; gap: 1rem;">
                    ${attachments.map(file => `
                      <div class="attachment-box glass" style="display: flex; justify-content: space-between; align-items: center; padding: 1.25rem; border-radius: 12px; background: rgba(255,255,255,0.03);">
                        <div style="display: flex; align-items: center; gap: 1rem;">
                           <div style="color: var(--accent-primary);"><i data-lucide="file-text"></i></div>
                           <div>
                             <div style="font-weight: 700; font-size: 0.95rem; color: var(--text-primary);">${file.file_name}</div>
                             <div style="font-size: 0.75rem; color: var(--text-secondary);">${file.file_type?.toUpperCase() || 'PDF'} Document</div>
                           </div>
                        </div>
                        <a href="${file.file_url}" target="_blank" class="btn-primary" style="height: 36px; padding: 0 1rem; font-size: 0.8rem; border-radius: 8px;">View</a>
                      </div>
                    `).join('')}
                  </div>
                </div>
              ` : ''}
            </div>

            <!-- Bottom Action -->
            <div style="padding: 2.5rem 1.5rem; text-align: center; background: rgba(0,0,0,0.1);">
               <p style="margin-bottom: 1.5rem; font-size: 0.9rem; color: var(--text-secondary); font-weight: 500;">Shared from CBT Elite Official Updates.</p>
               <button id="bottom-back-btn" class="btn-secondary" style="width: 100%; max-width: 300px; height: 48px; border-color: var(--accent-primary); color: var(--accent-primary); font-weight: 800;">RETURN TO DASHBOARD</button>
            </div>
          </div>
        </div>
      `

      document.getElementById('close-news-btn').onclick = () => {
        container.style.display = 'none'
        if (onBack) onBack()
      }
      document.getElementById('bottom-back-btn').onclick = () => {
        container.style.display = 'none'
        if (onBack) onBack()
      }

      if (window.lucide) window.lucide.createIcons();

    } catch (err) {
      container.innerHTML = `
        <div style="text-align: center; padding: 5rem 2rem;">
          <i data-lucide="alert-circle" style="width: 48px; height: 48px; color: var(--error); margin-bottom: 1.5rem;"></i>
          <h2 style="font-family: 'Outfit'; font-weight: 800; color: var(--text-primary);">Failed to load article</h2>
          <p style="color: var(--text-secondary); margin-bottom: 2.5rem;">Please check your connection and try again.</p>
          <button id="error-back-btn" class="btn-primary">Go Back</button>
        </div>
      `
      document.getElementById('error-back-btn').onclick = () => {
        container.style.display = 'none'
        if (onBack) onBack()
      }
      if (window.lucide) window.lucide.createIcons();
    }
  }
}
