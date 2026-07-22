export const SKINS = [
    {
        id: 'sport',
        name: 'Spor GT Yarışçı',
        icon: '🏎️',
        modelUrl: '/Cars/sport.glb',
        reqScore: 0,
        desc: 'Aerodinamik süper spor drift arabası',
        rotationY: Math.PI / 2
    },
    {
        id: 'sedan',
        name: 'Lüks Sedan',
        icon: '🚗',
        modelUrl: '/Cars/Sedan.glb',
        reqScore: 200,
        desc: 'Konforlu ve yüksek performanslı özel sedan',
        rotationY: Math.PI / 2
    },
    {
        id: 'sedan2',
        name: 'Taksi Nitro',
        icon: '🚕',
        modelUrl: '/Cars/Sedan2.glb',
        reqScore: 500,
        desc: 'Şehir içi agresif taksi drift aracı',
        rotationY: Math.PI / 2
    },
    {
        id: 'sedan3',
        name: 'Polis Interceptor',
        icon: '🚔',
        modelUrl: '/Cars/Sedan3.glb',
        reqScore: 1000,
        desc: 'Hızlı müdahale kolluk kuvveti devriye aracı',
        rotationY: Math.PI / 2
    },
    {
        id: 'suv',
        name: 'Offroad Monster SUV',
        icon: '🚙',
        modelUrl: '/Cars/SUV.glb',
        reqScore: 2000,
        desc: 'Ağır zırhlı ve güçlü 4x4 drift canavarı',
        rotationY: Math.PI / 2
    },
    {
        id: 'suv2',
        name: 'Zırhlı Titan SUV',
        icon: '🚐',
        modelUrl: '/Cars/suv2.glb',
        reqScore: 3500,
        desc: 'Karanlık titanyum gövdeli devasa SUV',
        rotationY: Math.PI / 2
    }
];

export function getSkinById(skinId) {
    return SKINS.find(s => s.id === skinId) || SKINS[0];
}
