export const SKINS = [
    {
        id: 'sport',
        name: 'Spor GT Yarışçı',
        icon: '🏎️',
        modelUrl: '/Cars/sport.glb',
        reqScore: 0,
        desc: 'Aerodinamik süper spor drift arabası',
        scale: 1.5
    },
    {
        id: 'sedan',
        name: 'Lüks Sedan',
        icon: '🚗',
        modelUrl: '/Cars/Sedan.glb',
        reqScore: 200,
        desc: 'Konforlu ve yüksek performanslı özel sedan',
        scale: 1.5
    },
    {
        id: 'sedan2',
        name: 'Taksi Nitro',
        icon: '🚕',
        modelUrl: '/Cars/Sedan2.glb',
        reqScore: 500,
        desc: 'Şehir içi agresif taksi drift aracı',
        scale: 1.5
    },
    {
        id: 'sedan3',
        name: 'Polis Interceptor',
        icon: '🚔',
        modelUrl: '/Cars/Sedan3.glb',
        reqScore: 1000,
        desc: 'Hızlı müdahale kolluk kuvveti devriye aracı',
        scale: 1.5
    },
    {
        id: 'suv',
        name: 'Offroad Monster SUV',
        icon: '🚙',
        modelUrl: '/Cars/SUV.glb',
        reqScore: 2000,
        desc: 'Ağır zırhlı ve güçlü 4x4 drift canavarı',
        scale: 1.5
    },
    {
        id: 'suv2',
        name: 'Zırhlı Titan SUV',
        icon: '🚐',
        modelUrl: '/Cars/suv2.glb',
        reqScore: 3500,
        desc: 'Karanlık titanyum gövdeli devasa SUV',
        scale: 1.5
    }
];

export function getSkinById(skinId) {
    return SKINS.find(s => s.id === skinId) || SKINS[0];
}
