export interface IpData {
    id: string;
    name: string;
    dob: string;
    description: string;
    imageUrl: string;
    /** Actual pixel dimensions of the composited image file */
    imageW: number;
    imageH: number;
}

export const IP_DATA: Record<string, IpData> = {
    'ma-ba-dong': {
        id: 'ma-ba-dong',
        name: 'Ma Bà Đồng',
        dob: 'Unknown',
        description: 'Ma Bà Đồng là một nhân vật huyền thoại trong văn hóa dân gian Việt Nam, thường được miêu tả là một người phụ nữ giàu có và quyền lực, có khả năng điều khiển thời tiết và mang lại may mắn cho những người tôn thờ bà. Bà thường được xem là biểu tượng của sự giàu có, thịnh vượng và bảo vệ gia đình.',
        imageUrl: '/images/brand-equity/Ma ba dong COMPOSITED 2.webp',
        imageW: 1927, imageH: 3240,
    },
    'a-vu': {
        id: 'a-vu',
        name: 'Vũ',
        dob: 'Unknown',
        description: 'A Vũ là một nhân vật trong văn hóa dân gian Việt Nam, thường được miêu tả là một người đàn ông trẻ tuổi, thông minh và nhanh nhẹn. A Vũ thường xuất hiện trong các câu chuyện dân gian với vai trò là người hùng, người giải quyết các vấn đề khó khăn và mang lại công lý cho những người yếu thế.',
        imageUrl: '/images/brand-equity/A Vu COMPOSITED 2.webp',
        imageW: 783, imageH: 2560,
    },
    'heny': {
        id: 'heny',
        name: 'Heny',
        dob: 'Unknown',
        description: 'Heny là một nhân vật hư cấu được tạo ra bởi Sino Studio, mang đậm phong cách hiện đại và cá tính mạnh mẽ. Heny thường được miêu tả là một cô gái trẻ trung, năng động và đầy nhiệt huyết, luôn sẵn sàng đối mặt với thử thách và khám phá thế giới xung quanh.',
        imageUrl: '/images/brand-equity/Heny COMPOSITED 2.webp',
        imageW: 950, imageH: 2560,
    },
    'hien-luong': {
        id: 'hien-luong',
        name: 'Hiền Lương',
        dob: 'Unknown',
        description: 'Hiền Lương là một nhân vật trong văn hóa dân gian Việt Nam, thường được miêu tả là một người phụ nữ hiền hậu, nhân hậu và có lòng thương người. Hiền Lương thường xuất hiện trong các câu chuyện dân gian với vai trò là người mẹ hiền, người vợ đảm đang hoặc người bạn tốt, luôn sẵn sàng giúp đỡ những người xung quanh.',
        imageUrl: '/images/brand-equity/Hien luong COMPOSITED 2.webp',
        imageW: 766, imageH: 2560,
    },
    'ha': {
        id: 'ha',
        name: 'Hạ',
        dob: 'Unknown',
        description: 'Hạ là một nhân vật trong văn hóa dân gian Việt Nam, thường được miêu tả là một cô gái xinh đẹp, dịu dàng và có tính cách nhẹ nhàng. Hạ thường xuất hiện trong các câu chuyện dân gian với vai trò là người con gái mơ mộng, người yêu thương hoặc người bạn tốt, luôn mang đến sự ấm áp và niềm vui cho những người xung quanh.',
        imageUrl: '/images/brand-equity/Ha COMPOSITED 2.webp',
        imageW: 824, imageH: 2560,
    },
    'sino': {
        id: 'sino',
        name: 'Sino',
        dob: 'Unknown',
        description: 'Sino là một nhân vật hư cấu được tạo ra bởi Sino Studio, mang đậm phong cách hiện đại và cá tính mạnh mẽ. Sino thường được miêu tả là một chàng trai trẻ trung, năng động và đầy nhiệt huyết, luôn sẵn sàng đối mặt với thử thách và khám phá thế giới xung quanh.',
        imageUrl: '/images/brand-equity/Sino COMPOSITED 2.webp',
        imageW: 881, imageH: 1812,
    },
    'linh': {
        id: 'linh',
        name: 'Linh',
        dob: 'Unknown',
        description: 'Linh là một nhân vật hư cấu được tạo ra bởi Sino Studio, mang đậm phong cách hiện đại và cá tính mạnh mẽ. Linh thường được miêu tả là một cô gái trẻ trung, năng động và đầy nhiệt huyết, luôn sẵn sàng đối mặt với thử thách và khám phá thế giới xung quanh.',
        imageUrl: '/images/brand-equity/Linh COMPOSITED 2.webp',
        imageW: 1012, imageH: 2560,
    },
    'nachi': {
        id: 'nachi',
        name: 'Nachi',
        dob: 'Unknown',
        description: 'Nachi là một nhân vật hư cấu được tạo ra bởi Sino Studio, mang đậm phong cách hiện đại và cá tính mạnh mẽ. Nachi thường được miêu tả là một cô gái trẻ trung, năng động và đầy nhiệt huyết, luôn sẵn sàng đối mặt với thử thách và khám phá thế giới xung quanh.',
        imageUrl: '/images/brand-equity/Nachi COMPOSITED 2.webp',
        imageW: 1032, imageH: 2475,
    },
    'vu': {
        id: 'vu',
        name: 'Shino',
        dob: 'Unknown',
        description: 'Vũ là một nhân vật hư cấu được tạo ra bởi Sino Studio, mang đậm phong cách hiện đại và cá tính mạnh mẽ. Vũ thường được miêu tả là một chàng trai trẻ trung, năng động và đầy nhiệt huyết, luôn sẵn sàng đối mặt với thử thách và khám phá thế giới xung quanh.',
        imageUrl: '/images/brand-equity/Vu COMPOSITED 2.webp',
        imageW: 956, imageH: 2560,
    },
    'boss': {
        id: 'boss',
        name: 'Boss',
        dob: 'Unknown',
        description: 'Boss là một nhân vật hư cấu được tạo ra bởi Sino Studio, mang đậm phong cách hiện đại và cá tính mạnh mẽ. Boss thường được miêu tả là một chàng trai trẻ trung, năng động và đầy nhiệt huyết, luôn sẵn sàng đối mặt với thử thách và khám phá thế giới xung quanh.',
        imageUrl: '/images/brand-equity/Boss COMPOSITED 2.webp',
        imageW: 2218, imageH: 4029,
    }
}

export const CHARACTER_ORDER = [
    'ma-ba-dong',
    'a-vu',
    'heny',
    'hien-luong',
    'ha',
    'sino',
    'linh',
    'nachi',
    'vu',
    'boss',
] as const;