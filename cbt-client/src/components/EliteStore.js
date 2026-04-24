import { DataService } from '../services/data'
import { ModalService } from '../services/ModalService'

export const EliteStoreComponent = {
    items: [
        { 
            id: 'streak_freeze', 
            name: 'Streak Freeze', 
            price: 100, 
            icon: 'snowflake', 
            desc: 'Protects your daily streak if you forget to practice for a day.',
            type: 'protection'
        },
        { 
            id: 'league_insurance', 
            name: 'League Insurance', 
            price: 200, 
            icon: 'shield-check', 
            desc: 'Prevents you from being demoted from your league on Sunday night.',
            type: 'protection'
        },
        { 
            id: 'power_up_bundle', 
            name: 'Power-up Mini Pack', 
            price: 100, 
            icon: 'zap', 
            desc: 'Get 5 "Eliminate 2" uses to use during difficult practice sessions.',
            type: 'consumable'
        },
        { 
            id: 'score_prediction', 
            name: 'JAMB Score Predictor', 
            price: 250, 
            icon: 'trending-up', 
            desc: 'Exclusive AI analysis predicting your likely JAMB score based on recent performance.',
            type: 'insight'
        }
    ],

    render(profile, onUpdate) {
        const modal = document.createElement('div');
        modal.id = 'elite-store-modal';
        modal.className = 'modal-overlay';
        modal.style = "position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.85); z-index:999999; display:flex; justify-content:center; align-items:flex-start; backdrop-filter:blur(10px); padding: max(2rem, env(safe-area-inset-top, 2rem)) 1rem 2rem; overflow-y: auto;";
        
        modal.innerHTML = `
            <div class="glass card scale-in" style="width:100%; max-width:500px; padding:2.5rem 2rem; border-radius:24px; border:1px solid var(--accent-primary); max-height: none; position: relative; margin: auto;">
                <button id="close-store-btn" class="header-icon-btn" style="position: absolute; top: 1rem; right: 1rem; z-index: 10;">
                    <i data-lucide="x"></i>
                </button>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem;">
                    <div>
                        <h2 style="font-family:'Outfit'; font-weight:900; margin:0; font-size:1.6rem; color:var(--text-primary);">Elite Store</h2>
                        <div style="display:flex; align-items:center; gap:0.5rem; margin-top:0.25rem;">
                            <i data-lucide="coins" style="width:14px; color:#f59e0b;"></i>
                            <span id="store-balance" style="font-weight:900; color:#f59e0b; font-size:0.9rem;">${profile.elite_coins || 0}</span>
                        </div>
                    </div>
                </div>

                <div style="display:grid; gap:1rem;">
                    ${this.items.map(item => `
                        <div class="glass card store-item" style="padding:1.25rem; border:1px solid var(--glass-border); display:flex; gap:1rem; align-items:center; cursor:pointer; transition:all 0.2s ease;">
                            <div style="width:52px; height:52px; border-radius:12px; background:var(--surface-color); display:flex; align-items:center; justify-content:center; color:var(--accent-primary); border:1px solid var(--glass-border);">
                                <i data-lucide="${item.icon}" style="width:24px;"></i>
                            </div>
                            <div style="flex:1;">
                                <h4 style="margin:0; font-family:'Outfit'; font-weight:800; font-size:1rem; color:var(--text-primary);">${item.name}</h4>
                                <p style="margin:4px 0 0; font-size:0.75rem; color:var(--text-secondary); line-height:1.4;">${item.desc}</p>
                            </div>
                            <div style="text-align:right;">
                                <button class="buy-btn btn-primary" data-id="${item.id}" data-price="${item.price}" style="padding:0.4rem 0.75rem; font-size:0.75rem; border-radius:8px; font-weight:900;">
                                    ${item.price} <i data-lucide="coins" style="width:10px; margin-left:2px; vertical-align:middle;"></i>
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
                
                <div style="margin-top:2rem; padding:1.25rem; border-radius:16px; background:rgba(255,255,255,0.03); border:1px dashed var(--glass-border); text-align:center;">
                    <p style="font-size:0.75rem; color:var(--text-secondary); margin:0; font-weight:600;">Earn more coins by completing Daily Targets and winning weekend Clashes!</p>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        if (window.lucide) window.lucide.createIcons({ root: modal });
        
        // Reset viewport scroll to prevent any background offset issues
        window.scrollTo(0, 0);
        if (document.body) document.body.scrollTop = 0;

        // Event Listeners
        document.getElementById('close-store-btn').onclick = () => modal.remove();
        
        modal.querySelectorAll('.buy-btn').forEach(btn => {
            btn.onclick = async () => {
                const itemId = btn.dataset.id;
                const price = parseInt(btn.dataset.price);

                if ((profile.elite_coins || 0) < price) {
                    await ModalService.alert("Insufficient Coins", "You need more Elite Coins to purchase this item. Keep practicing to earn more!", "warning");
                    return;
                }

                btn.disabled = true;
                btn.innerHTML = 'Buying...';

                try {
                    const { error } = await DataService.purchaseEliteItem(profile.id, itemId, price);
                    if (error) throw error;

                    profile.elite_coins -= price;
                    document.getElementById('store-balance').innerText = profile.elite_coins;
                    
                    await ModalService.alert("Purchase Success!", `You have successfully purchased ${this.items.find(i => i.id === itemId).name}!`, "success");
                    if (onUpdate) onUpdate(profile);
                    
                } catch (err) {
                    console.error("Purchase error:", err);
                    await ModalService.alert("Purchase Failed", "Something went wrong with the transaction. Please try again later.", "error");
                } finally {
                    btn.disabled = false;
                    btn.innerHTML = `${price} <i data-lucide="coins" style="width:10px; margin-left:2px; vertical-align:middle;"></i>`;
                    if (window.lucide) window.lucide.createIcons({ root: btn });
                }
            };
        });
    }
};
