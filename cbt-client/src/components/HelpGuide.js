import { ModalService } from '../services/ModalService'

export const HelpGuide = {
  show() {
    const categories = [
      {
        id: 'getting-started',
        title: 'Getting Started',
        icon: 'rocket',
        topics: [
          {
            title: 'Your Dashboard',
            content: 'The dashboard is your mission control. Monitor your Daily Star Target (goal is 50 questions), your current Streak, and your League standing.'
          },
          {
            title: 'Setting Goals',
            content: 'Consistency is key. Aim to answer at least 50 questions daily to earn Elite Coins and maintain your streak.'
          }
        ]
      },
      {
        id: 'exams-practice',
        title: 'Exams & Practice',
        icon: 'book-open',
        topics: [
          {
            title: 'Examination Modes',
            content: '<b>Full Exam:</b> Simulates the real environment with timers and standard marking.<br><b>Practice Mode:</b> Learn at your own pace with instant explanations.'
          },
          {
            title: 'AI Question Repair',
            content: 'Found a mistake? Click the "Repair" button on any question. Our AI will analyze and fix it instantly for everyone.'
          }
        ]
      },
      {
        id: 'leagues-clashes',
        title: 'Elite Leagues',
        icon: 'trophy',
        topics: [
          {
            title: 'League Progression',
            content: 'Start in Bronze and climb to the Elite tier. The top 3 performers in every clan are promoted every Sunday.'
          },
          {
            title: 'Saturday Clashes',
            content: 'Every Saturday, join your departmental clash (Science, Arts, etc.) to compete for massive point rewards and glory.'
          }
        ]
      },
      {
        id: 'economy-pro',
        title: 'Coins & Pro Status',
        icon: 'zap',
        topics: [
          {
            title: 'Elite Coins',
            content: 'Earn coins by hitting daily targets and winning clashes. Use them to buy Streak Freezes or unlock premium content.'
          },
          {
            title: 'Elite Pro',
            content: 'Upgrade to Elite Pro for unlimited AI Tutor access, deep analytics, and access to all examinations on the platform.'
          }
        ]
      }
    ];

    const helpHtml = `
      <div class="help-guide-container animate-fadeIn" style="display: flex; flex-direction: column; height: 100%;">
        
        <!-- Header -->
        <div style="background: var(--accent-primary); padding: 2rem 1.5rem; color: white; border-radius: 20px 20px 0 0;">
          <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem;">
            <i data-lucide="help-circle" style="width: 24px; height: 24px;"></i>
            <h2 style="font-family: 'Outfit'; font-weight: 900; margin: 0; font-size: 1.5rem;">Elite Help Center</h2>
          </div>
          <p style="margin: 0; opacity: 0.9; font-size: 0.9rem; font-weight: 500;">Everything you need to master the platform.</p>
        </div>

        <!-- Search Bar (Visual only for now) -->
        <div style="padding: 1.25rem; background: rgba(0,0,0,0.05); border-bottom: 1px solid var(--glass-border);">
          <div style="position: relative;">
            <i data-lucide="search" style="position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); width: 16px; color: var(--text-secondary);"></i>
            <input type="text" placeholder="Search topics..." style="width: 100%; padding: 0.75rem 1rem 0.75rem 2.75rem; border-radius: 12px; border: 1px solid var(--glass-border); background: var(--surface-color); color: var(--text-primary); font-size: 0.9rem;" disabled>
          </div>
        </div>

        <!-- Content Area -->
        <div style="flex: 1; overflow-y: auto; padding: 1.5rem;">
          <div class="help-categories" style="display: grid; gap: 1.5rem;">
            ${categories.map(cat => `
              <div class="help-section">
                <h3 style="font-family: 'Outfit'; font-weight: 800; font-size: 1.1rem; color: var(--accent-primary); margin: 0 0 1rem 0; display: flex; align-items: center; gap: 0.5rem;">
                  <i data-lucide="${cat.icon}" style="width: 18px;"></i> ${cat.title}
                </h3>
                <div style="display: grid; gap: 0.75rem;">
                  ${cat.topics.map(topic => `
                    <div class="help-card glass" style="padding: 1rem; border-radius: 12px; border: 1px solid var(--glass-border); background: rgba(255,255,255,0.02);">
                      <h4 style="margin: 0 0 0.5rem 0; font-size: 0.95rem; font-weight: 700; color: var(--text-primary);">${topic.title}</h4>
                      <p style="margin: 0; font-size: 0.85rem; line-height: 1.6; color: var(--text-secondary);">${topic.content}</p>
                    </div>
                  `).join('')}
                </div>
              </div>
            `).join('')}
          </div>

          <!-- Footer Action -->
          <div style="margin-top: 3rem; padding: 2rem; text-align: center; border-top: 1px solid var(--glass-border); background: rgba(0,0,0,0.02); border-radius: 16px;">
            <p style="font-weight: 700; color: var(--text-primary); margin-bottom: 0.5rem;">Still need help?</p>
            <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1.5rem;">Our support team is available 24/7 to assist you.</p>
            <button id="help-contact-btn" class="btn-primary" style="width: 100%; max-width: 200px;">Contact Support</button>
          </div>
        </div>
      </div>
    `;

    ModalService.showCustom(helpHtml, {
      maxWidth: '700px',
      padding: '0',
      onRender: () => {
        const contactBtn = document.getElementById('help-contact-btn');
        if (contactBtn) {
          contactBtn.onclick = () => {
            ModalService.hide();
            const contactItem = document.getElementById('more-contact-btn');
            if (contactItem) contactItem.click();
          }
        }
      }
    });
  }
}
