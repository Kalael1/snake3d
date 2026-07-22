import * as THREE from 'three';

export const SKINS = [
    {
        id: 'red_classic',
        name: 'Klasik Kırmızı',
        icon: '🔴',
        reqScore: 0,
        desc: 'Efsanevi kırmızı yarış makinesi',
        bodyColor: 0xe53e3e,
        roofColor: 0x991b1b,
        wheelColor: 0x222222
    },
    {
        id: 'neon_blue',
        name: 'Neon Mavi',
        icon: '🔵',
        reqScore: 200,
        desc: 'Elektrik mavisi gece yarışçısı',
        bodyColor: 0x3b82f6,
        roofColor: 0x1e40af,
        wheelColor: 0x1a1a2e
    },
    {
        id: 'sunset_orange',
        name: 'Gün Batımı',
        icon: '🟠',
        reqScore: 500,
        desc: 'Turuncu alev hızı',
        bodyColor: 0xf97316,
        roofColor: 0xc2410c,
        wheelColor: 0x222222
    },
    {
        id: 'toxic_green',
        name: 'Toksik Yeşil',
        icon: '🟢',
        reqScore: 1000,
        desc: 'Neon zehir yeşili canavar',
        bodyColor: 0x22c55e,
        roofColor: 0x15803d,
        wheelColor: 0x1a1a1a
    },
    {
        id: 'cyberpunk_purple',
        name: 'Cyberpunk Mor',
        icon: '🟣',
        reqScore: 2000,
        desc: 'Matrix veri akışı moru',
        bodyColor: 0xa855f7,
        roofColor: 0x7e22ce,
        wheelColor: 0x1e1033
    },
    {
        id: 'midnight_black',
        name: 'Gece Siyahı',
        icon: '⬛',
        reqScore: 3500,
        desc: 'Karanlık gölge hayaleti',
        bodyColor: 0x1e293b,
        roofColor: 0x0f172a,
        wheelColor: 0x0a0a0a
    },
    {
        id: 'gold_royal',
        name: 'Altın Kraliyet',
        icon: '👑',
        reqScore: 5000,
        desc: '24 ayar altın kaplama şampiyon',
        bodyColor: 0xeab308,
        roofColor: 0xa16207,
        wheelColor: 0x292524
    },
    {
        id: 'diamond_crystal',
        name: 'Kristal Elmas',
        icon: '💎',
        reqScore: 8000,
        desc: 'Prizmatik elmas kaplama efsane',
        bodyColor: 0xe0f2fe,
        roofColor: 0xbae6fd,
        wheelColor: 0x334155
    }
];

export function getSkinById(skinId) {
    return SKINS.find(s => s.id === skinId) || SKINS[0];
}
