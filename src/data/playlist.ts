export interface MusicMetadata {
    /** ID of the song */
    id: string;
    /** Title of the song */
    title: string;
    /** Artist of the song */
    artist: string[];
    /** Album of the song (optional) */
    album?: string;
}

export const PLAYLIST: Record<string, MusicMetadata> = {
    'ngoc-bao-khi': {
        id: 'ngoc-bao-khi',
        title: 'NGỌC BẢO KHÍ',
        artist: ['SINO'],
    },
    'chang-trai-bat-tinh': {
        id: 'chang-trai-bat-tinh',
        title: 'CHÀNG TRAI BẤT TỬ',
        artist: ['SINO', 'AN VU', 'MKM'],
    },
    'hinh-hai-trong-mat-anh': {
        id: 'hinh-hai-trong-mat-anh',
        title: 'HÌNH HÀI TRONG MẮT ANH',
        artist: ['SINO', '1NG', 'OVALKID'],
    },
    'khien-anh-mo-long': {
        id: 'khien-anh-mo-long',
        title: 'KHIẾN ANH MỞ LÒNG',
        artist: ['SINO', 'DARKI', 'OVALKID'],
    },
    'khong-the-co': {
        id: 'khong-the-co',
        title: 'KHÔNG THỂ CỐ',
        artist: ['SINO', 'HAYHO', 'KHANG.', 'OVALKID'],
    },
    'ngay-em-den': {
        id: 'ngay-em-den',
        title: 'NGÀY EM ĐẾN',
        artist: ['SINO', 'KHANG.', 'MKM'],
    },
    'tam-su-voi-em-sau-nay': {
        id: 'tam-su-voi-em-sau-nay',
        title: 'TÂM SỰ VỚI EM SAU NÀY',
        artist: ['SINO', 'NGUYEN.', 'MKM'],
    },
    'yeu-em-trong-mo': {
        id: 'yeu-em-trong-mo',
        title: 'YÊU EM TRONG MƠ',
        artist: ['SINO', 'KAI', 'AN VU'],
    },
    'yeu-trong-co-doc': {
        id: 'yeu-trong-co-doc',
        title: 'YÊU TRONG CÔ ĐỘC',
        artist: ['SINO', 'KAI', 'LIL TIAN', 'HOANG JEMI'],
    }
}