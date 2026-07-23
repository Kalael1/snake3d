export const COUNTRYBALLS = [
    {
        id: 'turkey',
        name: 'Türkiye 🇹🇷',
        flagEmoji: '🇹🇷',
        type: 'custom',
        drawFlag: (ctx, r) => {
            ctx.save();
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.clip();

            // Red background
            ctx.fillStyle = '#E30A17';
            ctx.fillRect(-r, -r, r * 2, r * 2);

            // White crescent outer
            ctx.fillStyle = '#FFFFFF';
            ctx.beginPath();
            ctx.arc(-r * 0.15, 0, r * 0.5, 0, Math.PI * 2);
            ctx.fill();

            // Red crescent inner cutout
            ctx.fillStyle = '#E30A17';
            ctx.beginPath();
            ctx.arc(-r * 0.05, 0, r * 0.4, 0, Math.PI * 2);
            ctx.fill();

            // White Star
            ctx.fillStyle = '#FFFFFF';
            drawStar(ctx, r * 0.3, 0, 5, r * 0.22, r * 0.1);

            ctx.restore();
        }
    },
    {
        id: 'poland',
        name: 'Polonya 🇵🇱',
        flagEmoji: '🇵🇱',
        type: 'striped_horizontal',
        colors: ['#FFFFFF', '#DC143C']
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
        colors: ['#002395', '#FFFFFF', '#ED2939']
    },
    {
        id: 'usa',
        name: 'ABD 🇺🇸',
        flagEmoji: '🇺🇸',
        type: 'custom',
        drawFlag: (ctx, r) => {
            // Stripes background
            const stripes = 7;
            const stripeHeight = (r * 2) / stripes;
            ctx.save();
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.clip();

            for (let i = 0; i < stripes; i++) {
                ctx.fillStyle = (i % 2 === 0) ? '#B22234' : '#FFFFFF';
                ctx.fillRect(-r, -r + i * stripeHeight, r * 2, stripeHeight);
            }

            // Blue Canton
            ctx.fillStyle = '#3C3B6E';
            ctx.fillRect(-r, -r, r * 1.1, r * 1.0);

            // Canton Stars
            ctx.fillStyle = '#FFFFFF';
            const starPositions = [
                [-r * 0.7, -r * 0.7], [-r * 0.3, -r * 0.7],
                [-r * 0.5, -r * 0.4], [-r * 0.8, -r * 0.2], [-r * 0.2, -r * 0.2]
            ];
            starPositions.forEach(([sx, sy]) => {
                drawStar(ctx, sx, sy, 5, r * 0.1, r * 0.04);
            });
            ctx.restore();
        }
    },
    {
        id: 'japan',
        name: 'Japonya 🇯🇵',
        flagEmoji: '🇯🇵',
        type: 'custom',
        drawFlag: (ctx, r) => {
            // White background
            ctx.fillStyle = '#FFFFFF';
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.fill();

            // Red Sun circle
            ctx.fillStyle = '#BC002D';
            ctx.beginPath();
            ctx.arc(0, 0, r * 0.52, 0, Math.PI * 2);
            ctx.fill();
        }
    },
    {
        id: 'brazil',
        name: 'Brezilya 🇧🇷',
        flagEmoji: '🇧🇷',
        type: 'custom',
        drawFlag: (ctx, r) => {
            ctx.save();
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.clip();

            // Green background
            ctx.fillStyle = '#009739';
            ctx.fillRect(-r, -r, r * 2, r * 2);

            // Yellow Rhombus
            ctx.fillStyle = '#FEDD00';
            ctx.beginPath();
            ctx.moveTo(0, -r * 0.75);
            ctx.lineTo(r * 0.85, 0);
            ctx.lineTo(0, r * 0.75);
            ctx.lineTo(-r * 0.85, 0);
            ctx.closePath();
            ctx.fill();

            // Blue Circle
            ctx.fillStyle = '#012169';
            ctx.beginPath();
            ctx.arc(0, 0, r * 0.42, 0, Math.PI * 2);
            ctx.fill();

            // White Band
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = r * 0.08;
            ctx.beginPath();
            ctx.arc(0, r * 0.2, r * 0.38, Math.PI * 1.15, Math.PI * 1.85);
            ctx.stroke();

            ctx.restore();
        }
    },
    {
        id: 'italy',
        name: 'İtalya 🇮🇹',
        flagEmoji: '🇮🇹',
        type: 'striped_vertical',
        colors: ['#009246', '#FFFFFF', '#CE2B37']
    },
    {
        id: 'uk',
        name: 'İngiltere 🇬🇧',
        flagEmoji: '🇬🇧',
        type: 'custom',
        drawFlag: (ctx, r) => {
            ctx.save();
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.clip();

            // Deep Blue
            ctx.fillStyle = '#012169';
            ctx.fillRect(-r, -r, r * 2, r * 2);

            // White Diagonals
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = r * 0.4;
            ctx.beginPath();
            ctx.moveTo(-r, -r); ctx.lineTo(r, r);
            ctx.moveTo(r, -r); ctx.lineTo(-r, r);
            ctx.stroke();

            // Red Diagonals
            ctx.strokeStyle = '#C8102E';
            ctx.lineWidth = r * 0.2;
            ctx.beginPath();
            ctx.moveTo(-r, -r); ctx.lineTo(r, r);
            ctx.moveTo(r, -r); ctx.lineTo(-r, r);
            ctx.stroke();

            // White Cross
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(-r * 0.35, -r, r * 0.7, r * 2);
            ctx.fillRect(-r, -r * 0.35, r * 2, r * 0.7);

            // Red Cross
            ctx.fillStyle = '#C8102E';
            ctx.fillRect(-r * 0.2, -r, r * 0.4, r * 2);
            ctx.fillRect(-r, -r * 0.2, r * 2, r * 0.4);

            ctx.restore();
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
            ctx.save();
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.clip();

            // Blue
            ctx.fillStyle = '#006AA7';
            ctx.fillRect(-r, -r, r * 2, r * 2);

            // Yellow Cross
            ctx.fillStyle = '#FECC00';
            ctx.fillRect(-r * 0.3, -r, r * 0.35, r * 2);
            ctx.fillRect(-r, -r * 0.18, r * 2, r * 0.35);

            ctx.restore();
        }
    },
    {
        id: 'netherlands',
        name: 'Hollanda 🇳🇱',
        flagEmoji: '🇳🇱',
        type: 'striped_horizontal',
        colors: ['#AE1C28', '#FFFFFF', '#21468B']
    },
    {
        id: 'canada',
        name: 'Kanada 🇨🇦',
        flagEmoji: '🇨🇦',
        type: 'custom',
        drawFlag: (ctx, r) => {
            ctx.save();
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.clip();

            // Red sides, white center
            ctx.fillStyle = '#FF0000';
            ctx.fillRect(-r, -r, r * 2, r * 2);
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(-r * 0.5, -r, r * 1.0, r * 2);

            // Maple Leaf emblem
            ctx.fillStyle = '#FF0000';
            ctx.beginPath();
            ctx.arc(0, 0, r * 0.28, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        }
    },
    {
        id: 'south_korea',
        name: 'Güney Kore 🇰🇷',
        flagEmoji: '🇰🇷',
        type: 'custom',
        drawFlag: (ctx, r) => {
            ctx.save();
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.clip();

            // White
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(-r, -r, r * 2, r * 2);

            // Taegeuk Circle (Red top, Blue bottom)
            ctx.fillStyle = '#CD2E3A';
            ctx.beginPath();
            ctx.arc(0, 0, r * 0.42, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#0047A0';
            ctx.beginPath();
            ctx.arc(0, 0, r * 0.42, 0, Math.PI);
            ctx.fill();

            ctx.restore();
        }
    }
];

function drawStar(ctx, cx, cy, spikes, outerRadius, innerRadius) {
    let rot = (Math.PI / 2) * 3;
    let x = cx;
    let y = cy;
    let step = Math.PI / spikes;

    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < spikes; i++) {
        x = cx + Math.cos(rot) * outerRadius;
        y = cy + Math.sin(rot) * outerRadius;
        ctx.lineTo(x, y);
        rot += step;

        x = cx + Math.cos(rot) * innerRadius;
        y = cy + Math.sin(rot) * innerRadius;
        ctx.lineTo(x, y);
        rot += step;
    }
    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
    ctx.fill();
}

export function getCountryballSkin(id) {
    return COUNTRYBALLS.find(c => c.id === id) || COUNTRYBALLS[0];
}
