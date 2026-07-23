// All drawFlag functions run INSIDE an already-clipped arc.
// They must NOT call ctx.save/clip/restore themselves — just fill.

export const COUNTRYBALLS = [
    {
        id: 'turkey',
        name: 'Türkiye 🇹🇷',
        flagEmoji: '🇹🇷',
        type: 'custom',
        drawFlag: (ctx, r) => {
            // Red background
            ctx.fillStyle = '#E30A17';
            ctx.fillRect(-r, -r, r * 2, r * 2);
            // White crescent moon
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.arc(-r * 0.12, 0, r * 0.48, 0, Math.PI * 2); ctx.fill();
            // Red cutout
            ctx.fillStyle = '#E30A17';
            ctx.beginPath(); ctx.arc(r * 0.02, 0, r * 0.38, 0, Math.PI * 2); ctx.fill();
            // Star
            ctx.fillStyle = '#fff';
            _star(ctx, r * 0.33, 0, 5, r * 0.21, r * 0.09);
        }
    },
    {
        id: 'poland',
        name: 'Polonya 🇵🇱',
        flagEmoji: '🇵🇱',
        type: 'striped_horizontal',
        colors: ['#ffffff', '#DC143C']
    },
    {
        id: 'germany',
        name: 'Almanya 🇩🇪',
        flagEmoji: '🇩🇪',
        type: 'striped_horizontal',
        colors: ['#000000', '#DD0000', '#FFCC00']
    },
    {
        id: 'france',
        name: 'Fransa 🇫🇷',
        flagEmoji: '🇫🇷',
        type: 'striped_vertical',
        colors: ['#002395', '#ffffff', '#ED2939']
    },
    {
        id: 'usa',
        name: 'ABD 🇺🇸',
        flagEmoji: '🇺🇸',
        type: 'custom',
        drawFlag: (ctx, r) => {
            const sw = (r * 2) / 7;
            for (let i = 0; i < 7; i++) {
                ctx.fillStyle = i % 2 === 0 ? '#B22234' : '#fff';
                ctx.fillRect(-r, -r + i * sw, r * 2, sw + 0.5);
            }
            ctx.fillStyle = '#3C3B6E';
            ctx.fillRect(-r, -r, r * 1.08, r);
            ctx.fillStyle = '#fff';
            [[-.7,-.7],[-.3,-.7],[-.5,-.4],[-.8,-.2],[-.2,-.2]].forEach(([sx,sy])=>{
                _star(ctx, r*sx, r*sy, 5, r*0.1, r*0.04);
            });
        }
    },
    {
        id: 'japan',
        name: 'Japonya 🇯🇵',
        flagEmoji: '🇯🇵',
        type: 'custom',
        drawFlag: (ctx, r) => {
            ctx.fillStyle = '#fff'; ctx.fillRect(-r, -r, r*2, r*2);
            ctx.fillStyle = '#BC002D'; ctx.beginPath(); ctx.arc(0, 0, r*0.5, 0, Math.PI*2); ctx.fill();
        }
    },
    {
        id: 'brazil',
        name: 'Brezilya 🇧🇷',
        flagEmoji: '🇧🇷',
        type: 'custom',
        drawFlag: (ctx, r) => {
            ctx.fillStyle = '#009739'; ctx.fillRect(-r, -r, r*2, r*2);
            ctx.fillStyle = '#FEDD00';
            ctx.beginPath(); ctx.moveTo(0,-r*.72); ctx.lineTo(r*.84,0); ctx.lineTo(0,r*.72); ctx.lineTo(-r*.84,0); ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#012169'; ctx.beginPath(); ctx.arc(0,0,r*.42,0,Math.PI*2); ctx.fill();
            ctx.strokeStyle = '#fff'; ctx.lineWidth = r*0.07;
            ctx.beginPath(); ctx.arc(0, r*.15, r*.37, Math.PI*1.15, Math.PI*1.85); ctx.stroke();
        }
    },
    {
        id: 'italy',
        name: 'İtalya 🇮🇹',
        flagEmoji: '🇮🇹',
        type: 'striped_vertical',
        colors: ['#009246', '#ffffff', '#CE2B37']
    },
    {
        id: 'uk',
        name: 'İngiltere 🇬🇧',
        flagEmoji: '🇬🇧',
        type: 'custom',
        drawFlag: (ctx, r) => {
            ctx.fillStyle = '#012169'; ctx.fillRect(-r, -r, r*2, r*2);
            // White diagonals wide
            ctx.strokeStyle = '#fff'; ctx.lineWidth = r*0.38;
            ctx.beginPath(); ctx.moveTo(-r,-r); ctx.lineTo(r,r); ctx.moveTo(r,-r); ctx.lineTo(-r,r); ctx.stroke();
            // Red diagonals thin
            ctx.strokeStyle = '#C8102E'; ctx.lineWidth = r*0.18;
            ctx.beginPath(); ctx.moveTo(-r,-r); ctx.lineTo(r,r); ctx.moveTo(r,-r); ctx.lineTo(-r,r); ctx.stroke();
            // White cross
            ctx.fillStyle = '#fff';
            ctx.fillRect(-r*0.33, -r, r*0.66, r*2);
            ctx.fillRect(-r, -r*0.33, r*2, r*0.66);
            // Red cross
            ctx.fillStyle = '#C8102E';
            ctx.fillRect(-r*0.18, -r, r*0.36, r*2);
            ctx.fillRect(-r, -r*0.18, r*2, r*0.36);
        }
    },
    {
        id: 'spain',
        name: 'İspanya 🇪🇸',
        flagEmoji: '🇪🇸',
        type: 'striped_horizontal',
        colors: ['#AA151B', '#F1BF00', '#F1BF00', '#AA151B']
    },
    {
        id: 'sweden',
        name: 'İsveç 🇸🇪',
        flagEmoji: '🇸🇪',
        type: 'custom',
        drawFlag: (ctx, r) => {
            ctx.fillStyle = '#006AA7'; ctx.fillRect(-r, -r, r*2, r*2);
            ctx.fillStyle = '#FECC00';
            ctx.fillRect(-r*0.28, -r, r*0.33, r*2);
            ctx.fillRect(-r, -r*0.17, r*2, r*0.33);
        }
    },
    {
        id: 'netherlands',
        name: 'Hollanda 🇳🇱',
        flagEmoji: '🇳🇱',
        type: 'striped_horizontal',
        colors: ['#AE1C28', '#ffffff', '#21468B']
    },
    {
        id: 'canada',
        name: 'Kanada 🇨🇦',
        flagEmoji: '🇨🇦',
        type: 'custom',
        drawFlag: (ctx, r) => {
            ctx.fillStyle = '#FF0000'; ctx.fillRect(-r, -r, r*2, r*2);
            ctx.fillStyle = '#fff'; ctx.fillRect(-r*0.5, -r, r, r*2);
            // Maple leaf - simplified circle
            ctx.fillStyle = '#FF0000';
            ctx.beginPath(); ctx.arc(0, 0, r*0.27, 0, Math.PI*2); ctx.fill();
        }
    },
    {
        id: 'south_korea',
        name: 'Güney Kore 🇰🇷',
        flagEmoji: '🇰🇷',
        type: 'custom',
        drawFlag: (ctx, r) => {
            ctx.fillStyle = '#fff'; ctx.fillRect(-r, -r, r*2, r*2);
            ctx.fillStyle = '#CD2E3A'; ctx.beginPath(); ctx.arc(0,0,r*.42,0,Math.PI*2); ctx.fill();
            ctx.fillStyle = '#0047A0'; ctx.beginPath(); ctx.arc(0,0,r*.42,0,Math.PI); ctx.fill();
        }
    },
    // Solid colors
    { id: 'color_black', name: 'Siyah ⬛', flagEmoji: '⬛', type: 'custom', drawFlag: (ctx, r) => { ctx.fillStyle = '#111'; ctx.fillRect(-r, -r, r*2, r*2); } },
    { id: 'color_white', name: 'Beyaz ⬜', flagEmoji: '⬜', type: 'custom', drawFlag: (ctx, r) => { ctx.fillStyle = '#f8f9fa'; ctx.fillRect(-r, -r, r*2, r*2); } },
    { id: 'color_blue', name: 'Mavi 🟦', flagEmoji: '🟦', type: 'custom', drawFlag: (ctx, r) => { ctx.fillStyle = '#0d6efd'; ctx.fillRect(-r, -r, r*2, r*2); } },
    { id: 'color_red', name: 'Kırmızı 🟥', flagEmoji: '🟥', type: 'custom', drawFlag: (ctx, r) => { ctx.fillStyle = '#dc3545'; ctx.fillRect(-r, -r, r*2, r*2); } },
    { id: 'color_green', name: 'Yeşil 🟩', flagEmoji: '🟩', type: 'custom', drawFlag: (ctx, r) => { ctx.fillStyle = '#198754'; ctx.fillRect(-r, -r, r*2, r*2); } },
    { id: 'color_yellow', name: 'Sarı 🟨', flagEmoji: '🟨', type: 'custom', drawFlag: (ctx, r) => { ctx.fillStyle = '#ffc107'; ctx.fillRect(-r, -r, r*2, r*2); } },
    { id: 'color_orange', name: 'Turuncu 🟧', flagEmoji: '🟧', type: 'custom', drawFlag: (ctx, r) => { ctx.fillStyle = '#fd7e14'; ctx.fillRect(-r, -r, r*2, r*2); } },
    { id: 'color_purple', name: 'Mor 🟪', flagEmoji: '🟪', type: 'custom', drawFlag: (ctx, r) => { ctx.fillStyle = '#6f42c1'; ctx.fillRect(-r, -r, r*2, r*2); } }
];

