export interface IpData {
    id: string;
    name: string;
    imageUrl: string;
    /** Actual pixel dimensions of the composited image file */
    imageW: number;
    imageH: number;
}

export const IP_DATA: Record<string, IpData> = {
    'ma-ba-dong': {
        id: 'ma-ba-dong',
        name: 'Ma Bà Đồng',
        imageUrl: '/images/brand-equity/Ma ba dong COMPOSITED 2.webp',
        imageW: 1927, imageH: 3240,
    },
    'vu': {
        id: 'vu',
        name: 'Vũ',
        imageUrl: '/images/brand-equity/A Vu COMPOSITED 2.webp',
        imageW: 783, imageH: 2560,
    },
    'heny': {
        id: 'heny',
        name: 'Heny',
        imageUrl: '/images/brand-equity/Heny COMPOSITED 2.webp',
        imageW: 950, imageH: 2560,
    },
    'hien-luong': {
        id: 'hien-luong',
        name: 'Hilary',
        imageUrl: '/images/brand-equity/Hien luong COMPOSITED 2.webp',
        imageW: 766, imageH: 2560,
    },
    'ha': {
        id: 'ha',
        name: 'Sunny',
        imageUrl: '/images/brand-equity/Ha COMPOSITED 2.webp',
        imageW: 824, imageH: 2560,
    },
    'sino': {
        id: 'sino',
        name: 'Sino',
        imageUrl: '/images/brand-equity/Sino COMPOSITED 2.webp',
        imageW: 881, imageH: 1812,
    },
    'linh': {
        id: 'linh',
        name: 'Linh',
        imageUrl: '/images/brand-equity/Linh COMPOSITED 2.webp',
        imageW: 1012, imageH: 2560,
    },
    'nachi': {
        id: 'nachi',
        name: 'Nachi',
        imageUrl: '/images/brand-equity/Nachi COMPOSITED 2.webp',
        imageW: 1032, imageH: 2475,
    },
    'shino': {
        id: 'shino',
        name: 'Shino',
        imageUrl: '/images/brand-equity/Vu COMPOSITED 2.webp',
        imageW: 956, imageH: 2560,
    },
    'boss': {
        id: 'boss',
        name: 'Boss',
        imageUrl: '/images/brand-equity/Boss COMPOSITED 2.webp',
        imageW: 2218, imageH: 4029,
    }
}

export const CHARACTER_ORDER = [
    'ma-ba-dong',
    'vu',
    'heny',
    'hien-luong',
    'ha',
    'sino',
    'linh',
    'nachi',
    'shino',
    'boss',
] as const;