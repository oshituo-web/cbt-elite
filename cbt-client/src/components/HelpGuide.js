import { ModalService } from '../services/ModalService'
import { AiService } from '../services/aiService'
import { TourGuide } from '../utils/TourGuide'

export const HelpGuide = {
  chatHistory: [],

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
            title: 'Daily Star Target',
            content: 'Hit 50 questions daily to earn your Daily Star. Consistent Stars build your Streak and earn you bonus Elite Coins.'
          }
        ]
      },
      {
        id: 'exams-practice',
        title: 'Exams & Practice',
        icon: 'book-open',
        topics: [
          {
            title: 'JAMB & Exam Simulation',
            content: 'CBT Elite provides timed exam simulations that match the exact JAMB/WAEC marking schemes. Your results include deep analytics and predicted scores.'
          },
          {
            title: 'AI Tutor & Repair',
            content: 'Use the <b>Elite AI Tutor</b> during practice for step-by-step guidance. Use the <b>Repair</b> tool to fix any question using AI instantly.'
          }
        ]
      },
      {
        id: 'leagues-clashes',
        title: 'Elite Leagues',
        icon: 'trophy',
        topics: [
          {
            title: 'Leagues & Promotions',
            content: 'Compete in 20-member clans. The top 3 performers are promoted to higher tiers (Silver, Gold, etc.) every Sunday at midnight.'
          },
          {
            title: 'Saturday Clashes',
            content: 'Join your departmental clash every Saturday for specialized competitions. These are high-stakes events with significant point rewards.'
          }
        ]
      },
      {
        id: 'account-elite',
        title: 'Elite Account',
        icon: 'user-check',
        topics: [
          {
            title: 'Free vs Pro',
            content: 'Free users can practice and join leagues. <b>Elite Pro</b> (₦1,500 Lifetime) unlocks unlimited AI explanations, unlimited Mock Exams, and detailed Subject Weakness analysis.'
          },
          {
            title: 'Activation',
            content: 'Upgrade via the Settings page. We support Paystack for instant activation. If you have a promo code, apply it during checkout for a discount.'
          }
        ]
      }
    ];

    const faqs = [
      { q: "How do I keep my streak?", a: "Answer at least 50 questions every day. If you might miss a day, use a <b>Streak Freeze</b> from the store." },
      { q: "What are Elite Coins?", a: "Coins are earned by hitting targets and winning clashes. Use them to buy powerups, streak freezes, and league insurance." },
      { q: "Is CBT Elite free?", a: "Basic practice is free. <b>Elite Pro</b> provides unlimited AI, full exam access, and deep insights for ₦1,500 lifetime." }
    ];

    const helpHtml = `
      <div id="help-center-root" class="help-guide-container animate-fadeIn" style="display: flex; flex-direction: column; height: 85vh; max-height: 800px; overflow: hidden; border-radius: 20px;">
        
        <!-- Header (Sticky) -->
        <div id="help-header" style="background: var(--accent-primary); padding: 1.75rem 1.5rem; color: white; transition: all 0.3s ease; flex-shrink: 0;">
          <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem;">
            <i data-lucide="help-circle" style="width: 24px; height: 24px;"></i>
            <h2 style="font-family: 'Outfit'; font-weight: 900; margin: 0; font-size: 1.5rem;">Elite Help Center</h2>
          </div>
          <p style="margin: 0; opacity: 0.9; font-size: 0.85rem; font-weight: 500;">Ask our AI Bot or browse the guides below.</p>
        </div>

        <!-- AI Search / Bot Bar (Sticky) -->
        <div id="help-search-area" style="padding: 1rem 1.25rem; background: rgba(0,0,0,0.05); border-bottom: 1px solid var(--glass-border); position: relative; z-index: 5; flex-shrink: 0;">
          <div style="position: relative; display: flex; gap: 0.5rem;">
            <div style="position: relative; flex: 1;">
              <i data-lucide="search" style="position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); width: 16px; color: var(--text-secondary);"></i>
              <input id="help-bot-input" type="text" placeholder="Ask anything about CBT Elite..." style="width: 100%; padding: 0.75rem 1rem 0.75rem 2.75rem; border-radius: 12px; border: 1px solid var(--glass-border); background: var(--surface-color); color: var(--text-primary); font-size: 0.9rem;">
            </div>
            <button id="help-ask-btn" class="btn-primary" style="padding: 0 1.25rem; border-radius: 12px; font-size: 0.8rem; font-weight: 800;">ASK AI</button>
          </div>
        </div>

        <!-- Main Scrollable Content -->
        <div id="help-main-content" style="flex: 1; overflow-y: auto; padding: 1.5rem; scroll-behavior: smooth; background: var(--surface-color);">
          
          <!-- AI Chat View (Hidden by default) -->
          <div id="help-chat-view" style="display: none; flex-direction: column; gap: 1rem; margin-bottom: 2rem;">
            <div id="help-chat-messages" style="display: flex; flex-direction: column; gap: 1rem;"></div>
            <div id="help-chat-loader" style="display: none; text-align: center; padding: 1rem;">
               <div class="loader-spinner" style="width: 20px; height: 20px; margin: 0 auto;"></div>
               <p style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.5rem;">Elite Bot is thinking...</p>
            </div>
            <div style="text-align: center; margin-top: 1rem;">
              <button id="close-chat-btn" style="background: rgba(0,0,0,0.05); border: 1px solid var(--glass-border); color: var(--text-primary); padding: 0.5rem 1rem; border-radius: 20px; font-size: 0.8rem; font-weight: 700; cursor: pointer;">← Back to Guides</button>
            </div>
          </div>

          <!-- Category Guides -->
          <div id="help-guides-view">
            <!-- 🎓 INTERACTIVE TOUR CTA (NEW) -->
            <div class="glass card scale-in" style="margin-bottom: 1.5rem; background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%); border: 1px solid #4338ca; border-radius: 20px; overflow: hidden; color: white;">
                <div style="padding: 1.5rem;">
                    <h4 style="margin: 0; font-family: 'Outfit'; font-weight: 900; font-size: 1.2rem; color: white;">Elite Platform Tour</h4>
                    <p style="margin: 0.5rem 0 1.25rem 0; font-size: 0.85rem; color: rgba(255,255,255,0.7); line-height: 1.5;">Not sure where to start? Let us walk you through the core features of CBT Elite in 2 minutes.</p>
                    <button id="help-launch-tour-btn" style="background: #3b82f6; color: white; border: none; font-weight: 800; width: 100%; height: 46px; border-radius: 12px; font-size: 0.9rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.5rem; box-shadow: 0 4px 15px rgba(0,0,0,0.2);">
                        <i data-lucide="play-circle" style="width: 18px; height: 18px;"></i>
                        LAUNCH INTERACTIVE TOUR
                    </button>
                </div>
            </div>

            <!-- 💎 PREMIUM CTA -->
            <div class="glass card scale-in" style="margin-bottom: 2rem; background: rgba(255,255,255,0.03); border: 1px solid var(--glass-border); padding: 1.25rem; border-radius: 16px;">
                <div style="display: flex; align-items: flex-start; gap: 1rem;">
                    <div style="background: rgba(255,215,0,0.1); width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #fbbf24; flex-shrink: 0;">
                        <i data-lucide="crown" style="width: 20px;"></i>
                    </div>
                    <div>
                        <h4 style="margin: 0; font-family: 'Outfit'; font-weight: 900; font-size: 1rem; color: #fbbf24;">Elite Pro Access</h4>
                        <p style="margin: 0.15rem 0 0.75rem 0; font-size: 0.75rem; color: var(--text-secondary); line-height: 1.4;">Unlock unlimited AI explanations and premium mock exams.</p>
                        <button onclick="window.navigateTo('settings')" class="btn-secondary" style="font-size: 0.7rem; padding: 0.4rem 0.8rem; height: auto;">UPGRADE NOW</button>
                    </div>
                </div>
            </div>

            <div class="help-categories" style="display: grid; gap: 2rem; margin-bottom: 2.5rem;">
              ${categories.map(cat => `
                <div class="help-section">
                  <h3 style="font-family: 'Outfit'; font-weight: 800; font-size: 1.05rem; color: var(--accent-primary); margin: 0 0 1rem 0; display: flex; align-items: center; gap: 0.5rem;">
                    <i data-lucide="${cat.icon}" style="width: 18px;"></i> ${cat.title}
                  </h3>
                  <div style="display: grid; gap: 0.85rem;">
                    ${cat.topics.map(topic => `
                      <div class="help-card glass" style="padding: 1.25rem; border-radius: 14px; border: 1px solid var(--glass-border); background: rgba(0,0,0,0.02);">
                        <h4 style="margin: 0 0 0.5rem 0; font-size: 0.95rem; font-weight: 800; color: var(--text-primary);">${topic.title}</h4>
                        <p style="margin: 0; font-size: 0.85rem; line-height: 1.6; color: var(--text-secondary);">${topic.content}</p>
                      </div>
                    `).join('')}
                  </div>
                </div>
              `).join('')}
            </div>

            <!-- FAQ Section -->
            <div style="margin-bottom: 2.5rem; background: rgba(0,0,0,0.02); padding: 1.5rem; border-radius: 16px; border: 1px solid var(--glass-border);">
              <h3 style="font-family: 'Outfit'; font-weight: 800; font-size: 1.05rem; color: var(--text-primary); margin: 0 0 1.25rem 0; display: flex; align-items: center; gap: 0.5rem;">
                <i data-lucide="message-square" style="width: 18px;"></i> Frequently Asked Questions
              </h3>
              <div style="display: flex; flex-direction: column; gap: 1.25rem;">
                ${faqs.map(faq => `
                  <div class="faq-item" style="border-bottom: 1px solid var(--glass-border); padding-bottom: 1rem;">
                    <div style="font-weight: 800; font-size: 0.9rem; color: var(--accent-primary); margin-bottom: 0.35rem;">${faq.q}</div>
                    <div style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.6;">${faq.a}</div>
                  </div>
                `).join('')}
              </div>
            </div>

            <!-- Community / Social -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 2.5rem;">
                <a href="mailto:cbtellite@gmail.com?subject=Support%20Request" class="glass card" style="display: flex; align-items: center; gap: 0.75rem; padding: 1rem; text-decoration: none; border: 1px solid #25d36630;">
                    <i data-lucide="mail" style="color: #25d366;"></i>
                    <div>
                        <div style="font-size: 0.85rem; font-weight: 800; color: var(--text-primary);">Email Support</div>
                        <div style="font-size: 0.65rem; color: var(--text-secondary);">cbtellite@gmail.com</div>
                    </div>
                </a>
                <a href="mailto:cbtellite@gmail.com?subject=Feedback" class="glass card" style="display: flex; align-items: center; gap: 0.75rem; padding: 1rem; text-decoration: none; border: 1px solid #1da1f230;">
                    <i data-lucide="message-circle" style="color: #1da1f2;"></i>
                    <div>
                        <div style="font-size: 0.85rem; font-weight: 800; color: var(--text-primary);">Send Feedback</div>
                        <div style="font-size: 0.65rem; color: var(--text-secondary);">Help us improve</div>
                    </div>
                </a>
            </div>

            <!-- Footer Action -->
            <div style="padding: 2rem; text-align: center; border-top: 1px solid var(--glass-border); background: linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.03) 100%); border-radius: 0 0 16px 16px;">
              <p style="font-weight: 800; color: var(--text-primary); margin-bottom: 1rem;">Still have questions?</p>
              <button id="help-contact-btn" class="btn-dominant" style="width: 100%; max-width: 250px; height: 48px;">MESSAGE SUPPORT</button>
              <p style="font-size: 0.7rem; color: var(--text-secondary); margin-top: 1rem; opacity: 0.7;">Typical response time: < 2 hours</p>
              
              <div style="margin-top: 2rem; padding-top: 1.5rem; border-top: 1px dashed var(--glass-border); opacity: 0.5;">
                 <p style="font-size: 0.6rem; color: var(--text-secondary); line-height: 1.4; font-weight: 600; margin: 0;">
                   CBT Elite is an independent educational tool. We are not affiliated with or endorsed by JAMB, WAEC, or NECO.
                 </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    ModalService.showCustom(helpHtml, {
      maxWidth: '700px',
      padding: '0',
      allowScroll: false,
      onRender: () => {
        const input = document.getElementById('help-bot-input');
        const askBtn = document.getElementById('help-ask-btn');
        const guidesView = document.getElementById('help-guides-view');
        const chatView = document.getElementById('help-chat-view');
        const closeChatBtn = document.getElementById('close-chat-btn');
        const contactBtn = document.getElementById('help-contact-btn');
        const launchTourBtn = document.getElementById('help-launch-tour-btn');

        const triggerBot = async () => {
          const query = input.value.trim();
          if (!query) return;

          // Switch views
          guidesView.style.display = 'none';
          chatView.style.display = 'flex';
          document.getElementById('help-header').style.padding = '1.25rem 1.5rem';
          
          this.addMessage('user', query);
          input.value = '';
          
          document.getElementById('help-chat-loader').style.display = 'block';
          const response = await AiService.askHelpBot(query, this.chatHistory);
          document.getElementById('help-chat-loader').style.display = 'none';
          
          this.addMessage('bot', response);
        };

        input.onkeypress = (e) => { if (e.key === 'Enter') triggerBot(); };
        askBtn.onclick = triggerBot;

        closeChatBtn.onclick = () => {
          chatView.style.display = 'none';
          guidesView.style.display = 'block';
          document.getElementById('help-header').style.padding = '2rem 1.5rem';
        };

        if (contactBtn) {
          contactBtn.onclick = () => {
            ModalService.hide();
            const contactItem = document.getElementById('more-contact-btn');
            if (contactItem) contactItem.click();
          }
        }

        if (launchTourBtn) {
            launchTourBtn.onclick = () => {
                ModalService.hide();
                setTimeout(() => TourGuide.start(), 300);
            };
        }
      }
    });
  },

  addMessage(role, text) {
    const chatContainer = document.getElementById('help-chat-messages');
    if (!chatContainer) return;

    const msgDiv = document.createElement('div');
    msgDiv.style = role === 'user' 
      ? "align-self: flex-end; background: var(--accent-primary); color: white; padding: 0.75rem 1rem; border-radius: 12px 12px 0 12px; max-width: 85%; font-size: 0.9rem; font-weight: 500;"
      : "align-self: flex-start; background: var(--surface-color); color: var(--text-primary); padding: 0.75rem 1rem; border-radius: 12px 12px 12px 0; max-width: 85%; font-size: 0.9rem; border: 1px solid var(--glass-border); line-height: 1.5;";
    
    msgDiv.innerHTML = text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
    chatContainer.appendChild(msgDiv);
    
    this.chatHistory.push({ role, content: text });
    
    const scrollArea = document.getElementById('help-main-content');
    if (scrollArea) scrollArea.scrollTop = scrollArea.scrollHeight;
  }
}