function _star(ctx, cx, cy, spikes, outer, inner) {
    let rot = -(Math.PI / 2);
    const step = Math.PI / spikes;
    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
        const rad = i % 2 === 0 ? outer : inner;
        ctx.lineTo(cx + Math.cos(rot) * rad, cy + Math.sin(rot) * rad);
        rot += step;
    }
    ctx.closePath();
    ctx.fill();
}

export function getCountryballSkin(id) {
    return COUNTRYBALLS.find(c => c.id === id) || COUNTRYBALLS[0];
}

// ============== COSMETICS ==============

export const HATS = [
    { id: 'none', name: 'Şapka Yok' },
    {
        id: 'tophat', name: 'Silindir Şapka',
        draw: (ctx, r) => {
            ctx.fillStyle = '#111';
            ctx.fillRect(-r*0.6, -r*0.95, r*1.2, r*0.2); // brim
            ctx.fillRect(-r*0.4, -r*1.8, r*0.8, r*0.85); // top
            ctx.fillStyle = '#dc3545';
            ctx.fillRect(-r*0.4, -r*1.15, r*0.8, r*0.2); // ribbon
        }
    },
    {
        id: 'cap', name: 'Kasket',
        draw: (ctx, r) => {
            ctx.fillStyle = '#0d6efd';
            ctx.beginPath(); ctx.arc(0, -r*0.7, r*0.6, Math.PI, 0); ctx.fill(); // dome
            ctx.fillRect(0, -r*0.7, r*0.8, r*0.15); // brim
        }
    },
    {
        id: 'crown', name: 'Kral Tacı',
        draw: (ctx, r) => {
            ctx.fillStyle = '#ffc107';
            ctx.beginPath();
            ctx.moveTo(-r*0.5, -r*0.8);
            ctx.lineTo(-r*0.6, -r*1.5);
            ctx.lineTo(-r*0.2, -r*1.1);
            ctx.lineTo(0, -r*1.6);
            ctx.lineTo(r*0.2, -r*1.1);
            ctx.lineTo(r*0.6, -r*1.5);
            ctx.lineTo(r*0.5, -r*0.8);
            ctx.closePath();
            ctx.fill();
            // Jewels
            ctx.fillStyle = '#dc3545';
            ctx.beginPath(); ctx.arc(-r*0.6, -r*1.5, r*0.08, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(0, -r*1.6, r*0.08, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(r*0.6, -r*1.5, r*0.08, 0, Math.PI*2); ctx.fill();
        }
    },
    {
        id: 'banana', name: 'Muz (Nano Banana) 🍌',
        draw: (ctx, r) => {
            // Nano Banana
            ctx.fillStyle = '#FFE135';
            ctx.beginPath();
            // Draw a curved banana shape on top
            ctx.moveTo(-r*0.7, -r*0.7);
            ctx.quadraticCurveTo(0, -r*1.8, r*0.7, -r*0.7);
            ctx.quadraticCurveTo(0, -r*1.3, -r*0.7, -r*0.7);
            ctx.fill();
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2;
            ctx.stroke();
            // Banana tips
            ctx.fillStyle = '#4A3B2C';
            ctx.beginPath(); ctx.arc(-r*0.65, -r*0.72, r*0.08, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(r*0.65, -r*0.72, r*0.08, 0, Math.PI*2); ctx.fill();
        }
    }
];

export const GLASSES = [
    { id: 'none', name: 'Gözlük Yok' },
    {
        id: 'sunglasses', name: 'Güneş Gözlüğü',
        draw: (ctx, r) => {
            ctx.fillStyle = '#111';
            ctx.fillRect(-r*0.7, -r*0.3, r*1.4, r*0.1); // frame
            // Left lens
            ctx.beginPath();
            ctx.moveTo(-r*0.6, -r*0.2); ctx.lineTo(-r*0.1, -r*0.2);
            ctx.lineTo(-r*0.2, r*0.2); ctx.lineTo(-r*0.5, r*0.2); ctx.closePath(); ctx.fill();
            // Right lens
            ctx.beginPath();
            ctx.moveTo(r*0.6, -r*0.2); ctx.lineTo(r*0.1, -r*0.2);
            ctx.lineTo(r*0.2, r*0.2); ctx.lineTo(r*0.5, r*0.2); ctx.closePath(); ctx.fill();
        }
    },
    {
        id: 'nerd', name: 'Nerd Gözlük',
        draw: (ctx, r) => {
            ctx.strokeStyle = '#111';
            ctx.lineWidth = r*0.08;
            ctx.beginPath(); ctx.arc(-r*0.35, -r*0.05, r*0.25, 0, Math.PI*2); ctx.stroke();
            ctx.beginPath(); ctx.arc(r*0.35, -r*0.05, r*0.25, 0, Math.PI*2); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(-r*0.1, -r*0.05); ctx.lineTo(r*0.1, -r*0.05); ctx.stroke();
            // White tape in middle
            ctx.fillStyle = '#fff';
            ctx.fillRect(-r*0.05, -r*0.12, r*0.1, r*0.14);
        }
    }
];

export function getHat(id) { return HATS.find(h => h.id === id) || HATS[0]; }
export function getGlasses(id) { return GLASSES.find(g => g.id === id) || GLASSES[0]; }

