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
        dob: '??/??',
        description: 'Một linh hồn cổ xưa từ chối đầu thai, chọn ở lại nơi trần thế. Bà lặng lẽ dẫn lối, bảo vệ con người khỏi những tai ương và hiểm họa tâm linh vô hình',
        imageUrl: '/images/brand-equity/Ma ba dong COMPOSITED 2.webp',
        imageW: 1927, imageH: 3240,
    },
    'vu': {
        id: 'vu',
        name: 'Vũ',
        dob: '03/06',
        description: 'Một chàng sinh viên với đam mê âm nhạc, nhưng cuộc sống không dễ dàng. Vũ phải làm tài xế công nghệ để kiếm thêm thu nhập và vô tình gặp được tình yêu đời mình qua những chuyến đi. Tiếc thay, cô gái anh yêu khi ấy với anh như cỏ và mây. Tình yêu ngắt quãng khi cô rời đi du học. Mãi về sau, khi đã theo đuổi thành công con đường âm nhạc, Vũ có cơ hội gặp lại cô ở một khoảng cách gần hơn, để bắt đầu',
        imageUrl: '/images/brand-equity/A Vu COMPOSITED 2.webp',
        imageW: 783, imageH: 2560,
    },
    'heny': {
        id: 'heny',
        name: 'Heny',
        dob: '14/12',
        description: 'Một cô tiểu thư trẻ trung, tràn đầy năng lượng, luôn xuất hiện với vẻ ngoài rực rỡ và cuốn hút. Nhưng phía sau đó là một khoảng lặng cô đơn – nơi không phải ai cũng có thể chạm tới. Trong một giai đoạn của cuộc đời, Heny gặp Vũ và đem lòng yêu anh. Đó là quãng thời gian ngắn ngủi nhưng chân thành. Tình duyên ấy lại đơm hoa khi cô trở về sau khi du học và gặp anh một lần nữa',
        imageUrl: '/images/brand-equity/Heny COMPOSITED 2.webp',
        imageW: 950, imageH: 2560,
    },
    'hien-luong': {
        id: 'hien-luong',
        name: 'Hilary',
        dob: '01/09',
        description: 'Là một cô gái dễ thương và xinh xắn. Ở độ tuổi rực rỡ nhất, đáng ra Hilary phải được đón nhận những hạnh phúc trọn vẹn, nhưng cuộc sống đã lấy đi người cô yêu thương nhất. Trong những giây phút cuối cùng, cô đã ở bên, đồng hành và dành trọn tình yêu đẹp nhất của tuổi trẻ cho anh. Sau cơn mưa, Hilary vẫn mạnh mẽ đứng dậy, bước tiếp trên hành trình phía trước và sống thật hạnh phúc như di nguyện của “mặt trời”.',
        imageUrl: '/images/brand-equity/Hien luong COMPOSITED 2.webp',
        imageW: 766, imageH: 2560,
    },
    'ha': {
        id: 'ha',
        name: 'Sunny',
        dob: '28/03',
        description: 'Sunny là chàng trai ấm áp như mặt trời. Ở độ tuổi rực rỡ, anh có một tình yêu đẹp với Hilary – một cô gái xinh xắn. Nhưng mọi thứ không mãi hạnh phúc với Sunny. Đến một ngày, anh biết mình mắc bệnh nan y, không còn sống được lâu. Anh đã dành những khoảnh khắc cuối cùng để an ủi người mình yêu và gửi đến cô những lời chúc đẹp nhất. Dù đã tồn tại ở một hình dạng khác, anh vẫn luôn dõi theo và mỉm cười trước hạnh phúc của cô ấy trên chặng đường phía trước.',
        imageUrl: '/images/brand-equity/Ha COMPOSITED 2.webp',
        imageW: 824, imageH: 2560,
    },
    'sino': {
        id: 'sino',
        name: 'Sino',
        dob: '09/04',
        description: 'Là linh vật đại diện của Sino Studio ngay từ những ngày đầu hình thành, Sino không chỉ mang ý nghĩa nhận diện mà còn là tinh thần cốt lõi của tập thể. Trong series Tây Du Kí GenZ, Sino hóa thân thành Huyết Quỷ – một nhân vật trung tâm sở hữu sức mạnh vượt trội cùng chiều sâu nội tâm phức tạp.',
        imageUrl: '/images/brand-equity/Sino COMPOSITED 2.webp',
        imageW: 881, imageH: 1812,
    },
    'linh': {
        id: 'linh',
        name: 'Linh',
        dob: '23/02',
        description: 'Nhân vật trung tâm của Linh: Truy Hồn Âm Giới, Linh là cô gái trẻ giàu năng lượng nhưng mang đôi mắt nhìn thấu linh hồn. Cô từng che giấu khả năng ấy cho đến khi biến cố ập đến gia đình. Từ đó, Linh chấp nhận bản thân, bước vào hành trình tìm em trai và đối mặt với thế giới tâm linh mà cô đã từng trốn tránh',
        imageUrl: '/images/brand-equity/Linh COMPOSITED 2.webp',
        imageW: 1012, imageH: 2560,
    },
    'nachi': {
        id: 'nachi',
        name: 'Nachi',
        dob: '07/08',
        description: 'Sinh ra với bệnh bạch tạng, Nachi lớn lên trong sự xa cách và tổn thương. Sau một tai nạn, cô rơi vào hôn mê và lạc vào giấc mơ của Shino – nơi lần đầu cô được sống trong hạnh phúc. Nhưng khi cơ thể ngoài đời thực ngừng tồn tại, Nachi cũng buộc phải rời bỏ giấc mơ ấy mãi mãi.',
        imageUrl: '/images/brand-equity/Nachi COMPOSITED 2.webp',
        imageW: 1032, imageH: 2475,
    },
    'shino': {
        id: 'shino',
        name: 'Shino',
        dob: '09/04',
        description: 'Shino là một chàng trai trầm lặng, lạc lối giữa cuộc sống u tối. Ý nghĩa duy nhất của anh từng nằm trong những giấc mơ, nơi Nachi xuất hiện như một ánh sáng dịu dàng. Khi cô biến mất, Shino mới thấu hiểu những gì cô đã phải trải qua. Từ đó, anh trở thành một họa sĩ – dùng từng bức tranh để tôn lên vẻ đẹp của những người mắc bệnh bạch tạng, như một cách tiếp tục yêu thương Nachi và mang lại cho những người như cô một hạnh phúc mà họ xứng đáng có được.',
        imageUrl: '/images/brand-equity/Vu COMPOSITED 2.webp',
        imageW: 956, imageH: 2560,
    },
    'boss': {
        id: 'boss',
        name: 'Boss',
        dob: '13/06',
        description: 'Boss là một nhân vật hư cấu được tạo ra bởi Sino Studio, một con quái vật to lớn, mạnh mẽ và điên cuồng. Ở dự án ngắn Ngọc Bảo Khí, Boss như là trùm cuối và là thử thách lớn nhất của chiến binh đối diện.',
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